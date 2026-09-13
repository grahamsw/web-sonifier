/**
 * MMM2Processor.js
 * 
 * AudioWorkletProcessor for Lou Reed "Metal Machine Music" autonomous drone ecology.
 * Implements:
 * - Continuous ground hum + transient exciter
 * - Dual cross-coupled Karplus-Strong / comb delay lines
 * - In-loop asymmetric saturation & soft wavefolding
 * - Single-sideband (SSB) frequency shifters with irrational prime offsets
 * - Real-time 3D Lorenz attractor chaos modulator
 * - Brownian 1/f^2 micro-pitch jitter / tape flutter
 */

class MMM2Processor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'droneFreq', defaultValue: 82.0, minValue: 30.0, maxValue: 400.0, automationRate: 'k-rate' },
      { name: 'feedback', defaultValue: 0.995, minValue: 0.70, maxValue: 1.15, automationRate: 'k-rate' },
      { name: 'freqShift', defaultValue: 7.3, minValue: 0.0, maxValue: 40.0, automationRate: 'k-rate' },
      { name: 'drive', defaultValue: 4.0, minValue: 1.0, maxValue: 25.0, automationRate: 'k-rate' },
      { name: 'wavefold', defaultValue: 0.3, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'chaosSpeed', defaultValue: 0.2, minValue: 0.01, maxValue: 2.0, automationRate: 'k-rate' },
      { name: 'chaosDepth', defaultValue: 0.4, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'flutter', defaultValue: 0.25, minValue: 0.0, maxValue: 1.0, automationRate: 'k-rate' }
    ]
  }

  constructor() {
    super()

    this.sampleRate = globalThis.sampleRate || 44100

    // Delay lines (max 1 second at 44.1/48kHz is ~48000 samples, buffer 65536)
    this.bufferSize = 65536
    this.bufferMask = this.bufferSize - 1
    this.delayBufferA = new Float32Array(this.bufferSize)
    this.delayBufferB = new Float32Array(this.bufferSize)
    this.writeIndex = 0

    // Ground hum oscillator phase
    this.humPhase = 0
    this.humPhaseStep = (2 * Math.PI * 60.0) / this.sampleRate

    // Transient exciter energy
    this.strikeEnvelope = 1.0 // initial burst on startup

    // Lorenz attractor state: dx/dt = sigma*(y-x), dy/dt = x*(rho-z)-y, dz/dt = x*y - beta*z
    this.lx = 0.1
    this.ly = 0.0
    this.lz = 0.0
    this.lorenzNormX = 0.0
    this.lorenzNormY = 0.0
    this.lorenzNormZ = 0.0

    // Frequency shifter carriers & phases
    this.carrierPhaseA = 0.0
    this.carrierPhaseB = 0.0

    // Hilbert FIR filter (31 taps, odd-symmetric)
    // Delay = 15 samples
    this.hilbertTaps = 31
    this.hilbertHalf = 15
    this.hilbertCoeffs = new Float32Array(this.hilbertTaps)
    this._initHilbert()

    // Circular buffers for Hilbert FIR
    this.hilbertBufA = new Float32Array(this.hilbertTaps)
    this.hilbertBufB = new Float32Array(this.hilbertTaps)
    this.hilbertIdx = 0

    // Brownian tape flutter random walk state
    this.brownianA = 0.0
    this.brownianB = 0.0

    // Message handler for manual strikes or reset
    this.port.onmessage = (event) => {
      const data = event.data
      if (data && data.type === 'strike') {
        this.strikeEnvelope = Math.max(this.strikeEnvelope, data.intensity || 1.0)
      }
    }
  }

  _initHilbert() {
    // Design 31-tap Hilbert transformer with Blackman window
    const N = this.hilbertTaps
    const mid = this.hilbertHalf
    for (let i = 0; i < N; i++) {
      const n = i - mid
      if (n % 2 !== 0) {
        // Ideal impulse response: 2 / (pi * n)
        const ideal = 2.0 / (Math.PI * n)
        // Blackman window
        const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (N - 1))
        this.hilbertCoeffs[i] = ideal * w
      } else {
        this.hilbertCoeffs[i] = 0
      }
    }
  }

  _stepLorenz(speed) {
    // Standard chaotic parameters
    const sigma = 10.0
    const rho = 28.0
    const beta = 8.0 / 3.0
    // Time step scaled by user parameter
    const dt = Math.min(0.01, 0.0006 * speed)

    const dx = sigma * (this.ly - this.lx) * dt
    const dy = (this.lx * (rho - this.lz) - this.ly) * dt
    const dz = (this.lx * this.ly - beta * this.lz) * dt

    this.lx += dx
    this.ly += dy
    this.lz += dz

    // Normalize roughly to [-1, 1]
    this.lorenzNormX = Math.max(-1.0, Math.min(1.0, this.lx / 20.0))
    this.lorenzNormY = Math.max(-1.0, Math.min(1.0, this.ly / 25.0))
    this.lorenzNormZ = Math.max(0.0, Math.min(1.0, this.lz / 45.0))
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]
    if (!output || output.length < 2) return true

    const left = output[0]
    const right = output[1]
    const numSamples = left.length

    // Extract k-rate parameters
    const droneFreq = parameters.droneFreq ? parameters.droneFreq[0] : 82.0
    const baseFeedback = parameters.feedback ? parameters.feedback[0] : 0.995
    const freqShift = parameters.freqShift ? parameters.freqShift[0] : 7.3
    const drive = parameters.drive ? parameters.drive[0] : 4.0
    const wavefold = parameters.wavefold ? parameters.wavefold[0] : 0.3
    const chaosSpeed = parameters.chaosSpeed ? parameters.chaosSpeed[0] : 0.2
    const chaosDepth = parameters.chaosDepth ? parameters.chaosDepth[0] : 0.4
    const flutter = parameters.flutter ? parameters.flutter[0] : 0.25

    // Step Lorenz attractor once every block
    this._stepLorenz(chaosSpeed)

    // Base delay times corresponding to drone fundamental
    const periodSamplesA = this.sampleRate / Math.max(30.0, droneFreq)
    // Channel B detuned by an irrational ratio (~1.498 = fifth / slightly sharp)
    const periodSamplesB = this.sampleRate / Math.max(30.0, droneFreq * 1.4983)

    // Cross-feed frequency shift carrier frequency steps
    // Channel A: +freqShift Hz
    // Channel B: -freqShift * 1.5205 Hz (irrational prime relation)
    const omegaStepA = (2 * Math.PI * freqShift) / this.sampleRate
    const omegaStepB = (2 * Math.PI * (freqShift * 1.5205)) / this.sampleRate

    // Chaos modulations
    const fbMod = this.lorenzNormY * 0.03 * chaosDepth
    const effFeedback = Math.min(1.12, Math.max(0.6, baseFeedback + fbMod))
    const delayModA = this.lorenzNormX * 8.0 * chaosDepth
    const delayModB = -this.lorenzNormX * 6.0 * chaosDepth

    for (let i = 0; i < numSamples; i++) {
      // 1. Exciter & Ground Hum
      this.humPhase += this.humPhaseStep
      if (this.humPhase > 2 * Math.PI) this.humPhase -= 2 * Math.PI
      const hum = 0.007 * (
        Math.sin(this.humPhase) +
        0.5 * Math.sin(this.humPhase * 3) +
        0.25 * Math.sin(this.humPhase * 5)
      )

      let exciter = hum
      if (this.strikeEnvelope > 0.0001) {
        const whiteNoise = (Math.random() * 2 - 1)
        exciter += whiteNoise * 0.3 * this.strikeEnvelope
        this.strikeEnvelope *= 0.9995 // slow decay (~50ms)
      }

      // 2. Brownian Tape Flutter Random Walk
      this.brownianA = 0.998 * this.brownianA + 0.002 * (Math.random() * 2 - 1)
      this.brownianB = 0.998 * this.brownianB + 0.002 * (Math.random() * 2 - 1)
      const flutterA = this.brownianA * 12.0 * flutter
      const flutterB = this.brownianB * 12.0 * flutter

      // 3. Read Delay Lines with Linear Interpolation
      const totalDelayA = Math.max(4.0, periodSamplesA + delayModA + flutterA)
      const totalDelayB = Math.max(4.0, periodSamplesB + delayModB + flutterB)

      const readPosA = (this.writeIndex - totalDelayA + this.bufferSize * 4) % this.bufferSize
      const intPosA = Math.floor(readPosA)
      const fracA = readPosA - intPosA
      const nextPosA = (intPosA + 1) & this.bufferMask
      const delayedSignalA = this.delayBufferA[intPosA] * (1 - fracA) + this.delayBufferA[nextPosA] * fracA

      const readPosB = (this.writeIndex - totalDelayB + this.bufferSize * 4) % this.bufferSize
      const intPosB = Math.floor(readPosB)
      const fracB = readPosB - intPosB
      const nextPosB = (intPosB + 1) & this.bufferMask
      const delayedSignalB = this.delayBufferB[intPosB] * (1 - fracB) + this.delayBufferB[nextPosB] * fracB

      // 4. In-Loop Hilbert Transform for SSB Frequency Shifting
      // Push into Hilbert history buffers
      this.hilbertBufA[this.hilbertIdx] = delayedSignalA
      this.hilbertBufB[this.hilbertIdx] = delayedSignalB

      // Compute in-phase (center tap) and quadrature (FIR convolution)
      const centerTapIdx = (this.hilbertIdx - this.hilbertHalf + this.hilbertTaps) % this.hilbertTaps
      const inPhaseA = this.hilbertBufA[centerTapIdx]
      const inPhaseB = this.hilbertBufB[centerTapIdx]

      let quadA = 0.0
      let quadB = 0.0
      for (let k = 0; k < this.hilbertTaps; k++) {
        const tapIdx = (this.hilbertIdx - k + this.hilbertTaps) % this.hilbertTaps
        const coeff = this.hilbertCoeffs[k]
        quadA += this.hilbertBufA[tapIdx] * coeff
        quadB += this.hilbertBufB[tapIdx] * coeff
      }

      this.hilbertIdx = (this.hilbertIdx + 1) % this.hilbertTaps

      // 5. Frequency Shift via Single-Sideband Quadrature Mix
      // Shift A up: inPhase*cos - quad*sin
      // Shift B down: inPhase*cos + quad*sin
      this.carrierPhaseA += omegaStepA
      if (this.carrierPhaseA > 2 * Math.PI) this.carrierPhaseA -= 2 * Math.PI
      const cosA = Math.cos(this.carrierPhaseA)
      const sinA = Math.sin(this.carrierPhaseA)
      const shiftedA = inPhaseA * cosA - quadA * sinA

      this.carrierPhaseB += omegaStepB
      if (this.carrierPhaseB > 2 * Math.PI) this.carrierPhaseB -= 2 * Math.PI
      const cosB = Math.cos(this.carrierPhaseB)
      const sinB = Math.sin(this.carrierPhaseB)
      const shiftedB = inPhaseB * cosB + quadB * sinB

      // 6. Cross-Coupling & Feedback Mix
      const crossMix = 0.35 // 35% cross-feed between channels
      const loopSignalA = (1 - crossMix) * shiftedA + crossMix * shiftedB
      const loopSignalB = (1 - crossMix) * shiftedB + crossMix * shiftedA

      // Sum exciter into loop
      const preSatA = (loopSignalA * effFeedback) + exciter
      const preSatB = (loopSignalB * effFeedback) + exciter

      // 7. In-Loop Non-Linear Asymmetric Saturation & Wavefolding
      // Channel A
      const drivenA = preSatA * drive
      let satA = (drivenA >= 0) ? Math.tanh(drivenA) : (Math.tanh(drivenA * 1.35) / 1.35)
      if (wavefold > 0.001 && Math.abs(satA) > 0.6) {
        const folded = Math.sin(satA * (1.0 + wavefold * 2.5))
        satA = (1 - wavefold) * satA + wavefold * folded
      }

      // Channel B
      const drivenB = preSatB * drive
      let satB = (drivenB >= 0) ? Math.tanh(drivenB) : (Math.tanh(drivenB * 1.35) / 1.35)
      if (wavefold > 0.001 && Math.abs(satB) > 0.6) {
        const folded = Math.sin(satB * (1.0 + wavefold * 2.5))
        satB = (1 - wavefold) * satB + wavefold * folded
      }

      // 8. Write back into delay lines (closing the loop)
      this.delayBufferA[this.writeIndex] = satA
      this.delayBufferB[this.writeIndex] = satB

      // Advance write index
      this.writeIndex = (this.writeIndex + 1) & this.bufferMask

      // 9. Output to stereo channels with chaotic spatial balance
      const panOffset = this.lorenzNormZ * 0.2 - 0.1
      left[i] = satA * (1.0 - panOffset)
      right[i] = satB * (1.0 + panOffset)
    }

    return true
  }
}

registerProcessor('mmm2-processor', MMM2Processor)
