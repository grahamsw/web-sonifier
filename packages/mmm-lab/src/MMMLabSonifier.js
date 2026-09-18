import { SonifierBase } from '@web-sonifier/core'

/**
 * MMMLabSonifier
 * 
 * An acoustic physical laboratory sonifier for exploring the fundamental building
 * blocks of Lou Reed's "Metal Machine Music" step-by-step:
 * 1. Idling tube amp noise floor (60Hz hum + rectifier harmonics + thermal hiss)
 * 2. 6-string Karplus-Strong guitar resonator bank with selectable tunings (Ostrich D, Open D, Standard E)
 * 3. Acoustic feedback coupling with physical propagation distance
 * 4. Power amp sag & blocking distortion choke ("valve on/off" flutter)
 * 5. Overblown harmonic node jumping and pitch-bending shriek
 * 6. Low rumble, cabinet cavity thump, and 60Hz heterodyne beating
 */
export class MMMLabSonifier extends SonifierBase {
  getParamSchema() {
    return [
      // Group 1: Idling Amp Floor (Hum & Hiss)
      {
        name: 'ampHum',
        type: 'number',
        range: [0, 1],
        default: 0.35,
        unit: 'gain',
        curve: 'linear',
        group: '1. Idling Amp Floor',
        label: 'Transformer Hum',
        description: '60 Hz mains hum and 120/180 Hz rectifier harmonics of an idling cranked amplifier'
      },
      {
        name: 'ampHiss',
        type: 'number',
        range: [0, 1],
        default: 0.20,
        unit: 'gain',
        curve: 'linear',
        group: '1. Idling Amp Floor',
        label: 'Thermal Hiss',
        description: 'Warm resistor and tube thermal hiss shaped by the amplifier cabinet'
      },

      // Group 2: Guitar Strings & Tunings
      {
        name: 'tuningPreset',
        type: 'enum',
        options: [
          { label: 'Lou Reed Ostrich D (D-D-D-D-D-D)', value: 'ostrich-d' },
          { label: 'Open D (D-A-D-F#-A-D)', value: 'open-d' },
          { label: 'Standard E (E-A-D-G-B-E)', value: 'standard-e' }
        ],
        values: ['ostrich-d', 'open-d', 'standard-e'],
        default: 'ostrich-d',
        group: '2. Guitar Strings & Tunings',
        label: 'String Tuning',
        description: 'Tuning configuration for the 6 guitar string resonators'
      },
      {
        name: 'basePitch',
        type: 'number',
        range: [40, 150],
        default: 73.416,
        unit: 'Hz',
        curve: 'exponential',
        group: '2. Guitar Strings & Tunings',
        label: 'Base Pitch (D1)',
        description: 'Root tuning frequency for the lowest string (73.4 Hz = D1)'
      },
      {
        name: 'detuneSpread',
        type: 'number',
        range: [-50, 50],
        default: 6,
        unit: 'cents',
        curve: 'linear',
        group: '2. Guitar Strings & Tunings',
        label: 'Detune Spread',
        description: 'Microtonal detuning spread across the 6 strings creating acoustic chorus and beating'
      },
      {
        name: 'stringDamping',
        type: 'number',
        range: [0, 1],
        default: 0.25,
        unit: 'norm',
        curve: 'linear',
        group: '2. Guitar Strings & Tunings',
        label: 'String Damping',
        description: 'High-frequency damping of the string resonators (lower = brighter, longer ringing)'
      },

      // Group 3: Acoustic Feedback Loop
      {
        name: 'feedbackGain',
        type: 'number',
        range: [0.0, 2.0],
        default: 1.0,
        unit: 'gain',
        curve: 'linear',
        group: '3. Acoustic Feedback Loop',
        label: 'Feedback Gain',
        description: 'Acoustic coupling gain between speaker cone and pickups (>1.0 self-oscillates)'
      },
      {
        name: 'couplingDistance',
        type: 'number',
        range: [1.0, 25.0],
        default: 4.0,
        unit: 'ms',
        curve: 'linear',
        group: '3. Acoustic Feedback Loop',
        label: 'Distance Delay',
        description: 'Physical acoustic propagation delay between speaker and guitar body'
      },

      // Group 4: Power Amp Sag & Choke
      {
        name: 'sagThreshold',
        type: 'number',
        range: [0.15, 1.0],
        default: 0.65,
        unit: 'thresh',
        curve: 'linear',
        group: '4. Power Amp Sag & Choke',
        label: 'Sag Threshold',
        description: 'Signal level where power-tube grid conducts and chokes the loop gain'
      },
      {
        name: 'sagDepth',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.80,
        unit: 'depth',
        curve: 'linear',
        group: '4. Power Amp Sag & Choke',
        label: 'Choke Depth',
        description: 'How severely the power amp cuts off the signal under heavy overload'
      },
      {
        name: 'sagRecovery',
        type: 'number',
        range: [20.0, 500.0],
        default: 160.0,
        unit: 'ms',
        curve: 'exponential',
        group: '4. Power Amp Sag & Choke',
        label: 'Recovery Time',
        description: 'Time for bias capacitor to bleed off, setting the rhythm of the valve on/off flutter'
      },

      // Group 5: Shriek & Harmonic Bending
      {
        name: 'harmonicShriek',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.40,
        unit: 'gain',
        curve: 'linear',
        group: '5. Shriek & Harmonic Bending',
        label: 'Harmonic Shriek',
        description: 'Overtone emphasis forcing the feedback to slip off fundamental into a reed-like scream'
      },
      {
        name: 'pickupAngle',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.30,
        unit: 'phase',
        curve: 'linear',
        group: '5. Shriek & Harmonic Bending',
        label: 'Pickup Angle / Bend',
        description: 'Micro-distance phase angle that pulls and bends the pitch of the screaming harmonic'
      },

      // Group 6: Low Rumble & Cabinet Resonance
      {
        name: 'cabinetThump',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.50,
        unit: 'gain',
        curve: 'linear',
        group: '6. Low Rumble & Cabinet Resonance',
        label: 'Cabinet Thump',
        description: '76 Hz resonant speaker cabinet air cavity shudder'
      },
      {
        name: 'cabinetHowl',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.50,
        unit: 'gain',
        curve: 'linear',
        group: '6. Low Rumble & Cabinet Resonance',
        label: 'Animal Howl',
        description: 'Low-mid (135 Hz) speaker cabinet cavity acoustic resonance that pitch-bends and howls like an animal'
      },
      {
        name: 'subBeating',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.40,
        unit: 'depth',
        curve: 'linear',
        group: '6. Low Rumble & Cabinet Resonance',
        label: 'Heterodyne Roar',
        description: 'Asymmetric tube intermodulation producing rich f2 - f1 difference tones and churning low-mid roar'
      },
      {
        name: 'rumbleResonance',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.5,
        unit: 'depth',
        curve: 'linear',
        group: '6. Low Rumble & Cabinet Resonance',
        label: 'Resonance Depth',
        description: 'Sharpness of the body and cabinet resonant modes — higher values create stronger, more pitched rumble'
      },

      // Group 6b: Speaker Knocking
      {
        name: 'coneLimit',
        type: 'number',
        range: [0.2, 1.0],
        default: 0.6,
        unit: 'thresh',
        curve: 'linear',
        group: '6b. Speaker Knocking',
        label: 'Cone Travel Limit',
        description: 'Mechanical excursion threshold where the speaker cone bottoms out, triggering a 55 Hz acoustic thud'
      },
      {
        name: 'knockLevel',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.4,
        unit: 'gain',
        curve: 'linear',
        group: '6b. Speaker Knocking',
        label: 'Knock Intensity',
        description: 'Amplitude of the 55 Hz damped speaker cone impact thud when hitting travel limit'
      },

      // Group 7: Output
      {
        name: 'volume',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.50,
        unit: 'gain',
        curve: 'logarithmic',
        group: '7. Output',
        label: 'Master Volume',
        description: 'Master listening level with ear-safety limiter'
      },

      // Group 8: Second Guitar / Density
      {
        name: 'loop2Gain',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.0,
        unit: 'gain',
        curve: 'linear',
        group: '8. Second Guitar / Density',
        label: 'Second Guitar Level',
        description: 'Mix level of the second guitar/amp feedback loop (0 = off, creates density and beating when raised)'
      },
      {
        name: 'loop2Detune',
        type: 'number',
        range: [-50, 50],
        default: 18,
        unit: 'cents',
        curve: 'linear',
        group: '8. Second Guitar / Density',
        label: 'Loop B Detune',
        description: 'Pitch offset of the second guitar relative to the first — creates beating interference patterns'
      },
      {
        name: 'loop2Distance',
        type: 'number',
        range: [1.0, 25.0],
        default: 7.0,
        unit: 'ms',
        curve: 'linear',
        group: '8. Second Guitar / Density',
        label: 'Loop B Distance',
        description: 'Acoustic propagation delay for the second guitar/amp pair (different room path)'
      },
      {
        name: 'crossCoupling',
        type: 'number',
        range: [0.0, 1.0],
        default: 0.3,
        unit: 'depth',
        curve: 'linear',
        group: '8. Second Guitar / Density',
        label: 'Cross-Coupling',
        description: 'How much the two feedback loops bleed into each other through the room (creates interference)'
      }
    ]
  }

