/**
 * MetaParameter (Macro)
 *
 * A pure mathematical 1-to-N parameter mapper.
 * Takes a single scalar control value and translates it into coordinated
 * parameter updates across an instrument.
 *
 * Supports:
 * - Simple 1-segment mappings (range, curve, invert)
 * - SuperCollider-style multi-segment piecewise envelopes with mixed curves
 * - Custom functional transforms
 * - Zero Web Audio / DOM dependencies
 */
export class MetaParameter {

  /**
   * @param {Object} config
   * @param {string} config.name - Identifier (e.g. 'frenzy')
   * @param {string} [config.label] - Human-readable label (e.g. 'Frenzy / Chaos')
   * @param {string} [config.description] - Description or tooltip
   * @param {[number, number]} [config.range=[0, 1]] - Input range
   * @param {number} [config.default=0.5] - Default input value
   * @param {Array<Object>} [config.mappings=[]] - Target parameter mappings
   */
  constructor(config = {}) {
    if (!config.name) {
      throw new Error('[web-sonify] MetaParameter requires a "name"')
    }

    this.name = config.name
    this.label = config.label || config.name
    this.description = config.description || ''
    this.range = config.range ?? [0, 1]
    this.default = config.default ?? (this.range[0] + (this.range[1] - this.range[0]) * 0.5)
    this.mappings = this._normalizeMappings(config.mappings || [])
  }

  /**
   * Map an input scalar value to a dictionary of target parameter values.
   * Pure function: Does not mutate sonifiers.
   *
   * @param {number} rawValue
   * @returns {Record<string, number|string|boolean>}
   */
  map(rawValue) {
    const [inMin, inMax] = this.range
    // Clamping to input range
    const clampedInput = inMax >= inMin
      ? Math.max(inMin, Math.min(inMax, rawValue))
      : Math.max(inMax, Math.min(inMin, rawValue))

    const u = inMax === inMin ? 0 : (clampedInput - inMin) / (inMax - inMin)
    const result = {}

    for (const m of this.mappings) {
      if (typeof m.map === 'function') {
        result[m.param] = m.map(u, clampedInput)
      } else if (m.points && m.points.length > 0) {
        result[m.param] = this._interpolatePoints(u, m.points)
      } else if (m.range) {
        const [outMin, outMax] = m.range
        let norm = m.invert ? (1 - u) : u
        result[m.param] = this._interpolateSegment(norm, outMin, outMax, m.curve || 'linear')
      }
    }

    return result
  }

  /**
   * Alias for map().
   * @param {number} rawValue
   * @returns {Record<string, number|string|boolean>}
   */
  evaluate(rawValue) {
    return this.map(rawValue)
  }

  /**
   * Evaluates input value and applies all updates to the target sonifier.
   *
   * @param {number} rawValue
   * @param {{ setParam: (name: string, value: any) => void }} sonifier
   * @returns {Record<string, number|string|boolean>}
   */
  apply(rawValue, sonifier) {
    if (!sonifier || typeof sonifier.setParam !== 'function') {
      throw new Error('[web-sonify] MetaParameter.apply() requires a sonifier with setParam()')
    }
    const updates = this.map(rawValue)
    for (const [param, val] of Object.entries(updates)) {
      sonifier.setParam(param, val)
    }
    return updates
  }

  /**
   * Get current serializable configuration.
   * @returns {Object}
   */
  getConfig() {
    return {
      name: this.name,
      label: this.label,
      description: this.description,
      range: [...this.range],
      default: this.default,
      mappings: JSON.parse(JSON.stringify(this.mappings))
    }
  }

  /**
   * Update configuration.
   * @param {Partial<Object>} config
   */
  setConfig(config = {}) {
    if (config.name) this.name = config.name
    if (config.label) this.label = config.label
    if (config.description !== undefined) this.description = config.description
    if (config.range) this.range = config.range
    if (config.default !== undefined) this.default = config.default
    if (config.mappings) this.mappings = this._normalizeMappings(config.mappings)
  }

  // ---------------------------------------------------------------------------
  // Internal Normalization & Math
  // ---------------------------------------------------------------------------

  _normalizeMappings(rawMappings) {
    return rawMappings.map(m => {
      const mapping = { ...m }

      // Convert SuperCollider-style levels & times into points array:
      // Env([levels], [times], [curves])
      if (Array.isArray(m.levels) && Array.isArray(m.times)) {
        const points = []
        let currentX = 0
        points.push([currentX, m.levels[0], m.curves?.[0] || 'linear'])

        for (let i = 0; i < m.times.length; i++) {
          currentX += m.times[i]
          const level = m.levels[i + 1] !== undefined ? m.levels[i + 1] : m.levels[i]
          const curve = m.curves?.[i + 1] || m.curves?.[i] || 'linear'
          points.push([currentX, level, curve])
        }
        mapping.points = points
      }

      // Ensure points are sorted by x
      if (Array.isArray(mapping.points)) {
        mapping.points = [...mapping.points].sort((a, b) => a[0] - b[0])
      }

      return mapping
    })
  }

  _interpolatePoints(u, points) {
    if (points.length === 1) return points[0][1]

    // Clamp before first point and after last point
    if (u <= points[0][0]) return points[0][1]
    const last = points[points.length - 1]
    if (u >= last[0]) return last[1]

    // Find segment [p0, p1]
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const x0 = p0[0]
      const x1 = p1[0]

      if (u >= x0 && u <= x1) {
        if (x1 === x0) return p1[1]
        const t = (u - x0) / (x1 - x0)
        // Use p1's curve specification if present, else p0's, else linear
        const curve = p1[2] || p0[2] || 'linear'
        return this._interpolateSegment(t, p0[1], p1[1], curve)
      }
    }

    return last[1]
  }

  _interpolateSegment(t, min, max, curve) {
    switch (curve) {
      case 'exponential':
        // Perceptual exponential mapping
        if (min > 0 && max > 0) {
          return min * Math.pow(max / min, t)
        }
        // Fallback for zero/negative endpoints
        return min + Math.pow(t, 2) * (max - min)

      case 'logarithmic': {
        const curved = t === 0 ? 0 : Math.log1p(t * (Math.E - 1))
        return min + curved * (max - min)
      }

      case 's-curve': {
        const curved = 0.5 - 0.5 * Math.cos(Math.PI * t)
        return min + curved * (max - min)
      }

      case 'linear':
      default:
        return min + t * (max - min)
    }
  }
}

/**
 * Common music technology alias for MetaParameter.
 */
export const Macro = MetaParameter
