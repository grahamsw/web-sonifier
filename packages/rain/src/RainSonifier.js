import { SonifierBase } from '@web-sonifier/core'

/**
 * RainSonifier
 *
 * Physical modeling rain environment based on Andy Farnell's Designing Sound
 * (Chapter 34: Water / Bubbles & Chapter 36: Rain).
 *
 * Implements three physically distinct acoustic impact surfaces:
 * 1. puddle: Water-on-water impact with Marcel Minnaert bubble cavity resonance,
 *    an upward frequency chirp (+35%) as the bubble neck pinches off, and a subtle splash transient.
 * 2. roof: Raindrop impact on corrugated sheet metal / tin roof, exciting thin plate inharmonic
 *    bending modes (2.3 kHz, 4.1 kHz, 6.1 kHz, 8.6 kHz) with a sharp metallic transient and resonant ring.
 * 3. foliage: Inelastic impact on leaves and garden soil, producing lowpass-damped organic spatters.
 *
 * Spatial Audio:
 * Exposes both Stereo Pan (center azimuth) and Stereo Spread (apparent source width).
 * Rain can range from a tightly localized trickle to a fully enveloping 180° surround sound field.
 *
 * Parameters:
 *   intensity   - Droplet arrival rate (drops/sec) and rain wash swell (0..500)
 *   pitch       - Spectral brightness and cavity resonance tuning (200..4000 Hz)
 *   dropletSize - Mass and duration of droplets (0.1..2.0)
 *   surface     - Impact material ('puddle', 'foliage', 'roof')
 *   pan         - Center azimuth position (-1..1)
 *   spread      - Angular field width / apparent source width (0..1, default 0.95)
 *   volume      - Master sonifier volume (0..1)
 */
export class RainSonifier extends SonifierBase {

  getParamSchema() {
    return [
      {
        name: 'intensity',
        type: 'number',
        range: [0, 500],
        default: 30,
        unit: 'drops/s',
        curve: 'exponential',
        group: 'Rainfall Character',
        label: 'Rain Intensity',
        description: 'Droplet arrival rate and ambient shower swell'
      },
      {
        name: 'pitch',
        type: 'number',
        range: [200, 4000],
        default: 1200,
        unit: 'Hz',
        curve: 'exponential',
        group: 'Rainfall Character',
        label: 'Rain Pitch',
        description: 'Spectral brightness of droplets and rain wash'
      },
      {
        name: 'dropletSize',
        type: 'number',
        range: [0.1, 2.0],
        default: 1.0,
        unit: 'scale',
        curve: 'linear',
        group: 'Rainfall Character',
        label: 'Droplet Size',
        description: 'Droplet mass, impact energy, and duration'
      },
      {
        name: 'surface',
        type: 'enum',
        values: ['puddle', 'foliage', 'roof'],
        default: 'puddle',
        group: 'Rainfall Character',
        label: 'Impact Surface',
        description: 'Physical impact material (puddle = Minnaert bubble chirps, roof = metallic plate pings, foliage = damped spatter)'
      },
      {
        name: 'pan',
        type: 'number',
        range: [-1, 1],
        default: 0.0,
        unit: 'pan',
        curve: 'linear',
        group: 'Acoustic Space',
        label: 'Stereo Pan',
        description: 'Center azimuth position of the rain field (-1 left, 0 center, +1 right)'
      },
      {
        name: 'spread',
        type: 'number',
        range: [0, 1],
        default: 0.95,
        unit: 'norm',
        curve: 'linear',
        group: 'Acoustic Space',
        label: 'Stereo Spread / Field Width',
        description: 'Angular extent of the rainfall field, from localized point (0) to enveloping 180° surround (1)'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'gain',
        curve: 'logarithmic',
        group: 'Acoustic Space',
        label: 'Volume',
        description: 'Master gain of the rain sonifier'
      }
    ]
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // Master gain node with click-free smoothing
    this._gainNode = audioContext.createGain()
    this._gainNode.gain.value = 0
    this._gainNode.connect(outputNode)

    // Pre-calculate physical surface variation pools and looping rain wash
    this._initSurfaceBuffers()
    this._washBuffer = this._createWashBuffer()

    // Setup ambient rain wash layer
    this._setupAmbientWash()

    // Scheduler state for granular droplets
    this._nextDropTime = audioContext.currentTime
    this._timer = null
    this._lookahead = 0.1          // Lookahead scheduling window (seconds)
    this._scheduleInterval = 25    // Scheduling check interval (ms)

    this._schedule()
  }

