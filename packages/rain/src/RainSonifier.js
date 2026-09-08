import { SonifierBase } from '@web-sonifier/core'

/**
 * RainSonifier
 *
 * Simulates an acoustic rain environment using a dual-layer noise synthesis model:
 * 1. Granular Droplet Engine: A Poisson process schedules short, non-resonant
 *    white-noise droplet spatters with gentle spectral shaping and stereo dispersion.
 * 2. Ambient Rain Wash: A continuous filtered pink/white noise bed providing the
 *    natural background rain shower that swells smoothly with intensity.
 *
 * Parameters:
 *   intensity   - Droplet arrival rate (drops/sec) and rain wash swell (0..500)
 *   pitch       - Spectral brightness/cutoff of droplets and rain wash (200..4000 Hz)
 *   dropletSize - Duration and weight of droplet spatters (0.1..2.0)
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
        description: 'Spectral brightness of droplets and rain wash'
      },
      {
        name: 'dropletSize',
        type: 'number',
        range: [0.1, 2.0],
        default: 1.0,
        group: 'rain',
        label: 'Droplet Size',
        description: 'Droplet spatter weight and duration'
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

    // Pre-calculate audio buffers (short white noise spatter + looping wash)
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
    this._washFilter.Q.value = 0.7 // Flat, natural non-resonant Butterworth roll-off
    const initialPitch = this.getParam('pitch') || 1200
    this._washFilter.frequency.value = Math.min(16000, initialPitch * 2.2)

    this._washGain = this._ctx.createGain()
    const initialIntensity = this.getParam('intensity') || 30
    const norm = Math.min(1, initialIntensity / 250)
    this._washGain.gain.value = Math.pow(norm, 1.2) * 0.4

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
    // Soft fluid droplet buffer: smooth Hann attack followed by gentle decay (no sharp fire clicks)
    const duration = 0.02 // 20ms
    const sampleRate = this._ctx.sampleRate
    const frameCount = Math.floor(sampleRate * duration)
    const attackFrames = Math.floor(sampleRate * 0.003) // 3ms smooth onset
    const buffer = this._ctx.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)

    let b0 = 0, b1 = 0
    for (let i = 0; i < frameCount; i++) {
      // Soft pink/brownian noise base for water texture rather than harsh white noise
      const white = Math.random() * 2 - 1
      b0 = 0.99 * b0 + white * 0.08
      b1 = 0.95 * b1 + b0 * 0.1
      const noise = b0 + b1 + white * 0.1

      let envelope
      if (i < attackFrames) {
        // Smooth raised-cosine attack (eliminates crackle/click)
        envelope = 0.5 * (1 - Math.cos((Math.PI * i) / attackFrames))
      } else {
        const decayT = (i - attackFrames) / (frameCount - attackFrames)
        envelope = Math.exp(-decayT * 6)
      }
      data[i] = noise * envelope
    }
    return buffer
  }

  _createWashBuffer() {
    // 3 seconds seamless stereo rain bed: balanced white and pink noise
    const duration = 3.0
    const sampleRate = this._ctx.sampleRate
    const frameCount = Math.floor(sampleRate * duration)
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
    if (!this._ctx || !this._gainNode) return

    const basePitch = this.getParam('pitch') || 1200
    const size = this.getParam('dropletSize') || 1.0
    const spread = this.getParam('spread') ?? 0.8

    // Warm water droplet frequency range (300 Hz - 2800 Hz)
    const pitchJitter = 1 + (Math.random() - 0.5) * 0.4
    const dropFreq = Math.min(2800, Math.max(300, basePitch * 0.8 * pitchJitter))

    const source = this._ctx.createBufferSource()
    source.buffer = this._dropImpulseBuffer

    // Lowpass/bandpass filter with low Q (0.7): soft, round droplet sound without harsh fire snaps
    const filter = this._ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(dropFreq, time)
    filter.Q.setValueAtTime(0.7, time)

    // Smooth amplitude envelope with 3ms soft attack and gentle decay
    const dropGain = this._ctx.createGain()
    const peakGain = (0.02 + Math.random() * 0.02) * Math.min(1.2, size)
    const dropDuration = 0.018 * size

    dropGain.gain.setValueAtTime(0, time)
    dropGain.gain.linearRampToValueAtTime(peakGain, time + 0.003)
    dropGain.gain.exponentialRampToValueAtTime(0.0001, time + dropDuration)

    source.connect(filter)
    filter.connect(dropGain)

    // Stereo panning
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
    source.stop(time + dropDuration + 0.005)
  }
}
