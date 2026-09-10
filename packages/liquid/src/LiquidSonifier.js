import { SonifierBase } from '@web-sonifier/core'

/**
 * LiquidSonifier
 * 
 * A physical modeling liquid resonator that uses an AudioWorklet for efficient per-sample processing.
 * Ported from grahamsw/purr.
 */
export class LiquidSonifier extends SonifierBase {
  getParamSchema() {
    return [
      {
        name: 'frequency',
        type: 'number',
        range: [10, 100],
        default: 40,
        unit: 'Hz',
        curve: 'exponential',
        group: 'Resonance & Tone',
        label: 'Frequency',
        description: 'Excitation frequency of the resonator'
      },
      {
        name: 'viscosity',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'norm',
        curve: 'linear',
        invert: true,
        group: 'Fluid Physics',
        label: 'Viscosity',
        description: 'Thickness of the liquid (damps high frequencies)'
      },
      {
        name: 'resonatorVolume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'scale',
        curve: 'linear',
        group: 'Fluid Physics',
        label: 'Resonator Volume',
        description: 'Physical size of the liquid container'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'gain',
        curve: 'logarithmic',
        group: 'Output',
        label: 'Volume',
        description: 'Master volume of the resonator'
      }
    ]
  }

  /**
   * @param {string} processorUrl The URL to LiquidResonatorProcessor.js. 
   * Defaults to a path relative to the root in many dev servers.
   */
  constructor(processorUrl = '/packages/liquid/src/LiquidResonatorProcessor.js') {
    super()
    this._processorUrl = processorUrl
    this._workletNode = null
  }

  async init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // Internal gain for this sonifier
    this._gainNode = audioContext.createGain()
    this._gainNode.gain.value = 0
    this._gainNode.connect(outputNode)

    try {
      // Register the worklet processor
      await this._ctx.audioWorklet.addModule(this._processorUrl)
      
      // Create the worklet node
      this._workletNode = new AudioWorkletNode(this._ctx, 'liquid-resonator-processor')
      this._workletNode.connect(this._gainNode)
      
      this._initialized = true
    } catch (e) {
      console.error('LiquidSonifier init failed:', e)
      throw e
    }
  }

  /**
   * Called when a parameter changes.
   * @param {string} name 
   * @param {number|string} value 
   */
  onParam(name, value) {
    if (this._initialized) {
      this._updateNodes()
    }
  }

  /**
   * Cleans up resources.
   */
  destroy() {
    if (this._gainNode) {
      this._gainNode.disconnect()
      this._gainNode = null
    }
    if (this._workletNode) {
      this._workletNode.disconnect()
      this._workletNode = null
    }
    this._ctx = null
  }

  /**
   * Updates the internal audio nodes based on current parameters.
   * @param {boolean} [immediate=false] Whether to skip the ramp.
   * @private
   */
  _updateNodes(immediate = false) {
    if (!this._workletNode || !this._ctx) return

    const now = this._ctx.currentTime
    const ramp = immediate ? 0 : 0.05

    const freq = this.getParam('frequency') ?? 40
    const visc = this.getParam('viscosity') ?? 0.5
    const resVol = this.getParam('resonatorVolume') ?? 0.5
    const volume = this.getParam('volume') ?? 0

    const setParam = (param, val) => {
      if (!param) return
      if (immediate) param.setValueAtTime(val, now)
      else param.setTargetAtTime(val, now, ramp)
    }

    // Master volume (using the gain node)
    setParam(this._gainNode.gain, volume)

    // Update worklet parameters
    const params = this._workletNode.parameters
    if (params.has('frequency')) setParam(params.get('frequency'), freq)
    if (params.has('viscosity')) setParam(params.get('viscosity'), visc)
    if (params.has('volume')) setParam(params.get('volume'), resVol)
  }
}
