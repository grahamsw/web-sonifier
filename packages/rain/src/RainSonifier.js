import { SonifierBase } from '@web-sonifier/core'

/**
 * RainSonifier
 *
 * Simulates an acoustic rain environment using a dual-layer synthesis model:
 * 1. Granular Droplet Engine: A Poisson process schedules individual droplet impacts
 *    filtered through tuned resonant bandpass filters with stereo dispersion.
 * 2. Ambient Rain Wash: A continuous filtered noise layer providing the characteristic
 *    background rain shower that swells smoothly with intensity.
 *
 * Parameters:
 *   intensity   - Droplet arrival rate (drops/sec) and rain wash swell (0..500)
 *   pitch       - Resonant frequency of droplets and rain wash (200..4000 Hz)
 *   dropletSize - Decay time and weight of droplet impacts (0.1..2.0)
 *   spread      - Stereo panning dispersion width (0..1)
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
        group: 'rain',
        label: 'Rain Intensity',
        description: 'Droplet arrival rate and ambient shower swell'
      },
      {
        name: 'pitch',
        type: 'number',
        range: [200, 4000],
        default: 1200,
        group: 'rain',
        label: 'Rain Pitch',
        description: 'Resonant frequency of droplets and rain wash'
      },
      {
        name: 'dropletSize',
        type: 'number',
        range: [0.1, 2.0],
        default: 1.0,
        group: 'rain',
        label: 'Droplet Size',
        description: 'Droplet impact weight and decay time'
      },
      {
        name: 'spread',
        type: 'number',
        range: [0, 1],
        default: 0.8,
        group: 'rain',
        label: 'Stereo Spread',
        description: 'Stereo panning dispersion'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'rain',
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

    // Pre-calculate audio buffers
    this._dropImpulseBuffer = this._createDropImpulseBuffer()
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
      const normalizedIntensity = Math.min(1, Math.max(0, value / 300))
      const targetWashGain = Math.pow(normalizedIntensity, 1.4) * 0.35
      this._washGain.gain.setTargetAtTime(targetWashGain, now, 0.03)
    }

    if (name === 'pitch' && this._washFilter) {
      const targetFreq = Math.min(16000, Math.max(100, value * 1.5))
      this._washFilter.frequency.setTargetAtTime(targetFreq, now, 0.03)
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

      setTimeout(() => {
        try {
          if (washSource) {
            washSource.stop()
            washSource.disconnect()
          }
          if (washFilter) washFilter.disconnect()
          if (washGain) washGain.disconnect()
          if (gainNode) gainNode.disconnect()
        } catch {
          // Audio nodes already stopped or detached
        }
      }, 30)
    }

    this._washSource = null
    this._washGain = null
    this._washFilter = null
    this._gainNode = null
    this._ctx = null
    this._dropImpulseBuffer = null
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
    const initialPitch = this.getParam('pitch') || 1200
    this._washFilter.frequency.value = Math.min(16000, initialPitch * 1.5)

    this._washGain = this._ctx.createGain()
    const initialIntensity = this.getParam('intensity') || 30
    const norm = Math.min(1, initialIntensity / 300)
    this._washGain.gain.value = Math.pow(norm, 1.4) * 0.35

    this._washSource.connect(this._washFilter)
    this._washFilter.connect(this._washGain)
    this._washGain.connect(this._gainNode)

    try {
      this._washSource.start(0)
    } catch {
      // In mock/test environments start may not be needed or already started
    }
  }

  _createDropImpulseBuffer() {
    const duration = 0.015 // 15ms excitation
    const sampleRate = this._ctx.sampleRate
    const frameCount = Math.floor(sampleRate * duration)
    const buffer = this._ctx.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < frameCount; i++) {
      const t = i / frameCount
      const decay = Math.exp(-t * 20)
      data[i] = (Math.random() * 2 - 1) * decay
    }
    return buffer
  }

  _createWashBuffer() {
    const duration = 2.0 // 2 seconds seamless loop
    const sampleRate = this._ctx.sampleRate
    const frameCount = Math.floor(sampleRate * duration)
    const buffer = this._ctx.createBuffer(2, frameCount, sampleRate)

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      let b0 = 0, b1 = 0, b2 = 0
      for (let i = 0; i < frameCount; i++) {
        // Pink noise approximation
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        const pink = b0 + b1 + b2 + white * 0.5362
        data[i] = pink * 0.1
      }
    }
    return buffer
  }

  _schedule() {
    if (!this._ctx) return

    const now = this._ctx.currentTime
    const intensity = this.getParam('intensity') || 0

    // Schedule droplet impacts using a Poisson process
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
    if (!this._ctx || !this._gainNode) return

    const basePitch = this.getParam('pitch') || 1200
    const size = this.getParam('dropletSize') || 1.0
    const spread = this.getParam('spread') ?? 0.8

    // Random pitch variance around base pitch (+/- 15%)
    const pitchJitter = 1 + (Math.random() - 0.5) * 0.3
    const dropFreq = Math.min(8000, Math.max(150, basePitch * pitchJitter))

    const source = this._ctx.createBufferSource()
    source.buffer = this._dropImpulseBuffer

    // Resonant bandpass filter
    const filter = this._ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(dropFreq, time)
    filter.Q.setValueAtTime(10 + 5 * size, time)

    // Amplitude envelope for this single drop
    const dropGain = this._ctx.createGain()
    const peakGain = (0.2 + Math.random() * 0.15) * Math.min(1.5, size)
    const dropDuration = 0.02 * size

    dropGain.gain.setValueAtTime(0, time)
    dropGain.gain.linearRampToValueAtTime(peakGain, time + 0.002)
    dropGain.gain.exponentialRampToValueAtTime(0.0001, time + dropDuration)

    source.connect(filter)
    filter.connect(dropGain)

    // Stereo panning if supported
    if (typeof this._ctx.createStereoPanner === 'function') {
      const panner = this._ctx.createStereoPanner()
      const panVal = (Math.random() * 2 - 1) * spread
      panner.pan.setValueAtTime(panVal, time)
      dropGain.connect(panner)
      panner.connect(this._gainNode)
    } else {
      dropGain.connect(this._gainNode)
    }

    source.start(time)
    source.stop(time + dropDuration + 0.01)
  }
}
