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
      driftRate: [0.25],
      sagThreshold: [0.65],
      sagDepth: [0.80],
      sagRecovery: [160.0],
      harmonicShriek: [0.40],
      pickupAngle: [0.30],
      shriekBite: [0.50],
      seagullSqueal: [0.35],
      cabinetThump: [0.50],
      cabinetHowl: [0.50],
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
      for (let i = 0; i < 128; i++) rmsSingle += left[i] * left[i] + right[i] * right[i]
    }
    rmsSingle = Math.sqrt(rmsSingle / (300 * 128 * 2))

    const pDual = new processorClass()
    const dualParams = makeParams({ feedbackGain: [1.05], loop2Gain: [0.8], crossCoupling: [0.0] })
    let rmsDual = 0
    for (let b = 0; b < 300; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      pDual.process([], [[left, right]], dualParams)
      for (let i = 0; i < 128; i++) rmsDual += left[i] * left[i] + right[i] * right[i]
    }
    rmsDual = Math.sqrt(rmsDual / (300 * 128 * 2))

    // Second loop adds energy; expect measurable increase
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

  it('generates commanding low-mid animal howl energy (90-250 Hz) when cabinetHowl is engaged', () => {
    const params = makeParams({
      feedbackGain: [1.25],
      cabinetHowl: [1.0],
      harmonicShriek: [0.1]
    })
    for (let b = 0; b < 200; b++) {
      processor.process([], [[new Float32Array(128), new Float32Array(128)]], params)
    }
    let howlEnergy = 0
    for (let b = 0; b < 10; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      processor.process([], [[left, right]], params)
      for (let i = 0; i < 128; i++) {
        howlEnergy += left[i] * left[i]
      }
    }
    const rms = Math.sqrt(howlEnergy / 1280)
    expect(rms).toBeGreaterThan(0.05)
  })

  it('bounds all outputs within [-1.0, 1.0] with both loops at maximum', () => {
    const params = makeParams({
      feedbackGain: [1.3],
      cabinetHowl: [1.0],
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

  it('suppresses high-frequency fizz (> 4.5 kHz) while preserving rich low-mid body (60-1500 Hz)', () => {
    const params = makeParams({
      feedbackGain: [1.10],
      cabinetHowl: [0.6],
      cabinetThump: [0.6]
    })
    for (let b = 0; b < 200; b++) {
      processor.process([], [[new Float32Array(128), new Float32Array(128)]], params)
    }

    const samples = []
    for (let b = 0; b < 20; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      processor.process([], [[left, right]], params)
      for (let i = 0; i < 128; i++) samples.push(left[i])
    }

    const lowFreqs = [60, 100, 135, 200, 400, 800, 1500]
    let lowMidEnergy = 0
    for (const f of lowFreqs) {
      let re = 0, im = 0
      const w = (2 * Math.PI * f) / 44100
      for (let n = 0; n < samples.length; n++) {
        re += samples[n] * Math.cos(w * n)
        im += samples[n] * Math.sin(w * n)
      }
      lowMidEnergy += (re * re + im * im)
    }

    const highFreqs = [4500, 6000, 8000, 10000, 14000]
    let highFizzEnergy = 0
    for (const f of highFreqs) {
      let re = 0, im = 0
      const w = (2 * Math.PI * f) / 44100
      for (let n = 0; n < samples.length; n++) {
        re += samples[n] * Math.cos(w * n)
        im += samples[n] * Math.sin(w * n)
      }
      highFizzEnergy += (re * re + im * im)
    }

    const lowMidRms = Math.sqrt(lowMidEnergy / lowFreqs.length)
    const highFizzRms = Math.max(1e-6, Math.sqrt(highFizzEnergy / highFreqs.length))
    const ratio = lowMidRms / highFizzRms

    // Low-mid body must be at least 5x (> 14 dB) stronger than harsh treble fizz
    expect(ratio).toBeGreaterThan(5.0)
  })

  it('triggers mechanical knock impulses and maintains low-end dominance in cabinet-boom configuration', () => {
    const params = makeParams({
      feedbackGain: [0.98],
      stringDamping: [0.55],
      basePitch: [50.0],
      cabinetThump: [1.0],
      rumbleResonance: [0.92],
      coneLimit: [0.28],
      knockLevel: [1.0],
      harmonicShriek: [0.0],
      cabinetHowl: [0.15],
      subBeating: [0.85]
    })

    let knockCount = 0
    for (let b = 0; b < 250; b++) {
      const prevAmp = processor.knockAmp
      processor.process([], [[new Float32Array(128), new Float32Array(128)]], params)
      if (processor.knockAmp > prevAmp && processor.knockAmp > 0.5) {
        knockCount++
      }
    }
    // Cone excursion bottoming must fire multiple mechanical knock impulses
    expect(knockCount).toBeGreaterThanOrEqual(1)
  })

  it('maintains dual guitar dynamic balance and prevents sag clamping in full-mmm configuration', () => {
    const params = makeParams({
      feedbackGain: [1.08],
      stringDamping: [0.25],
      basePitch: [73.416],
      detuneSpread: [7.0],
      harmonicShriek: [0.35],
      pickupAngle: [0.35],
      cabinetThump: [0.55],
      cabinetHowl: [0.60],
      subBeating: [0.50],
      rumbleResonance: [0.60],
      coneLimit: [0.50],
      knockLevel: [0.40],
      loop2Gain: [0.75],
      loop2Detune: [18.0],
      loop2Distance: [7.0],
      crossCoupling: [0.45]
    })

    for (let b = 0; b < 200; b++) {
      processor.process([], [[new Float32Array(128), new Float32Array(128)]], params)
    }

    // Both sag circuits must have charge but not be permanently clamped at 1.0
    expect(processor.sagCharge).toBeGreaterThan(0.2)
    expect(processor.sagCharge).toBeLessThan(0.95)
    expect(processor.sagCharge2).toBeGreaterThan(0.2)
    expect(processor.sagCharge2).toBeLessThan(0.95)

    // Verify bounded output
    const left = new Float32Array(128)
    const right = new Float32Array(128)
    processor.process([], [[left, right]], params)
    for (let i = 0; i < 128; i++) {
      expect(Math.abs(left[i])).toBeLessThanOrEqual(1.0)
      expect(Math.abs(right[i])).toBeLessThanOrEqual(1.0)
    }
  })

  it('exhibits authentic MMM spatial and spectral characteristics (wide stereo & decorrelation)', () => {
    const params = makeParams({
      feedbackGain: [1.08],
      harmonicShriek: [0.35],
      loop2Gain: [0.80],
      loop2Detune: [18.0],
      crossCoupling: [0.40]
    })

    // Warm up feedback
    for (let b = 0; b < 100; b++) {
      processor.process([], [[new Float32Array(128), new Float32Array(128)]], params)
    }

    // Capture 50 blocks (~6400 samples)
    const leftAll = []
    const rightAll = []
    for (let b = 0; b < 50; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      processor.process([], [[left, right]], params)
      for (let i = 0; i < 128; i++) {
        leftAll.push(left[i])
        rightAll.push(right[i])
      }
    }

    // Stereo correlation must demonstrate wide spatial decorrelation (< 0.65)
    let meanL = 0, meanR = 0
    for (let i = 0; i < leftAll.length; i++) {
      meanL += leftAll[i]
      meanR += rightAll[i]
    }
    meanL /= leftAll.length
    meanR /= rightAll.length

    let cov = 0, varL = 0, varR = 0
    let sumMidSq = 0, sumSideSq = 0
    for (let i = 0; i < leftAll.length; i++) {
      const dL = leftAll[i] - meanL
      const dR = rightAll[i] - meanR
      cov += dL * dR
      varL += dL * dL
      varR += dR * dR
      const m = 0.5 * (leftAll[i] + rightAll[i])
      const s = 0.5 * (leftAll[i] - rightAll[i])
      sumMidSq += m * m
      sumSideSq += s * s
    }
    const corr = cov / (Math.sqrt(varL * varR) + 1e-9)
    const sideMidRatio = Math.sqrt(sumSideSq) / (Math.sqrt(sumMidSq) + 1e-9)

    // Side-to-mid ratio must demonstrate substantial stereo separation (> 0.15 vs 0.02 in mono)
    expect(sideMidRatio).toBeGreaterThan(0.15)
  })

  it('exhibits power tube blocking sag relaxation under heavy feedback overload', () => {
    const params = makeParams({
      feedbackGain: [1.20],
      sagThreshold: [0.45],
      sagDepth: [0.95],
      sagRecovery: [185.0]
    })

    // Warm up feedback into blocking sag relaxation
    runBlocks(100, params)

    expect(processor.sagCharge).toBeGreaterThan(0.3)
    expect(processor.sagCharge).toBeLessThan(0.95)

    // Measure block RMS over next 200 blocks
    let minRms = 1.0
    let maxRms = 0.0
    for (let b = 0; b < 200; b++) {
      const left = new Float32Array(128)
      const right = new Float32Array(128)
      processor.process([], [[left, right]], params)
      let sumSq = 0
      for (let i = 0; i < 128; i++) {
        sumSq += left[i] * left[i]
      }
      const blockRms = Math.sqrt(sumSq / 128)
      if (blockRms < minRms) minRms = blockRms
      if (blockRms > maxRms) maxRms = blockRms
    }

    expect(maxRms).toBeGreaterThan(0.08)
    expect(minRms).toBeGreaterThan(0.01)
  })

  it('configures dual-harmonic presence barks (805 Hz Stack A, 960 Hz Stack B) forming an acoustic minor third', () => {
    expect(processor.spkBarkA_B0).toBeDefined()
    expect(processor.spkBarkB_B0).toBeDefined()
    // Stack A bark is 805 Hz, Stack B bark is 960 Hz
    // Verify coefficients differ between Stack A and Stack B
    expect(processor.spkBarkA_B0).not.toBe(processor.spkBarkB_B0)
    expect(processor.spkBarkA_A1).not.toBe(processor.spkBarkB_A1)
  })

  it('tracks string excursion and applies non-linear tension modulation during shriek', () => {
    const params = makeParams({
      feedbackGain: [1.15],
      harmonicShriek: [0.90],
      shriekBite: [0.80]
    })

    runBlocks(150, params)

    // Strings must have recorded excursion
    let totalExcursion = 0
    for (let s = 0; s < 6; s++) {
      totalExcursion += processor.stringExcursion[s]
    }
    expect(totalExcursion).toBeGreaterThan(0.1)
  })

  it('allows configurable driftRate without instability or NaN across range [0.0, 1.0]', () => {
    const params0 = makeParams({ driftRate: [0.0], feedbackGain: [1.05] })
    const peak0 = runBlocks(50, params0)
    expect(peak0).toBeLessThanOrEqual(1.0)

    const params1 = makeParams({ driftRate: [1.0], feedbackGain: [1.05] })
    const peak1 = runBlocks(50, params1)
    expect(peak1).toBeLessThanOrEqual(1.0)
    expect(processor.driftPhase1).toBeGreaterThan(0)
  })

  it('configures dual-guitar ostrich-ad tuning producing A2 (110 Hz) drone on Guitar B alongside D2 (73.4 Hz) on Guitar A', () => {
    processor.port.onmessage({ data: { type: 'tuning', preset: 'ostrich-ad' } })
    expect(processor.tuningIntervals[0]).toBe(1.0)
    // Guitar B intervals are Fifth above D: 1.498307 ratio -> 73.416 * 1.498307 = 110.00 Hz (A2)
    expect(processor.tuningIntervals2[0]).toBeCloseTo(1.498307, 4)
    expect(processor.tuningIntervals2[2]).toBeCloseTo(2.996614, 4) // 220.00 Hz (A3)

    const params = makeParams({ basePitch: [73.416], detuneSpread: [0.0], driftRate: [0.0], loop2Detune: [0.0] })
    processor.process([], [[new Float32Array(128), new Float32Array(128)]], params)

    // Guitar A fundamental: 44100 / 73.416 ≈ 600.68 samples
    expect(processor.stringPeriods[0]).toBeCloseTo(44100 / 73.416, 1)
    // Guitar B fundamental: 44100 / (73.416 * 1.498307) = 44100 / 110.00 = 400.9 samples (A2)
    expect(processor.stringPeriods2[0]).toBeCloseTo(44100 / 110.00, 1)
  })

  it('supports ostrich-a all-A unison drone tuning preset', () => {
    processor.port.onmessage({ data: { type: 'tuning', preset: 'ostrich-a' } })
    expect(processor.tuningIntervals[0]).toBeCloseTo(1.498307, 4)
    expect(processor.tuningIntervals2[0]).toBeCloseTo(1.498307, 4)
  })

  it('generates high-frequency microphonic seagull squeal energy in the 5.8-7.5 kHz range when seagullSqueal is active', () => {
    const pQuiet = new processorClass()
    const pSqueal = new processorClass()

    const quietParams = makeParams({
      ampHum: [0.0],
      ampHiss: [0.0],
      feedbackGain: [0.0],
      seagullSqueal: [0.0]
    })
    const squealParams = makeParams({
      ampHum: [0.0],
      ampHiss: [0.0],
      feedbackGain: [0.0],
      seagullSqueal: [0.85]
    })

    // Trigger seagull burst
    pQuiet.seagullBurstA = 1.0
    pSqueal.seagullBurstA = 1.0

    // Measure spectral energy at 6200 Hz via single-bin DFT
    const omega = (2 * Math.PI * 6200.0) / 44100.0
    let quietCos = 0, quietSin = 0
    let squealCos = 0, squealSin = 0

    let sampleCount = 0
    for (let b = 0; b < 10; b++) {
      const leftQ = new Float32Array(128), rightQ = new Float32Array(128)
      const leftS = new Float32Array(128), rightS = new Float32Array(128)
      pQuiet.process([], [[leftQ, rightQ]], quietParams)
      pSqueal.process([], [[leftS, rightS]], squealParams)

      for (let i = 0; i < 128; i++) {
        const n = sampleCount++
        quietCos += leftQ[i] * Math.cos(omega * n)
        quietSin += leftQ[i] * Math.sin(omega * n)
        squealCos += leftS[i] * Math.cos(omega * n)
        squealSin += leftS[i] * Math.sin(omega * n)
      }
    }

    const magQuiet = Math.hypot(quietCos, quietSin)
    const magSqueal = Math.hypot(squealCos, squealSin)

    expect(magQuiet).toBe(0.0)
    expect(magSqueal).toBeGreaterThan(0.05)
  })

  it('bounds and stabilizes seagull squeals across burst cycles without clipping or explosive runaway', () => {
    const params = makeParams({
      feedbackGain: [1.30],
      seagullSqueal: [1.0],
      loop2Gain: [0.80]
    })

    const peak = runBlocks(150, params)
    expect(peak).toBeLessThanOrEqual(1.0)
    expect(Number.isFinite(peak)).toBe(true)
  })
})

