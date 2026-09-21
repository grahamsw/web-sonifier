/**
 * ModalChime
 *
 * Standalone procedural physical model of metal tube/rod wind chimes and crotales
 * based on Andy Farnell's Designing Sound and the Euler-Bernoulli beam equation
 * for transverse vibrations of free-free or suspended cylindrical bars.
 *
 * Mode Ratios:
 *   Mode 1: 1.000 * f0
 *   Mode 2: 2.756 * f0
 *   Mode 3: 5.404 * f0
 *   Mode 4: 8.933 * f0
 *
 * Acoustics:
 *   - The inharmonic overtone series produces a shimmering, metallic identity.
 *   - Higher modes have higher internal friction and radiation resistance, decaying
 *     within 80-250ms, while the fundamental sustains for 2-4 seconds.
 *   - Excitation: Soft-strike impulse burst simulating a rubber or wooden clapper.
 */

export class ModalChime {
  /**
   * @param {AudioContext} audioContext
   * @param {AudioNode} [destination]
   */
  constructor(audioContext, destination = null) {
    if (!audioContext) {
      throw new Error('ModalChime requires an AudioContext')
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
    this.pitch = 587.33 // D5 base pitch (standard chime fundamental)
    this.material = 'aluminum' // 'aluminum' (bright & long ring), 'bronze' (warm), 'steel' (piercing)
    this.damping = 0.3 // 0.05 (infinite ring) to 1.0 (heavy muted tap)
    this.windSpeed = 0 // Continuous ambient wind (0 = manual strike mode, >0 = stochastic strikes)

    // Wind scheduling state
    this._windTimer = null
    this._nextWindStrikeTime = 0
    this._isWindRunning = false

    // Exciter buffer
    this._strikerBuffer = this._createStrikerBuffer()
  }

  setPitch(freq) {
    this.pitch = Math.max(120, Math.min(4000, Number(freq) || 587.33))
  }

  setMaterial(mat) {
    const valid = ['aluminum', 'bronze', 'steel']
    if (valid.includes(mat)) {
      this.material = mat
    }
  }

  setDamping(d) {
    this.damping = Math.max(0.02, Math.min(1.0, Number(d) ?? 0.3))
  }

  setVolume(gain, rampTime = 0.02) {
    if (!this.output || !this.ctx) return
    const g = Math.max(0, Math.min(1, Number(gain) ?? 1))
    const now = this.ctx.currentTime
    this.output.gain.cancelScheduledValues(now)
    this.output.gain.setTargetAtTime(g, now, rampTime)
  }

  setWindSpeed(speed) {
    const s = Math.max(0, Math.min(100, Number(speed) || 0))
    this.windSpeed = s

    if (s > 0) {
      if (!this._isWindRunning) {
        this._isWindRunning = true
        this._nextWindStrikeTime = this.ctx.currentTime
        this._scheduleWind()
      }
    } else {
      this._stopWind()
    }
  }

  connect(destination) {
    this.output.connect(destination)
  }

  disconnect() {
    this.output.disconnect()
  }

  /**
   * Strike a chime tube.
   *
   * @param {Object} [options]
   * @param {number} [options.pitch] - Fundamental frequency in Hz (defaults to this.pitch)
   * @param {number} [options.velocity=0.8] - Striker strike velocity (0..1)
   * @param {number} [options.damping] - Material damping override
   * @param {number} [options.time] - AudioContext timestamp
   * @param {number} [options.pan] - Stereo pan (-1..1)
   * @returns {{ stop: Function }}
   */
  strike(options = {}) {
    if (!this.ctx || !this.output) return { stop: () => {} }

    const now = this.ctx.currentTime
    const startTime = Math.max(now, options.time ?? now)
    const f0 = options.pitch ?? this.pitch
    const velocity = Math.max(0.01, Math.min(1.0, options.velocity ?? 0.8))
    const damp = options.damping ?? this.damping

    // Material decay multipliers
    // Aluminum rings long; bronze is warmer/shorter; steel is bright & dense
    let materialDecayMult = 1.0
    if (this.material === 'aluminum') materialDecayMult = 1.4
    if (this.material === 'bronze') materialDecayMult = 0.9
    if (this.material === 'steel') materialDecayMult = 1.1

    // 4 Euler-Bernoulli bar modes with relative amplitudes and decays
    // [ratio, relativeGain, decayRatio]
    const modes = [
      [1.000, 1.0, 1.0],      // Fundamental
      [2.756, 0.65, 0.45],    // Mode 2 (clinking overtone)
      [5.404, 0.35, 0.22],    // Mode 3 (metallic sheen)
      [8.933, 0.18, 0.10]     // Mode 4 (high strike transient)
    ]

    const baseDecaySeconds = (2.2 * materialDecayMult) / (0.2 + damp * 1.8)
    const activeNodes = []

    // Strike mix master gain
    const strikeMasterGain = this.ctx.createGain()
    strikeMasterGain.gain.setValueAtTime(1.0, startTime)

    for (const [ratio, relGain, modeDecayRatio] of modes) {
      const modeFreq = Math.min(18000, f0 * ratio)
      const modeDuration = Math.max(0.05, baseDecaySeconds * modeDecayRatio)

      // Sinusoidal modal resonator
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(modeFreq, startTime)

      // Slight natural micro-pitch drift under vibration
      osc.frequency.linearRampToValueAtTime(modeFreq * 1.0008, startTime + 0.04)

      // Modal amplitude envelope
      const modeGain = this.ctx.createGain()
      modeGain.gain.setValueAtTime(0.0001, startTime)

      // 1.5ms soft attack avoids synthetic clicking
      const peak = velocity * relGain * 0.25
      modeGain.gain.linearRampToValueAtTime(peak, startTime + 0.0015)

      // Natural exponential decay
      const decayFloor = Math.max(0.00001, peak * 0.0008)
      modeGain.gain.exponentialRampToValueAtTime(decayFloor, startTime + modeDuration)
      modeGain.gain.setValueAtTime(0, startTime + modeDuration + 0.01)

      osc.connect(modeGain)
      modeGain.connect(strikeMasterGain)

      try {
        osc.start(startTime)
        osc.stop(startTime + modeDuration + 0.02)
      } catch {
        // AudioContext edge state
      }

      activeNodes.push(osc, modeGain)
    }

    // Soft Clapper Impulsive Thump (wood/rubber striker transient)
    const striker = this.ctx.createBufferSource()
    striker.buffer = this._strikerBuffer
    const strikerGain = this.ctx.createGain()
    strikerGain.gain.setValueAtTime(0.06 * velocity, startTime)
    strikerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.008)
    striker.connect(strikerGain)
    strikerGain.connect(strikeMasterGain)

    try {
      striker.start(startTime)
      striker.stop(startTime + 0.01)
    } catch {
      // Ignored
    }
    activeNodes.push(striker, strikerGain)

    // Stereo Panning
    let finalNode = strikeMasterGain
    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner()
      const panVal = options.pan ?? (Math.random() * 1.2 - 0.6)
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panVal)), startTime)
      strikeMasterGain.connect(panner)
      finalNode = panner
      activeNodes.push(panner)
    }

    finalNode.connect(this.output)

    const totalDuration = baseDecaySeconds + 0.05
    const cleanupTimeout = Math.max(10, (startTime - now + totalDuration) * 1000)
    const cleanupTimer = setTimeout(() => {
      try {
        for (const n of activeNodes) {
          if (typeof n.disconnect === 'function') n.disconnect()
        }
        strikeMasterGain.disconnect()
      } catch {
        // Already disconnected
      }
    }, cleanupTimeout)

    return {
      stop: () => {
        clearTimeout(cleanupTimer)
        try {
          for (const n of activeNodes) {
            if (typeof n.stop === 'function') n.stop()
            if (typeof n.disconnect === 'function') n.disconnect()
          }
          strikeMasterGain.disconnect()
        } catch {
          // Ignored
        }
      }
    }
  }

  destroy() {
    this._stopWind()
    if (this.output && this.ctx) {
      const now = this.ctx.currentTime
      this.output.gain.setTargetAtTime(0, now, 0.01)
      setTimeout(() => {
        try {
          this.output.disconnect()
        } catch {
          // Ignored
        }
      }, 30)
    }
    this.output = null
    this.ctx = null
    this._strikerBuffer = null
  }

  // ---------------------------------------------------------------------------
  // Internal Wind & Helpers
  // ---------------------------------------------------------------------------

  _stopWind() {
    this._isWindRunning = false
    if (this._windTimer) {
      clearTimeout(this._windTimer)
      this._windTimer = null
    }
  }

  _scheduleWind() {
    if (!this._isWindRunning || !this.ctx) return

    const now = this.ctx.currentTime
    const speed = this.windSpeed // 0..100
    // Strike rate increases with wind speed
    const strikeRate = (speed / 100) * 3.5 // up to 3.5 strikes/sec in high wind

    if (strikeRate > 0 && this._nextWindStrikeTime < now + 0.1) {
      // Wind strikes tubes across a pentatonic chord around fundamental
      const semitoneOffsets = [0, 2, 4, 7, 9, 12]
      const chosenOffset = semitoneOffsets[Math.floor(Math.random() * semitoneOffsets.length)]
      const pitch = this.pitch * Math.pow(2, chosenOffset / 12)
      const velocity = 0.3 + (speed / 100) * 0.5 + Math.random() * 0.2

      this.strike({
        pitch,
        velocity,
        time: this._nextWindStrikeTime
      })

      // Poisson interval
      const u = Math.max(0.0001, Math.random())
      const delta = -Math.log(u) / strikeRate
      this._nextWindStrikeTime += delta
    }

    if (strikeRate <= 0 || this._nextWindStrikeTime < now) {
      this._nextWindStrikeTime = now + 0.1
    }

    this._windTimer = setTimeout(() => this._scheduleWind(), 40)
  }

  _createStrikerBuffer() {
    const sampleRate = this.ctx.sampleRate || 44100
    const frameCount = Math.floor(sampleRate * 0.006) // 6ms soft hammer contact
    const buffer = this.ctx.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frameCount; i++) {
      const env = 1 - (i / frameCount)
      data[i] = (Math.random() * 2 - 1) * Math.pow(env, 2)
    }
    return buffer
  }
}
