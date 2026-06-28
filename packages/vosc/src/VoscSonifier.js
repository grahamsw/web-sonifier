import { SonifierBase } from '@web-sonifier/core'

/**
 * VoscSonifier
 * 
 * Recreates the SuperCollider VoscPlayer synth in Web Audio.
 * Uses the VoscProcessor AudioWorklet for dynamic wavetable interpolation and modulators.
 */
export class VoscSonifier extends SonifierBase {
  getParamSchema() {
    return [
      {
        name: 'frequency',
        type: 'number',
        range: [20, 2000],
        default: 400,
        group: 'vosc',
        label: 'Frequency',
        description: 'Base frequency of the carrier'
      },
      {
        name: 'amplitude',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'vosc',
        label: 'Amplitude',
        description: 'Synthesis amplitude multiplier'
      },
      {
        name: 'bufLow',
        type: 'number',
        range: [0, 7],
        default: 0,
        group: 'vosc',
        label: 'Buffer Low',
        description: 'Minimum wavetable index for random sweep'
      },
      {
        name: 'bufHigh',
        type: 'number',
        range: [0, 7],
        default: 7,
        group: 'vosc',
        label: 'Buffer High',
        description: 'Maximum wavetable index for random sweep'
      },
      {
        name: 'bufSteps',
        type: 'number',
        range: [1, 100],
        default: 10,
        group: 'vosc',
        label: 'Buffer Steps',
        description: 'Number of steps in the buffer random walk'
      },
      {
        name: 'detuneLow',
        type: 'number',
        range: [0, 12],
        default: 0.01,
        group: 'vosc',
        label: 'Detune Low',
        description: 'Minimum detuning in semitones'
      },
      {
        name: 'detuneHigh',
        type: 'number',
        range: [0, 12],
        default: 0.1,
        group: 'vosc',
        label: 'Detune High',
        description: 'Maximum detuning in semitones'
      },
      {
        name: 'detuneSteps',
        type: 'number',
        range: [1, 100],
        default: 10,
        group: 'vosc',
        label: 'Detune Steps',
        description: 'Number of steps in the detuning random walk'
      },
      {
        name: 'panLow',
        type: 'number',
        range: [-1, 1],
        default: -1,
        group: 'vosc',
        label: 'Pan Low',
        description: 'Minimum pan position'
      },
      {
        name: 'panHigh',
        type: 'number',
        range: [-1, 1],
        default: 1,
        group: 'vosc',
        label: 'Pan High',
        description: 'Maximum pan position'
      },
      {
        name: 'panSteps',
        type: 'number',
        range: [1, 100],
        default: 10,
        group: 'vosc',
        label: 'Pan Steps',
        description: 'Number of steps in the pan random walk'
      },
      {
        name: 'spread',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'vosc',
        label: 'Spread',
        description: 'Stereo spread of the 8 detuned voices'
      },
      {
        name: 'releaseTime',
        type: 'number',
        range: [0, 100],
        default: 10,
        group: 'vosc',
        label: 'Release Time',
        description: 'Envelope release time in seconds'
      },
      {
        name: 'gate',
        type: 'number',
        range: [0, 1],
        default: 1,
        group: 'vosc',
        label: 'Gate',
        description: 'ASR envelope gate (1 = on, 0 = release)'
      },
      {
        name: 'waveSet',
        type: 'number',
        range: [0, 3],
        default: 0,
        group: 'vosc',
        label: 'Wave Set',
        description: 'Wavetable harmonic composition set (0, 1, 2, 3)'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'vosc',
        label: 'Volume',
        description: 'Master volume'
      }
    ]
  }

  /**
   * @param {string} processorUrl The URL to VoscProcessor.js.
   */
  constructor(processorUrl = '/packages/vosc/src/VoscProcessor.js') {
    super()
    this._processorUrl = processorUrl
    this._workletNode = null
  }

  async init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // Internal gain for this sonifier
    this._gainNode = audioContext.createGain()
    this._gainNode.gain.value = 0 // Apply defaults will set this
    this._gainNode.connect(outputNode)

    try {
      // Register the worklet processor
      await this._ctx.audioWorklet.addModule(this._processorUrl)
      
      // Generate initial wavetables
      const waveSet = this.getParam('waveSet') ?? 0
      const wavetables = this._generateWavetables(waveSet)

      // Create the worklet node
      this._workletNode = new AudioWorkletNode(this._ctx, 'vosc-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { wavetables }
      })
      this._workletNode.connect(this._gainNode)
      
