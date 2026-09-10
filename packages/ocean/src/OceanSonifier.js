import { SonifierBase } from '@web-sonifier/core'

/**
 * OceanSonifier
 *
 * Synthesizes an acoustic ocean surf and rolling wave environment using
 * tri-band noise filtering and stochastic wave swell cycle dynamics:
 *
 * 1. Deep Undertow (Low): Low-frequency resonant body (80-350 Hz) capturing water mass
 *    and receding wash back into the ocean.
 * 2. Surf Body (Mid): Sweeping bandpass surge (200-2200 Hz) that crests and crashes.
 * 3. Spray & Foam (High): Highpass water spray (1500-7000 Hz) that peaks as waves break.
 *
 * Parameters:
 *   intensity          - Wave surge power and crash amplitude (0..100)
 *   pitch              - Spectral depth and undertow resonance (80..2500 Hz)
 *   swellPeriod        - Mean duration of a wave cycle in seconds (3..20s)
 *   swellPeriodStdDev  - Standard deviation of wave cycle period in seconds (0..5s)
 *   swellDepth         - Mean swell volume dynamic range from trough to crest (0..1)
 *   swellDepthStdDev   - Standard deviation of swell volume depth (0..0.5)
 *   foam               - High-frequency sea foam and spray prominence (0..1)
 *   volume             - Master sonifier volume (0..1)
 */
export class OceanSonifier extends SonifierBase {

