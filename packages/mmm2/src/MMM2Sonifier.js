import { SonifierBase } from '@web-sonifier/core'

/**
 * MMM2Sonifier
 * 
 * Recreates the autonomous drone ecology of Lou Reed's "Metal Machine Music"
 * using coupled non-linear feedback loops, SSB frequency shifting, in-loop wavefolding,
 * a 3D Lorenz attractor chaos generator, physical modal cabinet resonance,
 * and an allpass phase-shearing ladder.
 */
export class MMM2Sonifier extends SonifierBase {
  getParamSchema() {
    return [
      {
        name: 'feedback',
        type: 'number',
        range: [0.70, 1.15],
        default: 0.995,
        unit: 'gain',
        curve: 'linear',
        group: 'Feedback & Loops',
        label: 'Loop Feedback',
        description: 'Feedback gain across the critical bifurcation point (0.99-1.02 self-oscillates)'
      },
      {
        name: 'droneFreq',
        type: 'number',
        range: [30, 400],
        default: 82,
        unit: 'Hz',
        curve: 'exponential',
        group: 'Feedback & Loops',
        label: 'Drone Frequency',
        description: 'Fundamental tuning of the cross-coupled delay loops'
      },
      {
        name: 'freqShift',
        type: 'number',
        range: [0, 40],
        default: 7.3,
        unit: 'Hz',
        curve: 'linear',
        group: 'Feedback & Loops',
        label: 'Frequency Shift',
        description: 'Single-sideband irrational offset destroying harmonicity into metallic chime'
      },
      {
        name: 'drive',
        type: 'number',
        range: [1, 25],
        default: 4.0,
        unit: 'gain',
        curve: 'exponential',
        group: 'Distortion & Wavefolding',
        label: 'In-Loop Drive',
        description: 'Asymmetric diode/tube saturation drive inside the feedback return path'
      },
      {
        name: 'wavefold',
        type: 'number',
        range: [0, 1],
        default: 0.3,
        unit: 'depth',
        curve: 'linear',
        group: 'Distortion & Wavefolding',
        label: 'Wavefolding',
        description: 'Soft wavefolding intensity generating dense upper partials'
      },
      {
        name: 'chaosSpeed',
        type: 'number',
        range: [0.01, 2.0],
        default: 0.2,
        unit: 'rate',
        curve: 'exponential',
        group: 'Chaos & Modulation',
        label: 'Lorenz Speed',
        description: 'Integration rate of the 3D Lorenz chaotic attractor'
      },
      {
        name: 'chaosDepth',
        type: 'number',
        range: [0, 1],
        default: 0.4,
        unit: 'depth',
        curve: 'linear',
        group: 'Chaos & Modulation',
        label: 'Chaos Depth',
        description: 'Magnitude of chaotic perturbation on feedback gain and delay pointers'
      },
      {
        name: 'flutter',
        type: 'number',
        range: [0, 1],
        default: 0.25,
        unit: 'depth',
        curve: 'linear',
        group: 'Chaos & Modulation',
        label: 'Tape Flutter',
        description: 'Brownian 1/f^2 random-walk micro-pitch jitter simulating tape instability'
      },
      {
        name: 'modalResonance',
        type: 'number',
        range: [0, 1],
        default: 0.6,
        unit: 'gain',
        curve: 'linear',
        group: 'Cabinet & Room Resonance',
        label: 'Cabinet Modes',
        description: 'Parallel high-Q modal filter bank simulating guitar body and room modes'
      },
      {
        name: 'allpassShear',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        unit: 'depth',
        curve: 'linear',
        group: 'Cabinet & Room Resonance',
        label: 'Phase Shear',
        description: 'Depth of the multi-stage allpass phase-cancellation sweep'
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
        description: 'Master output volume'
      }
    ]
  }

  /**
   * @param {string} processorUrl The URL to MMM2Processor.js
   */
  constructor(processorUrl = '/packages/mmm2/src/MMM2Processor.js') {
    super()
    this._processorUrl = processorUrl
    this._ctx = null
    this._output = null
    this._workletNode = null
    this._modalFilters = []
    this._allpassFilters = []
    this._initialized = false
  }

  async init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // 1. Master Output Gain
    this._masterGain = this._ctx.createGain()
    this._masterGain.gain.setValueAtTime(0, this._ctx.currentTime)
    this._masterGain.connect(outputNode)

    // 2. Ear-Safety Limiter
    this._limiter = this._ctx.createDynamicsCompressor()
    this._limiter.threshold.setValueAtTime(-6.0, this._ctx.currentTime)
    this._limiter.knee.setValueAtTime(3.0, this._ctx.currentTime)
    this._limiter.ratio.setValueAtTime(16.0, this._ctx.currentTime)
    this._limiter.attack.setValueAtTime(0.003, this._ctx.currentTime)
    this._limiter.release.setValueAtTime(0.1, this._ctx.currentTime)
    this._limiter.connect(this._masterGain)

    // 3. Register AudioWorklet Module
    try {
      await this._ctx.audioWorklet.addModule(this._processorUrl)
    } catch (e) {
      console.error('MMM2Sonifier: Failed to load AudioWorklet module:', e)
      throw e
    }