      this._initialized = true
    } catch (e) {
      console.error('VoscSonifier init failed:', e)
      throw e
    }
  }

  onParam(name, value) {
    if (this._initialized) {
      if (name === 'waveSet' && this._workletNode) {
        const wavetables = this._generateWavetables(value)
        this._workletNode.port.postMessage({ type: 'wavetables', wavetables })
      } else {
        this._updateNodes()
      }
    }
  }

  destroy() {
    if (this._gainNode && this._ctx) {
      // Teardown integrity: Ramp to 0 before disconnecting
      this._gainNode.gain.setValueAtTime(0, this._ctx.currentTime)
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

    // Master volume (gain node)
    setParam(this._gainNode.gain, this.getParam('volume') ?? 0.5)

    // Update worklet parameters
    const params = this._workletNode.parameters
    if (params.has('frequency')) setParam(params.get('frequency'), this.getParam('frequency') ?? 400)
    if (params.has('amplitude')) setParam(params.get('amplitude'), this.getParam('amplitude') ?? 0.5)
    if (params.has('bufLow')) setParam(params.get('bufLow'), this.getParam('bufLow') ?? 0)
    if (params.has('bufHigh')) setParam(params.get('bufHigh'), this.getParam('bufHigh') ?? 7)
    if (params.has('bufSteps')) setParam(params.get('bufSteps'), this.getParam('bufSteps') ?? 10)
    if (params.has('detuneLow')) setParam(params.get('detuneLow'), this.getParam('detuneLow') ?? 0.01)
    if (params.has('detuneHigh')) setParam(params.get('detuneHigh'), this.getParam('detuneHigh') ?? 0.1)
    if (params.has('detuneSteps')) setParam(params.get('detuneSteps'), this.getParam('detuneSteps') ?? 10)
    if (params.has('panLow')) setParam(params.get('panLow'), this.getParam('panLow') ?? -1)
    if (params.has('panHigh')) setParam(params.get('panHigh'), this.getParam('panHigh') ?? 1)
    if (params.has('panSteps')) setParam(params.get('panSteps'), this.getParam('panSteps') ?? 10)
    if (params.has('spread')) setParam(params.get('spread'), this.getParam('spread') ?? 0.5)
    if (params.has('releaseTime')) setParam(params.get('releaseTime'), this.getParam('releaseTime') ?? 10)
    if (params.has('gate')) setParam(params.get('gate'), this.getParam('gate') ?? 1)
  }

  /**
   * Replicates SuperCollider's ~makeBufs logic to generate 8 consecutive waveforms.
   * @private
   */
  _generateWavetables(waveSet) {
    const numBuffs = 8
    const size = 1024
    const wavetables = []

    for (let i = 0; i < numBuffs; i++) {
      let a = []
      
      if (waveSet === 0) {
        // Array.fill(i+1, { arg j; ((n-j)/n).squared })
        const length = i + 1
        for (let j = 0; j < length; j++) {
          const val = Math.pow((numBuffs - j) / numBuffs, 2)
          a.push(Math.round(val * 1000) / 1000)
        }
      } else if (waveSet === 1) {
        // Array.fill(i, 0) ++ [0.5, 1, 0.5]
        for (let j = 0; j < i; j++) {
          a.push(0)
        }
        a.push(0.5, 1, 0.5)
      } else if (waveSet === 2) {
        // Array of length 32 with 12 random slots set to 1.0 (reproducible/deterministic random seed is best)
        a = new Array(32).fill(0)
        // Set deterministic values so it's consistent
        const activeHarmonics = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 31]
        const limit = Math.min(activeHarmonics.length, 12)
        for (let h = 0; h < limit; h++) {
          const index = (activeHarmonics[h] + i) % 32
          a[index] = 1.0
        }
      } else {
        // (i+1)**2 random harmonics
        const length = Math.pow(i + 1, 2)
        // Use a deterministic pseudo-random formula
        for (let j = 0; j < length; j++) {
          const sinVal = Math.sin(i * 10 + j * 5)
          a.push(sinVal) // between -1 and 1
        }
      }

      // Generate the wavetable samples
      const wave = new Float32Array(size)
      let maxVal = 0

      for (let n = 0; n < size; n++) {
        let sum = 0
        for (let h = 0; h < a.length; h++) {
          sum += a[h] * Math.sin(2 * Math.PI * (h + 1) * n / size)
        }
        wave[n] = sum
        const absVal = Math.abs(sum)
        if (absVal > maxVal) {
          maxVal = absVal
        }
      }

      // Normalize waveform to peak value of 1.0
      if (maxVal > 0) {
        for (let n = 0; n < size; n++) {
          wave[n] /= maxVal
        }
      }

      wavetables.push(wave)
    }

    return wavetables
  }
}
