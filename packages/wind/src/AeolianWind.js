/**
 * AeolianWind
 *
 * Standalone procedural physical model of wind turbulence and vortex shedding
 * based on Andy Farnell's Designing Sound (Chapter 35: Wind / Aeolian Harp & Airflow)
 * and fluid dynamic acoustics.
 *
 * Physics Principles:
 * 1. Strouhal Vortex Shedding (Aeolian Tones):
 *    When airflow passes an obstacle of diameter d at velocity v, alternating vortices
 *    are shed at frequency f = St * (v / d), where St is the dimensionless Strouhal number
 *    (approx 0.2 for smooth cylinders/wires in sub-critical Reynolds regime).
 *    Multiple obstacle diameters (e.g. wires, branches, edges) produce a multi-band
 *    singing tone cluster.
 * 2. Background Turbulence & Shearing:
 *    Broadband pink noise filtered through lowpass and highpass shearing bands
 *    represents ambient air friction and turbulent pressure fluctuations.
 * 3. Gust Wandering LFO:
 *    Natural wind velocity does not remain static; stochastic low-frequency wandering
 *    modulates local speed with configurable turbulence/gustiness.
 * 4. Cavity Resonance (Helmholtz & Pipe / Chasm):
 *    Wind blowing across openings or hollow acoustic cavities excites resonant modes
 *    (hollow howling or whistle).
 *
 * Clean API:
 *   - setSpeed(v): Sets base wind speed (0..100 km/h or relative velocity)
 *   - setTurbulence(t): Sets gustiness and turbulent modulation depth (0..1)
 *   - setCavity(c): Sets cavity resonance / howling amount (0..1)
 *   - setVolume(v): Sets master output gain (0..1) with click-free parameter smoothing
 */

export class AeolianWind {
  /**
   * @param {AudioContext} audioContext - Web Audio AudioContext instance
   * @param {AudioNode} [destination] - Target destination node. Defaults to ctx.destination.
   */
  constructor(audioContext, destination = null) {
    if (!audioContext) {
      throw new Error('AeolianWind requires an AudioContext')
    }

    this.ctx = audioContext
    this.output = this.ctx.createGain()
    this.output.gain.value = 1.0

    if (destination) {
      this.output.connect(destination)
    } else {
      this.output.connect(this.ctx.destination)
    }

    // Physical state
    this.speed = 25 // Wind speed in km/h (0..100)
    this.turbulence = 0.4 // Gustiness / variance (0..1)
    this.cavity = 0.3 // Cavity / hollow resonance mix (0..1)
    this.volume = 0.7 // Master volume (0..1)

    // Strouhal wire/obstacle diameters in meters (thin wire, medium cable/branch, thick pole/edge)
    this.diameters = [0.003, 0.008, 0.022] // 3mm, 8mm, 22mm
    this.strouhalNumber = 0.2

    // Dynamic gust tracking
    this._currentGustSpeed = this.speed
    this._gustTargetSpeed = this.speed
    this._gustPhase = 0
    this._timer = null
    this._tickInterval = 40 // 40ms update loop

    // Build audio graph
    this._setupAudioGraph()

    // Start wandering modulation loop
    this._startModulationLoop()
  }

  /**
   * Set base wind speed (0 to 100 km/h)
   * @param {number} v
   */
  setSpeed(v) {
    const num = Number(v)
    this.speed = Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0
  }

  /**
   * Set turbulence / gustiness depth (0 to 1)
   * Controls the amplitude and speed of stochastic wind wandering.
   * @param {number} t
   */
  setTurbulence(t) {
    const num = Number(t)
    this.turbulence = Number.isFinite(num) ? Math.max(0, Math.min(1.0, num)) : 0.4
  }

  /**
   * Set cavity resonance / howling amount (0 to 1)
   * Emphasizes hollow architectural or chasm resonance.
   * @param {number} c
   */
  setCavity(c) {
    const num = Number(c)
    this.cavity = Number.isFinite(num) ? Math.max(0, Math.min(1.0, num)) : 0.3
    if (this._cavityGain && this.ctx) {
      const now = this.ctx.currentTime
      this._cavityGain.gain.setTargetAtTime(this.cavity * 0.4, now, 0.03)
    }
  }

  /**
   * Set master output volume with smooth ramp (0 to 1)
   * @param {number} gain
   * @param {number} [rampTime=0.02]
   */
  setVolume(gain, rampTime = 0.02) {
    if (!this.output || !this.ctx) return
    const num = Number(gain)
    const g = Number.isFinite(num) ? Math.max(0, Math.min(1.0, num)) : 0.7
    this.volume = g
    const rTime = Number.isFinite(Number(rampTime)) ? Math.max(0.001, Number(rampTime)) : 0.02
    const now = this.ctx.currentTime
    this.output.gain.cancelScheduledValues(now)
    this.output.gain.setTargetAtTime(g, now, rTime)
  }

