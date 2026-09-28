import { SonifierBase } from '@web-sonifier/core';
import { ShimmerCloud } from './ShimmerCloud.js';

export class EnoTextureSonifier extends SonifierBase {
  constructor() {
    super();
    this._cloudModel = null;
  }

  getParamSchema() {
    return [
      {
        name: 'pitch',
        type: 'number',
        range: [100, 2000],
        default: 261.63,
        unit: 'Hz',
        curve: 'exponential',
        group: 'Spectral Field',
        label: 'Centre Pitch',
        description: 'Centre frequency of the texture cloud'
      },
      {
        name: 'shimmer',
        type: 'number',
        range: [0, 1],
        default: 0.6,
        unit: 'norm',
        curve: 'linear',
        group: 'Timbre',
        label: 'Shimmer',
        description: 'Detuning spread / chorus depth between voices'
      },
      {
        name: 'brightness',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'norm',
        curve: 'linear',
        group: 'Timbre',
        label: 'Brightness',
        description: 'Bandpass centre shift'
      },
      {
        name: 'density',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'norm',
        curve: 'linear',
        group: 'Movement',
        label: 'Density',
        description: 'How many voices are simultaneously active'
      },
      {
        name: 'evolution',
        type: 'number',
        range: [0, 1],
        default: 0.4,
        unit: 'norm',
        curve: 'linear',
        group: 'Movement',
        label: 'Evolution',
        description: 'Rate of independent voice fading'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.35,
        unit: 'gain',
        curve: 'logarithmic',
        group: 'Output',
        label: 'Volume',
        description: 'Master gain'
      }
    ];
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext;
    this._output = outputNode;
    this._cloudModel = new ShimmerCloud(audioContext, outputNode);
  }

  onParam(name, value) {
    if (!this._cloudModel) return;
    switch (name) {
      case 'pitch': this._cloudModel.setPitch(value); break;
      case 'shimmer': this._cloudModel.setShimmer(value); break;
      case 'brightness': this._cloudModel.setBrightness(value); break;
      case 'density': this._cloudModel.setDensity(value); break;
      case 'evolution': this._cloudModel.setEvolution(value); break;
      case 'volume': this._cloudModel.setVolume(value); break;
    }
  }

  destroy() {
    if (this._cloudModel) {
      this._cloudModel.destroy();
      this._cloudModel = null;
    }
    this._ctx = null;
    this._output = null;
  }
}
