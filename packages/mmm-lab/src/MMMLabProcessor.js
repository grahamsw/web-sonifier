/**
 * MMMLabProcessor.js
 * 
 * Authentic Physical Model AudioWorkletProcessor for Metal Machine Lab:
 * - Dual guitar-amplifier feedback stacks in room acoustic environment (Lou Reed 1975 setup)
 * - Stack A (panned 85% L / 15% R): 6-string Karplus-Strong resonator, preamp tube overdrive with sag, 12" speaker cabinet, room delay
 * - Stack B (panned 15% L / 85% R): 6-string Karplus-Strong resonator, independent tube overdrive with sag, 12" speaker cabinet, room delay
 * - Room acoustic cross-coupling between Stack A and Stack B
 * - Authentic 12" guitar speaker transfer function (50 Hz HP, 1050 Hz presence bark, 3600 Hz cone rolloff)
 * - Harmonic shriek via pre-overdrive harmonic tilt drive (excites string 2nd/3rd modes naturally)
 * - 4-mode cabinet wood box resonance (55, 110, 180, 260 Hz) and physical cone bottoming knock
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
      { name: 'driftRate', defaultValue: 0.25, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },

      // 4. Power Amp Sag & Choke
      { name: 'sagThreshold', defaultValue: 0.65, minValue: 0.15, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'sagDepth', defaultValue: 0.80, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'sagRecovery', defaultValue: 160.0, minValue: 20.0, maxValue: 500.0, automationRate: 'k-rate' },

      // 5. Shriek & Harmonic Bending
      { name: 'harmonicShriek', defaultValue: 0.40, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'pickupAngle', defaultValue: 0.30, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'shriekBite', defaultValue: 0.50, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },

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

    // Hum phase & step (60 Hz mains with harmonics)
    this.humPhase = 0
    this.humPhaseStep = (2 * Math.PI * 60.0) / this.sampleRate

    // Thermal hiss 2-pole warm filter
    this.hissState = 0
    this.hissState2 = 0

    // 6 Guitar String Delays for Guitar A (size 8192 per string)
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
    this.stringDcX = new Float32Array(6)
    this.stringDcY = new Float32Array(6)
    this.stringPeriods = new Float32Array(6)

    // 6 Guitar String Delays for Guitar B
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
    this.stringDcX2 = new Float32Array(6)
    this.stringDcY2 = new Float32Array(6)
    this.stringPeriods2 = new Float32Array(6)

    // Wound string mass weighting across pickups
    this.stringWeights = new Float32Array([2.4, 2.0, 1.8, 1.2, 1.0, 0.9])

    // Tuning preset ratios relative to basePitch
    this.tuningPreset = 'ostrich-d'
    this.tuningPreset2 = 'ostrich-d'
    this._updateTuningRatios()

    // Acoustic Propagation Delay Buffers (Room sound path)
    this.propBufferSize = 4096
    this.propBufferMask = this.propBufferSize - 1
    this.propBuffer = new Float32Array(this.propBufferSize)
    this.propWriteIndex = 0
    this.propBuffer2 = new Float32Array(this.propBufferSize)
    this.propWriteIndex2 = 0

    // Virtual Power Amp Sag Bias Capacitors
    this.sagCharge = 0
    this.sagCharge2 = 0

    // DC Blocking state
    this.overdriveDcX = 0
    this.overdriveDcY = 0
    this.overdriveDcX2 = 0
    this.overdriveDcY2 = 0
    this.pickupX1 = 0
    this.pickupY1 = 0
    this.pickupX12 = 0
    this.pickupY12 = 0

    // 12" Guitar Speaker Transfer Function Filters
    // 1. High-Pass (50 Hz): rolls off DC/sub-bass, preserves 60/120 Hz mains body
    this._initSpeakerHP(50, 0.707)
    this.hpX1 = 0; this.hpX2 = 0; this.hpY1 = 0; this.hpY2 = 0
    this.hpX12 = 0; this.hpX22 = 0; this.hpY12 = 0; this.hpY22 = 0

    // 2. Presence Bark Peaking EQs (Dual-Harmonic Minor-Third Throat)
    // Stack A: 805 Hz, Q=0.65, +4.5 dB (authentic master tape throat mode A)
    this._initSpeakerBarkA(805, 0.65, 4.5)
    // Stack B: 960 Hz, Q=0.65, +4.5 dB (authentic master tape throat mode B: minor-third interval 960/805 = 1.1925)
    this._initSpeakerBarkB(960, 0.65, 4.5)
    this.barkX1 = 0; this.barkX2 = 0; this.barkY1 = 0; this.barkY2 = 0
    this.barkX12 = 0; this.barkX22 = 0; this.barkY12 = 0; this.barkY22 = 0

    // 3. Low-Pass (3600 Hz): steep 12" paper cone mechanical attenuation
    this._initSpeakerLP(3600, 0.707)
    this.lpX1 = 0; this.lpX2 = 0; this.lpY1 = 0; this.lpY2 = 0
    this.lpX12 = 0; this.lpX22 = 0; this.lpY12 = 0; this.lpY22 = 0

    // Pre-Gain Screech Resonance Filter (1550 Hz, Q=1.8, +8.0 dB for harmonicShriek mode jump)
    this._initShriekFilter(1550, 1.8, 8.0)
    this.tiltX1 = 0; this.tiltX2 = 0; this.tiltY1 = 0; this.tiltY2 = 0
    this.tiltX12 = 0; this.tiltX22 = 0; this.tiltY12 = 0; this.tiltY22 = 0

    // String Excursions for Non-Linear Tension Modulation (Pitch Swoop / Bend)
    this.stringExcursion = new Float32Array(6)
    this.stringExcursion2 = new Float32Array(6)

    // Acoustic Room Drift / Chaos Engine Phases
    this.driftPhase1 = 0.0
    this.driftPhase2 = 0.8
    this.driftPhase3 = 1.9

    // 4-Mode Cabinet Wood Box Resonance Bank (55, 110, 180, 260 Hz)
    this.rumbleX1 = new Float32Array(4)
    this.rumbleX2 = new Float32Array(4)
    this.rumbleY1 = new Float32Array(4)
    this.rumbleY2 = new Float32Array(4)
    this.rumbleX12 = new Float32Array(4)
    this.rumbleX22 = new Float32Array(4)
    this.rumbleY12 = new Float32Array(4)
    this.rumbleY22 = new Float32Array(4)
    this.lastBasePitch = 0
    this._updateRumbleFilters(73.416)

    // Cone Excursion & 55 Hz Acoustic Knock Resonators
    this.coneDisplacement = 0
    this.coneDisplacement2 = 0
    this.knockAmp = 0
    this.knockAmp2 = 0
    this.knockPhase = 0
    this.knockPhase2 = 0
    this.knockPhaseStep = (2 * Math.PI * 55.0) / this.sampleRate
    this.knockCooldown = 0

    // Backward-compatibility state aliases
    this.howlX1 = 0; this.howlX2 = 0; this.howlY1 = 0; this.howlY2 = 0
    this.shriekX1 = 0; this.shriekX2 = 0; this.shriekY1 = 0; this.shriekY2 = 0

    // Port messages
    this.port.onmessage = (event) => {
      const data = event.data
      if (data && data.type === 'tuning') {
        this.tuningPreset = data.preset || 'ostrich-d'
        this.tuningPreset2 = this.tuningPreset
        this._updateTuningRatios()
      } else if (data && data.type === 'reset') {
        this._resetState()
      }
    }
  }

  _resetState() {
    for (let s = 0; s < 6; s++) {
      this.stringBuffers[s].fill(0)
      this.stringBuffers2[s].fill(0)
      this.stringFilterStates[s] = 0
      this.stringFilterStates2[s] = 0
      this.stringDcX[s] = 0
      this.stringDcY[s] = 0
      this.stringDcX2[s] = 0
      this.stringDcY2[s] = 0
    }
    this.propBuffer.fill(0)
    this.propBuffer2.fill(0)
    this.propWriteIndex = 0
    this.propWriteIndex2 = 0
    this.sagCharge = 0
    this.sagCharge2 = 0
    this.coneDisplacement = 0
    this.coneDisplacement2 = 0
    this.knockAmp = 0
    this.knockAmp2 = 0
    this.knockPhase = 0
    this.knockPhase2 = 0
    this.overdriveDcX = 0
    this.overdriveDcY = 0
    this.overdriveDcX2 = 0
    this.overdriveDcY2 = 0
    this.pickupX1 = 0
    this.pickupY1 = 0
    this.pickupX12 = 0
    this.pickupY12 = 0
    this.hpX1 = 0; this.hpX2 = 0; this.hpY1 = 0; this.hpY2 = 0
    this.hpX12 = 0; this.hpX22 = 0; this.hpY12 = 0; this.hpY22 = 0
    this.barkX1 = 0; this.barkX2 = 0; this.barkY1 = 0; this.barkY2 = 0
    this.barkX12 = 0; this.barkX22 = 0; this.barkY12 = 0; this.barkY22 = 0
    this.lpX1 = 0; this.lpX2 = 0; this.lpY1 = 0; this.lpY2 = 0
    this.lpX12 = 0; this.lpX22 = 0; this.lpY12 = 0; this.lpY22 = 0
    this.tiltX1 = 0; this.tiltX2 = 0; this.tiltY1 = 0; this.tiltY2 = 0
    this.tiltX12 = 0; this.tiltX22 = 0; this.tiltY12 = 0; this.tiltY22 = 0
    this.rumbleX1.fill(0); this.rumbleX2.fill(0); this.rumbleY1.fill(0); this.rumbleY2.fill(0)
    this.rumbleX12.fill(0); this.rumbleX22.fill(0); this.rumbleY12.fill(0); this.rumbleY22.fill(0)
    this.stringExcursion.fill(0)
    this.stringExcursion2.fill(0)
    this.driftPhase1 = 0.0
    this.driftPhase2 = 0.8
    this.driftPhase3 = 1.9
  }

  _initSpeakerHP(cutoff, Q) {
    const w0 = (2 * Math.PI * cutoff) / this.sampleRate
    const alpha = Math.sin(w0) / (2 * Q)
    const cos = Math.cos(w0)
    const a0 = 1 + alpha
    this.spkHpB0 = ((1 + cos) / 2) / a0
    this.spkHpB1 = (-(1 + cos)) / a0
    this.spkHpB2 = ((1 + cos) / 2) / a0
    this.spkHpA1 = (-2 * cos) / a0
    this.spkHpA2 = (1 - alpha) / a0
  }

  _initSpeakerBarkA(centerFreq, Q, gainDB) {
    const w0 = (2 * Math.PI * centerFreq) / this.sampleRate
    const A = Math.pow(10, gainDB / 40)
    const alpha = Math.sin(w0) / (2 * Q)
    const b0 = 1 + alpha * A
    const b1 = -2 * Math.cos(w0)
    const b2 = 1 - alpha * A
    const a0 = 1 + alpha / A
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha / A
    this.spkBarkA_B0 = b0 / a0
    this.spkBarkA_B1 = b1 / a0
    this.spkBarkA_B2 = b2 / a0
    this.spkBarkA_A1 = a1 / a0
    this.spkBarkA_A2 = a2 / a0
    // Backward-compatibility aliases
    this.spkBarkB0 = this.spkBarkA_B0
    this.spkBarkB1 = this.spkBarkA_B1
    this.spkBarkB2 = this.spkBarkA_B2
    this.spkBarkA1 = this.spkBarkA_A1
    this.spkBarkA2 = this.spkBarkA_A2
  }

  _initSpeakerBarkB(centerFreq, Q, gainDB) {
    const w0 = (2 * Math.PI * centerFreq) / this.sampleRate
    const A = Math.pow(10, gainDB / 40)
    const alpha = Math.sin(w0) / (2 * Q)
    const b0 = 1 + alpha * A
    const b1 = -2 * Math.cos(w0)
    const b2 = 1 - alpha * A
    const a0 = 1 + alpha / A
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha / A
    this.spkBarkB_B0 = b0 / a0
    this.spkBarkB_B1 = b1 / a0
    this.spkBarkB_B2 = b2 / a0
    this.spkBarkB_A1 = a1 / a0
    this.spkBarkB_A2 = a2 / a0
  }

  _initSpeakerBark(centerFreq, Q, gainDB) {
    this._initSpeakerBarkA(centerFreq, Q, gainDB)
  }

  _initSpeakerLP(cutoff, Q) {
    const w0 = (2 * Math.PI * cutoff) / this.sampleRate
    const alpha = Math.sin(w0) / (2 * Q)
    const cos = Math.cos(w0)
    const a0 = 1 + alpha
    this.spkLpB0 = ((1 - cos) / 2) / a0
    this.spkLpB1 = (1 - cos) / a0
    this.spkLpB2 = ((1 - cos) / 2) / a0
    this.spkLpA1 = (-2 * cos) / a0
    this.spkLpA2 = (1 - alpha) / a0
    // Aliases for tests inspecting spkB0 / spkA1
    this.spkB0 = this.spkLpB0
    this.spkB1 = this.spkLpB1
    this.spkB2 = this.spkLpB2
    this.spkA1 = this.spkLpA1
    this.spkA2 = this.spkLpA2
  }

  _initShriekFilter(centerFreq, Q, gainDB) {
    const w0 = (2 * Math.PI * centerFreq) / this.sampleRate
    const A = Math.pow(10, gainDB / 40)
    const alpha = Math.sin(w0) / (2 * Q)
    const b0 = 1 + alpha * A
    const b1 = -2 * Math.cos(w0)
    const b2 = 1 - alpha * A
    const a0 = 1 + alpha / A
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha / A
    this.shriekB0 = b0 / a0
    this.shriekB1 = b1 / a0
    this.shriekB2 = b2 / a0
    this.shriekA1 = a1 / a0
    this.shriekA2 = a2 / a0
    // Backward-compatibility aliases for tilt filter
    this.tiltB0 = this.shriekB0
    this.tiltB1 = this.shriekB1
    this.tiltB2 = this.shriekB2
    this.tiltA1 = this.shriekA1
    this.tiltA2 = this.shriekA2
  }

  _initTiltFilter(cutoff, Q) {
    this._initShriekFilter(cutoff, Q, 8.0)
  }

  _initBiquadBP(centerFreq, Q) {
    const w0 = (2 * Math.PI * centerFreq) / this.sampleRate
    const alpha = Math.sin(w0) / (2 * Q)
    const a0 = 1 + alpha
    return {
      b0: alpha / a0,
      b1: 0,
      b2: -alpha / a0,
      a1: (-2 * Math.cos(w0)) / a0,
      a2: (1 - alpha) / a0
    }
  }

  _updateRumbleFilters(basePitch) {
    const f0 = Math.max(30.0, basePitch)
    const f1 = Math.min(this.sampleRate * 0.45, f0 * 2.0)
    const f2 = Math.min(this.sampleRate * 0.45, f0 * 3.0)
    const fBox = 82.0 // cabinet wood box fundamental mode
    this.rumbleCoeffs = [
      this._initBiquadBP(f0, 1.8),
      this._initBiquadBP(f1, 2.0),
      this._initBiquadBP(f2, 2.2),
      this._initBiquadBP(fBox, 2.2)
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

    // Extract k-rate parameter values
    const ampHum = parameters.ampHum ? parameters.ampHum[0] : 0.35
    const ampHiss = parameters.ampHiss ? parameters.ampHiss[0] : 0.20
    const basePitch = parameters.basePitch ? parameters.basePitch[0] : 73.416
    const detuneSpread = parameters.detuneSpread ? parameters.detuneSpread[0] : 6.0
    const stringDamping = parameters.stringDamping ? parameters.stringDamping[0] : 0.25
    const feedbackGain = parameters.feedbackGain ? parameters.feedbackGain[0] : 1.0
    const couplingDistance = parameters.couplingDistance ? parameters.couplingDistance[0] : 4.0
    const driftRate = parameters.driftRate ? parameters.driftRate[0] : 0.25
    const sagThreshold = parameters.sagThreshold ? parameters.sagThreshold[0] : 0.65
    const sagDepth = parameters.sagDepth ? parameters.sagDepth[0] : 0.80
    const sagRecovery = parameters.sagRecovery ? parameters.sagRecovery[0] : 160.0
    const harmonicShriek = parameters.harmonicShriek ? parameters.harmonicShriek[0] : 0.40
    const pickupAngle = parameters.pickupAngle ? parameters.pickupAngle[0] : 0.30
    const shriekBite = parameters.shriekBite ? parameters.shriekBite[0] : 0.50
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

    // Update resonant body filters if basePitch changed
    if (Math.abs(basePitch - this.lastBasePitch) > 0.05) {
      this._updateRumbleFilters(basePitch)
    }

    // Room Acoustic Chaos / Drift Engine (modulates propagation delay and micro-detuning)
    const driftSpeed = driftRate * (numSamples / this.sampleRate)
    this.driftPhase1 += driftSpeed * 0.45
    this.driftPhase2 += driftSpeed * 0.78
    this.driftPhase3 += driftSpeed * 1.55
    if (this.driftPhase1 > 2 * Math.PI) this.driftPhase1 -= 2 * Math.PI
    if (this.driftPhase2 > 2 * Math.PI) this.driftPhase2 -= 2 * Math.PI
    if (this.driftPhase3 > 2 * Math.PI) this.driftPhase3 -= 2 * Math.PI

    const delayDriftA = Math.sin(this.driftPhase1) * 0.8 * driftRate
    const delayDriftB = Math.cos(this.driftPhase2) * 0.8 * driftRate
    const detuneDrift = Math.sin(this.driftPhase3) * 5.0 * driftRate

    const effDistanceA = Math.max(1.0, couplingDistance + delayDriftA)
    const effDistanceB = Math.max(1.0, loop2Distance + delayDriftB)

    // Pre-calculate string delay lengths for Guitar A
    for (let s = 0; s < 6; s++) {
      const spreadCents = (s - 2.5) * (detuneSpread / 1200.0)
      const ratio = this.tuningIntervals[s]
      const freq = basePitch * ratio * Math.pow(2, spreadCents)
      this.stringPeriods[s] = Math.max(16, Math.min(this.stringBufferSize - 2, this.sampleRate / freq))
    }

    // Pre-calculate string delay lengths for Guitar B
    const effLoop2Detune = loop2Detune + detuneDrift
    const basePitchB = basePitch * Math.pow(2, effLoop2Detune / 1200.0)
    for (let s = 0; s < 6; s++) {
      const spreadCents = (s - 2.5) * (detuneSpread / 1200.0)
      const ratio = this.tuningIntervals2[s]
      const freq = basePitchB * ratio * Math.pow(2, spreadCents)
      this.stringPeriods2[s] = Math.max(16, Math.min(this.stringBufferSize - 2, this.sampleRate / freq))
    }

    // Propagation delay lengths in samples
    const propDelaySamplesA = (effDistanceA / 1000.0) * this.sampleRate
    const propDelaySamplesB = (effDistanceB / 1000.0) * this.sampleRate

    // Sag attack and bleed constants (Stack A recovers at sagRecovery ms; Stack B ~68% faster for out-of-phase throbbing)
    const sagAttack = 1.0 - Math.exp(-1.0 / (0.006 * this.sampleRate))
    const sagBleedA = Math.exp(-1.0 / ((sagRecovery / 1000.0) * this.sampleRate))
    const sagBleedB = Math.exp(-1.0 / (((sagRecovery * 0.68) / 1000.0) * this.sampleRate))

    // Asymmetric valve distortion balance
    const asym = 0.22 + subBeating * 0.35

    for (let i = 0; i < numSamples; i++) {
      // 1. Idling Amp Floor (Mains Hum + Warm Hiss)
      this.humPhase += this.humPhaseStep
      if (this.humPhase > 2 * Math.PI) this.humPhase -= 2 * Math.PI

      const humSig = Math.sin(this.humPhase) +
        0.42 * Math.sin(this.humPhase * 2) +
        0.22 * Math.sin(this.humPhase * 3) +
        0.10 * Math.sin(this.humPhase * 5)

      const rawNoise = (Math.random() * 2 - 1)
      this.hissState += 0.10 * (rawNoise - this.hissState)
      this.hissState2 += 0.10 * (this.hissState - this.hissState2)
      const ampFloor = (humSig * 0.07 * ampHum) + (this.hissState2 * 0.04 * ampHiss)

      // 2. Read Acoustic Feedback from Room Propagation Delays
      // Stack A self-feedback
      const readA = (this.propWriteIndex - propDelaySamplesA + this.propBufferSize * 4) % this.propBufferSize
      let intProp = Math.floor(readA); let fracProp = readA - intProp
      let nextProp = (intProp + 1) & this.propBufferMask
      const directFbA = this.propBuffer[intProp] * (1 - fracProp) + this.propBuffer[nextProp] * fracProp

      // Stack B self-feedback
      const readB = (this.propWriteIndex2 - propDelaySamplesB + this.propBufferSize * 4) % this.propBufferSize
      intProp = Math.floor(readB); fracProp = readB - intProp
      nextProp = (intProp + 1) & this.propBufferMask
      const directFbB = this.propBuffer2[intProp] * (1 - fracProp) + this.propBuffer2[nextProp] * fracProp

      // Room cross-bleed: Sound from Stack B bleeds into Guitar A; Stack A bleeds into Guitar B
      const bleedBtoA = directFbB * crossCoupling * 0.35
      const bleedAtoB = directFbA * crossCoupling * 0.35

      const acousticAtGuitarA = directFbA * feedbackGain + bleedBtoA
      const acousticAtGuitarB = directFbB * feedbackGain + bleedAtoB

      // Sound pressure exciting strings
      const stringExcitationA = (ampFloor * 0.05) + (acousticAtGuitarA * 0.018)
      const stringExcitationB = (ampFloor * 0.05) + (acousticAtGuitarB * 0.018)

      // 3. Guitar A: 6 Karplus-Strong Strings with Non-Linear Tension Modulation
      let sumStringA = 0.0
      let lowStringSignalA = 0.0

      for (let s = 0; s < 6; s++) {
        // High excursion shortens effective string delay (pitch bends up +40-70 cents during shriek)
        const tensionShortening = 1.0 - 0.045 * Math.min(1.0, this.stringExcursion[s] * this.stringExcursion[s] * 2.5)
        const pLen = this.stringPeriods[s] * tensionShortening
        const buf = this.stringBuffers[s]
        const wIdx = this.stringWriteIndices[s]

        const readPos = (wIdx - pLen + this.stringBufferSize * 4) % this.stringBufferSize
        const intPos = Math.floor(readPos)
        const frac = readPos - intPos
        const nextPos = (intPos + 1) & this.stringBufferMask
        const delayedSample = buf[intPos] * (1 - frac) + buf[nextPos] * frac

        const dampAlpha = Math.min(0.85, Math.max(0.08, 1.0 - stringDamping * 0.45))
        this.stringFilterStates[s] = delayedSample * dampAlpha + this.stringFilterStates[s] * (1 - dampAlpha)

        const lpOut = this.stringFilterStates[s]
        const dcBlocked = lpOut - this.stringDcX[s] + 0.9997 * this.stringDcY[s]
        this.stringDcX[s] = lpOut
        this.stringDcY[s] = dcBlocked

        const stringOut = Math.tanh(dcBlocked * 1.2) / 1.2
        this.stringExcursion[s] += (Math.abs(stringOut) - this.stringExcursion[s]) * 0.005
        const stringSustain = 0.994

        buf[wIdx] = (stringOut * stringSustain) + (stringExcitationA * 0.75)
        this.stringWriteIndices[s] = (wIdx + 1) & this.stringBufferMask

        sumStringA += stringOut * this.stringWeights[s]
        if (s === 0) lowStringSignalA = stringOut
      }

      // 4. Guitar B: 6 Karplus-Strong Strings with Non-Linear Tension Modulation
      let sumStringB = 0.0
      let lowStringSignalB = 0.0

      for (let s = 0; s < 6; s++) {
        const tensionShortening = 1.0 - 0.045 * Math.min(1.0, this.stringExcursion2[s] * this.stringExcursion2[s] * 2.5)
        const pLen = this.stringPeriods2[s] * tensionShortening
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
        this.stringExcursion2[s] += (Math.abs(stringOut) - this.stringExcursion2[s]) * 0.005
        const stringSustain = 0.994

        buf[wIdx] = (stringOut * stringSustain) + (stringExcitationB * 0.75)
        this.stringWriteIndices2[s] = (wIdx + 1) & this.stringBufferMask

        sumStringB += stringOut * this.stringWeights[s]
        if (s === 0) lowStringSignalB = stringOut
      }

      // 5. Pickups & Harmonic Screech (1550 Hz mode jump + asymmetric biting wave-shaper)
      const rawPickupA = sumStringA * 0.25
      const shriekHPA = this.tiltB0 * rawPickupA + this.tiltB1 * this.tiltX1 + this.tiltB2 * this.tiltX2
                      - this.tiltA1 * this.tiltY1 - this.tiltA2 * this.tiltY2
      this.tiltX2 = this.tiltX1; this.tiltX1 = rawPickupA
      this.tiltY2 = this.tiltY1; this.tiltY1 = shriekHPA
      const shriekDriveA = rawPickupA + shriekHPA * harmonicShriek * 3.2
      const bite = shriekBite * harmonicShriek
      const pickupSignalA = Math.tanh(shriekDriveA) + bite * 0.30 * (Math.tanh(2.2 * shriekDriveA) - Math.tanh(shriekDriveA))

      const rawPickupB = sumStringB * 0.25
      const shriekHPB = this.tiltB0 * rawPickupB + this.tiltB1 * this.tiltX12 + this.tiltB2 * this.tiltX22
                      - this.tiltA1 * this.tiltY12 - this.tiltA2 * this.tiltY22
      this.tiltX22 = this.tiltX12; this.tiltX12 = rawPickupB
      this.tiltY22 = this.tiltY12; this.tiltY12 = shriekHPB
      const shriekDriveB = rawPickupB + shriekHPB * harmonicShriek * 3.2
      const pickupSignalB = Math.tanh(shriekDriveB) + bite * 0.30 * (Math.tanh(2.2 * shriekDriveB) - Math.tanh(shriekDriveB))

      // 6. Preamp Overdrive & Power Amp Grid-Leak Blocking Sag (Stack A)
      const ampInputA = (acousticAtGuitarA * 0.65 + pickupSignalA * 0.85) * (1.0 + feedbackGain * 1.4) + ampFloor
      const absSigA = Math.abs(ampInputA)

      const overloadA = Math.max(0.0, absSigA - sagThreshold)
      const targetChargeA = Math.min(0.90, overloadA * 1.5)
      if (targetChargeA > this.sagCharge) {
        this.sagCharge += (targetChargeA - this.sagCharge) * sagAttack
      } else {
        this.sagCharge *= sagBleedA
      }
      const sagGainReductionA = Math.max(0.03, 1.0 / (1.0 + Math.pow(this.sagCharge / Math.max(0.1, 1.0 - sagDepth * 0.45), 2.2)))

      let valveOutA = 0
      if (ampInputA >= 0) {
        valveOutA = ampInputA / (1.0 + ampInputA * (0.65 - asym * 0.25))
      } else {
        const absA = -ampInputA
        valveOutA = -absA / (1.0 + absA * (0.85 + asym * 0.35))
      }
      const rawOverdrivenA = valveOutA * sagGainReductionA
      const overdrivenA = rawOverdrivenA - this.overdriveDcX + 0.997 * this.overdriveDcY
      this.overdriveDcX = rawOverdrivenA
      this.overdriveDcY = overdrivenA

      // Preamp Overdrive & Power Amp Grid-Leak Blocking Sag (Stack B)
      const ampInputB = (acousticAtGuitarB * 0.65 + pickupSignalB * 0.85) * (1.0 + feedbackGain * 1.4) + ampFloor
      const absSigB = Math.abs(ampInputB)

      const overloadB = Math.max(0.0, absSigB - sagThreshold)
      const targetChargeB = Math.min(0.90, overloadB * 1.5)
      if (targetChargeB > this.sagCharge2) {
        this.sagCharge2 += (targetChargeB - this.sagCharge2) * sagAttack
      } else {
        this.sagCharge2 *= sagBleedB
      }
      const sagGainReductionB = Math.max(0.03, 1.0 / (1.0 + Math.pow(this.sagCharge2 / Math.max(0.1, 1.0 - sagDepth * 0.45), 2.2)))

      let valveOutB = 0
      if (ampInputB >= 0) {
        valveOutB = ampInputB / (1.0 + ampInputB * (0.65 - asym * 0.25))
      } else {
        const absB = -ampInputB
        valveOutB = -absB / (1.0 + absB * (0.85 + asym * 0.35))
      }
      const rawOverdrivenB = valveOutB * sagGainReductionB
      const overdrivenB = rawOverdrivenB - this.overdriveDcX2 + 0.997 * this.overdriveDcY2
      this.overdriveDcX2 = rawOverdrivenB
      this.overdriveDcY2 = overdrivenB

      // 7. 12" Guitar Speaker Cabinet Transfer Function
      // Stack A: HP 50Hz -> Mid Bark 805Hz (+4.5dB) -> LP 3600Hz
      const hpOutA = this.spkHpB0 * overdrivenA + this.spkHpB1 * this.hpX1 + this.spkHpB2 * this.hpX2
                   - this.spkHpA1 * this.hpY1 - this.spkHpA2 * this.hpY2
      this.hpX2 = this.hpX1; this.hpX1 = overdrivenA; this.hpY2 = this.hpY1; this.hpY1 = hpOutA

      const barkOutA = this.spkBarkA_B0 * hpOutA + this.spkBarkA_B1 * this.barkX1 + this.spkBarkA_B2 * this.barkX2
                     - this.spkBarkA_A1 * this.barkY1 - this.spkBarkA_A2 * this.barkY2
      this.barkX2 = this.barkX1; this.barkX1 = hpOutA; this.barkY2 = this.barkY1; this.barkY1 = barkOutA

      const spkOutA = this.spkLpB0 * barkOutA + this.spkLpB1 * this.lpX1 + this.spkLpB2 * this.lpX2
                    - this.spkLpA1 * this.lpY1 - this.spkLpA2 * this.lpY2
      this.lpX2 = this.lpX1; this.lpX1 = barkOutA; this.lpY2 = this.lpY1; this.lpY1 = spkOutA

      this.propBuffer[this.propWriteIndex] = spkOutA
      this.propWriteIndex = (this.propWriteIndex + 1) & this.propBufferMask

      // Stack B: HP 50Hz -> Mid Bark 960Hz (+4.5dB, Minor-Third Throat) -> LP 3600Hz
      const hpOutB = this.spkHpB0 * overdrivenB + this.spkHpB1 * this.hpX12 + this.spkHpB2 * this.hpX22
                   - this.spkHpA1 * this.hpY12 - this.spkHpA2 * this.hpY22
      this.hpX22 = this.hpX12; this.hpX12 = overdrivenB; this.hpY22 = this.hpY12; this.hpY12 = hpOutB

      const barkOutB = this.spkBarkB_B0 * hpOutB + this.spkBarkB_B1 * this.barkX12 + this.spkBarkB_B2 * this.barkX22
                     - this.spkBarkB_A1 * this.barkY12 - this.spkBarkB_A2 * this.barkY22
      this.barkX22 = this.barkX12; this.barkX12 = hpOutB; this.barkY22 = this.barkY12; this.barkY12 = barkOutB

      const spkOutB = this.spkLpB0 * barkOutB + this.spkLpB1 * this.lpX12 + this.spkLpB2 * this.lpX22
                    - this.spkLpA1 * this.lpY12 - this.spkLpA2 * this.lpY22
      this.lpX22 = this.lpX12; this.lpX12 = barkOutB; this.lpY22 = this.lpY12; this.lpY12 = spkOutB

      this.propBuffer2[this.propWriteIndex2] = spkOutB
      this.propWriteIndex2 = (this.propWriteIndex2 + 1) & this.propBufferMask

      // 8. Cabinet Box Rumble & Resonance (55, 110, 180, 260 Hz)
      const subProductA = humSig * lowStringSignalA * subBeating * 1.5 * sagGainReductionA
      const thumpInA = spkOutA * (1.0 + cabinetHowl * 0.8) + subProductA

      let sumRumbleA = 0.0
      for (let f = 0; f < 4; f++) {
        const c = this.rumbleCoeffs[f]
        const filterOut = c.b0 * thumpInA + c.b1 * this.rumbleX1[f] + c.b2 * this.rumbleX2[f]
                        - c.a1 * this.rumbleY1[f] - c.a2 * this.rumbleY2[f]
        this.rumbleX2[f] = this.rumbleX1[f]; this.rumbleX1[f] = thumpInA
        this.rumbleY2[f] = this.rumbleY1[f]; this.rumbleY1[f] = filterOut
        sumRumbleA += filterOut
      }
      const rumbleSignalA = sumRumbleA * (0.5 + rumbleResonance * 1.5) * cabinetThump * 0.8

      const subProductB = humSig * lowStringSignalB * subBeating * 1.5 * sagGainReductionB
      const thumpInB = spkOutB * (1.0 + cabinetHowl * 0.8) + subProductB

      let sumRumbleB = 0.0
      for (let f = 0; f < 4; f++) {
        const c = this.rumbleCoeffs[f]
        const filterOut = c.b0 * thumpInB + c.b1 * this.rumbleX12[f] + c.b2 * this.rumbleX22[f]
                        - c.a1 * this.rumbleY12[f] - c.a2 * this.rumbleY22[f]
        this.rumbleX22[f] = this.rumbleX12[f]; this.rumbleX12[f] = thumpInB
        this.rumbleY22[f] = this.rumbleY12[f]; this.rumbleY12[f] = filterOut
        sumRumbleB += filterOut
      }
      const rumbleSignalB = sumRumbleB * (0.5 + rumbleResonance * 1.5) * cabinetThump * 0.8

      // 9. Speaker Cone Excursion & 55 Hz Acoustic Mechanical Knock
      this.coneDisplacement += (Math.abs(spkOutA) - this.coneDisplacement) * 0.008
      if (this.coneDisplacement > coneLimit) {
        this.knockAmp = knockLevel * 0.55
        this.knockPhase = 0
        this.coneDisplacement *= 0.5
      }
      let knockSignalA = 0.0
      if (this.knockAmp > 0.0005) {
        knockSignalA = this.knockAmp * Math.sin(this.knockPhase)
        this.knockPhase += this.knockPhaseStep
        this.knockAmp *= 0.9975
      }

      this.coneDisplacement2 += (Math.abs(spkOutB) - this.coneDisplacement2) * 0.008
      if (this.coneDisplacement2 > coneLimit) {
        this.knockAmp2 = knockLevel * 0.55
        this.knockPhase2 = 0
        this.coneDisplacement2 *= 0.5
      }
      let knockSignalB = 0.0
      if (this.knockAmp2 > 0.0005) {
        knockSignalB = this.knockAmp2 * Math.sin(this.knockPhase2)
        this.knockPhase2 += this.knockPhaseStep
        this.knockAmp2 *= 0.9975
      }

      // 10. Stack Acoustic Radiation & True Dual-Stack Stereo Staging
      // Stack A Output (Guitar Stack 1: predominantly Left)
      const stackOutputA = (spkOutA * 0.55 + rumbleSignalA * 0.35 + knockSignalA * 0.25) + (sumStringA * 0.08 * sagGainReductionA)

      // Stack B Output (Guitar Stack 2: predominantly Right, scaled by loop2Gain)
      const stackOutputB = ((spkOutB * 0.55 + rumbleSignalB * 0.35 + knockSignalB * 0.25) + (sumStringB * 0.08 * sagGainReductionB)) * loop2Gain

      // True Dual-Stack Stereo Staging:
      // Stack A radiates 75% Left, 25% Right
      // Stack B radiates 25% Left, 75% Right
      const rawL = (stackOutputA * 0.80 + stackOutputB * 0.20) + ampFloor * 0.05
      const rawR = (stackOutputA * 0.20 + stackOutputB * 0.80) + ampFloor * 0.05

      left[i] = Math.tanh(rawL)
      right[i] = Math.tanh(rawR)
    }

    return true
  }
}

registerProcessor('mmm-lab-processor', MMMLabProcessor)
