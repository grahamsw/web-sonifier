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
      { name: 'feedbackGain', defaultValue: 1.0, minValue: 0.0, maxValue: 2.5, automationRate: 'k-rate' },
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
      { name: 'cabinetHowl', defaultValue: 0.50, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'subBeating', defaultValue: 0.40, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'rumbleResonance', defaultValue: 0.5, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },

      // 7. Cone Excursion / Knocking
      { name: 'coneLimit', defaultValue: 0.6, minValue: 0.2, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'knockLevel', defaultValue: 0.4, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },

      // 8. Loop B
      { name: 'loop2Gain', defaultValue: 0.0, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'loop2Detune', defaultValue: 18.0, minValue: -50.0, maxValue: 50.0, automationRate: 'k-rate' },
      { name: 'loop2Distance', defaultValue: 7.0, minValue: 1.0, maxValue: 25.0, automationRate: 'k-rate' },
      { name: 'crossCoupling', defaultValue: 0.3, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' }
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

    // Pre-allocated string periods
    this.stringPeriods = new Float32Array(6)

    // Loop B String Delays
    this.stringBuffers2 = [
      new Float32Array(this.stringBufferSize),
      new Float32Array(this.stringBufferSize),
      new Float32Array(this.stringBufferSize),
      new Float32Array(this.stringBufferSize),
      new Float32Array(this.stringBufferSize),
      new Float32Array(this.stringBufferSize)
    ]
    this.stringWriteIndices2 = [0, 0, 0, 0, 0, 0]
    this.stringFilterStates2 = [0, 0, 0, 0, 0, 0]
    this.stringPeriods2 = new Float32Array(6)

    // Tuning preset ratios relative to basePitch
    this.tuningPreset = 'ostrich-d'
    this.tuningPreset2 = 'ostrich-d'
    this._updateTuningRatios()

    // Acoustic Propagation Delay Buffer (Speaker to Guitar)
    this.propBufferSize = 4096
    this.propBufferMask = this.propBufferSize - 1
    this.propBuffer = new Float32Array(this.propBufferSize)
    this.propWriteIndex = 0

    // Loop B Propagation Buffer
    this.propBuffer2 = new Float32Array(this.propBufferSize)
    this.propWriteIndex2 = 0

    // Power Amp Sag virtual bias capacitor state
    this.sagCharge = 0
    this.sagCharge2 = 0

    // Shriek bandpass filter state (biquad centered at 2.2 kHz)
    this.shriekX1 = 0
    this.shriekX2 = 0
    this.shriekY1 = 0
    this.shriekY2 = 0
    this._initShriekFilter(2200, 3.5)

    // Howl low-mid acoustic cabinet resonance filter (centered at 135 Hz)
    this.howlX1 = 0
    this.howlX2 = 0
    this.howlY1 = 0
    this.howlY2 = 0
    this._initHowlFilter(135, 1.8)

    // 12" Guitar Speaker Cabinet Lowpass Filters (2.8 kHz rolloff for acoustic feedback)
    this.spkX1 = 0
    this.spkX2 = 0
    this.spkY1 = 0
    this.spkY2 = 0
    this.spkX12 = 0
    this.spkX22 = 0
    this.spkY12 = 0
    this.spkY22 = 0
    this._initSpeakerFilter(2800, 0.707)

    // Physical wound string mass weighting over pickups
    this.stringWeights = new Float32Array([2.4, 2.0, 1.8, 1.2, 1.0, 0.9])

    // 4-Mode Resonant Filter Bank (Rumble & Body)
    this.rumbleX1 = new Float32Array(4)
    this.rumbleX2 = new Float32Array(4)
    this.rumbleY1 = new Float32Array(4)
    this.rumbleY2 = new Float32Array(4)
    this.lastBasePitch = 0
    this._updateRumbleFilters(73.416)

    // 55 Hz Acoustic Speaker Cone Knock Resonator (damped sine burst)
    this.coneDisplacement = 0
    this.knockAmp = 0
    this.knockPhase = 0
    this.knockPhaseStep = (2 * Math.PI * 55.0) / this.sampleRate

    // DC Blocking state for asymmetric overdrive
    this.overdriveDcX = 0
    this.overdriveDcY = 0
    this.overdriveDcX2 = 0
    this.overdriveDcY2 = 0

    // DC Blocking state for strings and pickup
    this.stringDcX = new Float32Array(6)
    this.stringDcY = new Float32Array(6)
    this.pickupX1 = 0
    this.pickupY1 = 0

    // Loop B DC Blocking
    this.stringDcX2 = new Float32Array(6)
    this.stringDcY2 = new Float32Array(6)
    this.pickupX12 = 0
    this.pickupY12 = 0

    // Port messages
    this.port.onmessage = (event) => {
      const data = event.data
      if (data && data.type === 'tuning') {
        this.tuningPreset = data.preset || 'ostrich-d'
        this.tuningPreset2 = this.tuningPreset
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

  _initHowlFilter(centerFreq, Q) {
    const w0 = (2 * Math.PI * centerFreq) / this.sampleRate
    const alpha = Math.sin(w0) / (2 * Q)
    const b0 = alpha
    const b1 = 0
    const b2 = -alpha
    const a0 = 1 + alpha
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha

    this.hb0 = b0 / a0
    this.hb1 = b1 / a0
    this.hb2 = b2 / a0
    this.ha1 = a1 / a0
    this.ha2 = a2 / a0
  }

  _initSpeakerFilter(cutoffFreq, Q) {
    const w0 = (2 * Math.PI * cutoffFreq) / this.sampleRate
    const alpha = Math.sin(w0) / (2 * Q)
    const cos = Math.cos(w0)
    const a0 = 1 + alpha

    this.spkB0 = ((1 - cos) / 2) / a0
    this.spkB1 = (1 - cos) / a0
    this.spkB2 = ((1 - cos) / 2) / a0
    this.spkA1 = (-2 * cos) / a0
    this.spkA2 = (1 - alpha) / a0
  }

  _initBiquadBP(centerFreq, Q) {
    const w0 = (2 * Math.PI * centerFreq) / this.sampleRate
    const alpha = Math.sin(w0) / (2 * Q)
    const b0 = alpha
    const b1 = 0
    const b2 = -alpha
    const a0 = 1 + alpha
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha

    return {
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0
    }
  }

  _updateRumbleFilters(basePitch) {
    const f0 = Math.max(30.0, basePitch)
    const f1 = Math.min(this.sampleRate * 0.45, f0 * 2.0)
    const f2 = Math.min(this.sampleRate * 0.45, f0 * 3.0)
    const fBox = 82.0 // cabinet wood box mode
    this.rumbleCoeffs = [
      this._initBiquadBP(f0, 1.5),
      this._initBiquadBP(f1, 1.5),
      this._initBiquadBP(f2, 1.6),
      this._initBiquadBP(fBox, 2.0)
    ]
    this.lastBasePitch = basePitch
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
    this.tuningIntervals2 = [...this.tuningIntervals]
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
    const cabinetHowl = parameters.cabinetHowl ? parameters.cabinetHowl[0] : 0.50
    const subBeating = parameters.subBeating ? parameters.subBeating[0] : 0.40
    const rumbleResonance = parameters.rumbleResonance ? parameters.rumbleResonance[0] : 0.5
    const coneLimit = parameters.coneLimit ? parameters.coneLimit[0] : 0.6
    const knockLevel = parameters.knockLevel ? parameters.knockLevel[0] : 0.4
    const loop2Gain = parameters.loop2Gain ? parameters.loop2Gain[0] : 0.0
    const loop2Detune = parameters.loop2Detune ? parameters.loop2Detune[0] : 18.0
    const loop2Distance = parameters.loop2Distance ? parameters.loop2Distance[0] : 7.0
    const crossCoupling = parameters.crossCoupling ? parameters.crossCoupling[0] : 0.3

    // Update body resonance filters if basePitch changed
    if (Math.abs(basePitch - this.lastBasePitch) > 0.1) {
      this._updateRumbleFilters(basePitch)
    }

    // Sag recovery bleed and dynamic attack coefficients
    const recoverySec = Math.max(0.015, sagRecovery / 1000.0)
    const sagBleed = Math.exp(-1.0 / (this.sampleRate * recoverySec))
    const sagAttack = 1.0 - Math.exp(-1.0 / (this.sampleRate * 0.035))

    // Compute period in samples for each string with microtonal detuning spread
    const stringPeriods = this.stringPeriods
    const stringPeriods2 = this.stringPeriods2
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

      const ratio2 = this.tuningIntervals2[s] * Math.pow(2.0, (detuneCents[s] + loop2Detune) / 1200.0)
      const freq2 = Math.min(this.sampleRate * 0.45, Math.max(20.0, basePitch * ratio2))
      stringPeriods2[s] = this.sampleRate / freq2
    }

    // Acoustic distance delay in samples + pickup micro-angle
    // ~1ms to 25ms delay (approx 1ft to 25ft acoustic room coupling)
    const angleOffset = Math.sin(pickupAngle * Math.PI) * 8.0
    const propDelaySamples = Math.max(4.0, (couplingDistance * 0.001 * this.sampleRate) + angleOffset)
    const propDelaySamples2 = Math.max(4.0, (loop2Distance * 0.001 * this.sampleRate) + angleOffset)

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
      const readA = (this.propWriteIndex - propDelaySamples + this.propBufferSize * 4) % this.propBufferSize
      let intProp = Math.floor(readA); let fracProp = readA - intProp
      let nextProp = (intProp + 1) & this.propBufferMask
      const a_from_A = this.propBuffer[intProp] * (1 - fracProp) + this.propBuffer[nextProp] * fracProp

      const readA2 = (this.propWriteIndex2 - propDelaySamples + this.propBufferSize * 4) % this.propBufferSize
      intProp = Math.floor(readA2); fracProp = readA2 - intProp
      nextProp = (intProp + 1) & this.propBufferMask
      const a_from_B = this.propBuffer2[intProp] * (1 - fracProp) + this.propBuffer2[nextProp] * fracProp
      
      const acousticFeedback = a_from_A * feedbackGain + a_from_B * crossCoupling * 0.3

      const readB = (this.propWriteIndex2 - propDelaySamples2 + this.propBufferSize * 4) % this.propBufferSize
      intProp = Math.floor(readB); fracProp = readB - intProp
      nextProp = (intProp + 1) & this.propBufferMask
      const b_from_B = this.propBuffer2[intProp] * (1 - fracProp) + this.propBuffer2[nextProp] * fracProp

      const readB2 = (this.propWriteIndex - propDelaySamples2 + this.propBufferSize * 4) % this.propBufferSize
      intProp = Math.floor(readB2); fracProp = readB2 - intProp
      nextProp = (intProp + 1) & this.propBufferMask
      const b_from_A = this.propBuffer[intProp] * (1 - fracProp) + this.propBuffer[nextProp] * fracProp

      const acousticFeedback2 = b_from_B * feedbackGain + b_from_A * crossCoupling * 0.3

      // 3. Acoustic Resonances: Low-Mid Cabinet Howl (135 Hz animal roar) & High Shriek (2.2 kHz)
      const howlIn = acousticFeedback
      const howlBand = this.hb0 * howlIn + this.hb1 * this.howlX1 + this.hb2 * this.howlX2
        - this.ha1 * this.howlY1 - this.ha2 * this.howlY2
      this.howlX2 = this.howlX1
      this.howlX1 = howlIn
      this.howlY2 = this.howlY1
      this.howlY1 = howlBand

      const shriekIn = acousticFeedback
      const shriekBand = this.sb0 * shriekIn + this.sb1 * this.shriekX1 + this.sb2 * this.shriekX2
        - this.sa1 * this.shriekY1 - this.sa2 * this.shriekY2
      this.shriekX2 = this.shriekX1
      this.shriekX1 = shriekIn
      this.shriekY2 = this.shriekY1
      this.shriekY1 = shriekBand

      // Direct acoustic feedback path (Cabinet Howl + High Shriek)
      const directAcousticFeedback = acousticFeedback + (howlBand * cabinetHowl * 2.5) + (shriekBand * harmonicShriek * 1.5)
      const directAcousticFeedback2 = acousticFeedback2 + (howlBand * cabinetHowl * 2.5) + (shriekBand * harmonicShriek * 1.5)

      // Total sound pressure driving parallel sympathetic strings
      const stringExcitation = (ampFloor * 0.08) + (directAcousticFeedback * 0.015)
      const stringExcitation2 = (ampFloor * 0.08) + (directAcousticFeedback2 * 0.015)

      // 4. Update 6-String Karplus-Strong Resonator Bank (Loop A)
      let sumStringL = 0.0
      let sumStringR = 0.0
      let lowStringSignal = 0.0

      for (let s = 0; s < 6; s++) {
        const pLen = stringPeriods[s]
        const buf = this.stringBuffers[s]
        const wIdx = this.stringWriteIndices[s]

        const readPos = (wIdx - pLen + this.stringBufferSize * 4) % this.stringBufferSize
        const intPos = Math.floor(readPos)
        const frac = readPos - intPos
        const nextPos = (intPos + 1) & this.stringBufferMask
        const delayedSample = buf[intPos] * (1 - frac) + buf[nextPos] * frac

        const dampAlpha = Math.min(0.85, Math.max(0.08, 1.0 - stringDamping * 0.45))
        this.stringFilterStates[s] = delayedSample * dampAlpha + this.stringFilterStates[s] * (1 - dampAlpha)

        // R = 0.9997 preserves low-frequency fundamentals
        const lpOut = this.stringFilterStates[s]
        const dcBlocked = lpOut - this.stringDcX[s] + 0.9997 * this.stringDcY[s]
        this.stringDcX[s] = lpOut
        this.stringDcY[s] = dcBlocked

        const stringOut = Math.tanh(dcBlocked * 1.2) / 1.2
        const stringSustain = 0.994
        
        buf[wIdx] = (stringOut * stringSustain) + (stringExcitation * 0.75)
        this.stringWriteIndices[s] = (wIdx + 1) & this.stringBufferMask

        sumStringL += stringOut * panWeights[s][0] * this.stringWeights[s]
        sumStringR += stringOut * panWeights[s][1] * this.stringWeights[s]

        if (s === 0) lowStringSignal = stringOut
      }

      // Update Loop B Resonator Bank
      let sumStringL2 = 0.0
      let sumStringR2 = 0.0
      
      for (let s = 0; s < 6; s++) {
        // reversed stereo panning for Loop B
        const panL = panWeights[s][1]
        const panR = panWeights[s][0]

        const pLen = stringPeriods2[s]
        const buf = this.stringBuffers2[s]
        const wIdx = this.stringWriteIndices2[s]

        const readPos = (wIdx - pLen + this.stringBufferSize * 4) % this.stringBufferSize
        const intPos = Math.floor(readPos)
        const frac = readPos - intPos
        const nextPos = (intPos + 1) & this.stringBufferMask
        const delayedSample = buf[intPos] * (1 - frac) + buf[nextPos] * frac

        const dampAlpha = Math.min(0.85, Math.max(0.08, 1.0 - stringDamping * 0.45))
        this.stringFilterStates2[s] = delayedSample * dampAlpha + this.stringFilterStates2[s] * (1 - dampAlpha)

        const lpOut = this.stringFilterStates2[s]
        const dcBlocked = lpOut - this.stringDcX2[s] + 0.9997 * this.stringDcY2[s]
        this.stringDcX2[s] = lpOut
        this.stringDcY2[s] = dcBlocked

        const stringOut = Math.tanh(dcBlocked * 1.2) / 1.2
        const stringSustain = 0.994

        buf[wIdx] = (stringOut * stringSustain) + (stringExcitation2 * 0.75)
        this.stringWriteIndices2[s] = (wIdx + 1) & this.stringBufferMask

        sumStringL2 += stringOut * panL * this.stringWeights[s]
        sumStringR2 += stringOut * panR * this.stringWeights[s]
      }

      // 5. Guitar Pickups & Cranked Amplifier Preamp
      const rawPickup = (sumStringL + sumStringR) * 0.25
      const pickupSignal = rawPickup - this.pickupX1 + 0.995 * this.pickupY1
      this.pickupX1 = rawPickup
      this.pickupY1 = pickupSignal

      // Direct acoustic cabinet feedback AND sympathetic strings enter cranked preamp
      const ampInput = (directAcousticFeedback * 0.70 + pickupSignal * 0.75) * (1.0 + feedbackGain * 1.6) + ampFloor
      const absSig = Math.abs(ampInput)

      const rawPickup2 = (sumStringL2 + sumStringR2) * 0.25
      const pickupSignal2 = rawPickup2 - this.pickupX12 + 0.995 * this.pickupY12
      this.pickupX12 = rawPickup2
      this.pickupY12 = pickupSignal2

      const ampInput2 = (directAcousticFeedback2 * 0.70 + pickupSignal2 * 0.75) * (1.0 + feedbackGain * 1.6) + ampFloor
      const absSig2 = Math.abs(ampInput2)

      // 6. Power Amp Sag & Asymmetric Tube Overdrive ("The Valve On/Off" + Heterodyne Roar Engine)
      const overload = Math.max(0.0, absSig - sagThreshold)
      const targetCharge = Math.min(1.0, overload * 1.5)
      if (targetCharge > this.sagCharge) {
        this.sagCharge += (targetCharge - this.sagCharge) * sagAttack
      } else {
        this.sagCharge *= sagBleed
      }
      const sagGainReduction = Math.max(0.35, 1.0 - this.sagCharge * sagDepth * 0.65)

      // Asymmetric tube transfer curve: the quadratic term (v^2) creates f2 - f1 heterodyne difference frequencies
      const asymCoeff = 0.20 + subBeating * 0.45
      const asymInput = ampInput + (asymCoeff * ampInput * ampInput)
      const rawOverdriven = Math.tanh(asymInput * 1.8) * sagGainReduction
      // DC blocker removes bias shift while preserving sub-bass down to 20Hz
      const overdriven = rawOverdriven - this.overdriveDcX + 0.997 * this.overdriveDcY
      this.overdriveDcX = rawOverdriven
      this.overdriveDcY = overdriven

      // Loop B Asymmetric Tube Overdrive
      const overload2 = Math.max(0.0, absSig2 - sagThreshold)
      const targetCharge2 = Math.min(1.0, overload2 * 1.5)
      if (targetCharge2 > this.sagCharge2) {
        this.sagCharge2 += (targetCharge2 - this.sagCharge2) * sagAttack
      } else {
        this.sagCharge2 *= sagBleed
      }
      const sagGainReduction2 = Math.max(0.35, 1.0 - this.sagCharge2 * sagDepth * 0.65)
      const asymInput2 = ampInput2 + (asymCoeff * ampInput2 * ampInput2)
      const rawOverdriven2 = Math.tanh(asymInput2 * 1.8) * sagGainReduction2
      const overdriven2 = rawOverdriven2 - this.overdriveDcX2 + 0.997 * this.overdriveDcY2
      this.overdriveDcX2 = rawOverdriven2
      this.overdriveDcY2 = overdriven2

      // 7. 12" Speaker Cabinet Rolloff before writing to room propagation buffer
      // Real guitar speakers roll off > 3 kHz, allowing the low-mid cabinet resonance to dominate
      const spkOut = this.spkB0 * overdriven + this.spkB1 * this.spkX1 + this.spkB2 * this.spkX2
        - this.spkA1 * this.spkY1 - this.spkA2 * this.spkY2
      this.spkX2 = this.spkX1
      this.spkX1 = overdriven
      this.spkY2 = this.spkY1
      this.spkY1 = spkOut
      this.propBuffer[this.propWriteIndex] = spkOut
      this.propWriteIndex = (this.propWriteIndex + 1) & this.propBufferMask

      const spkOut2 = this.spkB0 * overdriven2 + this.spkB1 * this.spkX12 + this.spkB2 * this.spkX22
        - this.spkA1 * this.spkY12 - this.spkA2 * this.spkY22
      this.spkX22 = this.spkX12
      this.spkX12 = overdriven2
      this.spkY22 = this.spkY12
      this.spkY12 = spkOut2
      this.propBuffer2[this.propWriteIndex2] = spkOut2
      this.propWriteIndex2 = (this.propWriteIndex2 + 1) & this.propBufferMask

      // 8. Low Rumble & Musically-Aligned Resonant Body Filter Bank
      const subProduct = humSig * lowStringSignal * subBeating * 2.0
      const thumpIn = overdriven + subProduct

      let sumRumble = 0.0
      for (let f = 0; f < 4; f++) {
        const c = this.rumbleCoeffs[f]
        const filterOut = c.b0 * thumpIn + c.b1 * this.rumbleX1[f] + c.b2 * this.rumbleX2[f]
          - c.a1 * this.rumbleY1[f] - c.a2 * this.rumbleY2[f]
        this.rumbleX2[f] = this.rumbleX1[f]
        this.rumbleX1[f] = thumpIn
        this.rumbleY2[f] = this.rumbleY1[f]
        this.rumbleY1[f] = filterOut
        sumRumble += filterOut
      }
      const rumbleSignal = sumRumble * (0.5 + rumbleResonance * 1.5) * cabinetThump * 0.9

      // 9. Speaker Cone Excursion & 55 Hz Acoustic Knock Resonator
      this.coneDisplacement += (Math.abs(overdriven) - this.coneDisplacement) * 0.008
      if (this.coneDisplacement > coneLimit) {
        this.knockAmp = knockLevel * 0.6
        this.knockPhase = 0
        this.coneDisplacement *= 0.5 // mechanical energy discharge
      }
      let knockSignal = 0.0
      if (this.knockAmp > 0.0005) {
        knockSignal = this.knockAmp * Math.sin(this.knockPhase)
        this.knockPhase += this.knockPhaseStep
        this.knockAmp *= 0.9975 // ~35ms acoustic decay ring
      }

      // 10. Output to Speakers (True acoustic speaker radiation with master saturation)
      const rawL = (overdriven * 0.40 + sumStringL * 0.15 + rumbleSignal * 0.35 + knockSignal * 0.30 + ampFloor * 0.12)
                 + (overdriven2 * 0.40 + sumStringL2 * 0.15) * loop2Gain * 0.7
      const rawR = (overdriven * 0.40 + sumStringR * 0.15 + rumbleSignal * 0.35 + knockSignal * 0.30 + ampFloor * 0.12)
                 + (overdriven2 * 0.40 + sumStringR2 * 0.15) * loop2Gain * 0.7

      left[i] = Math.tanh(rawL)
      right[i] = Math.tanh(rawR)
    }

    return true
  }
}

registerProcessor('mmm-lab-processor', MMMLabProcessor)