  /**
   * @param {string} processorUrl The URL to MMMLabProcessor.js
   */
  constructor(processorUrl = '/packages/mmm-lab/src/MMMLabProcessor.js') {
    super()
    this._processorUrl = processorUrl
    this._ctx = null
    this._output = null
    this._workletNode = null
    this._cabinetEQ = null
    this._limiter = null
    this._masterGain = null
    this._initialized = false
  }

  async init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // 1. Master Output Gain
    this._masterGain = this._ctx.createGain()
    this._masterGain.gain.setValueAtTime(0, this._ctx.currentTime)
    this._masterGain.connect(outputNode)

    // 2. Ear-Safety Limiter
    this._limiter = this._ctx.createDynamicsCompressor()
    this._limiter.threshold.setValueAtTime(-6.0, this._ctx.currentTime)
    this._limiter.knee.setValueAtTime(3.0, this._ctx.currentTime)
    this._limiter.ratio.setValueAtTime(16.0, this._ctx.currentTime)
    this._limiter.attack.setValueAtTime(0.003, this._ctx.currentTime)
    this._limiter.release.setValueAtTime(0.1, this._ctx.currentTime)
    this._limiter.connect(this._masterGain)

    // 3. Speaker Cabinet Lowpass Filter (Guitar Speaker rolloff above 5.5 kHz)
    this._cabinetEQ = this._ctx.createBiquadFilter()
    this._cabinetEQ.type = 'lowpass'
    this._cabinetEQ.frequency.setValueAtTime(5500, this._ctx.currentTime)
    this._cabinetEQ.Q.setValueAtTime(0.7, this._ctx.currentTime)
    this._cabinetEQ.connect(this._limiter)