  getParamSchema() {
    return [
      {
        name: 'intensity',
        type: 'number',
        range: [0, 100],
        default: 50,
        unit: '%',
        curve: 'linear',
        group: 'Acoustic Character',
        label: 'Wave Intensity',
        description: 'Wave surge power and swell amplitude'
      },
      {
        name: 'pitch',
        type: 'number',
        range: [80, 2500],
        default: 500,
        unit: 'Hz',
        curve: 'exponential',
        group: 'Acoustic Character',
        label: 'Spectral Depth',
        description: 'Resonant depth and filter cutoff frequency'
      },
      {
        name: 'foam',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'norm',
        curve: 'linear',
        group: 'Acoustic Character',
        label: 'Foam & Spray',
        description: 'High-frequency foam and spray intensity'
      },
      {
        name: 'swellPeriod',
        type: 'number',
        range: [0, 20.0],
        default: 8.0,
        unit: 's',
        curve: 'linear',
        group: 'Swell Dynamics',
        label: 'Swell Period',
        description: 'Mean duration of one rolling wave cycle'
      },
      {
        name: 'swellPeriodStdDev',
        type: 'number',
        range: [0, 5.0],
        default: 1.5,
        unit: 's',
        curve: 'linear',
        group: 'Swell Dynamics',
        label: 'Period Variation',
        description: 'Variation in seconds between wave cycles'
      },
      {
        name: 'swellDepth',
        type: 'number',
        range: [0, 1.0],
        default: 0.7,
        unit: 'norm',
        curve: 'linear',
        group: 'Swell Dynamics',
        label: 'Swell Depth',
        description: 'Mean volume dynamic range between trough and crest'
      },
      {
        name: 'swellDepthStdDev',
        type: 'number',
        range: [0, 0.5],
        default: 0.15,
        unit: 'norm',
        curve: 'linear',
        group: 'Swell Dynamics',
        label: 'Depth Variation',
        description: 'Variation in swell volume depth from wave to wave'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'gain',
        curve: 'logarithmic',
        group: 'Output',
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

    // Stochastic wave swell cycle state
    this._cycleStartTime = audioContext.currentTime
    this._currentWaveDuration = this._computeNextWaveDuration()
    this._currentWaveDepth = this._computeNextWaveDepth()
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

    if (name === 'swellPeriod' || name === 'swellPeriodStdDev') {
      this._currentWaveDuration = this._computeNextWaveDuration()
      this._cycleStartTime = now
    }

    if (name === 'swellDepth' || name === 'swellDepthStdDev') {
      this._currentWaveDepth = this._computeNextWaveDepth()
    }
  }

  destroy() {
    if (this._timer) {
      clearTimeout(this._timer)
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
    const duration = 20.0
    const sampleRate = this._ctx.sampleRate
    const frameCount = Math.floor(sampleRate * duration)
    const buffer = this._ctx.createBuffer(2, frameCount, sampleRate)
    const fadeFrames = Math.floor(sampleRate * 0.5)

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      let b0 = 0, b1 = 0, b2 = 0

      // Warm up filter state
      for (let i = 0; i < 500; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
      }

      for (let i = 0; i < frameCount; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        const pink = b0 + b1 + b2 + white * 0.5362
        data[i] = pink * 0.12 + white * 0.04
      }

      // Equal-power crossfade between start and end to ensure seamless looping
      for (let i = 0; i < fadeFrames; i++) {
        const progress = i / fadeFrames
        const headWeight = Math.sin(progress * Math.PI * 0.5)
        const tailWeight = Math.cos(progress * Math.PI * 0.5)
        const tailIdx = frameCount - fadeFrames + i
        const blended = data[i] * headWeight + data[tailIdx] * tailWeight
        data[i] = blended
        data[tailIdx] = blended
      }
    }
    return buffer
  }

  // ---------------------------------------------------------------------------
  // Stochastic Wave Swell Dynamics
  // ---------------------------------------------------------------------------

  _sampleGaussian(mean, stdDev, minVal, maxVal) {
    if (stdDev <= 0) return Math.min(maxVal, Math.max(minVal, mean))
    const u1 = Math.max(1e-6, Math.random())
    const u2 = Math.random()
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
    const sampled = mean + z * stdDev
    return Math.min(maxVal, Math.max(minVal, sampled))
  }

  _computeNextWaveDuration() {
    const mean = this.getParam('swellPeriod') ?? 8.0
    const stdDev = this.getParam('swellPeriodStdDev') ?? 1.5
    if (mean <= 0.2) return 0.2
    return this._sampleGaussian(mean, stdDev, 1.0, 30.0)
  }

  _computeNextWaveDepth() {
    const mean = this.getParam('swellDepth') ?? 0.7
    const stdDev = this.getParam('swellDepthStdDev') ?? 0.15
    if (mean <= 0.001) return 0.0
    return this._sampleGaussian(mean, stdDev, 0.0, 1.0)
  }

  _updateWaveCycle() {
    if (!this._ctx || !this._gainNode) return

    const now = this._ctx.currentTime
    let elapsed = now - this._cycleStartTime

    // Check if wave cycle has finished, transition to next randomized wave
    if (elapsed >= this._currentWaveDuration) {
      this._cycleStartTime = now
      this._currentWaveDuration = this._computeNextWaveDuration()
      this._currentWaveDepth = this._computeNextWaveDepth()
      elapsed = 0
    }

    const duration = this._currentWaveDuration
    const rawDepth = this._currentWaveDepth
    const depth = rawDepth <= 0.001 ? 0 : rawDepth
    const phase = duration <= 0.25 ? 0 : Math.min(0.9999, elapsed / duration)

    const intensity = Math.min(100, Math.max(0, this.getParam('intensity') ?? 50))
    const pitch = Math.min(2500, Math.max(80, this.getParam('pitch') || 500))
    const foamParam = Math.min(1, Math.max(0, this.getParam('foam') ?? 0.5))
    const normIntensity = intensity / 100 // 0 to 1

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

    // Dynamic gains modulated by swellDepth (trough level vs crest level)
    const trough = 1.0 - depth
    const surfTargetGain = (0.05 + 0.35 * normIntensity) * (trough + depth * swellEnv)
    const undertowTargetGain = (0.08 + 0.32 * normIntensity) * (trough * 0.8 + depth * backwashEnv)
    const foamTargetGain = (0.02 + 0.25 * normIntensity * foamParam) * depth * crashEnv

    // Dynamic filter frequencies (sweeping with swell and pitch, scaled by depth)
    const surfSweep = 0.6 + 1.2 * swellEnv
    const undertowSweep = 0.8 + 0.4 * backwashEnv
    const foamSweep = 0.9 + 0.3 * crashEnv

    const surfTargetFreq = Math.min(2600, Math.max(160, pitch * (1.0 + depth * (surfSweep - 1.0))))
    const undertowTargetFreq = Math.min(450, Math.max(60, pitch * 0.35 * (1.0 + depth * (undertowSweep - 1.0))))
    const foamTargetFreq = Math.min(7500, Math.max(1200, pitch * 2.8 * (1.0 + depth * (foamSweep - 1.0))))

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
