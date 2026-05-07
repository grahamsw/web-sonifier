/**
 * Runtime
 *
 * The core of web-sonify. Manages:
 * - The Web Audio context and master gain node
 * - The plugin registry (available sonifier types)
 * - Creation and teardown of sonifier instances
 *
 * One Runtime per page is the expected pattern.
 *
 * Usage:
 *   const runtime = new Runtime()
 *   runtime.register('tone', ToneSonifier)
 *   const tone = runtime.create('tone')
 *   runtime.setMasterVolume(0.8)
 *   tone.setParam('frequency', 440)
 *   runtime.destroy('tone')
 */
export class Runtime {

  constructor() {
    this._registry = {}     // name -> class
    this._instances = {}    // name -> instance
    this._audioContext = null
    this._masterGain = null
  }

  // ---------------------------------------------------------------------------
  // Audio context
  // ---------------------------------------------------------------------------

  /**
   * Initialise the Web Audio context. Must be called from a user gesture
   * (e.g. a button click) due to browser autoplay policy.
   *
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  start() {
    if (this._audioContext) return

    this._audioContext = new AudioContext()
    this._masterGain = this._audioContext.createGain()
    this._masterGain.gain.value = 1.0
    this._masterGain.connect(this._audioContext.destination)
  }

  /**
   * Suspend audio processing without destroying state.
   * Call this when the user navigates away or closes a panel.
   */
  async suspend() {
    if (this._audioContext) {
      await this._audioContext.suspend()
    }
  }

  /**
   * Resume a suspended audio context.
   */
  async resume() {
    if (this._audioContext) {
      await this._audioContext.resume()
    }
  }

  /**
   * Set the master volume. Affects all sonifiers.
   * @param {number} value - 0..1
   */
  setMasterVolume(value) {
    if (!this._masterGain) {
      console.warn('[web-sonify] Runtime.start() must be called before setMasterVolume()')
      return
    }
    const clamped = Math.max(0, Math.min(1, value))
    // Use setTargetAtTime for a smooth transition rather than a click
    this._masterGain.gain.setTargetAtTime(clamped, this._audioContext.currentTime, 0.01)
  }

  /**
   * Get the current master volume.
   * @returns {number}
   */
  getMasterVolume() {
    return this._masterGain?.gain.value ?? 1.0
  }

  // ---------------------------------------------------------------------------
  // Plugin registry
  // ---------------------------------------------------------------------------

  /**
   * Register a sonifier plugin class under a name.
   * @param {string} name
   * @param {typeof SonifierBase} pluginClass
   */
  register(name, pluginClass) {
    if (this._registry[name]) {
      console.warn(`[web-sonify] Sonifier "${name}" is already registered — overwriting`)
    }
    this._registry[name] = pluginClass
  }

  /**
   * List registered sonifier names.
   * @returns {string[]}
   */
  listRegistered() {
    return Object.keys(this._registry)
  }

  // ---------------------------------------------------------------------------
  // Instance lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Create and initialise a sonifier instance.
   * Returns the plugin instance directly — the site author holds this reference
   * and calls setParam() on it.
   *
   * @param {string} name - must match a registered sonifier
   * @param {string} [instanceId] - optional; defaults to name. Use when running
   *                                multiple instances of the same plugin type.
   * @returns {SonifierBase}
   */
  create(name, instanceId) {
    const id = instanceId ?? name

    if (!this._registry[name]) {
      throw new Error(`[web-sonify] No sonifier registered as "${name}"`)
    }
    if (!this._audioContext) {
      throw new Error(`[web-sonify] Runtime.start() must be called before create()`)
    }
    if (this._instances[id]) {
      console.warn(`[web-sonify] Instance "${id}" already exists — destroying previous`)
      this.destroy(id)
    }

    const instance = new this._registry[name]()
    instance.init(this._audioContext, this._masterGain)
    instance.applyDefaults()

    this._instances[id] = instance
    return instance
  }

  /**
   * Destroy a sonifier instance by id, freeing its audio nodes.
   * @param {string} instanceId
   */
  destroy(instanceId) {
    const instance = this._instances[instanceId]
    if (!instance) {
      console.warn(`[web-sonify] No instance found with id "${instanceId}"`)
      return
    }
    instance.destroy()
    delete this._instances[instanceId]
  }

  /**
   * Destroy all instances and close the audio context.
   * Call this when the page is torn down.
   */
  async destroyAll() {
    for (const id of Object.keys(this._instances)) {
      this.destroy(id)
    }
    if (this._audioContext) {
      await this._audioContext.close()
      this._audioContext = null
      this._masterGain = null
    }
  }
}
