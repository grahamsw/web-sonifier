import { SonifierBase } from '@web-sonifier/core'

/**
 * Creates an asymmetric non-linear saturation curve for tube/fuzz emulation.
 * Generates both odd and even harmonics with intermodulation distortion sidebands.
 *
 * @param {number} drive - Distortion intensity multiplier
 * @param {number} [samples=2048] - Number of points in the curve table
 * @returns {Float32Array}
 */
function makeFuzzCurve(drive = 15, samples = 2048) {
  const curve = new Float32Array(samples)
  const d = Math.max(1, drive)
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    // Asymmetric soft clipping (guitar amplifier power stage saturation)
    const saturated = Math.tanh(d * x)
    const evenHarmonic = 0.12 * Math.sin(Math.PI * x)
    curve[i] = Math.max(-1, Math.min(1, saturated + evenHarmonic))
  }
  return curve
}

/**
 * MetalMachineSonifier
 *
 * Inspired by Lou Reed's seminal 1975 noise/industrial masterpiece "Metal Machine Music".
 *
 * Synthesizes:
 * 1. Self-oscillating resonant feedback delay loops (tuned to fundamental, fifth, and screech nodes)
 * 2. High-gain polyphonic intermodulation fuzz/saturation
 * 3. "Tremolo 11" - clashing, unsynchronized dual optical tremolos across stereo channels
 * 4. Microtonal drift and chaotic harmonic hopping
 * 5. Resonant metallic chassis comb reflections
 */
export class MetalMachineSonifier extends SonifierBase {
  getParamSchema() {
    return [
      // -------------------------------------------------------------------------
      // Feedback & Overtones
      // -------------------------------------------------------------------------
      {
        name: 'frequency',
        type: 'number',
        range: [40, 300],
        default: 110,
        unit: 'Hz',
        curve: 'exponential',
        group: 'Feedback & Overtones',
        label: 'Base Frequency',
        description: 'Tuning of the primary feedback drone and open string resonance'
      },
      {
        name: 'feedback',
        type: 'number',
        range: [0.5, 1.3],
        default: 0.98,
        unit: 'gain',
        curve: 'linear',
        group: 'Feedback & Overtones',
        label: 'Loop Gain',
        description: 'Feedback intensity (sub-1.0 = resonant hum; >1.0 = screaming self-oscillation)'
      },
      {
        name: 'screech',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'norm',
        curve: 'exponential',
        group: 'Feedback & Overtones',
        label: 'Harmonic Screech',
        description: 'Resonant emphasis on high harmonic overtone screaming nodes'
      },

      // -------------------------------------------------------------------------
      // Modulation & Tremolo ("Tremolo 11")
      // -------------------------------------------------------------------------
      {
        name: 'rate',
        type: 'number',
        range: [0.5, 25],
        default: 7,
        unit: 'Hz',
        curve: 'exponential',
        group: 'Modulation & Tremolo',
        label: 'Tremolo Speed',
        description: 'Repetition rate of the primary amplifier optical tremolo flutter'
      },
      {
        name: 'clash',
        type: 'number',
        range: [0, 1],
        default: 0.35,
        unit: 'ratio',
        curve: 'linear',
        group: 'Modulation & Tremolo',
        label: 'Tremolo Clash',
        description: 'Detuning ratio between Left & Right tremolos (heterodyne beating clash)'
      },
      {
        name: 'depth',
        type: 'number',
        range: [0, 1],
        default: 0.7,
        unit: 'norm',
        curve: 'linear',
        group: 'Modulation & Tremolo',
        label: 'Tremolo Depth',
        description: 'Modulation depth of the optical tremolo chop'
      },

      // -------------------------------------------------------------------------
      // Distortion & Texture
      // -------------------------------------------------------------------------
      {
        name: 'drive',
        type: 'number',
        range: [1, 50],
        default: 15,
        unit: 'gain',
        curve: 'exponential',
        group: 'Distortion & Texture',
        label: 'Fuzz Drive',
        description: 'High-gain saturation and polyphonic intermodulation distortion'
      },
      {
        name: 'instability',
        type: 'number',
        range: [0, 1],
        default: 0.3,
        unit: 'norm',
        curve: 'linear',
        group: 'Distortion & Texture',
        label: 'Chaos / Drift',
        description: 'Microtonal delay modulation and tendency to jump harmonic modes'
      },

      // -------------------------------------------------------------------------
      // Output & Stereo Space
      // -------------------------------------------------------------------------
      {
        name: 'spread',
        type: 'number',
        range: [0, 1],
        default: 0.85,
        unit: 'stereo',
        curve: 'linear',
        group: 'Output',
        label: 'Stereo Spread',
        description: 'Separation of the feedback loops and clashing tremolos across the stereo field'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'gain',
        curve: 'logarithmic',
        group: 'Output',
        label: 'Master Volume',
        description: 'Output gain level'
      }
    ]
  }

