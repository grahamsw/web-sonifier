import { SonifierBase } from '@web-sonify/core'

/**
 * PurrSonifier
 * 
 * A complex sonifier that simulates a feline purr using multiple oscillators and resonant filters.
 * Ported and simplified from grahamsw/purr.
 */
export class PurrSonifier extends SonifierBase {
  getParamSchema() {
    return [
      {
        name: 'frequency',
        type: 'number',
        range: [20, 800],
        default: 40,
        group: 'purr',
        label: 'Base Frequency',
        description: 'Fundamental frequency of the resonance (pitch)'
      },
      {
        name: 'rate',
        type: 'number',
        range: [10, 100],
        default: 28,
        group: 'purr',
        label: 'Purr Rate',
        description: 'Repetition rate of the purr cycle (speed)'
      },
      {
        name: 'intensity',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'purr',
        label: 'Intensity',
        description: 'Energy level and spectral presence'
      },
      {
        name: 'arousal',
        type: 'number',
        range: [0, 1],
        default: 0.2,
        group: 'purr',
        label: 'Arousal',
        description: 'Temporal character and breathing modulation'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'purr',
        label: 'Volume',
        description: 'Master volume of the purr'
      }
    ]
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // Master gain for this sonifier
    this._gainNode = audioContext.createGain()
    this._gainNode.gain.value = 0
    this._gainNode.connect(outputNode)

    // Breath path
    this._breathGain = this._ctx.createGain()
    this._breathGain.connect(this._gainNode)

    this._breathLFO = this._ctx.createOscillator()
    this._breathLFOGain = this._ctx.createGain()
    this._breathLFO.connect(this._breathLFOGain)
    
    this._breathMod = this._ctx.createGain()
    this._breathMod.gain.value = 1.0
    this._breathLFOGain.connect(this._breathMod.gain)
    this._breathMod.connect(this._breathGain)

    // Exciter
    this._exciter = this._ctx.createOscillator()
    this._exciterLPF = this._ctx.createBiquadFilter()
    this._exciterLPF.type = 'lowpass'
    this._exciter.connect(this._exciterLPF)

    // Jitter
    this._jitterOsc = this._ctx.createOscillator()
    this._jitterGain = this._ctx.createGain()
    this._jitterOsc.connect(this._jitterGain)
    this._jitterGain.connect(this._exciter.frequency)

    // Formants
    this._f1Res = this._ctx.createBiquadFilter()
    this._f1Res.type = 'bandpass'
    this._f1Gain = this._ctx.createGain()
    this._exciterLPF.connect(this._f1Res)
    this._f1Res.connect(this._f1Gain)
    this._f1Gain.connect(this._breathGain)

    this._f2Res = this._ctx.createBiquadFilter()
    this._f2Res.type = 'bandpass'
    this._f2Gain = this._ctx.createGain()
    this._exciterLPF.connect(this._f2Res)
    this._f2Res.connect(this._f2Gain)
    this._f2Gain.connect(this._breathGain)

    // Rumble
    this._rumbleOsc = this._ctx.createOscillator()
    this._rumbleOsc.type = 'square'
    this._rumbleLPF = this._ctx.createBiquadFilter()
    this._rumbleLPF.type = 'lowpass'
    this._rumbleGain = this._ctx.createGain()
    this._rumbleOsc.connect(this._rumbleLPF)
    this._rumbleLPF.connect(this._rumbleGain)
    this._rumbleGain.connect(this._breathGain)
    this._jitterGain.connect(this._rumbleOsc.frequency)

    // Pulse wave periodic wave
    this._exciter.setPeriodicWave(this._createPulseWave())

    const now = this._ctx.currentTime
    this._exciter.start(now)
    this._jitterOsc.start(now)
    this._rumbleOsc.start(now)
    this._breathLFO.start(now)

    // Apply defaults to ensure finite values for immediate update
    this.applyDefaults()
    this._updateNodes(true)
  }

  onParam(name, value) {
    this._updateNodes()
  }

