import { SonifierBase } from '@web-sonifier/core';
import { AmbientPad } from './AmbientPad.js';

export class EnoBedSonifier extends SonifierBase {
  constructor() {
    super();
    this._padModel = null;
  }

  getParamSchema() {
    return [
      { name: 'pitch', type: 'number', range: [60, 880], default: 130.81, unit: 'Hz', curve: 'exponential', group: 'Harmonic Field', label: 'Root Pitch', description: 'Root frequency of the pad chord' },
      { name: 'warmth', type: 'number', range: [0, 1], default: 0.65, unit: 'norm', curve: 'linear', group: 'Timbre', label: 'Warmth', description: 'Lowpass filter brightness' },
      { name: 'detune', type: 'number', range: [0, 1], default: 0.4, unit: 'norm', curve: 'linear', group: 'Timbre', label: 'Detune', description: 'Micro-detuning spread between voices' },
      { name: 'drift', type: 'number', range: [0, 1], default: 0.3, unit: 'norm', curve: 'linear', group: 'Movement', label: 'Drift Depth', description: 'LFO depth modulating filter cutoff' },
      { name: 'driftRate', type: 'number', range: [0.01, 0.5], default: 0.08, unit: 'Hz', curve: 'logarithmic', group: 'Movement', label: 'Drift Rate', description: 'LFO speed' },
      { name: 'volume', type: 'number', range: [0, 1], default: 0.4, unit: 'gain', curve: 'logarithmic', group: 'Output', label: 'Volume', description: 'Master gain' }
    ];
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext;
    this._output = outputNode;
    this._padModel = new AmbientPad(audioContext, outputNode);
  }

  onParam(name, value) {
    if (!this._padModel) return;
    switch (name) {
      case 'pitch': this._padModel.setPitch(value); break;
      case 'warmth': this._padModel.setWarmth(value); break;
      case 'detune': this._padModel.setDetune(value); break;
      case 'drift': this._padModel.setDrift(value); break;
      case 'driftRate': this._padModel.setDriftRate(value); break;
      case 'volume': this._padModel.setVolume(value); break;
    }
  }

  destroy() {
    if (this._padModel) {
      this._padModel.destroy();
      this._padModel = null;
    }
    this._ctx = null;
    this._output = null;
  }
}