  init(audioContext, outputNode) {
    this.ctx = audioContext
    this.output = outputNode

    const now = this.ctx.currentTime

    // -------------------------------------------------------------------------
    // 1. Master Output Chain (with Soft Limiter for ear safety)
    // -------------------------------------------------------------------------
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.setValueAtTime(0, now)

    this.limiter = this.ctx.createDynamicsCompressor()
    this.limiter.threshold.setValueAtTime(-6, now)
    this.limiter.knee.setValueAtTime(6, now)
    this.limiter.ratio.setValueAtTime(16, now)
    this.limiter.attack.setValueAtTime(0.003, now)
    this.limiter.release.setValueAtTime(0.05, now)

    this.masterGain.connect(this.limiter)
    this.limiter.connect(this.output)

    // -------------------------------------------------------------------------
    // 2. Chassis Resonator (Metallic Formant Filter)
    // -------------------------------------------------------------------------
    this.chassisFilter = this.ctx.createBiquadFilter()
    this.chassisFilter.type = 'peaking'
    this.chassisFilter.frequency.setValueAtTime(1420, now)
    this.chassisFilter.Q.setValueAtTime(3.5, now)
    this.chassisFilter.gain.setValueAtTime(6.0, now)

    // -------------------------------------------------------------------------
    // 3. Clashing Dual Tremolo Stage ("Tremolo 11")
    // -------------------------------------------------------------------------
    this.leftTremGain = this.ctx.createGain()
    this.rightTremGain = this.ctx.createGain()

    // Left Tremolo LFO
    this.leftLfo = this.ctx.createOscillator()
    this.leftLfo.type = 'sine'
    this.leftLfo.frequency.setValueAtTime(7, now)

    this.leftLfoGain = this.ctx.createGain()
    this.leftLfoGain.gain.setValueAtTime(0.3, now)

    this.leftLfo.connect(this.leftLfoGain)
    this.leftLfoGain.connect(this.leftTremGain.gain)

    // Right Tremolo LFO (Detuned by clash ratio to create heterodyne beating)
    this.rightLfo = this.ctx.createOscillator()
    this.rightLfo.type = 'sine'
    this.rightLfo.frequency.setValueAtTime(8.5, now)

    this.rightLfoGain = this.ctx.createGain()
    this.rightLfoGain.gain.setValueAtTime(0.3, now)

    this.rightLfo.connect(this.rightLfoGain)
    this.rightLfoGain.connect(this.rightTremGain.gain)

    // Baseline gain for optical tremolo
    this.leftTremGain.gain.setValueAtTime(0.7, now)
    this.rightTremGain.gain.setValueAtTime(0.7, now)

    // Stereo Panning for the two tremolo paths
    this.leftPanner = this._createStereoPanner(-0.85)
    this.rightPanner = this._createStereoPanner(0.85)

    this.leftTremGain.connect(this.leftPanner)
    this.rightTremGain.connect(this.rightPanner)

    this.leftPanner.connect(this.masterGain)
    this.rightPanner.connect(this.masterGain)

    // Route chassis filter into left and right tremolo paths
    this.chassisFilter.connect(this.leftTremGain)
    this.chassisFilter.connect(this.rightTremGain)

    // -------------------------------------------------------------------------
    // 4. Intermodulation Fuzz Stage (WaveShaper)
    // -------------------------------------------------------------------------
    this.fuzzShaper = this.ctx.createWaveShaper()
    this.fuzzShaper.curve = makeFuzzCurve(15)
    this.fuzzShaper.oversample = '2x'
    this.fuzzShaper.connect(this.chassisFilter)

    // -------------------------------------------------------------------------
    // 5. Triple Resonant Feedback Loops
    // -------------------------------------------------------------------------
    this.feedbackSum = this.ctx.createGain()
    this.feedbackSum.connect(this.fuzzShaper)

    // Voice 1: Fundamental Drone Loop
    this.delay1 = this.ctx.createDelay(1.0)
    this.delay1.delayTime.setValueAtTime(1 / 110, now)

    this.filter1 = this.ctx.createBiquadFilter()
    this.filter1.type = 'bandpass'
    this.filter1.frequency.setValueAtTime(110, now)
    this.filter1.Q.setValueAtTime(6.0, now)

    this.fbGain1 = this.ctx.createGain()
    this.fbGain1.gain.setValueAtTime(0.48, now)

    // Voice 2: Fifth / Octave Overtone Loop
    this.delay2 = this.ctx.createDelay(1.0)
    this.delay2.delayTime.setValueAtTime(1 / 165, now)

    this.filter2 = this.ctx.createBiquadFilter()
    this.filter2.type = 'bandpass'
    this.filter2.frequency.setValueAtTime(165, now)
    this.filter2.Q.setValueAtTime(8.5, now)

    this.fbGain2 = this.ctx.createGain()
    this.fbGain2.gain.setValueAtTime(0.42, now)

    // Voice 3: High Screech Loop
    this.delay3 = this.ctx.createDelay(1.0)
    this.delay3.delayTime.setValueAtTime(1 / 330, now)

    this.filter3 = this.ctx.createBiquadFilter()
    this.filter3.type = 'highpass'
    this.filter3.frequency.setValueAtTime(330, now)
    this.filter3.Q.setValueAtTime(10.0, now)

    this.fbGain3 = this.ctx.createGain()
    this.fbGain3.gain.setValueAtTime(0.2, now)

    // Interconnect feedback network
    // Loop 1
    this.fuzzShaper.connect(this.delay1)
    this.delay1.connect(this.filter1)
    this.filter1.connect(this.fbGain1)
    this.fbGain1.connect(this.feedbackSum)

    // Loop 2
    this.fuzzShaper.connect(this.delay2)
    this.delay2.connect(this.filter2)
    this.filter2.connect(this.fbGain2)
    this.fbGain2.connect(this.feedbackSum)

    // Loop 3
    this.fuzzShaper.connect(this.delay3)
    this.delay3.connect(this.filter3)
    this.filter3.connect(this.fbGain3)
    this.fbGain3.connect(this.feedbackSum)

    // -------------------------------------------------------------------------
    // 6. Chaotic Instability Drift LFO
    // -------------------------------------------------------------------------
    this.driftLfo = this.ctx.createOscillator()
    this.driftLfo.type = 'triangle'
    this.driftLfo.frequency.setValueAtTime(1.8, now)

    this.driftGain1 = this.ctx.createGain()
    this.driftGain2 = this.ctx.createGain()
    this.driftGain3 = this.ctx.createGain()

    const maxDrift = 0.0005
    this.driftGain1.gain.setValueAtTime(maxDrift, now)
    this.driftGain2.gain.setValueAtTime(maxDrift * 0.7, now)
    this.driftGain3.gain.setValueAtTime(maxDrift * 1.3, now)

    this.driftLfo.connect(this.driftGain1)
    this.driftLfo.connect(this.driftGain2)
    this.driftLfo.connect(this.driftGain3)

    this.driftGain1.connect(this.delay1.delayTime)
    this.driftGain2.connect(this.delay2.delayTime)
    this.driftGain3.connect(this.delay3.delayTime)

    // -------------------------------------------------------------------------
    // 7. Seed Noise / Pickup Hum Generator
    // -------------------------------------------------------------------------
    this.seedSource = this._createSeedNoiseSource()
    this.seedGain = this.ctx.createGain()
    this.seedGain.gain.setValueAtTime(0.04, now)

    this.seedSource.connect(this.seedGain)
    this.seedGain.connect(this.feedbackSum)

    // Start all active sources
    this.leftLfo.start(now)
    this.rightLfo.start(now)
    this.driftLfo.start(now)
    this.seedSource.start(now)

    // Apply default parameter settings via SonifierBase
    this.applyDefaults()
  }

