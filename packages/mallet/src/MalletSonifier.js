import { SonifierBase } from '@web-sonifier/core'

/**
 * MalletSonifier
 * 
 * A physical modeling mallet instrument using modal synthesis.
 * Emits periodic strikes with noise-burst excitation and resonant filters.
 * Ported and simplified from grahamsw/purr.
 */
export class MalletSonifier extends SonifierBase {
  getParamSchema() {
    return [
      {
        name: 'strikeRate',
        type: 'number',
        range: [0.1, 20],
        default: 1.0,
        unit: 'Hz',
        curve: 'exponential',
        group: 'Striking',
        label: 'Strike Rate',
        description: 'How often the mallet strikes (Hz)'
      },
      {
        name: 'force',
        type: 'number',
        range: [0, 1],
        default: 0.7,
        unit: 'norm',
        curve: 'linear',
        group: 'Striking',
        label: 'Force',
        description: 'Impact strength'
      },
      {
        name: 'hardness',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'norm',
        curve: 'linear',
        group: 'Striking',
        label: 'Hardness',
        description: 'Hardness of the mallet head'
      },
      {
        name: 'boxSize',
        type: 'number',
        range: [0.5, 2.0],
        default: 1.0,
        unit: 'scale',
        curve: 'linear',
        invert: true,
        group: 'Resonant Body',
        label: 'Box Size',
        description: 'Size of the resonant body (larger = deeper resonance)'
      },
      {
        name: 'resonance',
        type: 'number',
        range: [0, 1],
        default: 0.4,
        unit: 'norm',
        curve: 'linear',
        group: 'Resonant Body',
        label: 'Resonance',
        description: 'Q factor of the resonant bank'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'gain',
        curve: 'logarithmic',
        group: 'Output',
        label: 'Volume',
        description: 'Master volume'
      }
    ]
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // Internal gain for this sonifier
    this._gainNode = audioContext.createGain()
    this._gainNode.gain.value = 0 // volume will be updated via onParam
    this._gainNode.connect(outputNode)

    this._timerId = null
    this._isStarted = false
    
    // Apply initial defaults
    this.applyDefaults()

    this._initialized = true
    this.start()
  }

  onParam(name, value) {
    if (this._initialized && name === 'volume' && this._gainNode && this._ctx) {
      this._gainNode.gain.setTargetAtTime(value, this._ctx.currentTime, 0.05)
    }
  }

  start() {
    if (this._isStarted) return
    this._isStarted = true
    this._scheduleNextStrike()
  }

  stop() {
    this._isStarted = false
    if (this._timerId) {
      clearTimeout(this._timerId)
      this._timerId = null
    }
  }

  destroy() {
    this.stop()
    if (this._gainNode) {
      this._gainNode.disconnect()
      this._gainNode = null
    }
    this._ctx = null
  }

  /**
   * Performs a single mallet strike.
   * @private
   */
  _strike() {
    if (!this._isStarted || !this._ctx || !this._gainNode) return

    const now = this._ctx.currentTime

    // 1. Create Noise Buffer (Excitation source)
    const bufferSize = this._ctx.sampleRate * 0.05 // 50ms burst
    const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const noiseSource = this._ctx.createBufferSource()
    noiseSource.buffer = buffer

    // 2. Setup Excitation Filter (Hardness)
    const excitFilter = this._ctx.createBiquadFilter()
    excitFilter.type = "lowpass"
    // hardness original range: 500 - 15000 Hz
    const hardnessFreq = 500 + this.getParam('hardness') * (15000 - 500)
    excitFilter.frequency.setValueAtTime(hardnessFreq, now)

    // 3. Impact Level (Force)
    const excitGain = this._ctx.createGain()
    // force original range: 0 - 2
    const impactLevel = this.getParam('force') * 2.0
    excitGain.gain.setValueAtTime(impactLevel, now)
    excitGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)

    noiseSource.connect(excitFilter)
    excitFilter.connect(excitGain)

    // 4. Modal Bank (Resonance bank)
    const baseFreqs = [120, 285, 410, 650]
    const boxSize = this.getParam('boxSize')
    // resonance original range: 5 - 155
    const resonanceQ = 5 + this.getParam('resonance') * (155 - 5)

    baseFreqs.forEach(f => {
      const filter = this._ctx.createBiquadFilter()
      filter.type = "bandpass"
      // Inverting boxSize for intuitive mapping: larger box = lower pitch
      filter.frequency.setValueAtTime(f * (2.5 - boxSize), now)
      filter.Q.setValueAtTime(resonanceQ, now)

      excitGain.connect(filter)
      filter.connect(this._gainNode)
      
      // Auto-cleanup for short-lived nodes
      setTimeout(() => {
        try { filter.disconnect() } catch (e) {}
      }, 500)
    })

    noiseSource.start(now)
    noiseSource.stop(now + 0.05)
    
    // Auto-cleanup for short-lived excitation nodes
    setTimeout(() => {
      try {
        noiseSource.disconnect()
        excitFilter.disconnect()
        excitGain.disconnect()
      } catch (e) {}
    }, 100)
  }

  /**
   * Scheduling loop for periodic strikes.
   * @private
   */
  _scheduleNextStrike() {
    if (!this._isStarted) return
    this._strike()

    const rateHz = this.getParam('strikeRate')
    const interval = 1000 / rateHz

    this._timerId = setTimeout(() => this._scheduleNextStrike(), interval)
  }
}
