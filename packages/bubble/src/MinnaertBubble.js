/**
 * MinnaertBubble
 *
 * Standalone procedural audio generator implementing Andy Farnell's acoustic model
 * of water bubbles (Designing Sound, Chapter 34: Water / Bubbles), based on Marcel Minnaert's
 * physical resonance equation for an oscillating gas cavity in liquid.
 *
 * Physics:
 *   f_0 ≈ (1 / (2 * π * r)) * sqrt(3 * γ * P_0 / ρ)
 *
 *   For air in ambient water at surface pressure (P_0 ≈ 101.3 kPa, ρ ≈ 1000 kg/m^3, γ ≈ 1.4):
 *   f_0 ≈ 3.26 / r  (where r is bubble radius in meters).
 *
 * Bubble Pinch-off & Dynamics:
 *   When a bubble pinches off and rises, surface tension change and hydrostatic relaxation
 *   cause an asymmetric upward frequency chirp, accompanied by viscous exponential decay:
 *     f(t) = f_0 * (1 + riseRate * t)
 *     a(t) = a_0 * exp(-damping * t)
 *
 * Dual Mode:
 *   1. Event / Trigger API: trigger({ radius, depth, energy, time })
 *   2. Continuous Streaming: setRate(dropsPerSecond) via an internal Poisson process.
 */

export class MinnaertBubble {
  /**
   * @param {AudioContext} audioContext - Web Audio AudioContext instance
   * @param {AudioNode} [destination] - Target destination node. Defaults to ctx.destination.
   */
  constructor(audioContext, destination = null) {
    if (!audioContext) {
      throw new Error('MinnaertBubble requires an AudioContext')
    }

    this.ctx = audioContext
    this.output = this.ctx.createGain()
    this.output.gain.value = 1.0

    if (destination) {
      this.output.connect(destination)
    } else {
      this.output.connect(this.ctx.destination)
    }

    // Default physical state
    this.radius = 0.004 // 4mm radius (~815 Hz base pitch)
    this.depth = 0.1 // 10cm depth
    this.viscosity = 0.5 // Relative fluid viscosity (affects damping and ring-down)
    this.rate = 0 // Continuous drops per second (0 = manual event-only mode)

    // Poisson scheduling state
    this._nextDropTime = 0
    this._timer = null
    this._lookahead = 0.1 // 100ms lookahead
    this._scheduleInterval = 40 // 40ms interval
    this._isRunning = false

    // Soft impulse buffer for impact / cavity excitation transient
    this._impulseBuffer = this._createImpulseBuffer()

    // Active voice tracking for leak-free teardown
    this._activeVoices = new Set()
  }

  /**
   * Set physical radius of bubbles in meters (0.0005m / 0.5mm to 0.03m / 30mm)
   * Small radius = high squeak / tinkling drop (~6.5 kHz)
   * Large radius = deep hollow "glug" / cavity resonant thud (~100 Hz)
   * @param {number} r
   */
  setRadius(r) {
    const num = Number(r)
    this.radius = Math.max(0.0005, Math.min(0.05, Number.isFinite(num) ? num : 0.004))
  }

  /**
   * Set liquid depth in meters (0.01m to 2.0m)
   * Deeper water increases hydrostatic pressure, slightly raising frequency and pitch chirp.
   * @param {number} d
   */
  setDepth(d) {
    const num = Number(d)
    this.depth = Math.max(0.01, Math.min(5.0, Number.isFinite(num) ? num : 0.1))
  }

  /**
   * Set fluid viscosity factor (0.0 = ringing/thin water, 1.0 = thick syrup/quick damp)
   * @param {number} v
   */
  setViscosity(v) {
    const num = Number(v)
    this.viscosity = Number.isFinite(num)
      ? Math.max(0.01, Math.min(1.0, num))
      : 0.5
  }

  /**
   * Set master output gain (0..1)
   * @param {number} gain
   * @param {number} [rampTime=0.02]
   */
  setVolume(gain, rampTime = 0.02) {
    if (!this.output || !this.ctx) return
    const num = Number(gain)
    const g = Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 1
    const rTime = Number.isFinite(Number(rampTime)) ? Math.max(0.001, Number(rampTime)) : 0.02
    const now = this.ctx.currentTime
    this.output.gain.cancelScheduledValues(now)
    this.output.gain.setTargetAtTime(g, now, rTime)
  }