    // 4. Create AudioWorklet Node
    this._workletNode = new AudioWorkletNode(this._ctx, 'mmm2-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2]
    })

    // 5. Build Parallel Modal Resonator Bank (Physical Chassis / Room Nodes)
    // Non-musical room and guitar body mode frequencies
    const modalFrequencies = [112, 184, 340, 520, 890, 1420, 2800, 4200]
    this._modalGainNode = this._ctx.createGain()
    this._modalGainNode.gain.setValueAtTime(0.6, this._ctx.currentTime)

    this._directGainNode = this._ctx.createGain()
    this._directGainNode.gain.setValueAtTime(0.8, this._ctx.currentTime)

    this._workletNode.connect(this._directGainNode)

    this._modalFilters = modalFrequencies.map((freq) => {
      const filter = this._ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(freq, this._ctx.currentTime)
      filter.Q.setValueAtTime(14.0, this._ctx.currentTime)
      this._workletNode.connect(filter)
      filter.connect(this._modalGainNode)
      return filter
    })

    // Summing node for direct + modal
    this._bodyMixer = this._ctx.createGain()
    this._directGainNode.connect(this._bodyMixer)
    this._modalGainNode.connect(this._bodyMixer)

    // 6. Multi-Stage Allpass Phase-Shearing Ladder
    // Cascaded allpass filters create moving notch cancellations
    const allpassBaseFreqs = [220, 440, 880, 1760]
    let prevNode = this._bodyMixer

    this._allpassFilters = allpassBaseFreqs.map((freq) => {
      const ap = this._ctx.createBiquadFilter()
      ap.type = 'allpass'
      ap.frequency.setValueAtTime(freq, this._ctx.currentTime)
      ap.Q.setValueAtTime(1.0, this._ctx.currentTime)
      prevNode.connect(ap)
      prevNode = ap
      return ap
    })

    // Dry/Wet blend for phase shearing
    this._dryShearGain = this._ctx.createGain()
    this._dryShearGain.gain.setValueAtTime(0.7, this._ctx.currentTime)
    this._bodyMixer.connect(this._dryShearGain)
    this._dryShearGain.connect(this._limiter)

    this._wetShearGain = this._ctx.createGain()
    this._wetShearGain.gain.setValueAtTime(0.5, this._ctx.currentTime)
    prevNode.connect(this._wetShearGain)
    this._wetShearGain.connect(this._limiter)

    // 7. Slow LFO for allpass shearing sweep
    this._shearLfo = this._ctx.createOscillator()
    this._shearLfo.frequency.setValueAtTime(0.04, this._ctx.currentTime) // 25-second cycle
    this._shearLfoGain = this._ctx.createGain()
    this._shearLfoGain.gain.setValueAtTime(200, this._ctx.currentTime)
    this._shearLfo.connect(this._shearLfoGain)
    for (const ap of this._allpassFilters) {
      this._shearLfoGain.connect(ap.frequency)
    }
    this._shearLfo.start()

    // 8. Apply Schema Defaults
    this.applyDefaults()
    this._initialized = true
  }

  /**
   * Triggers a transient noise impulse into the feedback matrix (e.g. on strike or data pulse).
   * @param {number} [intensity=1.0]
   */
  strike(intensity = 1.0) {
    if (this._workletNode && this._workletNode.port) {
      this._workletNode.port.postMessage({ type: 'strike', intensity })
    }
  }

  onParam(name, value) {
    if (!this._ctx) return
    const now = this._ctx.currentTime
    const rampTime = 0.025 // 25ms smoothing adhering to GEMINI.md

    // AudioWorklet parameters
    if (this._workletNode && this._workletNode.parameters && this._workletNode.parameters.has(name)) {
      const p = this._workletNode.parameters.get(name)
      if (p.setTargetAtTime) {
        p.setTargetAtTime(value, now, rampTime)
      } else {
        p.value = value
      }
      return
    }

    switch (name) {
      case 'modalResonance':
        if (this._modalGainNode && this._modalGainNode.gain.setTargetAtTime) {
          this._modalGainNode.gain.setTargetAtTime(value * 0.8, now, rampTime)
        }
        if (this._directGainNode && this._directGainNode.gain.setTargetAtTime) {
          this._directGainNode.gain.setTargetAtTime(Math.max(0.2, 1.0 - value * 0.4), now, rampTime)
        }
        break

      case 'allpassShear':
        if (this._wetShearGain && this._wetShearGain.gain.setTargetAtTime) {
          this._wetShearGain.gain.setTargetAtTime(value * 0.7, now, rampTime)
        }
        if (this._shearLfoGain && this._shearLfoGain.gain.setTargetAtTime) {
          this._shearLfoGain.gain.setTargetAtTime(value * 400.0, now, rampTime)
        }
        break

      case 'volume':
        if (this._masterGain && this._masterGain.gain.setTargetAtTime) {
          this._masterGain.gain.setTargetAtTime(value, now, rampTime)
        }
        break
    }
  }

  destroy() {
    if (!this._ctx) return

    const now = this._ctx.currentTime
    // Teardown integrity: ramp master gain to zero to prevent clicks
    if (this._masterGain && this._masterGain.gain.setTargetAtTime) {
      this._masterGain.gain.setTargetAtTime(0, now, 0.015)
    }

    setTimeout(() => {
      try {
        if (this._shearLfo) {
          this._shearLfo.stop()
          this._shearLfo.disconnect()
        }
        if (this._shearLfoGain) this._shearLfoGain.disconnect()
        if (this._workletNode) this._workletNode.disconnect()
        for (const f of this._modalFilters) f.disconnect()
        for (const ap of this._allpassFilters) ap.disconnect()
        if (this._modalGainNode) this._modalGainNode.disconnect()
        if (this._directGainNode) this._directGainNode.disconnect()
        if (this._bodyMixer) this._bodyMixer.disconnect()
        if (this._dryShearGain) this._dryShearGain.disconnect()
        if (this._wetShearGain) this._wetShearGain.disconnect()
        if (this._limiter) this._limiter.disconnect()
        if (this._masterGain) this._masterGain.disconnect()
      } catch (e) {
        // Ignore disconnect errors during teardown
      }
    }, 50)
  }
}
