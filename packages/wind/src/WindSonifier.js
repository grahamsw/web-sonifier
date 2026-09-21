import { SonifierBase } from '@web-sonifier/core'
import { AeolianWind } from './AeolianWind.js'

/**
 * WindSonifier
 *
 * Procedural physical model for Aeolian wind turbulence, cavity resonance,
 * and vortex shedding based on Andy Farnell's Designing Sound (Chapter 35).
 *
 * Exposes continuous aerodynamic parameters:
 *   - speed: Flow velocity in km/h (0..100)
 *   - turbulence: Gustiness and stochastic wandering depth (0..1)
 *   - cavity: Hollow architectural / chasm Helmholtz resonance (0..1)
 *   - volume: Master output gain (0..1)
 */
export class WindSonifier extends SonifierBase {
  getParamSchema() {
    return [
      {
        name: 'speed',
        type: 'number',
        range: [0, 100],
        default: 25,
        unit: 'km/h',
        curve: 'linear',
        group: 'Aerodynamics',
        label: 'Wind Speed',
        description: 'Airflow velocity driving Strouhal vortex shedding and aerodynamic shear'
      },
      {
        name: 'turbulence',
        type: 'number',
        range: [0, 1.0],
        default: 0.4,
        unit: 'norm',
        curve: 'linear',
        group: 'Aerodynamics',
        label: 'Turbulence',
        description: 'Gustiness, erratic wandering, and high-frequency friction hiss'
      },
      {
        name: 'cavity',
        type: 'number',
        range: [0, 1.0],
        default: 0.3,
        unit: 'norm',
        curve: 'linear',
        group: 'Acoustic Environment',
        label: 'Cavity Resonance',
        description: 'Resonant Helmholtz howling across hollow apertures and architectural cavities'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1.0],
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
    this._windModel = null
    this._ctx = null
    this._output = null
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode
    this._windModel = new AeolianWind(audioContext, outputNode)
  }

  onParam(name, value) {
    if (!this._windModel) return

    switch (name) {
      case 'speed':
        this._windModel.setSpeed(value)
        break
      case 'turbulence':
        this._windModel.setTurbulence(value)
        break
      case 'cavity':
        this._windModel.setCavity(value)
        break
      case 'volume':
        this._windModel.setVolume(value)
        break
    }
  }

  destroy() {
    if (this._windModel) {
      this._windModel.destroy()
      this._windModel = null
    }
    this._ctx = null
    this._output = null
  }
}