  /**
   * Set continuous bubble generation rate in drops/sec.
   * Setting to 0 stops continuous mode.
   * @param {number} rate
   */
  setRate(rate) {
    if (!this.ctx) return
    const num = Number(rate)
    const r = Number.isFinite(num) ? Math.max(0, num) : 0
    this.rate = r

    if (r > 0) {
      if (!this._isRunning) {
        this._isRunning = true
        this._nextDropTime = this.ctx.currentTime
        this._schedule()
      }
    } else {
      this._stopContinuous()
    }
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
   * Trigger an individual bubble event at a specified time (or immediately).
   *
   * @param {Object} [options]
   * @param {number} [options.radius] - Bubble radius in meters (defaults to instance radius)
   * @param {number} [options.depth] - Submersion depth in meters (defaults to instance depth)
   * @param {number} [options.energy=1.0] - Impact energy/amplitude (0..1)
   * @param {number} [options.viscosity] - Viscosity / damping (defaults to instance viscosity)
   * @param {number} [options.time] - AudioContext timestamp for scheduled trigger (defaults to now)
   * @param {number} [options.pan] - Stereo pan (-1..1), defaults to slight random jitter
   * @returns {{ stop: Function }} Handle to sound event
   */
  trigger(options = {}) {
    if (!this.ctx || !this.output) return { stop: () => {} }

    const now = this.ctx.currentTime
    const rawTime = Number(options.time)
    const startTime = (Number.isFinite(rawTime) && rawTime >= now) ? rawTime : now

    const rawRadius = Number(options.radius ?? this.radius)
    const r = (Number.isFinite(rawRadius) && rawRadius > 0)
      ? Math.max(0.0005, Math.min(0.05, rawRadius))
      : this.radius

    const rawDepth = Number(options.depth ?? this.depth)
    const depth = (Number.isFinite(rawDepth) && rawDepth >= 0)
      ? Math.max(0.01, Math.min(5.0, rawDepth))
      : this.depth

    const rawEnergy = Number(options.energy ?? 1.0)
    const energy = Number.isFinite(rawEnergy)
      ? Math.max(0.01, Math.min(1.0, rawEnergy))
      : 1.0

    const rawVisc = Number(options.viscosity ?? this.viscosity)
    const visc = Number.isFinite(rawVisc)
      ? Math.max(0.01, Math.min(1.0, rawVisc))
      : this.viscosity

    // 1. Minnaert Fundamental Frequency calculation
    // f0 = (1 / (2 * pi * r)) * sqrt(3 * gamma * P / rho)
    // P = P_atm + rho * g * depth = 101325 + 1000 * 9.81 * depth
    const pAtm = 101325
    const rho = 1000
    const g = 9.80665
    const gamma = 1.4
    const pressure = pAtm + rho * g * depth
    const c = Math.sqrt((3 * gamma * pressure) / rho)
    const baseFreq = Math.min(12000, Math.max(80, c / (2 * Math.PI * r)))

    // Dynamic duration based on radius and viscosity:
    // Small bubbles ring down very fast (10-30ms); large bubbles resonate longer (60-150ms)
    const duration = Math.min(0.25, Math.max(0.02, (0.01 + r * 1.8) / (0.4 + visc * 1.2)))

    // 2. Farnell Bubble Chirp:
    // Frequency rises dynamically as the bubble forms and breaks neck tension.
    // Farnell models this as an initial upward pitch sweep:
    // f(t) sweeps from baseFreq to baseFreq * (1 + chirpRatio)
    const chirpRatio = 0.15 + (1 - visc) * 0.25 // 15% to 40% rise
    const endFreq = Math.min(18000, Math.max(80, baseFreq * (1 + chirpRatio)))

    // 3. Audio Node Graph Construction for this single droplet:
    // [Oscillator] ──► [Shaping Gain] ──► [Stereo Panner (if available)] ──► [output]
    //      ▲
    // [Impulse Click] (subtle transient excitation)
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(baseFreq, startTime)
    // Exponential or linear upward pitch glide over the first 60% of life
    const riseDuration = duration * 0.6
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), startTime + riseDuration)