    // 4. Register AudioWorklet Module
    try {
      await this._ctx.audioWorklet.addModule(this._processorUrl)
    } catch (e) {
      console.error('MMMLabSonifier: Failed to load AudioWorklet module:', e)
      throw e
    }

    // 5. Create AudioWorklet Node
    this._workletNode = new AudioWorkletNode(this._ctx, 'mmm-lab-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    })
    this._workletNode.connect(this._cabinetEQ)

    // 6. Apply Schema Defaults
    this.applyDefaults()
    for (const [k, v] of Object.entries(this._paramValues)) {
      this.onParam(k, v)
    }
    this._initialized = true
  }

  onParam(name, value) {
    if (!this._ctx) return
    const now = this._ctx.currentTime
    const rampTime = 0.025 // 25ms smoothing adhering to GEMINI.md

    if (name === 'tuningPreset') {
      if (this._workletNode && this._workletNode.port) {
        this._workletNode.port.postMessage({ type: 'tuning', preset: value })
      }
      return
    }

    if (name === 'volume') {
      if (this._masterGain && this._masterGain.gain.setTargetAtTime) {
        this._masterGain.gain.setTargetAtTime(value, now, rampTime)
      }
      return
    }

    // AudioWorklet parameters
    if (this._workletNode && this._workletNode.parameters && this._workletNode.parameters.has(name)) {
      const p = this._workletNode.parameters.get(name)
      if (p.setTargetAtTime) {
        p.setTargetAtTime(value, now, rampTime)
      } else {
        p.value = value
      }
    }
  }

  destroy() {
    if (!this._ctx) return

    const now = this._ctx.currentTime
    // Teardown integrity: ramp master gain to zero to prevent audible clicks
    if (this._masterGain && this._masterGain.gain.setTargetAtTime) {
      this._masterGain.gain.setTargetAtTime(0, now, 0.015)
    }

    setTimeout(() => {
      try {
        if (this._workletNode) this._workletNode.disconnect()
        if (this._cabinetEQ) this._cabinetEQ.disconnect()
        if (this._limiter) this._limiter.disconnect()
        if (this._masterGain) this._masterGain.disconnect()
      } catch (e) {
        // Ignore teardown disconnect errors
      }
    }, 50)
  }
}