  onParam(name, value) {
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const tc = 0.025 // 25ms smoothing constant

    switch (name) {
      case 'frequency': {
        const f0 = Math.max(40, Math.min(300, value))
        const f1 = f0 * 1.503
        const f2 = f0 * 3.018

        this.delay1.delayTime.setTargetAtTime(1 / f0, now, tc)
        this.filter1.frequency.setTargetAtTime(f0, now, tc)

        this.delay2.delayTime.setTargetAtTime(1 / f1, now, tc)
        this.filter2.frequency.setTargetAtTime(f1, now, tc)

        this.delay3.delayTime.setTargetAtTime(1 / f2, now, tc)
        this.filter3.frequency.setTargetAtTime(f2, now, tc)
        break
      }

      case 'feedback': {
        const fb = Math.max(0.5, Math.min(1.3, value))
        const screech = this.getParam('screech') ?? 0.5
        this.fbGain1.gain.setTargetAtTime(fb * 0.48, now, tc)
        this.fbGain2.gain.setTargetAtTime(fb * 0.42, now, tc)
        this.fbGain3.gain.setTargetAtTime(fb * 0.35 * screech, now, tc)
        break
      }

      case 'screech': {
        const sc = Math.max(0, Math.min(1, value))
        const fb = this.getParam('feedback') ?? 0.98
        const screechGain = fb * 0.35 * sc
        this.fbGain3.gain.setTargetAtTime(screechGain, now, tc)
        break
      }

      case 'rate': {
        const r = Math.max(0.5, Math.min(25, value))
        const clash = this.getParam('clash') ?? 0.35
        this.leftLfo.frequency.setTargetAtTime(r, now, tc)
        const rightRate = r * (1 + clash * 0.4)
        this.rightLfo.frequency.setTargetAtTime(rightRate, now, tc)
        break
      }

      case 'clash': {
        const c = Math.max(0, Math.min(1, value))
        const rate = this.getParam('rate') ?? 7
        const rightRate = rate * (1 + c * 0.4)
        this.rightLfo.frequency.setTargetAtTime(rightRate, now, tc)
        break
      }

      case 'depth': {
        const d = Math.max(0, Math.min(1, value))
        this.leftLfoGain.gain.setTargetAtTime(d * 0.45, now, tc)
        this.rightLfoGain.gain.setTargetAtTime(d * 0.45, now, tc)
        this.leftTremGain.gain.setTargetAtTime(1 - d * 0.45, now, tc)
        this.rightTremGain.gain.setTargetAtTime(1 - d * 0.45, now, tc)
        break
      }

      case 'drive': {
        const dr = Math.max(1, Math.min(50, value))
        this.fuzzShaper.curve = makeFuzzCurve(dr)
        break
      }

      case 'instability': {
        const inst = Math.max(0, Math.min(1, value))
        const maxDrift = 0.0015 * inst
        this.driftGain1.gain.setTargetAtTime(maxDrift, now, tc)
        this.driftGain2.gain.setTargetAtTime(maxDrift * 0.7, now, tc)
        this.driftGain3.gain.setTargetAtTime(maxDrift * 1.3, now, tc)
        break
      }

      case 'spread': {
        const sp = Math.max(0, Math.min(1, value))
        this._setPannerPosition(this.leftPanner, -sp)
        this._setPannerPosition(this.rightPanner, sp)
        break
      }

      case 'volume': {
        const v = Math.max(0, Math.min(1, value))
        this.masterGain.gain.setTargetAtTime(v, now, tc)
        break
      }
    }
  }

