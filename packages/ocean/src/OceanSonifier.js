import { SonifierBase } from '@web-sonifier/core'

/**
 * OceanSonifier
 *
 * Synthesizes an acoustic ocean surf and rolling wave environment using
 * tri-band noise filtering and asymmetric wave swell cycle dynamics:
 *
 * 1. Deep Undertow (Low): Low-frequency resonant body (80-350 Hz) capturing water mass
 *    and receding wash back into the ocean.
 * 2. Surf Body (Mid): Sweeping bandpass surge (200-2000 Hz) that crests and crashes.
 * 3. Spray & Foam (High): Highpass water spray (1500-6000 Hz) that peaks as waves break.
 *
 * Parameters:
 *   intensity   - Wave surge power and crash amplitude (0..100)
 *   pitch       - Spectral depth and undertow resonance (80..2500 Hz)
 *   swellPeriod - Duration of a wave cycle in seconds (3..20s)
 *   foam        - High-frequency sea foam and spray prominence (0..1)
 *   volume      - Master sonifier volume (0..1)
 */
export class OceanSonifier extends SonifierBase {

  getParamSchema() {
    return [
      {
        name: 'intensity',
        type: 'number',
        range: [0, 100],
        default: 50,
        group: 'ocean',
        label: 'Wave Intensity',
        description: 'Wave surge power and swell amplitude'
      },
      {
        name: 'pitch',
        type: 'number',
        range: [80, 2500],
        default: 500,
        group: 'ocean',
        label: 'Spectral Depth',
        description: 'Resonant depth and filter cutoff frequency'
      },
      {
        name: 'swellPeriod',
        type: 'number',
        range: [3.0, 20.0],
        default: 8.0,
        group: 'ocean',
        label: 'Swell Period (s)',
        description: 'Duration of one rolling wave cycle'
      },
      {
        name: 'foam',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'ocean',
        label: 'Foam & Spray',
        description: 'High-frequency foam and spray intensity'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'ocean',
        label: 'Volume',
        description: 'Master gain of the ocean sonifier'
      }
    ]
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // Master gain with parameter-smoothed transitions
    this._gainNode = audioContext.createGain()
    this._gainNode.gain.value = 0
    this._gainNode.connect(outputNode)

    // Pre-calculate continuous noise buffer
    this._noiseBuffer = this._createNoiseBuffer()

    // Tri-band synthesis network
    this._setupAudioGraph()

    // Wave swell cycle state
    this._cycleStartTime = audioContext.currentTime
    this._timer = null
    this._tickInterval = 35 // 35ms update interval

    this._updateWaveCycle()
  }

  onParam(name, value) {
    if (!this._ctx) return
    const now = this._ctx.currentTime

    if (name === 'volume' && this._gainNode) {
      this._gainNode.gain.setTargetAtTime(value, now, 0.02)
    }

    // Dynamic wave parameters are applied on each cycle tick
  }

