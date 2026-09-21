/**
 * EventScatterAdapter
 *
 * Temporal de-quantizer adapter for infrequent, bursty, or periodic batch data feeds
 * (e.g. "5 signups occurred in the last 60 seconds").
 *
 * Rather than dumping all 5 strikes at once or holding a state static for 60 seconds,
 * EventScatterAdapter distributes the N event triggers smoothly across the subsequent window,
 * reconstructing an authentic, living temporal texture.
 */

export class EventScatterAdapter {
  /**
   * @param {Object} config
   * @param {number} [config.windowSeconds=60] - Expected interval duration between batch updates
   * @param {'random'|'uniform'|'poisson'} [config.strategy='random'] - Temporal distribution strategy
   * @param {Function} [config.onTrigger] - Callback invoked when an event fires: onTrigger(eventPayload)
   * @param {number} [config.maxEventsPerWindow=200] - Safety ceiling to prevent audio queue flooding
   */
  constructor(config = {}) {
    this.windowSeconds = Math.max(0.1, config.windowSeconds ?? 60)
    this.strategy = config.strategy ?? 'random'
    this.onTrigger = config.onTrigger ?? null
    this.maxEventsPerWindow = config.maxEventsPerWindow ?? 200

    this._scheduledTimers = new Set()
    this._isPaused = false
  }

  /**
   * Feed a new count of events that occurred over the window.
   * Schedules those events across the window starting now.
   *
   * @param {number} count - Number of events to scatter (e.g. 5 signups)
   * @param {Object} [payload={}] - Optional metadata or parameters passed to onTrigger
   * @returns {number[]} Array of scheduled millisecond delay offsets
   */
  feed(count, payload = {}) {
    if (this._isPaused) return []

    const n = Math.max(0, Math.min(this.maxEventsPerWindow, Math.round(Number(count) || 0)))
    if (n === 0) return []

    const windowMs = this.windowSeconds * 1000
    const offsets = this._generateOffsets(n, windowMs)

    for (const offset of offsets) {
      const timerId = setTimeout(() => {
        this._scheduledTimers.delete(timerId)
        if (!this._isPaused && typeof this.onTrigger === 'function') {
          this.onTrigger({
            ...payload,
            index: offsets.indexOf(offset),
            total: n,
            timeOffset: offset / 1000
          })
        }
      }, offset)

      this._scheduledTimers.add(timerId)
    }

    return offsets
  }

  /**
   * Cancel all currently pending scheduled events
   */
  cancel() {
    for (const timerId of this._scheduledTimers) {
      clearTimeout(timerId)
    }
    this._scheduledTimers.clear()
  }

  /**
   * Pause triggering without discarding scheduled timers
   */
  pause() {
    this._isPaused = true
  }

  /**
   * Resume triggering
   */
  resume() {
    this._isPaused = false
  }

  /**
   * Number of events currently waiting to fire
   */
  get pendingCount() {
    return this._scheduledTimers.size
  }

  // ---------------------------------------------------------------------------
  // Internal Distribution Calculations
  // ---------------------------------------------------------------------------

  _generateOffsets(n, windowMs) {
    const offsets = []

    if (this.strategy === 'uniform') {
      const step = windowMs / (n + 1)
      for (let i = 1; i <= n; i++) {
        offsets.push(i * step)
      }
      return offsets
    }

    if (this.strategy === 'poisson') {
      // Poisson process: inter-arrival interval delta = -ln(U) / lambda
      const lambda = n / windowMs
      let current = 0
      for (let i = 0; i < n; i++) {
        const u = Math.max(0.0001, Math.random())
        const delta = -Math.log(u) / lambda
        current += delta
        if (current >= windowMs) {
          // Wrap or clamp within window
          current = (current % windowMs)
        }
        offsets.push(current)
      }
      return offsets.sort((a, b) => a - b)
    }

    // Default: 'random' uniform distribution across [0, windowMs]
    for (let i = 0; i < n; i++) {
      offsets.push(Math.random() * windowMs)
    }
    return offsets.sort((a, b) => a - b)
  }
}
