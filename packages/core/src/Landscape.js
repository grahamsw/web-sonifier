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

    // Map<string, { sonifier, channelGain, panner, sendGain, layer, options }>
    this._objects = new Map()

    // Map<string, { name, gainNode, baseGain, ducking }>
    this._layers = new Map()

    // Map<string, typeof SonifierBase> - Plugin registry for dynamic instantiation
    this._registry = new Map()
    this._sceneName = 'Landscape Scene'

    // Array<{ sourceId, sourceParam, targetId, targetParam, scale, offset, curve, clamp, transform }>
    this._couplings = []
    this._dispatchStack = new Set()

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

    // Initialize or wire layer buses
    this._initLayerBuses(ctx)
  }

  _initLayerBuses(ctx) {
    if (!ctx || !this._dryGain) return

    // Ensure built-in standard layers exist if not yet defined
    if (!this._layers.has('bed')) {
      this.defineLayer('bed', { gain: 1.0 })
    }
    if (!this._layers.has('texture')) {
      this.defineLayer('texture', { gain: 1.0 })
    }
    if (!this._layers.has('figure')) {
      this.defineLayer('figure', {
        gain: 1.0,
        ducking: { targets: ['bed', 'texture'], depth: 0.35, attack: 0.015, release: 0.25 }
      })
    }
    if (!this._layers.has('event')) {
      this.defineLayer('event', {
        gain: 1.0,
        ducking: { targets: ['bed', 'texture'], depth: 0.35, attack: 0.015, release: 0.25 }
      })
    }
    if (!this._layers.has('alert')) {
      this.defineLayer('alert', {
        gain: 1.0,
        ducking: { targets: ['bed', 'texture', 'figure', 'event'], depth: 0.60, attack: 0.01, release: 0.40 }
      })
    }

    // For any layer defined before init(), create and connect its gainNode
    for (const layer of this._layers.values()) {
      if (!layer.gainNode && typeof ctx.createGain === 'function') {
        layer.gainNode = ctx.createGain()
        layer.gainNode.gain.value = layer.baseGain
        layer.gainNode.connect(this._dryGain)
      }
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

  // ---------------------------------------------------------------------------
  // Layer Management (Open Attentional Buses)
  // ---------------------------------------------------------------------------

  /**
   * Define or reconfigure an attentional layer bus.
   *
   * @param {string} name - Layer identifier (e.g. 'bed', 'texture', 'figure', 'event', 'alert' or custom)
   * @param {Object} [options]
   * @param {number} [options.gain=1.0] - Baseline layer volume (0..1)
   * @param {Object} [options.ducking] - Ducking behavior when objects in this layer trigger events
   * @param {string[]} [options.ducking.targets] - Target layer names to duck
   * @param {number} [options.ducking.depth=0.35] - Attenuation factor (0..1, e.g. 0.35 = -3.7 dB)
   * @param {number} [options.ducking.attack=0.015] - Duck attack ramp time in seconds
   * @param {number} [options.ducking.release=0.25] - Duck recovery time in seconds
   * @returns {Object}
   */
  defineLayer(name, { gain = 1.0, ducking = null } = {}) {
    let layer = this._layers.get(name)
    if (!layer) {
      let gainNode = null
      if (this._audioContext && this._dryGain && typeof this._audioContext.createGain === 'function') {
        gainNode = this._audioContext.createGain()
        gainNode.gain.value = gain
        gainNode.connect(this._dryGain)
      }
      layer = {
        name,
        gainNode,
        baseGain: gain,
        ducking: ducking ? { ...ducking } : null
      }
      this._layers.set(name, layer)
    } else {
      layer.baseGain = gain
      if (ducking !== undefined) layer.ducking = ducking ? { ...ducking } : null
      if (layer.gainNode && this._audioContext) {
        if (typeof layer.gainNode.gain.setTargetAtTime === 'function') {
          layer.gainNode.gain.setTargetAtTime(gain, this._audioContext.currentTime, 0.02)
        } else {
          layer.gainNode.gain.value = gain
        }
      }
    }
    return layer
  }

  /**
   * Retrieve a layer by name, dynamically creating it with sensible defaults if needed.
   * @param {string} name
   * @returns {Object}
   */
  getLayer(name) {
    if (!this._layers.has(name)) {
      if (name === 'bed' || name === 'texture') {
        return this.defineLayer(name, { gain: 1.0 })
      }
      if (name === 'figure' || name === 'event') {
        return this.defineLayer(name, {
          gain: 1.0,
          ducking: { targets: ['bed', 'texture'], depth: 0.35, attack: 0.015, release: 0.25 }
        })
      }
      if (name === 'alert') {
        return this.defineLayer(name, {
          gain: 1.0,
          ducking: { targets: ['bed', 'texture', 'figure', 'event'], depth: 0.60, attack: 0.01, release: 0.40 }
        })
      }
      return this.defineLayer(name, { gain: 1.0 })
    }
    return this._layers.get(name)
  }

  listLayers() {
    return Array.from(this._layers.keys())
  }

  /**
   * Set overall baseline gain for an entire layer bus.
   * @param {string} name
   * @param {number} value
   * @param {number} [rampTime=0.02]
   */
  setLayerGain(name, value, rampTime = 0.02) {
    const layer = this.getLayer(name)
    if (!layer) return
    layer.baseGain = Math.max(0, value)
    if (layer.gainNode && this._audioContext) {
      if (typeof layer.gainNode.gain.setTargetAtTime === 'function') {
        layer.gainNode.gain.setTargetAtTime(layer.baseGain, this._audioContext.currentTime, rampTime)
      } else {
        layer.gainNode.gain.value = layer.baseGain
      }
    }
  }

  getLayerGain(name) {
    const layer = this._layers.get(name)
    return layer ? layer.baseGain : null
  }

  /**
   * Temporarily duck a target layer bus (simulating the biological olivocochlear acoustic reflex).
   *
   * @param {string} targetLayerName
   * @param {Object} [options]
   * @param {number} [options.depth=0.35] - Attenuation factor (0..1)
   * @param {number} [options.attack=0.015] - Attack time in seconds
   * @param {number} [options.release=0.25] - Release time constant in seconds
   */
  duckLayer(targetLayerName, { depth = 0.35, attack = 0.015, release = 0.25 } = {}) {
    const layer = this._layers.get(targetLayerName)
    if (!layer || !layer.gainNode || !this._audioContext) return

    const ctx = this._audioContext
    const t0 = ctx.currentTime || 0
    const clampedDepth = Math.min(1, Math.max(0, depth))
    const duckedGain = layer.baseGain * (1.0 - clampedDepth)
    const param = layer.gainNode.gain

    if (typeof param.cancelScheduledValues === 'function') {
      param.cancelScheduledValues(t0)
    }
    if (typeof param.setValueAtTime === 'function') {
      param.setValueAtTime(param.value !== undefined ? param.value : layer.baseGain, t0)
    }
    if (typeof param.linearRampToValueAtTime === 'function') {
      param.linearRampToValueAtTime(duckedGain, t0 + attack)
    } else if (typeof param.setTargetAtTime === 'function') {
      param.setTargetAtTime(duckedGain, t0, attack)
    } else {
      param.value = duckedGain
    }

    if (typeof param.setTargetAtTime === 'function') {
      param.setTargetAtTime(layer.baseGain, t0 + attack, release)
    }
  }

  /**
   * Trigger ducking on all target layers configured for the specified source layer.
   * @param {string} sourceLayerName
   */
  triggerDucking(sourceLayerName) {
    const layer = this._layers.get(sourceLayerName)
    if (!layer || !layer.ducking || !Array.isArray(layer.ducking.targets)) return

    const { targets, depth, attack, release } = layer.ducking
    for (const target of targets) {
      this.duckLayer(target, { depth, attack, release })
    }
  }

  // ---------------------------------------------------------------------------
  // Declarative Inter-Object Coupling Bus
  // ---------------------------------------------------------------------------

  /**
   * Declaratively couple a parameter from a source object to a target object parameter.
   *
   * @param {string} sourceId - ID of emitting object
   * @param {string} sourceParam - Parameter on source object
   * @param {string} targetId - ID of receiving object
   * @param {string} targetParam - Parameter on receiving object
   * @param {Object} [options]
   * @param {number} [options.scale=1.0] - Scaling factor
   * @param {number} [options.offset=0.0] - Additive offset
   * @param {'linear'|'exponential'|'logarithmic'} [options.curve='linear'] - Transfer curve
   * @param {[number, number]} [options.clamp] - [min, max] boundary clamp
   * @param {Function} [options.transform] - Custom mapping function (value) => mappedValue
   */
  couple(sourceId, sourceParam, targetId, targetParam, options = {}) {
    this.uncouple(sourceId, sourceParam, targetId, targetParam)
    this._couplings.push({
      sourceId,
      sourceParam,
      targetId,
      targetParam,
      ...options
    })
  }

  /**
   * Remove an active coupling between source and target parameters.
   */
  uncouple(sourceId, sourceParam, targetId, targetParam) {
    this._couplings = this._couplings.filter(c =>
      !(c.sourceId === sourceId &&
        c.sourceParam === sourceParam &&
        c.targetId === targetId &&
        c.targetParam === targetParam)
    )
  }

  /**
   * List active couplings, optionally filtered by objectId.
   * @param {string} [objectId]
   * @returns {Object[]}
   */
  listCouplings(objectId = null) {
    if (!objectId) return [...this._couplings]
    return this._couplings.filter(c => c.sourceId === objectId || c.targetId === objectId)
  }

  _dispatchCouplings(sourceId, sourceParam, value) {
    const key = `${sourceId}:${sourceParam}`
    if (this._dispatchStack.has(key)) {
      // Prevent cyclic recursion
      return
    }

    this._dispatchStack.add(key)
    try {
      for (const c of this._couplings) {
        if (c.sourceId === sourceId && c.sourceParam === sourceParam) {
          let targetVal = value
          if (typeof c.transform === 'function') {
            targetVal = c.transform(value)
          } else {
            const scale = c.scale !== undefined ? c.scale : 1.0
            const offset = c.offset !== undefined ? c.offset : 0.0

            if (c.curve === 'exponential') {
              const sign = Math.sign(value)
              targetVal = sign * Math.pow(Math.abs(value), scale) + offset
            } else if (c.curve === 'logarithmic') {
              const sign = Math.sign(value)
              targetVal = sign * Math.log1p(Math.abs(value)) * scale + offset
            } else {
              targetVal = value * scale + offset
            }
          }

          if (Array.isArray(c.clamp) && c.clamp.length === 2) {
            targetVal = Math.max(c.clamp[0], Math.min(c.clamp[1], targetVal))
          }

          this.setParam(c.targetId, c.targetParam, targetVal)
        }
      }
    } finally {
      this._dispatchStack.delete(key)
    }
  }

  // ---------------------------------------------------------------------------
  // Sound Object Lifecycle & Spatial Routing
  // ---------------------------------------------------------------------------

  /**
   * Register a sound-producing object (resonator) into the landscape.
   *
   * @param {string} id - Unique identifier for the object
   * @param {Object} sonifierInstance - An instantiated Sonifier (SonifierBase)
   * @param {Object} [options]
   * @param {string} [options.layer='bed'] - Layer bus role ('bed', 'texture', 'figure', 'event', 'alert', or custom)
   * @param {number} [options.gain=1.0] - Object channel baseline gain (0..1)
   * @param {number} [options.pan=0.0] - Stereo azimuth position (-1.0 left to +1.0 right)
   * @param {number} [options.distance=0.0] - Distance in meters from listener (0..50)
   * @param {number} [options.reverbSend=0.3] - Base send level to shared room reverb (0..1)
   */
  addObject(id, sonifierInstance, options = {}) {
    if (this._objects.has(id)) {
      this.removeObject(id)
    }

    if (!this._audioContext) {
      throw new Error('[web-sonify] Landscape must be initialized with an AudioContext before adding objects')
    }

    const ctx = this._audioContext
    const layerName = options.layer || options.role || 'bed'
    const layer = this.getLayer(layerName)

    const baseGain = options.gain !== undefined ? options.gain : 1.0
    const distance = options.distance !== undefined ? Math.max(0, options.distance) : 0
    const distAtten = 1 / Math.sqrt(1 + 0.1 * distance)

    const channelGain = ctx.createGain()
    channelGain.gain.value = baseGain * distAtten

    // Spatial panner (X-axis azimuth)
    let panner = null
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner()
      panner.pan.value = options.pan !== undefined ? options.pan : 0.0
    }

    // Reverb send (Z-axis distance increases wet reflection)
    const baseSend = options.reverbSend !== undefined ? options.reverbSend : 0.3
    const sendGain = ctx.createGain()
    sendGain.gain.value = Math.min(1.0, baseSend + 0.04 * distance)

    // Initialize sonifier into channelGain
    if (typeof sonifierInstance.init === 'function') {
      sonifierInstance.init(ctx, channelGain)
    }
    if (typeof sonifierInstance.applyDefaults === 'function') {
      sonifierInstance.applyDefaults()
    }

    // Connect audio routing to the layer bus
    const layerDestination = (layer && layer.gainNode) ? layer.gainNode : this._dryGain

    if (panner) {
      channelGain.connect(panner)
      panner.connect(layerDestination)
      panner.connect(sendGain)
    } else {
      channelGain.connect(layerDestination)
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
      layer: layerName,
      options: {
        ...options,
        type: options.type || id,
        layer: layerName,
        gain: baseGain,
        distance,
        reverbSend: baseSend
      }
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

    // Clean up active couplings involving this object
    this._couplings = this._couplings.filter(c => c.sourceId !== id && c.targetId !== id)

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
   * Handles channel strip params ('pan', 'spread', 'gain', 'distance', 'reverbSend') or forwards to sonifier.
   * Dispatches active inter-object couplings.
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
      this._dispatchCouplings(objectId, param, value)
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
      this._dispatchCouplings(objectId, param, value)
      return
    }

    if (param === 'gain' || param === 'volume') {
      entry.options.gain = value
      const dist = entry.options.distance || 0
      const distAtten = 1 / Math.sqrt(1 + 0.1 * dist)
      const effectiveGain = value * distAtten

      if (entry.channelGain && typeof entry.channelGain.gain.setTargetAtTime === 'function') {
        entry.channelGain.gain.setTargetAtTime(effectiveGain, t, 0.02)
      } else if (entry.channelGain) {
        entry.channelGain.gain.value = effectiveGain
      }
      this._dispatchCouplings(objectId, param, value)
      return
    }

    if (param === 'distance') {
      entry.options.distance = Math.max(0, value)
      const distAtten = 1 / Math.sqrt(1 + 0.1 * entry.options.distance)
      const effectiveGain = (entry.options.gain ?? 1.0) * distAtten

      if (entry.channelGain && typeof entry.channelGain.gain.setTargetAtTime === 'function') {
        entry.channelGain.gain.setTargetAtTime(effectiveGain, t, 0.02)
      } else if (entry.channelGain) {
        entry.channelGain.gain.value = effectiveGain
      }

      const effectiveSend = Math.min(1.0, (entry.options.reverbSend ?? 0.3) + 0.04 * entry.options.distance)
      if (entry.sendGain && typeof entry.sendGain.gain.setTargetAtTime === 'function') {
        entry.sendGain.gain.setTargetAtTime(effectiveSend, t, 0.02)
      } else if (entry.sendGain) {
        entry.sendGain.gain.value = effectiveSend
      }
      this._dispatchCouplings(objectId, param, value)
      return
    }

    if (param === 'reverbSend') {
      entry.options.reverbSend = value
      const dist = entry.options.distance || 0
      const effectiveSend = Math.min(1.0, value + 0.04 * dist)

      if (entry.sendGain && typeof entry.sendGain.gain.setTargetAtTime === 'function') {
        entry.sendGain.gain.setTargetAtTime(effectiveSend, t, 0.02)
      } else if (entry.sendGain) {
        entry.sendGain.gain.value = effectiveSend
      }
      this._dispatchCouplings(objectId, param, value)
      return
    }

    // Forward to child sonifier
    if (typeof entry.sonifier.setParam === 'function') {
      entry.sonifier.setParam(param, value)
    }

    // Dispatch any active inter-object couplings
    this._dispatchCouplings(objectId, param, value)
  }

  /**
   * Trigger a discrete event on a sound object (e.g. strike, triggerBubble).
   * Automatically triggers olivocochlear ducking on lower layers if configured.
   *
   * @param {string} objectId
   * @param {string} method
   * @param {...any} args
   */
  trigger(objectId, method, ...args) {
    const entry = this._objects.get(objectId)
    if (!entry) return null

    let result = null
    if (typeof entry.sonifier[method] === 'function') {
      result = entry.sonifier[method](...args)
    }

    // Trigger olivocochlear ducking if object's layer has ducking configured
    const optOut = args[0] && typeof args[0] === 'object' && args[0].duck === false
    if (!optOut && entry.layer) {
      this.triggerDucking(entry.layer)
    }

    return result
  }

  /**
   * Set overall landscape master volume.
   * @param {number} value (0..1)
   */
  setMasterVolume(value) {
    const clamped = Math.min(1, Math.max(0, value))
    if (this._masterGain && this._audioContext) {
      if (typeof this._masterGain.gain.setTargetAtTime === 'function') {
        this._masterGain.gain.setTargetAtTime(clamped, this._audioContext.currentTime, 0.02)
      } else {
        this._masterGain.gain.value = clamped
      }
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
      if (typeof this._masterGain.gain.setTargetAtTime === 'function') {
        this._masterGain.gain.setTargetAtTime(0, this._audioContext.currentTime, 0.03)
      } else {
        this._masterGain.gain.value = 0
      }
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

    this._couplings = []
    this._dispatchStack.clear()

    // Disconnect all layer gain nodes
    for (const layer of this._layers.values()) {
      if (layer.gainNode) {
        try {
          layer.gainNode.disconnect()
        } catch {}
      }
    }
    this._layers.clear()

    if (this._masterGain && this._audioContext) {
      if (typeof this._masterGain.gain.setTargetAtTime === 'function') {
        this._masterGain.gain.setTargetAtTime(0, this._audioContext.currentTime, 0.02)
      } else {
        this._masterGain.gain.value = 0
      }
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

  // ---------------------------------------------------------------------------
  // Plugin Registry
  // ---------------------------------------------------------------------------

  /**
   * Register a sonifier plugin class under a type name.
   * Enables dynamic object instantiation during loadScene().
   *
   * @param {string} type - Identifier (e.g. 'wind', 'rain', 'ocean', 'chime')
   * @param {typeof SonifierBase} pluginClass
   */
  register(type, pluginClass) {
    this._registry.set(type, pluginClass)
  }

  /**
   * Retrieve a registered plugin class by type name.
   * @param {string} type
   * @returns {typeof SonifierBase|null}
   */
  getRegistered(type) {
    return this._registry.get(type) || null
  }

  /**
   * List all registered plugin types.
   * @returns {string[]}
   */
  listRegistered() {
    return Array.from(this._registry.keys())
  }

  // ---------------------------------------------------------------------------
  // Scene Document I/O (Declarative Serialization & Ingestion)
  // ---------------------------------------------------------------------------

  /**
   * Serialize the entire landscape state into a declarative SceneDescriptor.
   *
   * @param {Object} [options]
   * @param {string} [options.name] - Optional scene name override
   * @returns {Object} SceneDescriptor
   */
  exportScene(options = {}) {
    const objects = {}
    for (const [id, entry] of this._objects.entries()) {
      const params = {}
      if (typeof entry.sonifier.getParamSchema === 'function') {
        const schema = entry.sonifier.getParamSchema() || []
        for (const p of schema) {
          const val = typeof entry.sonifier.getParam === 'function'
            ? entry.sonifier.getParam(p.name)
            : entry.sonifier[p.name]
          if (val !== undefined) {
            params[p.name] = val
          }
        }
      }

      objects[id] = {
        type: entry.options.type || entry.type || id,
        layer: entry.layer || 'bed',
        gain: entry.options.gain !== undefined ? entry.options.gain : 1.0,
        pan: entry.options.pan !== undefined ? entry.options.pan : 0.0,
        distance: entry.options.distance !== undefined ? entry.options.distance : 0.0,
        spread: entry.options.spread !== undefined ? entry.options.spread : 0.0,
        reverbSend: entry.options.reverbSend !== undefined ? entry.options.reverbSend : 0.3,
        params
      }
    }

    const layers = {}
    for (const [name, layer] of this._layers.entries()) {
      layers[name] = {
        gain: layer.baseGain,
        ducking: layer.ducking ? { ...layer.ducking } : null
      }
    }

    return {
      version: 1,
      name: options.name || this._sceneName || 'Landscape Scene',
      space: this.getSpace(),
      masterVolume: this.getMasterVolume(),
      layers,
      objects,
      couplings: this.listCouplings()
    }
  }

  /**
   * Load and reconfigure the landscape from a declarative SceneDescriptor.
   *
   * @param {Object} descriptor - Scene configuration
   * @param {Object} [options]
   * @param {Record<string, typeof SonifierBase>} [options.plugins] - Optional plugin class overrides
   * @returns {Promise<Landscape>}
   */
  async loadScene(descriptor, options = {}) {
    if (!descriptor || typeof descriptor !== 'object') {
      throw new Error('[web-sonify] loadScene requires a valid scene descriptor object')
    }

    this._sceneName = descriptor.name || 'Landscape Scene'

    // 1. Configure master space & volume
    if (descriptor.space) {
      this.setSpace(descriptor.space)
    }
    if (descriptor.masterVolume !== undefined) {
      this.setMasterVolume(descriptor.masterVolume)
    }

    // 2. Configure layers
    if (descriptor.layers && typeof descriptor.layers === 'object') {
      for (const [name, cfg] of Object.entries(descriptor.layers)) {
        this.defineLayer(name, {
          gain: cfg.gain !== undefined ? cfg.gain : 1.0,
          ducking: cfg.ducking || null
        })
      }
    }

    // 3. Clear existing couplings (will be repopulated from descriptor)
    this._couplings = []

    // 4. Instantiate or update objects
    if (descriptor.objects && typeof descriptor.objects === 'object') {
      for (const [id, objCfg] of Object.entries(descriptor.objects)) {
        const type = objCfg.type || id
        let entry = this._objects.get(id)

        if (!entry) {
          const PluginClass = (options.plugins && options.plugins[type]) || this._registry.get(type)
          if (!PluginClass) {
            console.warn(`[web-sonify] Cannot instantiate object "${id}": no plugin registered for type "${type}"`)
            continue
          }
          const instance = new PluginClass()
          entry = this.addObject(id, instance, {
            type,
            layer: objCfg.layer || 'bed',
            gain: objCfg.gain,
            pan: objCfg.pan,
            distance: objCfg.distance,
            spread: objCfg.spread,
            reverbSend: objCfg.reverbSend
          })
        } else {
          entry.options.type = type
          if (objCfg.layer) entry.layer = objCfg.layer
          if (objCfg.gain !== undefined) this.setParam(id, 'gain', objCfg.gain)
          if (objCfg.pan !== undefined) this.setParam(id, 'pan', objCfg.pan)
          if (objCfg.distance !== undefined) this.setParam(id, 'distance', objCfg.distance)
          if (objCfg.spread !== undefined) this.setParam(id, 'spread', objCfg.spread)
          if (objCfg.reverbSend !== undefined) this.setParam(id, 'reverbSend', objCfg.reverbSend)
        }

        // Apply inner sonifier parameters
        if (objCfg.params && typeof objCfg.params === 'object') {
          for (const [paramName, paramVal] of Object.entries(objCfg.params)) {
            this.setParam(id, paramName, paramVal)
          }
        }
      }
    }

    // 5. Restore couplings
    if (Array.isArray(descriptor.couplings)) {
      for (const c of descriptor.couplings) {
        this.couple(c.sourceId, c.sourceParam, c.targetId, c.targetParam, {
          scale: c.scale,
          offset: c.offset,
          curve: c.curve,
          clamp: c.clamp,
          transform: c.transform
        })
      }
    }

    return this
  }
}