    // Excitation impulse burst
    const impulse = this.ctx.createBufferSource()
    impulse.buffer = this._impulseBuffer
    const impulseGain = this.ctx.createGain()
    impulseGain.gain.setValueAtTime(Math.max(0.0001, 0.08 * energy), startTime)
    impulseGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.004)
    impulse.connect(impulseGain)

    // Damped Envelope:
    // Immediate soft attack (1.5ms) to avoid clicks, followed by exponential decay
    const envGain = this.ctx.createGain()
    envGain.gain.setValueAtTime(0.0001, startTime)
    const attackTime = 0.0015
    const peakGain = Math.max(0.0001, energy * 0.45)
    envGain.gain.linearRampToValueAtTime(peakGain, startTime + attackTime)
    // Decay: Farnell damp factor d = viscosity / r
    const decayTarget = Math.max(0.00001, peakGain * 0.001)
    envGain.gain.exponentialRampToValueAtTime(decayTarget, startTime + duration)
    envGain.gain.setValueAtTime(0, startTime + duration + 0.005)

    // Mix impulse and resonant body
    osc.connect(envGain)
    impulseGain.connect(envGain)

    // Stereo Panning
    let finalNode = envGain
    let pannerNode = null
    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner()
      const rawPan = Number(options.pan)
      const panVal = Number.isFinite(rawPan) ? Math.max(-1, Math.min(1, rawPan)) : (Math.random() * 1.4 - 0.7)
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panVal)), startTime)
      envGain.connect(panner)
      finalNode = panner
      pannerNode = panner
    }

    finalNode.connect(this.output)

    // Start & auto-cleanup
    try {
      osc.start(startTime)
      impulse.start(startTime)
      osc.stop(startTime + duration + 0.01)
      impulse.stop(startTime + 0.01)
    } catch {
      // AudioContext state error fallback
    }

    const cleanupTimeout = Math.max(10, (startTime - now + duration + 0.05) * 1000)
    let handle = null
    const cleanupTimer = setTimeout(() => {
      try {
        osc.disconnect()
        impulse.disconnect()
        impulseGain.disconnect()
        envGain.disconnect()
        if (pannerNode) pannerNode.disconnect()
      } catch {
        // Already cleaned
      }
      if (this._activeVoices && handle) {
        this._activeVoices.delete(handle)
      }
    }, cleanupTimeout)

    handle = {
      stop: () => {
        clearTimeout(cleanupTimer)
        try {
          osc.stop()
          impulse.stop()
          osc.disconnect()
          impulse.disconnect()
          impulseGain.disconnect()
          envGain.disconnect()
          if (pannerNode) pannerNode.disconnect()
        } catch {
          // ignore
        }
        if (this._activeVoices) {
          this._activeVoices.delete(handle)
        }
      }
    }

    if (this._activeVoices) {
      this._activeVoices.add(handle)
    }
    return handle
  }

  /**
   * Tear down all audio nodes and continuous timers
   */
  destroy() {
    this._stopContinuous()
    if (this._activeVoices) {
      for (const v of this._activeVoices) {
        v.stop()
      }
      this._activeVoices.clear()
    }

    if (this.output && this.ctx) {
      const out = this.output
      const now = this.ctx.currentTime
      out.gain.cancelScheduledValues(now)
      out.gain.setTargetAtTime(0, now, 0.01)
      setTimeout(() => {
        try {
          out.disconnect()
        } catch {
          // ignored
        }
      }, 30)
    }
    this.output = null
    this.ctx = null
    this._impulseBuffer = null
  }

  // ---------------------------------------------------------------------------
  // Internal Poisson Scheduling & Helpers
  // ---------------------------------------------------------------------------

  _stopContinuous() {
    this._isRunning = false
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
  }

  _schedule() {
    if (!this._isRunning || !this.ctx) return

    const now = this.ctx.currentTime
    const rate = this.rate

    while (rate > 0 && this._nextDropTime < now + this._lookahead) {
      // Subtle natural variation in radius and energy per droplet
      const radiusJitter = this.radius * (0.8 + Math.random() * 0.4)
      const energyJitter = 0.6 + Math.random() * 0.4

      this.trigger({
        radius: radiusJitter,
        depth: this.depth,
        viscosity: this.viscosity,
        energy: energyJitter,
        time: this._nextDropTime
      })

      // Poisson interval: Δt = -ln(U) / λ
      const u = Math.max(0.0001, Math.random())
      const delta = -Math.log(u) / rate
      this._nextDropTime += delta
    }

    if (rate <= 0 || this._nextDropTime < now) {
      this._nextDropTime = now + this._lookahead
    }

    this._timer = setTimeout(() => this._schedule(), this._scheduleInterval)
  }

  _createImpulseBuffer() {
    const sampleRate = this.ctx.sampleRate || 44100
    const frameCount = Math.floor(sampleRate * 0.004) // 4ms micro-transient
    const buffer = this.ctx.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frameCount; i++) {
      const env = 1 - (i / frameCount)
      data[i] = (Math.random() * 2 - 1) * Math.pow(env, 3)
    }
    return buffer
  }
}