  destroy() {
    const now = this._ctx?.currentTime || 0
    if (this._gainNode) {
      // Smooth fade out to avoid clicks
      this._gainNode.gain.setTargetAtTime(0, now, 0.02)
      
      // Delay cleanup to allow for ramp
      setTimeout(() => {
        this._cleanup()
      }, 100)
    }
  }

  _cleanup() {
    if (this._exciter) {
      this._exciter.stop()
      this._exciter.disconnect()
      this._exciter = null
    }
    if (this._rumbleOsc) {
      this._rumbleOsc.stop()
      this._rumbleOsc.disconnect()
      this._rumbleOsc = null
    }
    if (this._jitterOsc) {
      this._jitterOsc.stop()
      this._jitterOsc.disconnect()
      this._jitterOsc = null
    }
    if (this._breathLFO) {
      this._breathLFO.stop()
      this._breathLFO.disconnect()
      this._breathLFO = null
    }
    
    // Disconnect all other nodes
    [
      this._breathGain, this._breathLFOGain, this._breathMod,
      this._exciterLPF, this._jitterGain,
      this._f1Res, this._f1Gain, this._f2Res, this._f2Gain,
      this._rumbleLPF, this._rumbleGain, this._gainNode
    ].forEach(node => {
      try { node?.disconnect() } catch (e) {}
    })
    
    this._ctx = null
  }

  _createPulseWave() {
    const n = 64
    const real = new Float32Array(n)
    const imag = new Float32Array(n)
    // Create a pulse-like wave by summing harmonics with 1/n^2 decay
    for (let i = 1; i < n; i++) {
      real[i] = 1.0 / (i * i)
    }
    return this._ctx.createPeriodicWave(real, imag)
  }

  _updateNodes(immediate = false) {
    if (!this._ctx || !this._gainNode) return

    const now = this._ctx.currentTime
    const ramp = immediate ? 0 : 0.05

    const freq = this.getParam('frequency')
    const rate = this.getParam('rate')
    const intensity = this.getParam('intensity')
    const arousal = this.getParam('arousal')
    const volume = this.getParam('volume')

    const setParam = (param, val) => {
      if (!param) return
      if (immediate) param.setValueAtTime(val, now)
      else param.setTargetAtTime(val, now, ramp)
    }

    // Master Volume
    setParam(this._gainNode.gain, volume)

    // Exciter and Rate
    setParam(this._exciter.frequency, rate)
    setParam(this._exciterLPF.frequency, Math.min(20000, freq * 1.5))
    
    // Jitter (Arousal mapping from original source)
    setParam(this._jitterOsc.frequency, 4)
    // jitterDepth original range: 0.02 - 0.22
    const jitterDepth = 0.02 + arousal * 0.20
    setParam(this._jitterGain.gain, rate * jitterDepth * 0.5)

    // Rumble (Intensity mapping)
    setParam(this._rumbleOsc.frequency, rate * 0.5)
    setParam(this._rumbleLPF.frequency, Math.min(1000, freq * 0.8))
    // rumbleAmp original range: 0.08 - 0.38
    const rumbleAmp = 0.08 + intensity * 0.30
    setParam(this._rumbleGain.gain, rumbleAmp * 0.6)

    // Formants (Intensity & Frequency)
    // f1Amp original range: 0.30 - 0.65
    const f1Amp = 0.30 + intensity * 0.35
    setParam(this._f1Res.frequency, Math.min(20000, freq * 1.0))
    setParam(this._f1Res.Q, 5 + 10 * 0.1) 
    setParam(this._f1Gain.gain, f1Amp * 0.4)

    // f2Amp original range: 0.20 - 0.45
    const f2Amp = 0.20 + intensity * 0.25
    setParam(this._f2Res.frequency, Math.min(20000, freq * 2.0))
    setParam(this._f2Res.Q, 3 + 8 * 0.06) 
    setParam(this._f2Gain.gain, f2Amp * 0.3)

    // Breath (Arousal mapping)
    // breathRate original range: 0.15 - 1.35 Hz
    setParam(this._breathLFO.frequency, 0.15 + arousal * 1.20)
    // breathDepth original range: 0.10 - 0.45
    const breathDepth = 0.10 + arousal * 0.35
    setParam(this._breathLFOGain.gain, breathDepth * 0.4)
  }
}
