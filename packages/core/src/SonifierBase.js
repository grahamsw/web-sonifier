/**
 * SonifierBase
 *
 * Base class for all sonifier plugins. Plugin authors extend this class
 * and implement getParamSchema(), init(), onParam(), and destroy().
 *
 * The base class owns setParam() — it validates the value, stores it,
 * then calls onParam() for the subclass to act on.
 */
export class SonifierBase {

  constructor() {
    this._paramValues = {}
  }

  // ---------------------------------------------------------------------------
  // To be implemented by subclass
  // ---------------------------------------------------------------------------

  /**
   * Return an array of parameter descriptors.
   * @returns {ParamSchema[]}
   *
   * @example
   * return [
   *   { name: 'frequency', type: 'number', range: [20, 2000], default: 220,
   *     group: 'tone', label: 'Frequency', description: 'Oscillator frequency in Hz' },
   *   { name: 'volume',    type: 'number', range: [0, 1],     default: 0.5,
   *     group: 'tone', label: 'Volume' }
   * ]
   */
  getParamSchema() {
    throw new Error(`${this.constructor.name} must implement getParamSchema()`)
  }

  /**
   * Called once when the sonifier is created.
   * Plugin should build its Web Audio graph here and connect to outputNode.
   *
   * @param {AudioContext} audioContext
   * @param {AudioNode} outputNode - connect your final node to this
   */
  init(audioContext, outputNode) {
    throw new Error(`${this.constructor.name} must implement init()`)
  }

  /**
   * Called by the base class after a param value has been validated and stored.
   * Plugin should respond to the new value here (e.g. update oscillator frequency).
   *
   * @param {string} name
   * @param {*} value
   */
  onParam(name, value) {
    throw new Error(`${this.constructor.name} must implement onParam()`)
  }

  /**
   * Called when the sonifier is torn down.
   * Plugin should stop and disconnect all audio nodes here.
   */
  destroy() {
    throw new Error(`${this.constructor.name} must implement destroy()`)
  }

  // ---------------------------------------------------------------------------
  // Provided by base class — do not override
  // ---------------------------------------------------------------------------

  /**
   * Set a parameter value. Validates against schema, stores value, calls onParam().
   * This is what the site author and adapters call.
   *
   * @param {string} name
   * @param {*} value
   */
  setParam(name, value) {
    const schema = this._getSchemaEntry(name)
    if (!schema) {
      console.warn(`[web-sonify] Unknown param "${name}" on ${this.constructor.name}`)
      return
    }

    const cooked = this._validate(schema, value)
    this._paramValues[name] = cooked
    this.onParam(name, cooked)
  }

  /**
   * Get the current stored value of a parameter.
   * @param {string} name
   * @returns {*}
   */
  getParam(name) {
    return this._paramValues[name]
  }

  /**
   * Apply all default values from the schema.
   * Called by Runtime after init().
   */
  applyDefaults() {
    for (const entry of this.getParamSchema()) {
      if (entry.default !== undefined) {
        this.setParam(entry.name, entry.default)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _getSchemaEntry(name) {
    return this.getParamSchema().find(p => p.name === name) ?? null
  }

  _validate(schema, value) {
    if (schema.type === 'number') {
      const n = Number(value)
      if (isNaN(n)) {
        console.warn(`[web-sonify] Param "${schema.name}" expected a number, got ${value}`)
        return schema.default ?? 0
      }
      if (schema.range) {
        const [min, max] = schema.range
        if (n < min || n > max) {
          console.warn(`[web-sonify] Param "${schema.name}" value ${n} clamped to [${min}, ${max}]`)
          return Math.min(max, Math.max(min, n))
        }
      }
      return n
    }

    if (schema.type === 'enum') {
      if (!schema.values.includes(value)) {
        console.warn(`[web-sonify] Param "${schema.name}" invalid value "${value}", using default`)
        return schema.default ?? schema.values[0]
      }
      return value
    }

    if (schema.type === 'boolean') {
      return Boolean(value)
    }

    return value
  }
}

/**
 * @typedef {Object} ParamSchema
 * @property {string} name
 * @property {'number'|'enum'|'boolean'} type
 * @property {[number, number]} [range]   - for type 'number'
 * @property {string[]} [values]          - for type 'enum'
 * @property {*} [default]
 * @property {string} [group]
 * @property {string} [label]
 * @property {string} [description]
 */