  onParam(name, value) {
    if (!this._ctx) return
    const now = this._ctx.currentTime

    if (name === 'volume' && this._gainNode) {
      this._gainNode.gain.setTargetAtTime(value, now, 0.02)
    }

    if (name === 'intensity' && this._washGain) {
      // Smoothly swell ambient wash as intensity increases
      const normalizedIntensity = Math.min(1, Math.max(0, value / 250))
      const targetWashGain = Math.pow(normalizedIntensity, 1.2) * 0.4
      this._washGain.gain.setTargetAtTime(targetWashGain, now, 0.03)
    }

    if (name === 'pitch' && this._washFilter) {
      // Spectral tilt tracking pitch (brightness of rain shower)
      const targetFreq = Math.min(16000, Math.max(300, value * 2.2))
      this._washFilter.frequency.setTargetAtTime(targetFreq, now, 0.03)
    }

    if (name === 'pan' && this._washPanner && this._washPanner.pan) {
      this._washPanner.pan.setTargetAtTime(value, now, 0.02)
    }
  }

  destroy() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }

    // Ramp gain to zero before stopping sources and disconnecting (avoid pops)
    if (this._gainNode && this._ctx) {
      const now = this._ctx.currentTime
      this._gainNode.gain.setTargetAtTime(0, now, 0.01)

      const washSource = this._washSource
      const gainNode = this._gainNode
      const washGain = this._washGain
      const washFilter = this._washFilter
      const washPanner = this._washPanner

      setTimeout(() => {
        try {
          if (washSource) {
            washSource.stop()
            washSource.disconnect()
          }
          if (washFilter) washFilter.disconnect()
          if (washGain) washGain.disconnect()
          if (washPanner) washPanner.disconnect()
          if (gainNode) gainNode.disconnect()
        } catch {
          // Audio nodes already stopped or detached
        }
      }, 30)
    }

    this._washSource = null
    this._washGain = null
    this._washFilter = null
    this._washPanner = null
    this._gainNode = null
    this._ctx = null
    this._surfaceBuffers = null
    this._washBuffer = null
  }

  // ---------------------------------------------------------------------------
  // Internal Synthesis & Scheduling
  // ---------------------------------------------------------------------------

  _setupAmbientWash() {
    if (!this._ctx || !this._washBuffer) return

    this._washSource = this._ctx.createBufferSource()
    this._washSource.buffer = this._washBuffer
    this._washSource.loop = true

    this._washFilter = this._ctx.createBiquadFilter()
    this._washFilter.type = 'lowpass'
    this._washFilter.Q.value = 0.7 // Flat, natural non-resonant Butterworth roll-off
    const initialPitch = this.getParam('pitch') || 1200
    this._washFilter.frequency.value = Math.min(16000, initialPitch * 2.2)

    this._washGain = this._ctx.createGain()
    const initialIntensity = this.getParam('intensity') || 30
    const norm = Math.min(1, initialIntensity / 250)
    this._washGain.gain.value = Math.pow(norm, 1.2) * 0.4

    this._washSource.connect(this._washFilter)
    this._washFilter.connect(this._washGain)

    if (typeof this._ctx.createStereoPanner === 'function') {
      this._washPanner = this._ctx.createStereoPanner()
      const initialPan = this.getParam('pan') ?? 0.0
      this._washPanner.pan.value = initialPan
      this._washGain.connect(this._washPanner)
      this._washPanner.connect(this._gainNode)
    } else {
      this._washGain.connect(this._gainNode)
    }

    try {
      this._washSource.start(0)
    } catch {
      // In mock/test environments start may not be needed or already started
    }
  }

  _initSurfaceBuffers() {
    this._surfaceBuffers = {
      puddle: [],
      roof: [],
      foliage: []
    }

    const basePuddleFreq = 1350
    const baseRoofFreq = 2300

    for (let i = 0; i < 6; i++) {
      // Puddle: Minnaert bubble cavity resonance variations
      const pJitter = 0.82 + i * 0.07 + (Math.random() - 0.5) * 0.04
      this._surfaceBuffers.puddle.push(
        this._createPuddleBuffer(basePuddleFreq * pJitter, 0.042)
      )

      // Tin Roof: Sheet metal plate inharmonic mode variations
      const rJitter = 0.88 + i * 0.05 + (Math.random() - 0.5) * 0.03
      this._surfaceBuffers.roof.push(
        this._createRoofBuffer(baseRoofFreq * rJitter, 0.048)
      )

      // Foliage: Damped organic leaf spatter variations
      const fDuration = 0.022 + i * 0.003
      this._surfaceBuffers.foliage.push(
        this._createFoliageBuffer(fDuration)
      )
    }
  }

  _createPuddleBuffer(f0, duration) {
    const sampleRate = this._ctx.sampleRate || 44100
    const frameCount = Math.max(1, Math.floor(sampleRate * duration))
    const buffer = this._ctx.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)
    const tau = duration * 0.30 // ~12ms decay
    const beta = 0.38 // 38% upward Minnaert frequency chirp
    const attackFrames = Math.max(1, Math.floor(sampleRate * 0.0015)) // 1.5ms soft attack

    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate
      // Phase integral for linear upward chirp f(t) = f0 * (1 + beta * (t/duration))
      const phase = 2 * Math.PI * f0 * (t + (beta / 2) * (t * t / duration))
      const bubble = Math.sin(phase)

      let env
      if (i < attackFrames) {
        env = (i / attackFrames) * Math.exp(-t / tau)
      } else {
        env = Math.exp(-t / tau)
      }

      // Initial surface tension splash click in first 1.5ms
      let click = 0
      if (t < 0.0015) {
        click = (Math.random() * 2 - 1) * (1 - t / 0.0015) * 0.16
      }

      data[i] = (bubble + click) * env * 0.85
    }
    return buffer
  }

  _createRoofBuffer(f0, duration) {
    const sampleRate = this._ctx.sampleRate || 44100
    const frameCount = Math.max(1, Math.floor(sampleRate * duration))
    const buffer = this._ctx.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)

    // Thin sheet metal plate inharmonic modes
    const modes = [
      { freq: f0 * 1.00, amp: 0.60, tau: 0.035 },
      { freq: f0 * 1.77, amp: 0.35, tau: 0.024 },
      { freq: f0 * 2.64, amp: 0.20, tau: 0.016 },
      { freq: f0 * 3.73, amp: 0.10, tau: 0.009 }
    ]

    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate
      let sample = 0

      // Sharp metallic impact transient in first 0.8ms
      if (t < 0.0008) {
        sample += (Math.random() * 2 - 1) * (1 - t / 0.0008) * 0.42
      }

      for (const m of modes) {
        if (m.freq < sampleRate * 0.48) {
          sample += m.amp * Math.exp(-t / m.tau) * Math.sin(2 * Math.PI * m.freq * t)
        }
      }

      const microRamp = Math.min(1, i / Math.max(1, sampleRate * 0.0003))
      data[i] = sample * microRamp * 0.80
    }
    return buffer
  }

  _createFoliageBuffer(duration) {
    const sampleRate = this._ctx.sampleRate || 44100
    const frameCount = Math.max(1, Math.floor(sampleRate * duration))
    const buffer = this._ctx.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)
    const attackFrames = Math.max(1, Math.floor(sampleRate * 0.0025))
    const tau = 0.011

    let b0 = 0, b1 = 0
    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate
      const white = Math.random() * 2 - 1
      // Lowpass filter for soft organic thump
      b0 = 0.88 * b0 + white * 0.12
      b1 = 0.85 * b1 + b0 * 0.15

      let env
      if (i < attackFrames) {
        env = 0.5 * (1 - Math.cos((Math.PI * i) / attackFrames))
      } else {
        env = Math.exp(-(t - 0.0025) / tau)
      }
      data[i] = (b0 + b1) * env * 0.65
    }
    return buffer
  }

  _createWashBuffer() {
    // 3 seconds seamless stereo rain bed: balanced white and pink noise
    const duration = 3.0
    const sampleRate = this._ctx.sampleRate || 44100
    const frameCount = Math.max(1, Math.floor(sampleRate * duration))
    const buffer = this._ctx.createBuffer(2, frameCount, sampleRate)

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      let b0 = 0, b1 = 0, b2 = 0
      for (let i = 0; i < frameCount; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        const pink = b0 + b1 + b2 + white * 0.5362
        // Mix pink noise body with crisp white noise texture
        data[i] = (pink * 0.08 + white * 0.035)
      }
    }
    return buffer
  }

  _schedule() {
    if (!this._ctx) return

    const now = this._ctx.currentTime
    const intensity = this.getParam('intensity') || 0

    // Schedule droplet spatters using a Poisson process
    while (intensity > 0 && this._nextDropTime < now + this._lookahead) {
      this._scheduleDrop(this._nextDropTime)

      // Interval = -ln(U) / intensity
      const u = Math.max(0.0001, Math.random())
      const delta = -Math.log(u) / intensity
      this._nextDropTime += delta
    }

    if (intensity <= 0 || this._nextDropTime < now) {
      this._nextDropTime = now + this._lookahead
    }

    this._timer = setTimeout(() => this._schedule(), this._scheduleInterval)
  }

  _scheduleDrop(time) {
    if (!this._ctx || !this._gainNode || !this._surfaceBuffers) return

    const basePitch = this.getParam('pitch') || 1200
    const size = this.getParam('dropletSize') || 1.0
    const centerPan = this.getParam('pan') ?? 0.0
    const spread = this.getParam('spread') ?? 0.95
    const surface = this.getParam('surface') || 'puddle'

    const pool = this._surfaceBuffers[surface] || this._surfaceBuffers.puddle
    if (!pool || pool.length === 0) return
    const buffer = pool[Math.floor(Math.random() * pool.length)]
    if (!buffer) return

    const source = this._ctx.createBufferSource()
    source.buffer = buffer

    // Pitch scaling from pitch parameter and micro-jitter
    const pitchRatio = (basePitch / 1200) * (1 + (Math.random() - 0.5) * 0.22)
    // Larger droplets produce slightly deeper resonance
    const sizePitchMult = Math.pow(size, -0.15)
    const finalRate = Math.max(0.2, Math.min(4.0, pitchRatio * sizePitchMult))
    if (source.playbackRate && typeof source.playbackRate.setValueAtTime === 'function') {
      source.playbackRate.setValueAtTime(finalRate, time)
    } else if (source.playbackRate) {
      source.playbackRate.value = finalRate
    }

    const dropGain = this._ctx.createGain()
    // Droplet volume scaling with kinetic energy
    const peakGain = (0.16 + Math.random() * 0.10) * Math.min(1.5, Math.pow(size, 0.6))
    if (dropGain.gain && typeof dropGain.gain.setValueAtTime === 'function') {
      dropGain.gain.setValueAtTime(peakGain, time)
    } else if (dropGain.gain) {
      dropGain.gain.value = peakGain
    }

    source.connect(dropGain)

    // Spatial positioning: pan + spread
    // Droplets fall across the auditory field within [pan - spread, pan + spread]
    const panOffset = (Math.random() * 2 - 1) * spread
    const dropPan = Math.max(-1, Math.min(1, centerPan + panOffset))

    if (typeof this._ctx.createStereoPanner === 'function') {
      const panner = this._ctx.createStereoPanner()
      if (panner.pan && typeof panner.pan.setValueAtTime === 'function') {
        panner.pan.setValueAtTime(dropPan, time)
      } else if (panner.pan) {
        panner.pan.value = dropPan
      }
      dropGain.connect(panner)
      panner.connect(this._gainNode)
    } else {
      dropGain.connect(this._gainNode)
    }

    try {
      source.start(time)
    } catch {
      // In mock/test environments
    }
  }
}
