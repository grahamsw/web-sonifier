import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock AudioWorklet environment for Node/Vitest
let processorClass
global.AudioWorkletProcessor = class {
  constructor() {
    this.port = { onmessage: null, postMessage: vi.fn() }
  }
}
global.registerProcessor = (name, cls) => {
  processorClass = cls
}

describe('MMMLabProcessor DSP Stability', async () => {
  await import('../src/MMMLabProcessor.js')

  let processor
  let sampleRate = 44100
  global.sampleRate = sampleRate

  beforeEach(() => {
    processor = new processorClass()
  })

  function makeParams(overrides = {}) {
    const defaults = {
      ampHum: [0.35],
      ampHiss: [0.20],
      basePitch: [73.416],
      detuneSpread: [6.0],
      stringDamping: [0.25],
      feedbackGain: [0.98],
      couplingDistance: [4.0],
      sagThreshold: [0.65],
      sagDepth: [0.80],
      sagRecovery: [160.0],
      harmonicShriek: [0.40],
      pickupAngle: [0.30],
      cabinetThump: [0.50],
      subBeating: [0.40],
      rumbleResonance: [0.5],
      coneLimit: [0.6],
      knockLevel: [0.4],
      loop2Gain: [0.0],
      loop2Detune: [18.0],
      loop2Distance: [7.0],
      crossCoupling: [0.3]
    }
    return { ...defaults, ...overrides }
  }

  function runBlocks(count, params) {
    let maxAbs = 0.0
    for (let b = 0; b < count; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      const outputs = [[left, right]]
      processor.process([], outputs, params)
      for (let i = 0; i < 128; i++) {
        const absL = Math.abs(left[i])
        const absR = Math.abs(right[i])
        if (absL > maxAbs) maxAbs = absL
        if (absR > maxAbs) maxAbs = absR
        expect(Number.isFinite(left[i])).toBe(true)
        expect(Number.isFinite(right[i])).toBe(true)
      }
    }
    return maxAbs
  }

  it('keeps idling amp hum stable and bounded without explosive runaway at feedbackGain = 0', () => {
    const params = makeParams({ feedbackGain: [0.0] })
    const peak = runBlocks(100, params)
    expect(peak).toBeGreaterThan(0.005)
    expect(peak).toBeLessThan(0.3)
  })

  it('bounds acoustic feedback within [-1.0, 1.0] when feedbackGain is cranked', () => {
    const params = makeParams({ feedbackGain: [1.10] })
    const peak = runBlocks(300, params)
    expect(peak).toBeGreaterThan(0.1)
    expect(peak).toBeLessThanOrEqual(1.0)
  })

  it('produces oscillating AC audio with frequent zero crossings rather than DC lock', () => {
    const params = makeParams({ feedbackGain: [1.05] })
    // Run 200 blocks to build up stable feedback oscillation
    runBlocks(200, params)
    // Collect multiple blocks and sum zero crossings for statistical reliability
    let zeroCrossings = 0
    for (let b = 0; b < 4; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      processor.process([], [[left, right]], params)
      for (let i = 1; i < 128; i++) {
        if ((left[i] >= 0 && left[i-1] < 0) || (left[i] < 0 && left[i-1] >= 0)) {
          zeroCrossings++
        }
      }
    }
    expect(zeroCrossings).toBeGreaterThanOrEqual(4) // Real oscillating AC audio across 4 blocks
  })

  it('exhibits distinct dynamic range between low gain (clean/hum) and high gain (feedback)', () => {
    const pLow = new processorClass()
    const lowParams = makeParams({ feedbackGain: [0.3] })
    let lowPeak = 0
    for (let b = 0; b < 200; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      pLow.process([], [[left, right]], lowParams)
      for (let i = 0; i < 128; i++) {
        const absL = Math.abs(left[i])
        if (absL > lowPeak) lowPeak = absL
      }
    }

    const pHigh = new processorClass()
    const highParams = makeParams({ feedbackGain: [1.3] })
    let highPeak = 0
    for (let b = 0; b < 200; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      pHigh.process([], [[left, right]], highParams)
      for (let i = 0; i < 128; i++) {
        const absL = Math.abs(left[i])
        if (absL > highPeak) highPeak = absL
      }
    }

    expect(lowPeak).toBeLessThan(0.10)
    expect(highPeak).toBeGreaterThan(0.35)
    expect(highPeak / lowPeak).toBeGreaterThan(3.5)
  })

  it('responds to tuning preset message port events', () => {
    expect(() => {
      processor.port.onmessage({ data: { type: 'tuning', preset: 'open-d' } })
      processor.port.onmessage({ data: { type: 'tuning', preset: 'standard-e' } })
      processor.port.onmessage({ data: { type: 'tuning', preset: 'ostrich-d' } })
    }).not.toThrow()
  })

  // --- Phase A: Resonant Filter Bank ---

  it('produces richer spectral content with the 4-mode filter bank when cabinetThump is on', () => {
    const pOff = new processorClass()
    const paramsOff = makeParams({ feedbackGain: [1.05], cabinetThump: [0.0], rumbleResonance: [0.5] })
    let rmsOff = 0
    for (let b = 0; b < 200; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      pOff.process([], [[left, right]], paramsOff)
      for (let i = 0; i < 128; i++) rmsOff += left[i] * left[i]
    }
    rmsOff = Math.sqrt(rmsOff / (200 * 128))

    const pOn = new processorClass()
    const paramsOn = makeParams({ feedbackGain: [1.05], cabinetThump: [1.0], rumbleResonance: [1.0] })
    let rmsOn = 0
    for (let b = 0; b < 200; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      pOn.process([], [[left, right]], paramsOn)
      for (let i = 0; i < 128; i++) rmsOn += left[i] * left[i]
    }
    rmsOn = Math.sqrt(rmsOn / (200 * 128))

    expect(rmsOn).toBeGreaterThan(rmsOff)
  })

  // --- Phase B: Speaker Knocking & Heterodyne Roar ---

  it('produces knock transients under heavy low-frequency drive', () => {
    const params = makeParams({
      feedbackGain: [1.3],
      basePitch: [45.0],
      coneLimit: [0.25],
      knockLevel: [1.0],
      cabinetThump: [1.0],
      subBeating: [1.0]
    })
    let peakValues = []
    for (let b = 0; b < 500; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      processor.process([], [[left, right]], params)
      for (let i = 0; i < 128; i++) {
        peakValues.push(Math.abs(left[i]))
      }
    }

    peakValues.sort((a, b) => b - a)
    const topPeak = peakValues[0]
    expect(topPeak).toBeGreaterThan(0.01)
  })

  it('fires the 55 Hz acoustic knock resonator when displacement crosses coneLimit', () => {
    const params = makeParams({
      feedbackGain: [1.25],
      coneLimit: [0.45],
      knockLevel: [0.8]
    })
    let knockFired = false
    for (let b = 0; b < 250; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      processor.process([], [[left, right]], params)
      if (processor.knockAmp > 0.05) knockFired = true
    }
    expect(knockFired).toBe(true)
    expect(processor.knockPhaseStep).toBeCloseTo((2 * Math.PI * 55.0) / 44100, 4)
  })

  it('generates rich asymmetric tube overdrive with DC blocking stability', () => {
    const params = makeParams({
      feedbackGain: [1.15],
      subBeating: [0.9]
    })
    // Run 200 blocks of heavy feedback with asymmetric tube saturation
    let sumDc = 0
    let totalSamples = 0
    for (let b = 0; b < 200; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      processor.process([], [[left, right]], params)
      if (b > 50) {
        for (let i = 0; i < 128; i++) {
          sumDc += left[i]
          totalSamples++
        }
      }
    }
    const avgDc = Math.abs(sumDc / totalSamples)
    // Asymmetric distortion produces difference tones, but DC blocker keeps output centered
    expect(avgDc).toBeLessThan(0.05)
  })

  // --- Phase C: Second Feedback Loop ---

  it('increases density when loop2Gain is raised', () => {
    const pSingle = new processorClass()
    const singleParams = makeParams({ feedbackGain: [1.05], loop2Gain: [0.0], crossCoupling: [0.0] })
    let rmsSingle = 0
    for (let b = 0; b < 300; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      pSingle.process([], [[left, right]], singleParams)
      for (let i = 0; i < 128; i++) rmsSingle += left[i] * left[i]
    }
    rmsSingle = Math.sqrt(rmsSingle / (300 * 128))

    const pDual = new processorClass()
    const dualParams = makeParams({ feedbackGain: [1.05], loop2Gain: [0.8], crossCoupling: [0.0] })
    let rmsDual = 0
    for (let b = 0; b < 300; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      pDual.process([], [[left, right]], dualParams)
      for (let i = 0; i < 128; i++) rmsDual += left[i] * left[i]
    }
    rmsDual = Math.sqrt(rmsDual / (300 * 128))

    // Second loop adds energy (scaled by 0.7); expect measurable increase
    expect(rmsDual).toBeGreaterThan(rmsSingle)
  })

  it('creates stereo width between the two loops', () => {
    const params = makeParams({ feedbackGain: [1.05], loop2Gain: [0.8] })
    for (let b = 0; b < 200; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      processor.process([], [[left, right]], params)
    }

    const left = new Float32Array(128)
    const right = new Float32Array(128)
    processor.process([], [[left, right]], params)

    let diffEnergy = 0
    for (let i = 0; i < 128; i++) {
      const diff = left[i] - right[i]
      diffEnergy += diff * diff
    }
    diffEnergy = Math.sqrt(diffEnergy / 128)

    expect(diffEnergy).toBeGreaterThan(0.001)
  })

  it('bounds all outputs within [-1.0, 1.0] with both loops at maximum', () => {
    const params = makeParams({
      feedbackGain: [1.3],
      loop2Gain: [1.0],
      crossCoupling: [1.0],
      cabinetThump: [1.0],
      rumbleResonance: [1.0],
      knockLevel: [1.0],
      coneLimit: [0.3],
      harmonicShriek: [1.0]
    })
    const peak = runBlocks(500, params)
    expect(peak).toBeLessThanOrEqual(1.0)
  })
})
