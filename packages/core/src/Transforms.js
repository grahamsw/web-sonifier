/**
 * Numeric Stateful Transforms for Web Sonifier
 *
 * Provides reusable preprocessing pipelines for data feeds and adapters.
 * Each factory creates a stateful closure (val => number) that maintains
 * its own history buffer or accumulator.
 */

export const Transforms = {
  /**
   * Exponential Moving Average (Single-pole lowpass filter).
   * Smooths high-frequency jitter and temporal noise in continuous streams.
   *
   * y[t] = alpha * x[t] + (1 - alpha) * y[t - 1]
   *
   * @param {number} [alpha=0.2] - Smoothing factor between 0 (max smoothing) and 1 (no smoothing)
   * @param {number} [initialValue=null] - Optional starting state
   * @returns {((val: number) => number) & { reset: (val?: number) => void }}
   */
  ema(alpha = 0.2, initialValue = null) {
    const a = Math.max(0.001, Math.min(1.0, Number(alpha) || 0.2))
    let y = initialValue != null ? Number(initialValue) : null

    const transform = (x) => {
      const num = Number(x)
      if (isNaN(num)) return y ?? 0
      if (y === null) {
        y = num
        return y
      }
      y = a * num + (1.0 - a) * y
      return y
    }

    transform.reset = (val = null) => {
      y = val != null ? Number(val) : null
    }

    return transform
  },

  /**
   * Simple Moving Average over a sliding window of N samples.
   *
   * @param {number} [windowSize=5] - Number of samples in moving window
   * @returns {((val: number) => number) & { reset: () => void }}
   */
  sma(windowSize = 5) {
    const size = Math.max(1, Math.round(Number(windowSize) || 5))
    let window = []

    const transform = (x) => {
      const num = Number(x)
      if (isNaN(num)) {
        if (window.length === 0) return 0
        const sum = window.reduce((acc, v) => acc + v, 0)
        return sum / window.length
      }

      window.push(num)
      if (window.length > size) {
        window.shift()
      }

      const sum = window.reduce((acc, v) => acc + v, 0)
      return sum / window.length
    }

    transform.reset = () => {
      window = []
    }

    return transform
  },

  /**
   * First-order difference / rate of change (derivative).
   * Outputs delta = x[t] - x[t - 1]. Returns 0 on the first sample.
   *
   * @returns {((val: number) => number) & { reset: () => void }}
   */
  delta() {
    let prev = null

    const transform = (x) => {
      const num = Number(x)
      if (isNaN(num)) return 0
      if (prev === null) {
        prev = num
        return 0
      }
      const d = num - prev
      prev = num
      return d
    }

    transform.reset = () => {
      prev = null
    }

    return transform
  },

  /**
   * Boundary detector & threshold gate with optional hysteresis.
   * Useful for triggering events or gating values when exceeding limits.
   *
   * @param {Object} [options]
   * @param {number} [options.threshold=0.5] - Activation threshold
   * @param {number} [options.hysteresis=0] - Lag zone to prevent chatter
   * @param {number} [options.above=1] - Output when above threshold
   * @param {number} [options.below=0] - Output when below threshold
   * @returns {((val: number) => number) & { reset: () => void }}
   */
  threshold(options = {}) {
    const t = Number(options.threshold ?? 0.5)
    const hyst = Math.max(0, Number(options.hysteresis || 0))
    const aboveVal = Number(options.above ?? 1)
    const belowVal = Number(options.below ?? 0)

    let state = false

    const transform = (x) => {
      const num = Number(x)
      if (isNaN(num)) return state ? aboveVal : belowVal

      if (!state) {
        if (num >= t + hyst) {
          state = true
        }
      } else {
        if (num <= t - hyst) {
          state = false
        }
      }

      return state ? aboveVal : belowVal
    }

    transform.reset = () => {
      state = false
    }

    return transform
  },

  /**
   * Running accumulator / numerical integrator.
   * Accumulates incoming values with optional bounds clamping.
   *
   * @param {number} [initial=0] - Initial accumulated sum
   * @param {number} [min=-Infinity] - Minimum clamp bound
   * @param {number} [max=Infinity] - Maximum clamp bound
   * @returns {((val: number) => number) & { reset: (val?: number) => void }}
   */
  accumulate(initial = 0, min = -Infinity, max = Infinity) {
    const initVal = Number(initial) || 0
    const minVal = Number(min)
    const maxVal = Number(max)
    let sum = Math.max(minVal, Math.min(maxVal, initVal))

    const transform = (x) => {
      const num = Number(x)
      if (!isNaN(num)) {
        sum = Math.max(minVal, Math.min(maxVal, sum + num))
      }
      return sum
    }

    transform.reset = (val = initVal) => {
      sum = Math.max(minVal, Math.min(maxVal, Number(val) || 0))
    }

    return transform
  }
}
