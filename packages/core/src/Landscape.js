import { Adapter } from './Adapter.js'
import { Quantize, Scales } from './Quantizer.js'

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

    // Map<string, FeedDefinition> - Registered data feeds
    this._feeds = new Map()

    // Array<MappingEntry> - Active feed-to-parameter mappings
    this._mappings = []

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
    this._feeds.clear()
    this._mappings = []

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
  // Data Feed Specification & Registry
  // ---------------------------------------------------------------------------

  /**
   * Define or register a data feed contract.
   *
   * @param {string} id - Unique feed identifier
   * @param {Object} spec - Feed specification
   * @param {string} [spec.label] - Human-readable label
   * @param {'continuous'|'event'} [spec.type='continuous'] - Signal type
   * @param {[number, number]} [spec.range=[0, 100]] - Default input range
   * @param {string} [spec.unit=''] - Physical engineering unit
   * @param {'macro'|'meso'|'micro'} [spec.temporalScale] - Temporal scale
   * @param {number} [spec.sampleRateMs] - Expected update interval in ms
   */
  defineFeed(id, spec = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('[web-sonify] defineFeed requires a string id')
    }
    const def = {
      id,
      label: spec.label || id,
      type: spec.type || 'continuous',
      range: Array.isArray(spec.range) && spec.range.length === 2 ? [...spec.range] : [0, 100],
      unit: spec.unit || '',
      temporalScale: spec.temporalScale || 'meso',
      ...spec
    }
    this._feeds.set(id, def)
    return def
  }

  /**
   * Retrieve a feed specification by ID.
   * @param {string} id
   * @returns {Object|null}
   */
  getFeed(id) {
    return this._feeds.get(id) || null
  }

  /**
   * Check if a feed is registered.
   * @param {string} id
   * @returns {boolean}
   */
  hasFeed(id) {
    return this._feeds.has(id)
  }

  /**
   * Remove a feed and any mappings referencing it.
   * @param {string} id
   */
  removeFeed(id) {
    this._feeds.delete(id)
    this._mappings = this._mappings.filter(m => m.feedId !== id)
  }

  /**
   * List all registered data feeds.
   * @returns {Object[]}
   */
  listFeeds() {
    return Array.from(this._feeds.values()).map(f => ({ ...f }))
  }

  /**
   * Ingest a Feed Specification document.
   * @param {Object} feedDoc
   * @returns {Landscape}
   */
  loadFeeds(feedDoc) {
    if (!feedDoc || typeof feedDoc !== 'object') return this
    const feedsObj = feedDoc.feeds || feedDoc
    if (typeof feedsObj === 'object') {
      for (const [id, spec] of Object.entries(feedsObj)) {
        if (spec && typeof spec === 'object') {
          this.defineFeed(id, spec)
        }
      }
    }
    return this
  }

  /**
   * Export the registered feeds as a Feed Specification document.
   * @param {Object} [options]
   * @returns {Object} FeedDocument
   */
  exportFeeds(options = {}) {
    const feeds = {}
    for (const [id, def] of this._feeds.entries()) {
      feeds[id] = { ...def }
    }
    return {
      version: 1,
      name: options.name || 'Data Feed Specification',
      description: options.description || '',
      feeds
    }
  }

  // ---------------------------------------------------------------------------
  // Transduction Bridge: Parameter Mappings & Adapters
  // ---------------------------------------------------------------------------

  /**
   * Add a mapping connecting a data feed to an object parameter or trigger.
   *
   * @param {Object} mappingDef
   * @param {string} mappingDef.feedId - ID of data feed
   * @param {Object} mappingDef.target - Target specification
   * @param {string} mappingDef.target.objectId - Target sound object ID
   * @param {string} [mappingDef.target.param] - Target parameter name
   * @param {'setParam'|'trigger'} [mappingDef.target.action='setParam'] - Action type
   * @param {string} [mappingDef.target.event] - Event name for triggers (default 'strike')
   * @param {Object} [mappingDef.adapter] - Adapter configuration
   * @param {[number, number]} [mappingDef.adapter.inputRange] - Expected input bounds
   * @param {[number, number]} [mappingDef.adapter.outputRange] - Target parameter value range
   * @param {'linear'|'exponential'|'logarithmic'} [mappingDef.adapter.curve='linear']
   * @param {boolean} [mappingDef.adapter.invert=false]
   * @param {string[]|Function[]} [mappingDef.adapter.decorators]
   */
  addMapping(mappingDef) {
    if (!mappingDef || !mappingDef.feedId || !mappingDef.target || !mappingDef.target.objectId) {
      throw new Error('[web-sonify] addMapping requires feedId and target with objectId')
    }

    const { feedId, target, adapter: adapterConfig = {} } = mappingDef
    const action = target.action || (target.param ? 'setParam' : 'trigger')
    const targetKey = action === 'setParam' ? target.param : (target.event || 'strike')

    // Remove any existing duplicate mapping for the same feed and target
    this.removeMapping(feedId, target.objectId, targetKey)

    // Determine input range from feed if omitted
    const feed = this._feeds.get(feedId)
    const inputRange = adapterConfig.inputRange || (feed ? [...feed.range] : [0, 100])
    const outputRange = adapterConfig.outputRange || [0, 1]

    const adapterInstance = new Adapter({
      param: target.param || targetKey,
      inputRange,
      outputRange,
      curve: adapterConfig.curve || 'linear',
      invert: Boolean(adapterConfig.invert),
      autoRange: adapterConfig.autoRange || null
    })

    // Attach any decorators
    if (Array.isArray(adapterConfig.decorators)) {
      for (const dec of adapterConfig.decorators) {
        if (typeof dec === 'function') {
          adapterInstance.pipe(dec)
        } else if (typeof dec === 'string') {
          const transformer = this._resolveDecorator(dec)
          if (transformer) adapterInstance.pipe(transformer)
        }
      }
    }

    const entry = {
      feedId,
      target: {
        objectId: target.objectId,
        param: target.param || null,
        action,
        event: target.event || (action === 'trigger' ? 'strike' : null)
      },
      adapterConfig: {
        inputRange,
        outputRange,
        curve: adapterConfig.curve || 'linear',
        invert: Boolean(adapterConfig.invert),
        decorators: adapterConfig.decorators ? [...adapterConfig.decorators] : []
      },
      adapter: adapterInstance
    }

    this._mappings.push(entry)
    return entry
  }

  /**
   * Remove an active parameter mapping.
   * @param {string} feedId
   * @param {string} objectId
   * @param {string} paramOrEvent
   */
  removeMapping(feedId, objectId, paramOrEvent) {
    this._mappings = this._mappings.filter(m => {
      const matchFeed = m.feedId === feedId
      const matchObj = m.target.objectId === objectId
      const matchParam = (m.target.param === paramOrEvent) || (m.target.event === paramOrEvent)
      return !(matchFeed && matchObj && matchParam)
    })
  }

  /**
   * List active parameter mappings.
   * @param {Object} [filter]
   * @returns {Object[]}
   */
  listMappings(filter = {}) {
    return this._mappings
      .filter(m => {
        if (filter.feedId && m.feedId !== filter.feedId) return false
        if (filter.objectId && m.target.objectId !== filter.objectId) return false
        return true
      })
      .map(m => ({
        feedId: m.feedId,
        target: { ...m.target },
        adapter: { ...m.adapterConfig }
      }))
  }

  /**
   * Ingest a Parameter Mappings document.
   * @param {Object} mappingsDoc
   * @returns {Landscape}
   */
  loadMappings(mappingsDoc) {
    if (!mappingsDoc || typeof mappingsDoc !== 'object') return this
    const list = Array.isArray(mappingsDoc.mappings)
      ? mappingsDoc.mappings
      : (Array.isArray(mappingsDoc) ? mappingsDoc : [])
    for (const m of list) {
      if (m && typeof m === 'object') {
        this.addMapping(m)
      }
    }
    return this
  }

  /**
   * Export parameter mappings as a Mappings Specification document.
   * @param {Object} [options]
   * @returns {Object} MappingsDocument
   */
  exportMappings(options = {}) {
    return {
      version: 1,
      name: options.name || 'Parameter Mappings Specification',
      feedSpecId: options.feedSpecId || '',
      landscapeSpecId: options.landscapeSpecId || '',
      mappings: this.listMappings()
    }
  }

  _resolveDecorator(name) {
    if (name === 'quantizePentatonic' || name === 'quantize:pentatonic') {
      return Quantize.scale(Scales.pentatonic)
    }
    if (name === 'quantizeMinorPentatonic' || name === 'quantize:minorPentatonic') {
      return Quantize.scale(Scales.minorPentatonic)
    }
    if (name === 'quantizeHirajoshi' || name === 'quantize:hirajoshi') {
      return Quantize.scale(Scales.hirajoshi)
    }
    if (name === 'round' || name === 'integer') {
      return Math.round
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Live Telemetry Stream Ingestion
  // ---------------------------------------------------------------------------

  /**
   * Push live telemetry data into the landscape.
   * Automatically scales raw values through the configured Adapters and dispatches
   * to target object parameters or triggers.
   *
   * @param {string} feedId - ID of incoming data feed
   * @param {number|boolean|any} rawValue - Data value
   * @param {Object} [options]
   * @param {Object} [options.payload] - Optional extra payload for trigger events
   */
  pushData(feedId, rawValue, options = {}) {
    const matching = this._mappings.filter(m => m.feedId === feedId)
    if (matching.length === 0) return

    for (const m of matching) {
      const { objectId, param, action, event } = m.target

      if (action === 'trigger') {
        // Event trigger
        if (rawValue) {
          const velocity = typeof rawValue === 'number' && m.adapter ? m.adapter.map(rawValue) : 1.0
          const payload = {
            velocity: Math.max(0.01, Math.min(1.0, velocity)),
            value: rawValue,
            ...(options.payload || {})
          }
          this.trigger(objectId, event || 'strike', payload)
        }
      } else {
        // Continuous parameter
        const numVal = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue)
        if (!isNaN(numVal) && m.adapter) {
          const mapped = m.adapter.map(numVal)
          this.setParam(objectId, param, mapped)
        }
      }
    }
  }

  /**
   * Convenience alias for pushData.
   */
  push(feedId, rawValue, options = {}) {
    return this.pushData(feedId, rawValue, options)
  }

  // ---------------------------------------------------------------------------
  // Scene Document I/O (Declarative Serialization & Ingestion)
  // ---------------------------------------------------------------------------

  /**
   * Serialize only the acoustic landscape configuration.
   *
   * @param {Object} [options]
   * @returns {Object} LandscapeDescriptor
   */
  exportLandscape(options = {}) {
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
   * Serialize the complete scene, including landscape acoustics, feed specs, and mappings.
   *
   * @param {Object} [options]
   * @param {string} [options.name] - Optional scene name override
   * @returns {Object} SceneBundle
   */
  exportScene(options = {}) {
    const landscapeSpec = this.exportLandscape(options)
    const feedsSpec = this.exportFeeds(options)
    const mappingsSpec = this.exportMappings(options)

    return {
      version: 1,
      name: options.name || this._sceneName || 'Landscape Scene',
      // Backward-compatible v1 properties at root
      ...landscapeSpec,
      landscape: landscapeSpec,
      feeds: feedsSpec.feeds,
      mappings: mappingsSpec.mappings
    }
  }

  /**
   * Convenience alias for loadScene.
   */
  async loadLandscape(descriptor, options = {}) {
    return this.loadScene(descriptor, options)
  }

  /**
   * Load and reconfigure the landscape from a declarative SceneDescriptor or SceneBundle.
   *
   * @param {Object} descriptor - Scene or Landscape configuration
   * @param {Object} [options]
   * @param {Record<string, typeof SonifierBase>} [options.plugins] - Optional plugin class overrides
   * @returns {Promise<Landscape>}
   */
  async loadScene(descriptor, options = {}) {
    if (!descriptor || typeof descriptor !== 'object') {
      throw new Error('[web-sonify] loadScene requires a valid scene descriptor object')
    }

    const landscapeDoc = descriptor.landscape || descriptor
    this._sceneName = landscapeDoc.name || 'Landscape Scene'

    // 1. Configure master space & volume
    if (landscapeDoc.space) {
      this.setSpace(landscapeDoc.space)
    }
    if (landscapeDoc.masterVolume !== undefined) {
      this.setMasterVolume(landscapeDoc.masterVolume)
    }

    // 2. Configure layers
    if (landscapeDoc.layers && typeof landscapeDoc.layers === 'object') {
      for (const [name, cfg] of Object.entries(landscapeDoc.layers)) {
        this.defineLayer(name, {
          gain: cfg.gain !== undefined ? cfg.gain : 1.0,
          ducking: cfg.ducking || null
        })
      }
    }

    // 3. Clear existing couplings (will be repopulated from descriptor)
    this._couplings = []

    // 4. Instantiate or update objects
    if (landscapeDoc.objects && typeof landscapeDoc.objects === 'object') {
      for (const [id, objCfg] of Object.entries(landscapeDoc.objects)) {
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
    if (Array.isArray(landscapeDoc.couplings)) {
      for (const c of landscapeDoc.couplings) {
        this.couple(c.sourceId, c.sourceParam, c.targetId, c.targetParam, {
          scale: c.scale,
          offset: c.offset,
          curve: c.curve,
          clamp: c.clamp,
          transform: c.transform
        })
      }
    }

    // 6. Restore feeds if present
    if (descriptor.feeds) {
      this.loadFeeds(descriptor.feeds)
    }

    // 7. Restore mappings if present
    if (descriptor.mappings) {
      this.loadMappings(descriptor.mappings)
    }

    return this
  }
}

