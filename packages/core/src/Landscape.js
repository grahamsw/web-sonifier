/**
 * Landscape
 *
 * An Auditory Scene Orchestrator based on Albert Bregman's Auditory Scene Analysis (ASA).
 * Composes multiple sound-producing objects (resonators) within a shared acoustic
 * spatial container (room/reverberator), excited by continuous or discrete forces.
 */
export class Landscape {
  /**
   * @param {Object} [options]
   * @param {AudioContext} [options.audioContext] - optional existing context
   * @param {AudioNode} [options.destination] - optional master destination node
   */
  constructor(options = {}) {
    this._audioContext = options.audioContext || null
    this._ownsContext = !options.audioContext
    this._destination = options.destination || null

    this._masterGain = null
    this._dryGain = null
    this._reverbGain = null
    this._convolver = null

    // Map<string, { sonifier, channelGain, panner, sendGain, options }>
    this._objects = new Map()

    this._spaceSettings = {
      decay: 2.2,
      wet: 0.28,
      warmth: 0.65
    }

    if (this._audioContext) {
      this._initAudioGraph(this._audioContext, this._destination)
    }
  }

  /**
   * Initialize the Web Audio graph and master spatial bus.
   *
   * @param {AudioContext} audioContext
   * @param {AudioNode} [destinationNode]
   */
  init(audioContext, destinationNode) {
    this._audioContext = audioContext
    this._destination = destinationNode || (audioContext ? audioContext.destination : null)
    this._initAudioGraph(this._audioContext, this._destination)
  }

  _initAudioGraph(ctx, dest) {
    if (!ctx) return
    const out = dest || ctx.destination

    // Master bus
    this._masterGain = ctx.createGain()
    this._masterGain.gain.value = 1.0
    this._masterGain.connect(out)

    // Dry bus
    this._dryGain = ctx.createGain()
    this._dryGain.gain.value = 1.0
    this._dryGain.connect(this._masterGain)

    // Reverb bus (shared spatial container)
    this._reverbGain = ctx.createGain()
    this._reverbGain.gain.value = this._spaceSettings.wet
    this._reverbGain.connect(this._masterGain)

    if (typeof ctx.createConvolver === 'function') {
      this._convolver = ctx.createConvolver()
      const ir = this._generateImpulseResponse(this._spaceSettings.decay, this._spaceSettings.warmth)
      if (ir) this._convolver.buffer = ir
      this._convolver.connect(this._reverbGain)
    }
  }

  /**
   * Synthesize a decorrelated natural stereo impulse response with frequency-dependent damping.
   *
   * @param {number} decay - RT60 decay time in seconds
   * @param {number} warmth - 0 (bright/hard) to 1 (warm/high-frequency absorption)
   * @returns {AudioBuffer|null}
   */
  _generateImpulseResponse(decay = 2.0, warmth = 0.6) {
    if (!this._audioContext || typeof this._audioContext.createBuffer !== 'function') return null
    const sampleRate = this._audioContext.sampleRate || 44100
    const duration = Math.max(0.1, decay)
    const length = Math.max(1, Math.floor(sampleRate * duration))
    const buffer = this._audioContext.createBuffer(2, length, sampleRate)
    const left = buffer.getChannelData(0)
    const right = buffer.getChannelData(1)

    // Decay rate: -60dB at t = decay -> exp(-3 * t / decay)
    const decayFactor = 3.5 / duration
    let lastL = 0
    let lastR = 0
    const alpha = 0.05 + 0.9 * (1.0 - Math.min(1, Math.max(0, warmth)))

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate
      const env = Math.exp(-decayFactor * t)
      const nL = (Math.random() * 2 - 1) * env
      const nR = (Math.random() * 2 - 1) * env
      lastL += alpha * (nL - lastL)
      lastR += alpha * (nR - lastR)
      left[i] = lastL
      right[i] = lastR
    }

