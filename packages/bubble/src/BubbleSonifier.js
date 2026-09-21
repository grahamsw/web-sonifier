import { SonifierBase } from '@web-sonifier/core'
import { MinnaertBubble } from './MinnaertBubble.js'

/**
 * BubbleSonifier
 *
 * Physical modeling sonifier for fluid droplet and bubble acoustics based on
 * Andy Farnell's Designing Sound (Chapter 34: Water / Bubbles).
 *
 * Exposes both:
 * 1. Continuous physical controls (radius/size, depth, viscosity, continuous bubbling rate)
 * 2. Event-driven API (triggerBubble) for sonifying discrete telemetry arrivals or discrete events.
 */
export class BubbleSonifier extends SonifierBase {
  getParamSchema() {
    return [
      {
        name: 'radius',
        type: 'number',
        range: [0.0005, 0.03],
        default: 0.004,
        unit: 'm',
        curve: 'logarithmic',
        group: 'Physical Geometry',
        label: 'Bubble Radius',
        description: 'Physical bubble radius in meters (smaller = higher pitch tinkle, larger = deep resonant glug)'
      },
      {
        name: 'depth',
        type: 'number',
        range: [0.01, 2.0],
        default: 0.1,
        unit: 'm',
        curve: 'linear',
        group: 'Physical Geometry',
        label: 'Liquid Depth',
        description: 'Submersion depth in liquid (increases hydrostatic pressure and chirp ascent)'
      },
      {
        name: 'viscosity',
        type: 'number',
        range: [0.01, 1.0],
        default: 0.4,
        unit: 'norm',
        curve: 'linear',
        group: 'Fluid Dynamics',
        label: 'Viscosity',
        description: 'Fluid thickness (higher = heavily damped drops, lower = ringing acoustic cavities)'
      },
      {
        name: 'rate',
        type: 'number',
        range: [0, 60],
        default: 0,
        unit: 'drops/s',
        curve: 'exponential',
        group: 'Acoustic Stream',
        label: 'Continuous Rate',
        description: 'Automatic droplet arrival rate (0 = manual event trigger mode, >0 = stream)'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.7,
        unit: 'gain',
        curve: 'logarithmic',
        group: 'Output',
        label: 'Volume',
        description: 'Master output gain'
      }
    ]
  }

  constructor() {
    super()
    this._bubbleModel = null
    this._ctx = null
    this._output = null
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // Instantiate standalone Farnell procedural engine
    this._bubbleModel = new MinnaertBubble(audioContext, outputNode)
  }

  onParam(name, value) {
    if (!this._bubbleModel) return

    switch (name) {
      case 'radius':
        this._bubbleModel.setRadius(value)
        break
      case 'depth':
        this._bubbleModel.setDepth(value)
        break
      case 'viscosity':
        this._bubbleModel.setViscosity(value)
        break
      case 'rate':
        this._bubbleModel.setRate(value)
        break
      case 'volume':
        this._bubbleModel.setVolume(value)
        break
    }
  }

  /**
   * Event API: Trigger a single discrete droplet event.
   * Useful for mapping one-off discrete data items (e.g. database query, error, payment).
   *
   * @param {Object} [options]
   * @param {number} [options.radius]
   * @param {number} [options.energy]
   * @param {number} [options.depth]
   * @param {number} [options.viscosity]
   * @param {number} [options.time]
   */
  triggerBubble(options = {}) {
    if (!this._bubbleModel) return null
    return this._bubbleModel.trigger(options)
  }

  destroy() {
    if (this._bubbleModel) {
      this._bubbleModel.destroy()
      this._bubbleModel = null
    }
    this._ctx = null
    this._output = null
  }
}