  destroy() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }

    // Ramp master gain to 0 before disconnecting (avoid pops)
    if (this._gainNode && this._ctx) {
      const now = this._ctx.currentTime
      this._gainNode.gain.setTargetAtTime(0, now, 0.01)

      const noiseSource = this._noiseSource
      const gainNode = this._gainNode
      const undertowGain = this._undertowGain
      const undertowFilter = this._undertowFilter
      const surfGain = this._surfGain
      const surfFilter = this._surfFilter
      const foamGain = this._foamGain
      const foamFilter = this._foamFilter

      setTimeout(() => {
        try {
          if (noiseSource) {
            noiseSource.stop()
            noiseSource.disconnect()
          }
          if (undertowFilter) undertowFilter.disconnect()
          if (undertowGain) undertowGain.disconnect()
          if (surfFilter) surfFilter.disconnect()
          if (surfGain) surfGain.disconnect()
          if (foamFilter) foamFilter.disconnect()
          if (foamGain) foamGain.disconnect()
          if (gainNode) gainNode.disconnect()
        } catch {
          // Audio nodes already stopped or detached
        }
      }, 30)
    }

    this._noiseSource = null
    this._undertowFilter = null
    this._undertowGain = null
    this._surfFilter = null
    this._surfGain = null
    this._foamFilter = null
    this._foamGain = null
    this._gainNode = null
    this._ctx = null
    this._noiseBuffer = null
  }

  // ---------------------------------------------------------------------------
  // Audio Graph Setup
  // ---------------------------------------------------------------------------

  _setupAudioGraph() {
    if (!this._ctx || !this._noiseBuffer) return

    // Looping stereo noise generator
    this._noiseSource = this._ctx.createBufferSource()
    this._noiseSource.buffer = this._noiseBuffer
    this._noiseSource.loop = true

    const basePitch = this.getParam('pitch') || 500

    // Band 1: Deep Undertow (Lowpass)
    this._undertowFilter = this._ctx.createBiquadFilter()
    this._undertowFilter.type = 'lowpass'
    this._undertowFilter.Q.value = 1.0
    this._undertowFilter.frequency.value = Math.min(400, Math.max(70, basePitch * 0.35))

    this._undertowGain = this._ctx.createGain()
    this._undertowGain.gain.value = 0.15

    this._noiseSource.connect(this._undertowFilter)
    this._undertowFilter.connect(this._undertowGain)
    this._undertowGain.connect(this._gainNode)

    // Band 2: Surf Body (Bandpass)
    this._surfFilter = this._ctx.createBiquadFilter()
    this._surfFilter.type = 'bandpass'
    this._surfFilter.Q.value = 0.8
    this._surfFilter.frequency.value = Math.min(2200, Math.max(180, basePitch))

    this._surfGain = this._ctx.createGain()
    this._surfGain.gain.value = 0.1

    this._noiseSource.connect(this._surfFilter)
    this._surfFilter.connect(this._surfGain)
    this._surfGain.connect(this._gainNode)

    // Band 3: Spray & Foam (Highpass)
    this._foamFilter = this._ctx.createBiquadFilter()
    this._foamFilter.type = 'highpass'
    this._foamFilter.Q.value = 0.7
    this._foamFilter.frequency.value = Math.min(7000, Math.max(1200, basePitch * 2.8))

    this._foamGain = this._ctx.createGain()
    this._foamGain.gain.value = 0.05

    this._noiseSource.connect(this._foamFilter)
    this._foamFilter.connect(this._foamGain)
    this._foamGain.connect(this._gainNode)

    try {
      this._noiseSource.start(0)
    } catch {
      // Test environment safe fallback
    }
  }

  _createNoiseBuffer() {
    const duration = 4.0
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
        data[i] = pink * 0.12 + white * 0.04
      }
    }
    return buffer
  }

  // ---------------------------------------------------------------------------
  // Wave Swell Dynamics
  // ---------------------------------------------------------------------------

  _updateWaveCycle() {
    if (!this._ctx || !this._gainNode) return

    const now = this._ctx.currentTime
    const period = Math.max(3.0, this.getParam('swellPeriod') || 8.0)
    const intensity = Math.min(100, Math.max(0, this.getParam('intensity') ?? 50))
    const pitch = Math.min(2500, Math.max(80, this.getParam('pitch') || 500))
    const foamParam = Math.min(1, Math.max(0, this.getParam('foam') ?? 0.5))

    const normIntensity = intensity / 100 // 0 to 1

    // Wave cycle phase: 0 to 1
    const elapsed = now - this._cycleStartTime
    const phase = (elapsed % period) / period

    let swellEnv = 0
    let crashEnv = 0
    let backwashEnv = 0

    if (phase < 0.45) {
      // Phase 1: Swell Inrush (Smooth rise)
      const p = phase / 0.45
      swellEnv = 0.5 * (1 - Math.cos(Math.PI * p))
      crashEnv = Math.pow(swellEnv, 3) * 0.5
      backwashEnv = 0.2 * (1 - p)
    } else if (phase < 0.60) {
      // Phase 2: Crest & Breaker Peak
      const p = (phase - 0.45) / 0.15
      swellEnv = 1.0 - 0.25 * p
      crashEnv = 1.0 - 0.4 * p
      backwashEnv = 0.1 + 0.3 * p
    } else {
      // Phase 3: Outrush / Backwash & Undertow
      const p = (phase - 0.60) / 0.40
      swellEnv = 0.75 * Math.exp(-p * 3.5)
      crashEnv = 0.6 * Math.exp(-p * 4.5)
      backwashEnv = 0.4 + 0.6 * Math.sin(Math.PI * p)
    }

    // Dynamic gains tracking wave envelope and intensity
    const surfTargetGain = (0.05 + 0.35 * normIntensity) * (0.2 + 0.8 * swellEnv)
    const undertowTargetGain = (0.08 + 0.32 * normIntensity) * (0.3 + 0.7 * backwashEnv)
    const foamTargetGain = (0.02 + 0.25 * normIntensity * foamParam) * crashEnv

    // Dynamic filter frequencies (sweeping with swell and pitch)
    const surfTargetFreq = Math.min(2600, Math.max(160, pitch * (0.6 + 1.2 * swellEnv)))
    const undertowTargetFreq = Math.min(450, Math.max(60, pitch * 0.35 * (0.8 + 0.4 * backwashEnv)))
    const foamTargetFreq = Math.min(7500, Math.max(1200, pitch * 2.8 * (0.9 + 0.3 * crashEnv)))

    // Parameter smoothing with 35ms time constant
    const smooth = 0.035
    if (this._surfGain) this._surfGain.gain.setTargetAtTime(surfTargetGain, now, smooth)
    if (this._undertowGain) this._undertowGain.gain.setTargetAtTime(undertowTargetGain, now, smooth)
    if (this._foamGain) this._foamGain.gain.setTargetAtTime(foamTargetGain, now, smooth)

    if (this._surfFilter) this._surfFilter.frequency.setTargetAtTime(surfTargetFreq, now, smooth)
    if (this._undertowFilter) this._undertowFilter.frequency.setTargetAtTime(undertowTargetFreq, now, smooth)
    if (this._foamFilter) this._foamFilter.frequency.setTargetAtTime(foamTargetFreq, now, smooth)

    this._timer = setTimeout(() => this._updateWaveCycle(), this._tickInterval)
  }
}
