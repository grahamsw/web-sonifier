import { SonifierBase } from '@web-sonify/core'

/**
 * EngineSonifier
 * 
 * Generates an engine-like sound (or purr) using filtered white noise and LFO volume modulation.
 * Converted from the realtime project.
 */
export class EngineSonifier extends SonifierBase {
  getParamSchema() {
    return [
      {
        name: 'pitch',
        type: 'number',
        range: [20, 2000],
        default: 300,
        group: 'engine',
        label: 'Pitch (Hz)',
        description: 'Fundamental frequency of the engine resonance'
      },
      {
        name: 'rate',
        type: 'number',
        range: [0.1, 60],
        default: 25,
        group: 'engine',
        label: 'Volatility / Rate',
        description: 'Speed of the volume modulation (LFO)'
      },
      {
        name: 'volumeVariance',
        type: 'number',
        range: [0, 0.5],
        default: 0.1,
        group: 'engine',
        label: 'Throttle Depth',
        description: 'Depth of the volume modulation'
      },
      {
        name: 'rolloff',
        type: 'number',
        range: [-96, -12], // We'll map internally to -12, -24, -48, -96
        default: -96,
        group: 'engine',
        label: 'Filter Rolloff',
        description: 'Steepness of the bandpass filters (-12 to -96 dB/octave)'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.25,
        group: 'engine',
        label: 'Master Volume',
        description: 'Overall volume of the engine'
      }
    ]
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // 1. Master Gain & LFO
    this._masterGain = this._ctx.createGain()
    this._masterGain.gain.value = 0 // set in updateNodes
    this._masterGain.connect(outputNode)

    this._lfo = this._ctx.createOscillator()
    this._lfo.type = 'sine'
    this._lfoGain = this._ctx.createGain()
    this._lfoGain.gain.value = 0 // set in updateNodes
    this._lfo.connect(this._lfoGain)
    this._lfoGain.connect(this._masterGain.gain)

    // 2. White Noise Source
    this._noiseBuffer = this._createWhiteNoiseBuffer()
    this._noiseSource = this._ctx.createBufferSource()
    this._noiseSource.buffer = this._noiseBuffer
    this._noiseSource.loop = true

    // 3. Filter Banks
    const harmonics = [
      { ratio: 1, amp: 0.25 },
      { ratio: 3, amp: 0.08 },
      { ratio: 4, amp: 0.05 },
      { ratio: 7, amp: 0.02 }
    ]

    this._filterBanks = harmonics.map(h => {
      // Create 8 cascaded filters for up to -96dB rolloff
      const filters = []
      for (let i = 0; i < 8; i++) {
        const filter = this._ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filters.push(filter)
      }

      // Chain them: noise -> f0 -> f1 -> f2 ... -> f7
      this._noiseSource.connect(filters[0])
      for (let i = 0; i < 7; i++) {
        filters[i].connect(filters[i + 1])
      }

      // Taps for different rolloffs
      const taps = {
        12: { source: filters[0], gain: this._ctx.createGain() },
        24: { source: filters[1], gain: this._ctx.createGain() },
        48: { source: filters[3], gain: this._ctx.createGain() },
        96: { source: filters[7], gain: this._ctx.createGain() }
      }

      const bankOutGain = this._ctx.createGain()
      bankOutGain.gain.value = h.amp

      // Connect taps to bank out
      Object.values(taps).forEach(tap => {
        tap.gain.gain.value = 0
        tap.source.connect(tap.gain)
        tap.gain.connect(bankOutGain)
      })

      bankOutGain.connect(this._masterGain)

      return { ratio: h.ratio, amp: h.amp, filters, taps }
    })

    const now = this._ctx.currentTime
    this._lfo.start(now)
    this._noiseSource.start(now)

    this._initialized = true
  }

  _createWhiteNoiseBuffer() {
    const bufferSize = this._ctx.sampleRate * 2 // 2 seconds
    const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
    const output = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1
    }
    return buffer
  }

  onParam(name, value) {
    if (this._initialized) {
      this._updateNodes()
    }
  }

  _updateNodes(immediate = false) {
    if (!this._ctx || !this._masterGain) return

    const now = this._ctx.currentTime
    const ramp = immediate ? 0 : 0.05

    const pitch = this.getParam('pitch') ?? 300
    const rate = this.getParam('rate') ?? 25
    const volume = this.getParam('volume') ?? 0.25
    const volumeVariance = this.getParam('volumeVariance') ?? 0.1
    const rolloff = this.getParam('rolloff') ?? -96

    const setParam = (param, val) => {
      if (!param || !Number.isFinite(val)) return
      if (immediate) param.setValueAtTime(val, now)
      else param.setTargetAtTime(val, now, ramp)
    }

    // Map rolloff to tap
    let activeTap = 96
    if (rolloff >= -12) activeTap = 12
    else if (rolloff >= -24) activeTap = 24
    else if (rolloff >= -48) activeTap = 48

    setParam(this._masterGain.gain, volume)
    setParam(this._lfo.frequency, rate)
    setParam(this._lfoGain.gain, volumeVariance)

    // Update filter banks
    this._filterBanks.forEach(bank => {
      const targetFreq = Math.min(20000, pitch * bank.ratio)
      bank.filters.forEach(f => {
        setParam(f.frequency, targetFreq)
      })

      // Update tap gains (crossfade/switch)
      Object.entries(bank.taps).forEach(([tapKey, tap]) => {
        const isTarget = parseInt(tapKey, 10) === activeTap
        setParam(tap.gain.gain, isTarget ? 1.0 : 0.0)
      })
    })
  }

  destroy() {
    const now = this._ctx?.currentTime || 0
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(0, now, 0.02)
      setTimeout(() => {
        this._cleanup()
      }, 100)
    }
  }

  _cleanup() {
    if (this._noiseSource) {
      try { this._noiseSource.stop() } catch (e) {}
      this._noiseSource.disconnect()
      this._noiseSource = null
    }
    if (this._lfo) {
      try { this._lfo.stop() } catch (e) {}
      this._lfo.disconnect()
      this._lfo = null
    }

    if (this._filterBanks) {
      this._filterBanks.forEach(bank => {
        bank.filters.forEach(f => {
          try { f.disconnect() } catch (e) {}
        })
        Object.values(bank.taps).forEach(tap => {
          try { tap.gain.disconnect() } catch (e) {}
        })
      })
      this._filterBanks = null
    }

    [this._masterGain, this._lfoGain].forEach(node => {
      try { node?.disconnect() } catch (e) {}
    })

    this._ctx = null
  }
}