  /**
   * Connect output to a target AudioNode
   * @param {AudioNode} destination
   */
  connect(destination) {
    this.output.connect(destination)
  }

  /**
   * Disconnect output
   */
  disconnect() {
    this.output.disconnect()
  }

  /**
   * Destroy all audio nodes and background timers cleanly without popping
   */
  destroy() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }

    if (this.output && this.ctx) {
      const out = this.output
      const now = this.ctx.currentTime
      // Smooth ramp to 0 before disconnection to eliminate clicks/pops
      out.gain.cancelScheduledValues(now)
      out.gain.setTargetAtTime(0, now, 0.01)

      const noiseSource = this._noiseSource
      const activeFilters = [
        this._lowFilter,
        this._highFilter,
        this._cavityFilter,
        ...(this._vortexFilters || [])
      ]
      const activeGains = [
        this._lowGain,
        this._highGain,
        this._cavityGain,
        this._vortexMasterGain,
        this._masterMixGain,
        ...(this._vortexGains || [])
      ]

      setTimeout(() => {
        try {
          if (noiseSource) {
            noiseSource.stop()
            noiseSource.disconnect()
          }
          for (const f of activeFilters) {
            if (f && typeof f.disconnect === 'function') f.disconnect()
          }
          for (const g of activeGains) {
            if (g && typeof g.disconnect === 'function') g.disconnect()
          }
          out.disconnect()
        } catch {
          // Ignored if already disconnected
        }
      }, 30)
    }

    this._noiseSource = null
    this._noiseBuffer = null
    this._lowFilter = null
    this._lowGain = null
    this._highFilter = null
    this._highGain = null
    this._cavityFilter = null
    this._cavityGain = null
    this._vortexFilters = null
    this._vortexGains = null
    this._vortexMasterGain = null
    this._masterMixGain = null
    this.output = null
    this.ctx = null
  }

  // ---------------------------------------------------------------------------
  // Audio Graph Construction
  // ---------------------------------------------------------------------------

  _setupAudioGraph() {
    // 1. Dual Pink & White Noise Generator
    this._noiseBuffer = this._createNoiseBuffer()
    this._noiseSource = this.ctx.createBufferSource()
    this._noiseSource.buffer = this._noiseBuffer
    this._noiseSource.loop = true

    // Master sum gain into this.output
    this._masterMixGain = this.ctx.createGain()
    this._masterMixGain.gain.value = 1.0
    this._masterMixGain.connect(this.output)

    // 2. Low-frequency turbulent rumble / shear (Lowpass)
    this._lowFilter = this.ctx.createBiquadFilter()
    this._lowFilter.type = 'lowpass'
    this._lowFilter.frequency.value = 120
    this._lowFilter.Q.value = 1.2

    this._lowGain = this.ctx.createGain()
    this._lowGain.gain.value = 0.1

    this._noiseSource.connect(this._lowFilter)
    this._lowFilter.connect(this._lowGain)
    this._lowGain.connect(this._masterMixGain)

    // 3. High-frequency friction / rustle / whistling hiss (Highpass / Bandpass)
    this._highFilter = this.ctx.createBiquadFilter()
    this._highFilter.type = 'bandpass'
    this._highFilter.frequency.value = 1400
    this._highFilter.Q.value = 0.8

    this._highGain = this.ctx.createGain()
    this._highGain.gain.value = 0.05

    this._noiseSource.connect(this._highFilter)
    this._highFilter.connect(this._highGain)
    this._highGain.connect(this._masterMixGain)

    // 4. Cavity Resonance (Helmholtz hollow resonance)
    this._cavityFilter = this.ctx.createBiquadFilter()
    this._cavityFilter.type = 'bandpass'
    this._cavityFilter.frequency.value = 280
    this._cavityFilter.Q.value = 8.0 // High Q produces the hollow pipe/chasm howl

    this._cavityGain = this.ctx.createGain()
    this._cavityGain.gain.value = this.cavity * 0.4

    this._noiseSource.connect(this._cavityFilter)
    this._cavityFilter.connect(this._cavityGain)
    this._cavityGain.connect(this._masterMixGain)

    // 5. Strouhal Vortex Shedding Filter Bank (Aeolian Harp Wires & Obstacles)
    // f = St * (v / d)
    this._vortexMasterGain = this.ctx.createGain()
    this._vortexMasterGain.gain.value = 0.4
    this._vortexMasterGain.connect(this._masterMixGain)

    this._vortexFilters = []
    this._vortexGains = []

    for (let i = 0; i < this.diameters.length; i++) {
      const bp = this.ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 12.0 // Sharp resonant peak for distinct whistling tone

      const g = this.ctx.createGain()
      g.gain.value = 0.2

      this._noiseSource.connect(bp)
      bp.connect(g)
      g.connect(this._vortexMasterGain)

      this._vortexFilters.push(bp)
      this._vortexGains.push(g)
    }

    try {
      this._noiseSource.start(0)
    } catch {
      // AudioContext state fallback
    }
  }

  // ---------------------------------------------------------------------------
  // Noise Synthesis (Pink + White Noise for natural aerodynamic spectrum)
  // ---------------------------------------------------------------------------

  _createNoiseBuffer() {
    const duration = 12.0
    const sampleRate = this.ctx.sampleRate || 44100
    const frameCount = Math.floor(sampleRate * duration)
    const buffer = this.ctx.createBuffer(2, frameCount, sampleRate)
    const fadeFrames = Math.floor(sampleRate * 0.4)

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      let b0 = 0, b1 = 0, b2 = 0

      // Warm up filter
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
        // Mix 75% pink (fluid shear 1/f) and 25% white (micro-vortex hiss)
        data[i] = pink * 0.14 + white * 0.05
      }

      // Seamless crossfade loop
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
  // Modulation Loop: Stochastic Wind Wandering & Physics Automation
  // ---------------------------------------------------------------------------

  _startModulationLoop() {
    const update = () => {
      if (!this.ctx || !this.output) return

      const now = this.ctx.currentTime
      const baseSpeed = this.speed
      const turb = this.turbulence

      // Gust wandering: drift target speed probabilistically
      if (Math.random() < 0.08) {
        // Random gust delta proportional to turbulence and base speed
        const gustFactor = 1.0 + (Math.random() * 2 - 1) * turb * 0.75
        this._gustTargetSpeed = Math.max(0, Math.min(100, baseSpeed * gustFactor))
      }

      // Smooth approach to gust target (lowpass wandering)
      const slewRate = 0.05 + turb * 0.08
      this._currentGustSpeed += (this._gustTargetSpeed - this._currentGustSpeed) * slewRate

      // Effective wind velocity in meters per second (1 km/h ≈ 0.27778 m/s)
      const v_mps = Math.max(0.1, this._currentGustSpeed * 0.27778)
      const speedNorm = Math.min(1.0, this._currentGustSpeed / 100)

      // Time constant for Web Audio parameter smoothing
      const smooth = 0.04

      // 1. Turbulent lowpass body frequency & gain
      // Louder and brighter as speed increases
      const lowFreq = Math.min(600, 60 + speedNorm * 380)
      const lowAmp = Math.pow(speedNorm, 1.2) * 0.5
      if (this._lowFilter) this._lowFilter.frequency.setTargetAtTime(lowFreq, now, smooth)
      if (this._lowGain) this._lowGain.gain.setTargetAtTime(lowAmp, now, smooth)

      // 2. Highpass / hiss rustle
      const highFreq = Math.min(4500, 800 + speedNorm * 2800)
      const highAmp = Math.pow(speedNorm, 1.5) * (0.02 + 0.3 * turb)
      if (this._highFilter) this._highFilter.frequency.setTargetAtTime(highFreq, now, smooth)
      if (this._highGain) this._highGain.gain.setTargetAtTime(highAmp, now, smooth)

      // 3. Cavity resonance (Helmholtz howling)
      // Slightly pitch up with flow velocity, gain rises with speed and cavity setting
      const cavityFreq = 220 + speedNorm * 120
      const cavityAmp = Math.pow(speedNorm, 1.1) * this.cavity * 0.6
      if (this._cavityFilter) this._cavityFilter.frequency.setTargetAtTime(cavityFreq, now, smooth)
      if (this._cavityGain) this._cavityGain.gain.setTargetAtTime(cavityAmp, now, smooth)

      // 4. Strouhal Vortex Shedding Frequencies & Gains
      // f = St * (v / d)
      // Gain of vortex shedding peaks when speed is sufficient to excite the obstacle
      const St = this.strouhalNumber
      if (this._vortexFilters && this._vortexGains) {
        for (let i = 0; i < this.diameters.length; i++) {
          const d = this.diameters[i]
          const vortexFreq = Math.max(40, Math.min(12000, St * (v_mps / d)))

          // Strouhal resonance amplitude rises as flow energy reaches Reynolds threshold
          const obstacleAmp = Math.min(0.4, Math.pow(speedNorm, 1.3) * (0.15 + (i * 0.05)))

          this._vortexFilters[i].frequency.setTargetAtTime(vortexFreq, now, smooth)
          this._vortexGains[i].gain.setTargetAtTime(obstacleAmp, now, smooth)
        }
      }

      this._timer = setTimeout(update, this._tickInterval)
    }

    this._timer = setTimeout(update, this._tickInterval)
  }
}
