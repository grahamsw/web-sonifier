import { SonifierBase } from '@web-sonify/core'

/**
 * DroneSonifier
 * 
 * A drone sonifier based on a SuperCollider synth definition.
 * Uses an AudioWorklet for the synthesis logic.
 */
export class DroneSonifier extends SonifierBase {
  getParamSchema() {
    return [
      {
        name: 'frequency',
        type: 'number',
        range: [20, 200],
        default: 40,
        group: 'drone',
        label: 'Frequency',
        description: 'Base frequency of the drone'
      },
      {
        name: 'nharm',
        type: 'number',
        range: [1, 50],
        default: 12,
        group: 'drone',
        label: 'Harmonics',
        description: 'Number of harmonics'
      },
      {
        name: 'detune',
        type: 'number',
        range: [0, 2],
        default: 0.2,
        group: 'drone',
        label: 'Detune',
        description: 'Detuning amount in semitones'
      },
      {
        name: 'pan',
        type: 'number',
        range: [-1, 1],
        default: 0,
        group: 'drone',
        label: 'Pan',
        description: 'Stereo balance'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'drone',
        label: 'Volume',
        description: 'Master volume'
      }
    ]
  }

  /**
   * @param {string} processorUrl The URL to DroneResonatorProcessor.js.
   */
  constructor(processorUrl = '/packages/drone-sonifier/src/DroneResonatorProcessor.js') {
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
      this._workletNode = new AudioWorkletNode(this._ctx, 'drone-resonator-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      })
      this._workletNode.connect(this._gainNode)
      
      this._initialized = true
    } catch (e) {
      console.error('DroneSonifier init failed:', e)
      throw e
    }
  }

  onParam(name, value) {
    if (this._initialized) {
      this._updateNodes()
    }
  }

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

  _updateNodes(immediate = false) {
    if (!this._workletNode || !this._ctx) return

    const now = this._ctx.currentTime
    const ramp = immediate ? 0 : 0.05

    const setParam = (param, val) => {
      if (!param) return
      if (immediate) param.setValueAtTime(val, now)
      else param.setTargetAtTime(val, now, ramp)
    }

    // Master volume
    setParam(this._gainNode.gain, this.getParam('volume') ?? 0)

    // Update worklet parameters
    const params = this._workletNode.parameters
    if (params.has('frequency')) setParam(params.get('frequency'), this.getParam('frequency') ?? 40)
    if (params.has('nharm')) setParam(params.get('nharm'), this.getParam('nharm') ?? 12)
    if (params.has('detune')) setParam(params.get('detune'), this.getParam('detune') ?? 0.2)
    if (params.has('pan')) setParam(params.get('pan'), this.getParam('pan') ?? 0)
    if (params.has('amplitude')) setParam(params.get('amplitude'), 1.0) // We use gain node for volume
  }
}
