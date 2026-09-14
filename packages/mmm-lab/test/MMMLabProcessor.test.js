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
      subBeating: [0.40]
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
    // Run 100 blocks (~0.3 seconds)
    const peak = runBlocks(100, params)
    expect(peak).toBeGreaterThan(0.005) // Not silent
    expect(peak).toBeLessThan(0.3) // Calm hum, does not run away
  })

  it('bounds acoustic feedback within [-1.0, 1.0] when feedbackGain is cranked', () => {
    const params = makeParams({ feedbackGain: [1.10] })
    // Run 300 blocks (~0.9 seconds of intense acoustic feedback)
    const peak = runBlocks(300, params)
    expect(peak).toBeGreaterThan(0.1) // Feedback produces energetic resonance
    expect(peak).toBeLessThanOrEqual(1.0) // Bounded by string saturation, never blows up to +30 dBFS
  })

  it('produces oscillating AC audio with frequent zero crossings rather than DC lock', () => {
    const params = makeParams({ feedbackGain: [1.05] })
    // Run 100 blocks
    runBlocks(100, params)
    const left = new Float32Array(128)
    const right = new Float32Array(128)
    processor.process([], [[left, right]], params)

    let zeroCrossings = 0
    for (let i = 1; i < 128; i++) {
      if ((left[i] >= 0 && left[i-1] < 0) || (left[i] < 0 && left[i-1] >= 0)) {
        zeroCrossings++
      }
    }
    expect(zeroCrossings).toBeGreaterThanOrEqual(4) // Real oscillating AC audio
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

    expect(lowPeak).toBeLessThan(0.10) // Sub-threshold remains quiet/clean
    expect(highPeak).toBeGreaterThan(0.35) // High gain enters full feedback
    expect(highPeak / lowPeak).toBeGreaterThan(3.5) // Distinct, wide dynamic contrast
  })

  it('responds to tuning preset message port events', () => {
    expect(() => {
      processor.port.onmessage({ data: { type: 'tuning', preset: 'open-d' } })
      processor.port.onmessage({ data: { type: 'tuning', preset: 'standard-e' } })
      processor.port.onmessage({ data: { type: 'tuning', preset: 'ostrich-d' } })
    }).not.toThrow()
  })
})
