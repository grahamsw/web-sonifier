import { SonifierBase } from '@web-sonifier/core'
import { ModalChime } from './ModalChime.js'

/**
 * ChimeSonifier
 *
 * Procedural physical model for wind chimes and crotales based on Andy Farnell's
 * Designing Sound and Euler-Bernoulli beam theory.
 *
 * Exposes physical parameters (pitch, material, damping, windSpeed, volume)
 * and an event-driven trigger API (strike) for discrete telemetry mapping.
 */
export class ChimeSonifier extends SonifierBase {
  getParamSchema() {
    return [
      {
        name: 'pitch',
        type: 'number',
        range: [150, 2500],
        default: 587.33,
        unit: 'Hz',
        curve: 'exponential',
        group: 'Tube Physics',
        label: 'Base Pitch',
        description: 'Fundamental resonance of the chime tube (D5 = 587 Hz)'
      },
      {
        name: 'material',
        type: 'enum',
        values: ['aluminum', 'bronze', 'steel'],
        default: 'aluminum',
        group: 'Tube Physics',
        label: 'Metal Alloy',
        description: 'Acoustic alloy (aluminum = long ringing, bronze = warm, steel = bright)'
      },
      {
        name: 'damping',
        type: 'number',
        range: [0.05, 1.0],
        default: 0.25,
        unit: 'norm',
        curve: 'linear',
        group: 'Tube Physics',
        label: 'Damping',
        description: 'Energy loss rate (lower = singing sustain, higher = short metallic tap)'
      },
      {
        name: 'windSpeed',
        type: 'number',
        range: [0, 100],
        default: 0,
        unit: 'km/h',
        curve: 'linear',
        group: 'Acoustic Environment',
        label: 'Wind Speed',
        description: 'Ambient airflow velocity driving stochastic clapper strikes (0 = event-only mode)'
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
      },
      {
        name: 'pan',
        type: 'number',
        range: [-1, 1],
        default: 0.45,
        unit: 'pan',
        curve: 'linear',
        group: 'Acoustic Space',
        label: 'Stereo Pan',
        description: 'Stereo azimuth position (-1 left, 0 center, +1 right)'
      },
      {
        name: 'spread',
        type: 'number',
        range: [0, 1],
        default: 0.08,
        unit: 'norm',
        curve: 'linear',
        group: 'Acoustic Space',
        label: 'Stereo Spread',
        description: 'Apparent source width / spatial extent (localized point 0.05 to wider cluster)'
      }
    ]
  }

  constructor() {
    super()
    this._chimeModel = null
    this._ctx = null
    this._output = null
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode
    this._chimeModel = new ModalChime(audioContext, outputNode)
  }

  onParam(name, value) {
    if (!this._chimeModel) return

    switch (name) {
      case 'pitch':
        this._chimeModel.setPitch(value)
        break
      case 'material':
        this._chimeModel.setMaterial(value)
        break
      case 'damping':
        this._chimeModel.setDamping(value)
        break
      case 'windSpeed':
        this._chimeModel.setWindSpeed(value)
        break
      case 'volume':
        this._chimeModel.setVolume(value)
        break
      case 'pan':
        this._chimeModel.setPan(value)
        break
      case 'spread':
        this._chimeModel.setSpread(value)
        break
    }
  }

  /**
   * Event API: Strike the chime tube with specified pitch, velocity, and damping.
   *
   * @param {Object} [options]
   * @param {number} [options.pitch]
   * @param {number} [options.velocity]
   * @param {number} [options.damping]
   * @param {number} [options.time]
   * @param {number} [options.pan]
   */
  strike(options = {}) {
    if (!this._chimeModel) return null
    return this._chimeModel.strike(options)
  }

  destroy() {
    if (this._chimeModel) {
      this._chimeModel.destroy()
      this._chimeModel = null
    }
    this._ctx = null
    this._output = null
  }
}