  destroy() {
    if (!this.ctx) return

    const now = this.ctx.currentTime

    // 1. Smooth ramp master gain to zero to avoid teardown pops (GEMINI.md rule)
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.03)
    }

    // 2. Stop oscillators and sources after fade out
    setTimeout(() => {
      try {
        if (this.leftLfo) { this.leftLfo.stop(); this.leftLfo.disconnect() }
        if (this.rightLfo) { this.rightLfo.stop(); this.rightLfo.disconnect() }
        if (this.driftLfo) { this.driftLfo.stop(); this.driftLfo.disconnect() }
        if (this.seedSource) { this.seedSource.stop(); this.seedSource.disconnect() }

        if (this.delay1) this.delay1.disconnect()
        if (this.delay2) this.delay2.disconnect()
        if (this.delay3) this.delay3.disconnect()
        if (this.filter1) this.filter1.disconnect()
        if (this.filter2) this.filter2.disconnect()
        if (this.filter3) this.filter3.disconnect()
        if (this.fbGain1) this.fbGain1.disconnect()
        if (this.fbGain2) this.fbGain2.disconnect()
        if (this.fbGain3) this.fbGain3.disconnect()
        if (this.fuzzShaper) this.fuzzShaper.disconnect()
        if (this.chassisFilter) this.chassisFilter.disconnect()
        if (this.leftTremGain) this.leftTremGain.disconnect()
        if (this.rightTremGain) this.rightTremGain.disconnect()
        if (this.leftPanner) this.leftPanner.disconnect()
        if (this.rightPanner) this.rightPanner.disconnect()
        if (this.limiter) this.limiter.disconnect()
        if (this.masterGain) this.masterGain.disconnect()
      } catch (err) {
        // Safe teardown
      }
    }, 40)
  }

  /**
   * Helper to create a StereoPannerNode or Fallback Gain Splitter
   * @private
   */
  _createStereoPanner(panValue) {
    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner()
      panner.pan.setValueAtTime(panValue, this.ctx.currentTime)
      return panner
    }
    // Fallback: regular gain node
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(1.0, this.ctx.currentTime)
    return gain
  }

  /**
   * Helper to set pan position on StereoPanner or fallback
   * @private
   */
  _setPannerPosition(node, panValue) {
    if (node && node.pan && typeof node.pan.setTargetAtTime === 'function') {
      node.pan.setTargetAtTime(panValue, this.ctx.currentTime, 0.025)
    }
  }

  /**
   * Generates a continuous looping buffer of pink noise and 60Hz hum
   * that seeds the guitar pickup feedback loop.
   * @private
   */
  _createSeedNoiseSource() {
    const sampleRate = this.ctx.sampleRate || 44100
    const bufferLength = sampleRate * 2 // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferLength, sampleRate)
    const data = buffer.getChannelData(0)

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < bufferLength; i++) {
      const white = Math.random() * 2 - 1
      // Paul Kellet's pink noise filter algorithm
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
      b6 = white * 0.115926

      // Add faint 60Hz and 120Hz pickup hum
      const t = i / sampleRate
      const hum = 0.08 * Math.sin(2 * Math.PI * 60 * t) + 0.04 * Math.sin(2 * Math.PI * 120 * t)
      data[i] = (pink * 0.05 + hum) * 0.15
    }

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    return source
  }
}
