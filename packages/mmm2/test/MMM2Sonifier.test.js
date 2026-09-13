import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MMM2Sonifier } from '../src/MMM2Sonifier.js'
import '../../core/test/setup.js'

describe('MMM2Sonifier', () => {
  let sonifier
  let mockContext
  let mockOutput
  let mockWorkletParams

  beforeEach(() => {
    vi.useFakeTimers()

    const mockParam = (initial = 0) => ({
      value: initial,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn()
    })

    mockWorkletParams = new Map([
      ['droneFreq', mockParam(82.0)],
      ['feedback', mockParam(0.995)],
      ['freqShift', mockParam(7.3)],
      ['drive', mockParam(4.0)],
      ['wavefold', mockParam(0.3)],
      ['chaosSpeed', mockParam(0.2)],
      ['chaosDepth', mockParam(0.4)],
      ['flutter', mockParam(0.25)]
    ])

    global.AudioWorkletNode = class {
      constructor() {
        this.parameters = mockWorkletParams
        this.port = {
          postMessage: vi.fn(),
          onmessage: null
        }
      }
      connect = vi.fn()
      disconnect = vi.fn()
    }

    mockContext = {
      currentTime: 0,
      audioWorklet: {
        addModule: vi.fn(() => Promise.resolve())
      },
      createGain: vi.fn(() => ({
        gain: mockParam(1),
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'bandpass',
        frequency: mockParam(100),
        Q: mockParam(1),
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      createOscillator: vi.fn(() => ({
        frequency: mockParam(0.04),
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      createDynamicsCompressor: vi.fn(() => ({
        threshold: mockParam(-6),
        knee: mockParam(3),
        ratio: mockParam(16),
        attack: mockParam(0.003),
        release: mockParam(0.1),
        connect: vi.fn(),
        disconnect: vi.fn()
      }))
    }

    mockOutput = { connect: vi.fn() }
    sonifier = new MMM2Sonifier()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('declares a valid MMM2 parameter schema', () => {
    const schema = sonifier.getParamSchema()
    expect(Array.isArray(schema)).toBe(true)

    const paramNames = schema.map(p => p.name)
    expect(paramNames).toContain('feedback')
    expect(paramNames).toContain('droneFreq')
    expect(paramNames).toContain('freqShift')
    expect(paramNames).toContain('drive')
    expect(paramNames).toContain('wavefold')
    expect(paramNames).toContain('chaosSpeed')
    expect(paramNames).toContain('chaosDepth')
    expect(paramNames).toContain('flutter')
    expect(paramNames).toContain('modalResonance')
    expect(paramNames).toContain('allpassShear')
    expect(paramNames).toContain('volume')

    const groups = new Set(schema.map(p => p.group))
    expect(groups.has('Feedback & Loops')).toBe(true)
    expect(groups.has('Distortion & Wavefolding')).toBe(true)
    expect(groups.has('Chaos & Modulation')).toBe(true)
    expect(groups.has('Cabinet & Room Resonance')).toBe(true)
    expect(groups.has('Output')).toBe(true)
  })

  it('initializes the AudioWorklet, modal filters, and limiter graph', async () => {
    await sonifier.init(mockContext, mockOutput)

    expect(mockContext.audioWorklet.addModule).toHaveBeenCalledWith('/packages/mmm2/src/MMM2Processor.js')
    expect(mockContext.createDynamicsCompressor).toHaveBeenCalled()
    expect(mockContext.createBiquadFilter).toHaveBeenCalled() // 8 modal + 4 allpass = 12 filters
    expect(mockContext.createGain).toHaveBeenCalled()
    expect(sonifier._initialized).toBe(true)
  })

  it('updates AudioWorklet parameters on setParam with smoothing', async () => {
    await sonifier.init(mockContext, mockOutput)

    sonifier.setParam('feedback', 1.05)
    const fbParam = mockWorkletParams.get('feedback')
    expect(fbParam.setTargetAtTime).toHaveBeenCalledWith(1.05, 0, 0.025)

    sonifier.setParam('freqShift', 14.6)
    const fsParam = mockWorkletParams.get('freqShift')
    expect(fsParam.setTargetAtTime).toHaveBeenCalledWith(14.6, 0, 0.025)

    sonifier.setParam('drive', 8.0)
    const drParam = mockWorkletParams.get('drive')
    expect(drParam.setTargetAtTime).toHaveBeenCalledWith(8.0, 0, 0.025)
  })

  it('updates modal resonance, allpass shear, and volume with smoothing', async () => {
    await sonifier.init(mockContext, mockOutput)

    sonifier.setParam('modalResonance', 0.8)
    expect(sonifier._modalGainNode.gain.setTargetAtTime).toHaveBeenCalled()

    sonifier.setParam('allpassShear', 0.9)
    expect(sonifier._wetShearGain.gain.setTargetAtTime).toHaveBeenCalled()

    sonifier.setParam('volume', 0.75)
    expect(sonifier._masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.75, 0, 0.025)
  })

  it('sends strike transient messages to worklet node port', async () => {
    await sonifier.init(mockContext, mockOutput)

    sonifier.strike(0.85)
    expect(sonifier._workletNode.port.postMessage).toHaveBeenCalledWith({
      type: 'strike',
      intensity: 0.85
    })
  })

  it('ramps master gain to zero on destroy() for teardown integrity', async () => {
    await sonifier.init(mockContext, mockOutput)

    sonifier.destroy()
    expect(sonifier._masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.015)

    vi.advanceTimersByTime(60)
    expect(sonifier._workletNode.disconnect).toHaveBeenCalled()
    expect(sonifier._masterGain.disconnect).toHaveBeenCalled()
  })
})
