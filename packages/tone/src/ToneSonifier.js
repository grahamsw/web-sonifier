/**
 * ToneSonifier
 *
 * A simple continuous tone sonifier. Demonstrates the plugin interface.
 *
 * Parameters:
 *   frequency  - oscillator frequency in Hz
 *   volume     - gain of this sonifier (0..1), independent of master volume
 *   waveform   - oscillator waveform type
 *
 * Audio graph:
 *   oscillator -> gainNode -> outputNode
 */

import { SonifierBase } from '@web-sonify/core'

export class ToneSonifier extends SonifierBase {

  getParamSchema() {
    return [
      {
        name: 'frequency',
        type: 'number',
        range: [20, 2000],
        default: 220,
        group: 'tone',
        label: 'Frequency',
        description: 'Oscillator frequency in Hz'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'tone',
        label: 'Volume',
        description: 'Volume of this sonifier (0 to 1)'
      },
      {
        name: 'waveform',
        type: 'enum',
        values: ['sine', 'square', 'sawtooth', 'triangle'],
        default: 'sine',
        group: 'tone',
        label: 'Waveform',
        description: 'Oscillator waveform shape'
      }
    ]
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext

    this._gainNode = audioContext.createGain()
    this._gainNode.gain.value = 0  // start silent, applyDefaults() will set volume

    this._oscillator = audioContext.createOscillator()
    this._oscillator.type = 'sine'
    this._oscillator.frequency.value = 220

    this._oscillator.connect(this._gainNode)
    this._gainNode.connect(outputNode)

    this._oscillator.start()
  }

  onParam(name, value) {
    if (!this._oscillator) return

    switch (name) {
      case 'frequency':
        // Smooth frequency changes to avoid clicks
        this._oscillator.frequency.setTargetAtTime(value, this._ctx.currentTime, 0.01)
        break

      case 'volume':
        this._gainNode.gain.setTargetAtTime(value, this._ctx.currentTime, 0.01)
        break

      case 'waveform':
        this._oscillator.type = value
        break
    }
  }

  destroy() {
    if (this._oscillator) {
      // NOTE: To avoid clicks, we should ideally ramp gain to zero before 
      // stopping/disconnecting. However, SonifierBase.destroy() is synchronous.
      // We stop the oscillator at the current time to at least terminate the source.
      this._oscillator.stop()
      this._oscillator.disconnect()
      this._oscillator = null
    }
    if (this._gainNode) {
      this._gainNode.disconnect()
      this._gainNode = null
    }
    this._ctx = null
  }
}
