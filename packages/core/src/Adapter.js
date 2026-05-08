/**
 * Adapter
 *
 * A stateful mapping function. Takes raw data values and maps them to
 * a sonifier parameter's value range. Knows nothing about sonifiers.
 *
 * The site author calls adapter.map(rawValue) and passes the result
 * to sonifier.setParam().
 *
 * Supports:
 * - Fixed input range
 * - Auto-ranging: derives input range from a rolling window of recent values
 * - Curves: linear, exponential, logarithmic
 */
export class Adapter {

  /**
   * @param {Object} config
   * @param {string} config.param              - parameter name this adapter maps to
   * @param {[number, number]} config.outputRange - [min, max] in the sonifier's param space
   * @param {[number, number]} [config.inputRange] - fixed input range; omit to use autoRange
   * @param {'linear'|'exponential'|'logarithmic'} [config.curve='linear']
   * @param {Object} [config.autoRange]        - if present, input range is derived dynamically
   * @param {number} [config.autoRange.windowSize=100] - number of recent values to track
   * @param {number} [config.autoRange.padding=0.05]   - fractional padding added to derived range
   */
  constructor(config) {
    this.param = config.param
    this.outputRange = config.outputRange
    this.curve = config.curve ?? 'linear'
    this._fixedInputRange = config.inputRange ?? null
    this._autoRange = config.autoRange ?? null

    // Rolling window for auto-ranging
    this._window = []
    this._windowSize = config.autoRange?.windowSize ?? 100
    this._padding = config.autoRange?.padding ?? 0.05
  }

  /**
   * Map a raw value to the output range.
   * If autoRange is enabled, updates the rolling window as a side effect.
   *
   * @param {number} rawValue
   * @returns {number} mapped value in outputRange
   */
  map(rawValue) {
    const inputRange = this._resolveInputRange(rawValue)
    if (!inputRange) {
      // Not enough data yet to derive a range
      return this.outputRange[0]
    }
    const normalised = this._normalise(rawValue, inputRange)
    const curved = this._applyCurve(normalised)
    return this._scale(curved, this.outputRange)
  }

  /**
   * Seed the adapter with historical values.
   * Useful for priming the auto-range window before live data arrives.
   *
   * @param {number[]} values
   */
  seed(values) {
    for (const v of values) {
      this._updateWindow(v)
    }
  }

  /**
   * Get the current configuration (e.g. for saving or displaying in a settings dialog).
   * @returns {Object}
   */
  getConfig() {
    return {
      param: this.param,
      outputRange: [...this.outputRange],
      inputRange: this._fixedInputRange ? [...this._fixedInputRange] : null,
      curve: this.curve,
      autoRange: this._autoRange ? { windowSize: this._windowSize, padding: this._padding } : null
    }
  }

  /**
   * Update configuration (e.g. from a settings dialog).
   * @param {Partial<Object>} config
   */
  setConfig(config) {
    if (config.param)       this.param = config.param
    if (config.outputRange) this.outputRange = config.outputRange
    if (config.inputRange)  this._fixedInputRange = config.inputRange
    if (config.curve)       this.curve = config.curve
    if (config.autoRange) {
      this._autoRange = config.autoRange
      this._windowSize = config.autoRange.windowSize ?? this._windowSize
      this._padding = config.autoRange.padding ?? this._padding
    }
  }

  /**
   * Get the current derived input range (useful for display in a settings dialog).
   * Returns null if using auto-range and not enough data yet.
   * @returns {[number, number]|null}
   */
  getInputRange() {
    if (this._fixedInputRange) return [...this._fixedInputRange]
    return this._deriveRangeFromWindow()
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  _resolveInputRange(rawValue) {
    if (this._fixedInputRange) return this._fixedInputRange
    if (this._autoRange) {
      this._updateWindow(rawValue)
      return this._deriveRangeFromWindow()
    }
    console.warn('[web-sonify] Adapter has no inputRange and autoRange is not enabled')
    return null
  }

  _updateWindow(value) {
    this._window.push(value)
    if (this._window.length > this._windowSize) {
      this._window.shift()
    }
  }

  _deriveRangeFromWindow() {
    if (this._window.length < 2) return null
    const min = Math.min(...this._window)
    const max = Math.max(...this._window)
    if (min === max) return null
    const pad = (max - min) * this._padding
    return [min - pad, max + pad]
  }

  _normalise(value, [min, max]) {
    if (max === min) return 0
    return Math.max(0, Math.min(1, (value - min) / (max - min)))
  }

  _applyCurve(t) {
    switch (this.curve) {
      case 'exponential':
        // Preserves perceptual spacing (e.g. for frequency/pitch)
        return t === 0 ? 0 : Math.pow(t, 2)
      case 'logarithmic':
        return t === 0 ? 0 : Math.log1p(t * (Math.E - 1))
      case 'linear':
      default:
        return t
    }
  }

  _scale(t, [min, max]) {
    return min + t * (max - min)
  }
}