    return buffer
  }

  /**
   * Configure the shared acoustic space (reverberation and spatial immersion).
   *
   * @param {Object} space
   * @param {number} [space.decay] - Reverberation decay time in seconds (0.1..10)
   * @param {number} [space.wet] - Reverb mix ratio (0..1)
   * @param {number} [space.warmth] - High-frequency absorption (0..1)
   */
  setSpace({ decay, wet, warmth } = {}) {
    let recomputeBuffer = false

    if (decay !== undefined && decay !== this._spaceSettings.decay) {
      this._spaceSettings.decay = Math.max(0.1, decay)
      recomputeBuffer = true
    }
    if (warmth !== undefined && warmth !== this._spaceSettings.warmth) {
      this._spaceSettings.warmth = Math.min(1, Math.max(0, warmth))
      recomputeBuffer = true
    }
    if (wet !== undefined) {
      this._spaceSettings.wet = Math.min(1, Math.max(0, wet))
      if (this._reverbGain && this._audioContext) {
        this._reverbGain.gain.setTargetAtTime(this._spaceSettings.wet, this._audioContext.currentTime, 0.02)
      }
    }

    if (recomputeBuffer && this._convolver && this._audioContext) {
      const ir = this._generateImpulseResponse(this._spaceSettings.decay, this._spaceSettings.warmth)
      if (ir) this._convolver.buffer = ir
    }
  }

  getSpace() {
    return { ...this._spaceSettings }
  }

  /**
   * Register a sound-producing object (resonator) into the landscape.
   *
   * @param {string} id - Unique identifier for the object
   * @param {Object} sonifierInstance - An instantiated Sonifier (SonifierBase)
   * @param {Object} [options]
   * @param {number} [options.gain=1.0] - Object channel gain (0..1)
   * @param {number} [options.pan=0.0] - Stereo azimuth position (-1.0 left to +1.0 right)
   * @param {number} [options.reverbSend=0.3] - Send level to shared room reverb (0..1)
   */
  addObject(id, sonifierInstance, options = {}) {
    if (this._objects.has(id)) {
      this.removeObject(id)
    }

    if (!this._audioContext) {
      throw new Error('[web-sonify] Landscape must be initialized with an AudioContext before adding objects')
    }

    const ctx = this._audioContext
    const channelGain = ctx.createGain()
    channelGain.gain.value = options.gain !== undefined ? options.gain : 1.0

    // Spatial panner
    let panner = null
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner()
      panner.pan.value = options.pan !== undefined ? options.pan : 0.0
    }

    // Reverb send
    const sendGain = ctx.createGain()
    sendGain.gain.value = options.reverbSend !== undefined ? options.reverbSend : 0.3

    // Initialize sonifier into channelGain
    if (typeof sonifierInstance.init === 'function') {
      sonifierInstance.init(ctx, channelGain)
    }
    if (typeof sonifierInstance.applyDefaults === 'function') {
      sonifierInstance.applyDefaults()
    }

    // Connect audio routing
    if (panner) {
      channelGain.connect(panner)
      panner.connect(this._dryGain)
      panner.connect(sendGain)
    } else {
      channelGain.connect(this._dryGain)
      channelGain.connect(sendGain)
    }

    if (this._convolver) {
      sendGain.connect(this._convolver)
    } else if (this._reverbGain) {
      sendGain.connect(this._reverbGain)
    }

    const entry = {
      sonifier: sonifierInstance,
      channelGain,
      panner,
      sendGain,
      options: { ...options }
    }

    this._objects.set(id, entry)
    return entry
  }

  /**
   * Remove and teardown an object from the landscape.
   * @param {string} id
   */
  removeObject(id) {
    const entry = this._objects.get(id)
    if (!entry) return

    try {
      if (typeof entry.sonifier.destroy === 'function') {
        entry.sonifier.destroy()
      }
      entry.channelGain.disconnect()
      if (entry.panner) entry.panner.disconnect()
      entry.sendGain.disconnect()
    } catch {
      // Ignore disconnect errors
    }

    this._objects.delete(id)
  }

  /**
   * Retrieve an object's instance and channel strip nodes.
   * @param {string} id
   */
  getObject(id) {
    return this._objects.get(id) || null
  }

  listObjects() {
    return Array.from(this._objects.keys())
  }

  /**
   * Route continuous parameter updates with audio-rate smoothing.
   * Handles channel strip params ('pan', 'gain', 'reverbSend') or forwards to sonifier.
   *
   * @param {string} objectId
   * @param {string} param
   * @param {any} value
   */
  setParam(objectId, param, value) {
    const entry = this._objects.get(objectId)
    if (!entry) {
      console.warn(`[web-sonify] Landscape object "${objectId}" not found`)
      return
    }

    const t = this._audioContext ? this._audioContext.currentTime : 0

    if (param === 'pan') {
      entry.options.pan = value
      if (entry.panner && entry.panner.pan && typeof entry.panner.pan.setTargetAtTime === 'function') {
        entry.panner.pan.setTargetAtTime(value, t, 0.02)
      } else if (entry.panner) {
        entry.panner.pan.value = value
      }
      if (typeof entry.sonifier.getParamSchema === 'function') {
        const schema = entry.sonifier.getParamSchema() || []
        if (schema.some(p => p.name === 'pan') && typeof entry.sonifier.setParam === 'function') {
          entry.sonifier.setParam('pan', value)
        }
      }
      return
    }

    if (param === 'spread') {
      entry.options.spread = value
      if (typeof entry.sonifier.getParamSchema === 'function') {
        const schema = entry.sonifier.getParamSchema() || []
        if (schema.some(p => p.name === 'spread') && typeof entry.sonifier.setParam === 'function') {
          entry.sonifier.setParam('spread', value)
        }
      }
      return
    }

    if (param === 'gain' || param === 'volume') {
      entry.options.gain = value
      if (entry.channelGain && typeof entry.channelGain.gain.setTargetAtTime === 'function') {
        entry.channelGain.gain.setTargetAtTime(value, t, 0.02)
      } else if (entry.channelGain) {
        entry.channelGain.gain.value = value
      }
      return
    }

    if (param === 'reverbSend') {
      entry.options.reverbSend = value
      if (entry.sendGain && typeof entry.sendGain.gain.setTargetAtTime === 'function') {
        entry.sendGain.gain.setTargetAtTime(value, t, 0.02)
      } else if (entry.sendGain) {
        entry.sendGain.gain.value = value
      }
      return
    }

    // Forward to child sonifier
    if (typeof entry.sonifier.setParam === 'function') {
      entry.sonifier.setParam(param, value)
    }
  }

  /**
   * Trigger a discrete event on a sound object (e.g. strike, triggerBubble).
   *
   * @param {string} objectId
   * @param {string} method
   * @param {...any} args
   */
  trigger(objectId, method, ...args) {
    const entry = this._objects.get(objectId)
    if (!entry) return null

    if (typeof entry.sonifier[method] === 'function') {
      return entry.sonifier[method](...args)
    }
    return null
  }

  /**
   * Set overall landscape master volume.
   * @param {number} value (0..1)
   */
  setMasterVolume(value) {
    const clamped = Math.min(1, Math.max(0, value))
    if (this._masterGain && this._audioContext) {
      this._masterGain.gain.setTargetAtTime(clamped, this._audioContext.currentTime, 0.02)
    }
  }

  getMasterVolume() {
    return this._masterGain?.gain.value ?? 1.0
  }

  /**
   * Start or resume the audio context.
   */
  async start() {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this._ownsContext = true
      this._initAudioGraph(this._audioContext, this._destination)
    }
    if (this._audioContext.state === 'suspended') {
      await this._audioContext.resume()
    }
  }

  /**
   * Stop or suspend the audio context.
   */
  async stop() {
    if (this._masterGain && this._audioContext) {
      this._masterGain.gain.setTargetAtTime(0, this._audioContext.currentTime, 0.03)
      await new Promise(r => setTimeout(r, 40))
    }
    if (this._audioContext && typeof this._audioContext.suspend === 'function') {
      await this._audioContext.suspend()
    }
  }

  /**
   * Destroy the entire landscape, child objects, and audio nodes cleanly.
   */
  async destroy() {
    for (const id of Array.from(this._objects.keys())) {
      this.removeObject(id)
    }

    if (this._masterGain && this._audioContext) {
      this._masterGain.gain.setTargetAtTime(0, this._audioContext.currentTime, 0.02)
    }

    if (this._dryGain) this._dryGain.disconnect()
    if (this._reverbGain) this._reverbGain.disconnect()
    if (this._convolver) this._convolver.disconnect()
    if (this._masterGain) this._masterGain.disconnect()

    if (this._ownsContext && this._audioContext && typeof this._audioContext.close === 'function') {
      await this._audioContext.close()
    }

    this._audioContext = null
    this._masterGain = null
    this._dryGain = null
    this._reverbGain = null
    this._convolver = null
  }
}
