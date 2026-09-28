import { SonifierBase } from '@web-sonifier/core'
import { TapeLoopTone } from './TapeLoopTone.js'

export class EnoFigureSonifier extends SonifierBase {
  constructor() {
    super()
    this._model = null
  }
  
  getParamSchema() {
    return [
      { name: 'pitch', type: 'number', range: [200, 2000], default: 523.25, unit: 'Hz', curve: 'exponential', group: 'Tone', label: 'Base Pitch', description: 'Base pitch for triggered notes' },
      { name: 'sustain', type: 'number', range: [0.5, 8.0], default: 3.0, unit: 's', curve: 'linear', group: 'Tone', label: 'Sustain', description: 'Decay time of each note envelope' },
      { name: 'brightness', type: 'number', range: [0, 1], default: 0.3, unit: 'norm', curve: 'linear', group: 'Tone', label: 'Brightness', description: '2nd harmonic level' },
      { name: 'autoRate', type: 'number', range: [0, 2], default: 0.3, unit: 'Hz', curve: 'linear', group: 'Generative', label: 'Auto Rate', description: 'Auto-trigger rate (0 = event-only)' },
      { name: 'scatter', type: 'number', range: [0, 1], default: 0.5, unit: 'norm', curve: 'linear', group: 'Generative', label: 'Scatter', description: 'Timing randomness of auto-triggered notes' },
      { name: 'scale', type: 'enum', values: ['major', 'minor', 'pentatonic', 'dorian', 'chromatic'], default: 'pentatonic', group: 'Generative', label: 'Scale', description: 'Scale for auto-generated note selection' },
      { name: 'volume', type: 'number', range: [0, 1], default: 0.45, unit: 'gain', curve: 'logarithmic', group: 'Output', label: 'Volume', description: 'Master gain' }
    ]
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode
    this._model = new TapeLoopTone(audioContext, outputNode)
  }

  onParam(name, value) {
    if (!this._model) return
    switch (name) {
      case 'pitch': this._model.setPitch(value); break
      case 'sustain': this._model.setSustain(value); break
      case 'brightness': this._model.setBrightness(value); break
      case 'autoRate': this._model.setAutoRate(value); break
      case 'scatter': this._model.setScatter(value); break
      case 'scale': this._model.setScale(value); break
      case 'volume': this._model.setVolume(value); break
    }
  }
  
  trigger(options = {}) {
    if (!this._model) return null
    return this._model.trigger(options)
  }

  destroy() {
    if (this._model) {
      this._model.destroy()
      this._model = null
    }
    this._ctx = null
    this._output = null
  }
}
