/**
 * MMMLabProcessor.js
 * 
 * AudioWorkletProcessor for Metal Machine Lab:
 * - Idling tube amp floor (60Hz transformer hum + 120/180Hz ripple + thermal hiss)
 * - 6-string Karplus-Strong physical comb resonator bank
 * - Tuning presets: Lou Reed Ostrich D, Open D, Standard E
 * - Acoustic feedback coupling with physical propagation delay
 * - Tube amplifier power sag / blocking distortion model ("valve on/off" flutter)
 * - Shriek harmonic peaking node & pitch bending
 * - Cabinet thump & sub-harmonic beating
 */

class MMMLabProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      // 1. Idling Amp Floor
      { name: 'ampHum', defaultValue: 0.35, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'ampHiss', defaultValue: 0.20, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },

      // 2. Guitar Strings & Tunings
      { name: 'basePitch', defaultValue: 73.416, minValue: 40.0, maxValue: 150.0, automationRate: 'k-rate' },
      { name: 'detuneSpread', defaultValue: 6.0, minValue: -50.0, maxValue: 50.0, automationRate: 'k-rate' },
      { name: 'stringDamping', defaultValue: 0.25, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },

      // 3. Acoustic Feedback Loop
      { name: 'feedbackGain', defaultValue: 0.98, minValue: 0.0, maxValue: 1.30, automationRate: 'k-rate' },
      { name: 'couplingDistance', defaultValue: 4.0, minValue: 1.0, maxValue: 25.0, automationRate: 'k-rate' },

      // 4. Power Amp Sag & Choke
      { name: 'sagThreshold', defaultValue: 0.65, minValue: 0.15, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'sagDepth', defaultValue: 0.80, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'sagRecovery', defaultValue: 160.0, minValue: 20.0, maxValue: 500.0, automationRate: 'k-rate' },

      // 5. Shriek & Harmonic Bending
      { name: 'harmonicShriek', defaultValue: 0.40, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'pickupAngle', defaultValue: 0.30, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },

      // 6. Low Rumble & Cabinet Resonance
      { name: 'cabinetThump', defaultValue: 0.50, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'subBeating', defaultValue: 0.40, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' }
    ]
  }

  constructor() {
    super()

    this.sampleRate = globalThis.sampleRate || 44100

    // Hum phase & step
    this.humPhase = 0
    this.humPhaseStep = (2 * Math.PI * 60.0) / this.sampleRate

    // Thermal hiss 1-pole filter state
    this.hissState = 0

    // 6 Guitar String Delays (size 8192 per string)
    this.stringBufferSize = 8192
    this.stringBufferMask = this.stringBufferSize - 1
    this.stringBuffers = [
      new Float32Array(this.stringBufferSize),
      new Float32Array(this.stringBufferSize),
      new Float32Array(this.stringBufferSize),
      new Float32Array(this.stringBufferSize),
      new Float32Array(this.stringBufferSize),
      new Float32Array(this.stringBufferSize)
    ]
    this.stringWriteIndices = [0, 0, 0, 0, 0, 0]
    this.stringFilterStates = [0, 0, 0, 0, 0, 0]

    // Tuning preset ratios relative to basePitch
    this.tuningPreset = 'ostrich-d'
    this._updateTuningRatios()

    // Acoustic Propagation Delay Buffer (Speaker to Guitar)
    this.propBufferSize = 4096
    this.propBufferMask = this.propBufferSize - 1
    this.propBuffer = new Float32Array(this.propBufferSize)
    this.propWriteIndex = 0

    // Power Amp Sag virtual bias capacitor state
    this.sagCharge = 0

    // Shriek bandpass filter state (biquad centered at 2.2 kHz)
    this.shriekX1 = 0
    this.shriekX2 = 0
    this.shriekY1 = 0
    this.shriekY2 = 0
    this._initShriekFilter(2200, 3.5)

    // Cabinet Thump resonant filter state (biquad centered at 76 Hz)
    this.thumpX1 = 0
    this.thumpX2 = 0
    this.thumpY1 = 0
    this.thumpY2 = 0
    this._initThumpFilter(76, 4.0)

    // Port messages
    this.port.onmessage = (event) => {
      const data = event.data
      if (data && data.type === 'tuning') {
        this.tuningPreset = data.preset || 'ostrich-d'
        this._updateTuningRatios()
      }
    }
  }

  _initShriekFilter(centerFreq, Q) {
    const w0 = (2 * Math.PI * centerFreq) / this.sampleRate
    const alpha = Math.sin(w0) / (2 * Q)
    const b0 = alpha
    const b1 = 0
    const b2 = -alpha
    const a0 = 1 + alpha
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha

    this.sb0 = b0 / a0
    this.sb1 = b1 / a0
    this.sb2 = b2 / a0
    this.sa1 = a1 / a0
    this.sa2 = a2 / a0
  }

  _initThumpFilter(centerFreq, Q) {
    const w0 = (2 * Math.PI * centerFreq) / this.sampleRate
    const alpha = Math.sin(w0) / (2 * Q)
    const b0 = alpha
    const b1 = 0
    const b2 = -alpha
    const a0 = 1 + alpha
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha

    this.tb0 = b0 / a0
    this.tb1 = b1 / a0
    this.tb2 = b2 / a0
    this.ta1 = a1 / a0
    this.ta2 = a2 / a0
  }

  _updateTuningRatios() {
    switch (this.tuningPreset) {
      case 'open-d':
        // Open D: D1, A1, D2, F#2, A2, D3
        this.tuningIntervals = [1.0, 1.4983, 2.0, 2.5198, 2.9966, 4.0]
        break
      case 'standard-e':
        // Standard E: E, A, D, G, B, E
        this.tuningIntervals = [1.0, 1.3348, 1.7818, 2.3784, 2.9966, 4.0]
        break
      case 'ostrich-d':
      default:
        // Lou Reed Ostrich D: D1, D2, D2, D3, D3, D3
        this.tuningIntervals = [1.0, 2.0, 2.0, 4.0, 4.0, 4.0]
        break
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]
    if (!output || output.length < 2) return true

    const left = output[0]
    const right = output[1]
    const numSamples = left.length

    // 1. Extract k-rate parameters
    const ampHum = parameters.ampHum ? parameters.ampHum[0] : 0.35
    const ampHiss = parameters.ampHiss ? parameters.ampHiss[0] : 0.20
    const basePitch = parameters.basePitch ? parameters.basePitch[0] : 73.416
    const detuneSpread = parameters.detuneSpread ? parameters.detuneSpread[0] : 6.0
    const stringDamping = parameters.stringDamping ? parameters.stringDamping[0] : 0.25
    const feedbackGain = parameters.feedbackGain ? parameters.feedbackGain[0] : 0.98
    const couplingDistance = parameters.couplingDistance ? parameters.couplingDistance[0] : 4.0
    const sagThreshold = parameters.sagThreshold ? parameters.sagThreshold[0] : 0.65
    const sagDepth = parameters.sagDepth ? parameters.sagDepth[0] : 0.80
    const sagRecovery = parameters.sagRecovery ? parameters.sagRecovery[0] : 160.0
    const harmonicShriek = parameters.harmonicShriek ? parameters.harmonicShriek[0] : 0.40
    const pickupAngle = parameters.pickupAngle ? parameters.pickupAngle[0] : 0.30
    const cabinetThump = parameters.cabinetThump ? parameters.cabinetThump[0] : 0.50
    const subBeating = parameters.subBeating ? parameters.subBeating[0] : 0.40

    // Sag recovery bleed coefficient
    const recoverySec = Math.max(0.015, sagRecovery / 1000.0)
    const sagBleed = Math.exp(-1.0 / (this.sampleRate * recoverySec))

    // Compute period in samples for each string with microtonal detuning spread
    const stringPeriods = new Float32Array(6)
    const detuneCents = [
      -detuneSpread * 0.8,
      detuneSpread * 0.5,
      -detuneSpread * 0.3,
      detuneSpread * 0.9,
      -detuneSpread * 1.1,
      detuneSpread * 1.4
    ]

    for (let s = 0; s < 6; s++) {
      const ratio = this.tuningIntervals[s] * Math.pow(2.0, detuneCents[s] / 1200.0)
      const freq = Math.min(this.sampleRate * 0.45, Math.max(20.0, basePitch * ratio))
      stringPeriods[s] = this.sampleRate / freq
    }

    // Acoustic distance delay in samples + pickup micro-angle
    const propDelaySamples = Math.max(2.0, Math.min(this.propBufferSize - 2,
      (couplingDistance / 1000.0) * this.sampleRate + (pickupAngle * 0.0012 * this.sampleRate)
    ))

    // String stereo panning positions (from string 0 left to string 5 right)
    const panWeights = [
      [0.85, 0.15],
      [0.70, 0.30],
      [0.55, 0.45],
      [0.45, 0.55],
      [0.30, 0.70],
      [0.15, 0.85]
    ]

    for (let i = 0; i < numSamples; i++) {
      // 1. Idling Tube Amp Noise Floor (Hum & Hiss)
      this.humPhase += this.humPhaseStep
      if (this.humPhase > 2 * Math.PI) this.humPhase -= 2 * Math.PI

      const humSig = Math.sin(this.humPhase) +
        0.42 * Math.sin(this.humPhase * 2) +
        0.22 * Math.sin(this.humPhase * 3) +
        0.10 * Math.sin(this.humPhase * 5)

      // Warm 1-pole lowpass thermal tube hiss
      const rawNoise = (Math.random() * 2 - 1)
      this.hissState += 0.28 * (rawNoise - this.hissState)

      const ampFloor = (humSig * 0.07 * ampHum) + (this.hissState * 0.035 * ampHiss)

      // 2. Read Acoustic Feedback from Speaker Propagation Delay
      const readProp = (this.propWriteIndex - propDelaySamples + this.propBufferSize * 4) % this.propBufferSize
      const intProp = Math.floor(readProp)
      const fracProp = readProp - intProp
      const nextProp = (intProp + 1) & this.propBufferMask
      const rawSpeakerAcoustic = this.propBuffer[intProp] * (1 - fracProp) + this.propBuffer[nextProp] * fracProp
      const acousticFeedback = rawSpeakerAcoustic * feedbackGain

      // 3. Shriek High-Harmonic Peaking Node (2.2 kHz overtone resonance)
      const shriekIn = acousticFeedback
      const shriekBand = this.sb0 * shriekIn + this.sb1 * this.shriekX1 + this.sb2 * this.shriekX2
        - this.sa1 * this.shriekY1 - this.sa2 * this.shriekY2
      this.shriekX2 = this.shriekX1
      this.shriekX1 = shriekIn
      this.shriekY2 = this.shriekY1
      this.shriekY1 = shriekBand

      // High frequency overtone emphasis injected back into strings
      const feedbackWithShriek = acousticFeedback + (shriekBand * harmonicShriek * 3.0)

      // Total excitation driving the guitar strings:
      // Hum drives strings continuously; acoustic feedback drives strings into resonance
      const stringExcitation = (ampFloor * 0.25) + (feedbackWithShriek * 0.45)

      // 4. Update 6-String Karplus-Strong Resonator Bank
      let sumStringL = 0.0
      let sumStringR = 0.0
      let lowStringSignal = 0.0

      for (let s = 0; s < 6; s++) {
        const pLen = stringPeriods[s]
        const buf = this.stringBuffers[s]
        const wIdx = this.stringWriteIndices[s]

        // Read fractional delay
        const readPos = (wIdx - pLen + this.stringBufferSize * 4) % this.stringBufferSize
        const intPos = Math.floor(readPos)
        const frac = readPos - intPos
        const nextPos = (intPos + 1) & this.stringBufferMask
        const delayedSample = buf[intPos] * (1 - frac) + buf[nextPos] * frac

        // One-pole loop damping filter (lower damping = brighter, longer ring)
        const dampAlpha = Math.min(0.85, Math.max(0.08, 1.0 - stringDamping * 0.45))
        this.stringFilterStates[s] = delayedSample * dampAlpha + this.stringFilterStates[s] * (1 - dampAlpha)

        // Physical string displacement saturation: steel strings softly saturate under high amplitude
        const stringOut = Math.tanh(this.stringFilterStates[s] * 1.2) / 1.2

        // Per-period string sustain
        const stringSustain = 0.9992
        buf[wIdx] = (stringOut * stringSustain) + (stringExcitation * 0.75)
        this.stringWriteIndices[s] = (wIdx + 1) & this.stringBufferMask

        // Sum into stereo mix
        sumStringL += stringOut * panWeights[s][0]
        sumStringR += stringOut * panWeights[s][1]

        if (s === 0) lowStringSignal = stringOut
      }

      // 5. Guitar Pickups & Cranked Amplifier Preamp
      const pickupSignal = (sumStringL + sumStringR) * 0.5
      // Preamp boosts guitar signal into power amp
      const ampInput = (pickupSignal * (1.8 + feedbackGain * 2.2)) + ampFloor
      const absSig = Math.abs(ampInput)

      // 6. Power Amp Sag & Choking Model ("The Valve On/Off")
      // Bounded grid capacitor with fast attack (~8ms) and variable bleed recovery
      const overload = Math.max(0.0, absSig - sagThreshold)
      const targetCharge = Math.min(1.0, overload * 1.5)
      if (targetCharge > this.sagCharge) {
        this.sagCharge += (targetCharge - this.sagCharge) * 0.004
      } else {
        this.sagCharge *= sagBleed
      }

      // Dynamic tube gain reduction from bias shift
      const sagGainReduction = Math.max(0.05, 1.0 - this.sagCharge * sagDepth)

      // Non-linear tube overdrive / saturation
      const overdriven = Math.tanh(ampInput * 1.9) * sagGainReduction

      // 7. Write Saturated Output into Speaker Propagation Delay
      this.propBuffer[this.propWriteIndex] = overdriven
      this.propWriteIndex = (this.propWriteIndex + 1) & this.propBufferMask

      // 8. Low Rumble & Cabinet Thump
      // Intermodulation difference product between 60Hz hum and low string
      const subProduct = humSig * lowStringSignal * subBeating * 2.0

      // 76Hz resonant cabinet air-cavity filter
      const thumpIn = overdriven + subProduct
      const thumpResonance = this.tb0 * thumpIn + this.tb1 * this.thumpX1 + this.tb2 * this.thumpX2
        - this.ta1 * this.thumpY1 - this.ta2 * this.thumpY2
      this.thumpX2 = this.thumpX1
      this.thumpX1 = thumpIn
      this.thumpY2 = this.thumpY1
      this.thumpY1 = thumpResonance

      const rumbleSignal = thumpResonance * cabinetThump * 0.9

      // 9. Output to Speakers (overdriven amp + guitar resonance + cabinet thump + hum floor)
      left[i] = (overdriven * 0.50 + sumStringL * 0.20 + rumbleSignal * 0.35 + ampFloor * 0.20)
      right[i] = (overdriven * 0.50 + sumStringR * 0.20 + rumbleSignal * 0.35 + ampFloor * 0.20)
    }

    return true
  }
}

registerProcessor('mmm-lab-processor', MMMLabProcessor)
