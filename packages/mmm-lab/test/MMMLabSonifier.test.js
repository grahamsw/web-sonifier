import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MMMLabSonifier } from '../src/MMMLabSonifier.js'
import '../../core/test/setup.js'

describe('MMMLabSonifier', () => {
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
      ['ampHum', mockParam(0.35)],
      ['ampHiss', mockParam(0.20)],
      ['basePitch', mockParam(73.416)],
      ['detuneSpread', mockParam(6.0)],
      ['stringDamping', mockParam(0.25)],
      ['feedbackGain', mockParam(0.98)],
      ['couplingDistance', mockParam(4.0)],
      ['sagThreshold', mockParam(0.65)],
      ['sagDepth', mockParam(0.80)],
      ['sagRecovery', mockParam(160.0)],
      ['harmonicShriek', mockParam(0.40)],
      ['pickupAngle', mockParam(0.30)],
      ['cabinetThump', mockParam(0.50)],
      ['subBeating', mockParam(0.40)],
      ['rumbleResonance', mockParam(0.5)],
      ['coneLimit', mockParam(0.6)],
      ['knockLevel', mockParam(0.4)],
      ['loop2Gain', mockParam(0.0)],
      ['loop2Detune', mockParam(18.0)],
      ['loop2Distance', mockParam(7.0)],
      ['crossCoupling', mockParam(0.3)]
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
        type: 'lowpass',
        frequency: mockParam(5500),
        Q: mockParam(0.7),
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
    sonifier = new MMMLabSonifier()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('declares all progressive parameter groups in schema', () => {
    const schema = sonifier.getParamSchema()
    expect(Array.isArray(schema)).toBe(true)

    const groups = schema.map(p => p.group)
    expect(groups).toContain('1. Idling Amp Floor')
    expect(groups).toContain('2. Guitar Strings & Tunings')
    expect(groups).toContain('3. Acoustic Feedback Loop')
    expect(groups).toContain('4. Power Amp Sag & Choke')
    expect(groups).toContain('5. Shriek & Harmonic Bending')
    expect(groups).toContain('6. Low Rumble & Cabinet Resonance')
    expect(groups).toContain('6b. Speaker Knocking')
    expect(groups).toContain('7. Output')
    expect(groups).toContain('8. Second Guitar / Density')

    const paramNames = schema.map(p => p.name)
    // Original params
    expect(paramNames).toContain('ampHum')
    expect(paramNames).toContain('ampHiss')
    expect(paramNames).toContain('tuningPreset')
    expect(paramNames).toContain('basePitch')
    expect(paramNames).toContain('detuneSpread')
    expect(paramNames).toContain('stringDamping')
    expect(paramNames).toContain('feedbackGain')
    expect(paramNames).toContain('couplingDistance')
    expect(paramNames).toContain('sagThreshold')
    expect(paramNames).toContain('sagDepth')
    expect(paramNames).toContain('sagRecovery')
    expect(paramNames).toContain('harmonicShriek')
    expect(paramNames).toContain('pickupAngle')
    expect(paramNames).toContain('cabinetThump')
    expect(paramNames).toContain('subBeating')
    expect(paramNames).toContain('volume')
    // Phase A
    expect(paramNames).toContain('rumbleResonance')
    // Phase B
    expect(paramNames).toContain('coneLimit')
    expect(paramNames).toContain('knockLevel')
    // Phase C
    expect(paramNames).toContain('loop2Gain')
    expect(paramNames).toContain('loop2Detune')
    expect(paramNames).toContain('loop2Distance')
    expect(paramNames).toContain('crossCoupling')
  })

  it('initializes the AudioWorklet, cabinet EQ, limiter, and master gain graph', async () => {
    await sonifier.init(mockContext, mockOutput)

    expect(mockContext.audioWorklet.addModule).toHaveBeenCalledWith('/packages/mmm-lab/src/MMMLabProcessor.js')
    expect(mockContext.createBiquadFilter).toHaveBeenCalled()
    expect(mockContext.createDynamicsCompressor).toHaveBeenCalled()
    expect(mockContext.createGain).toHaveBeenCalled()
    expect(sonifier._initialized).toBe(true)
  })

  it('updates AudioWorklet parameters on setParam with smoothing', async () => {
    await sonifier.init(mockContext, mockOutput)

    sonifier.setParam('feedbackGain', 1.05)
    const fbParam = mockWorkletParams.get('feedbackGain')
    expect(fbParam.setTargetAtTime).toHaveBeenCalledWith(1.05, 0, 0.025)

    sonifier.setParam('sagRecovery', 220)
    const sagParam = mockWorkletParams.get('sagRecovery')
    expect(sagParam.setTargetAtTime).toHaveBeenCalledWith(220, 0, 0.025)

    sonifier.setParam('harmonicShriek', 0.8)
    const shriekParam = mockWorkletParams.get('harmonicShriek')
    expect(shriekParam.setTargetAtTime).toHaveBeenCalledWith(0.8, 0, 0.025)

    sonifier.setParam('cabinetThump', 0.9)
    const thumpParam = mockWorkletParams.get('cabinetThump')
    expect(thumpParam.setTargetAtTime).toHaveBeenCalledWith(0.9, 0, 0.025)
  })

  it('updates new Phase A/B/C parameters with smoothing', async () => {
    await sonifier.init(mockContext, mockOutput)

    sonifier.setParam('rumbleResonance', 0.8)
    expect(mockWorkletParams.get('rumbleResonance').setTargetAtTime).toHaveBeenCalledWith(0.8, 0, 0.025)

    sonifier.setParam('coneLimit', 0.4)
    expect(mockWorkletParams.get('coneLimit').setTargetAtTime).toHaveBeenCalledWith(0.4, 0, 0.025)

    sonifier.setParam('knockLevel', 0.7)
    expect(mockWorkletParams.get('knockLevel').setTargetAtTime).toHaveBeenCalledWith(0.7, 0, 0.025)

    sonifier.setParam('loop2Gain', 0.6)
    expect(mockWorkletParams.get('loop2Gain').setTargetAtTime).toHaveBeenCalledWith(0.6, 0, 0.025)

    sonifier.setParam('loop2Detune', 25)
    expect(mockWorkletParams.get('loop2Detune').setTargetAtTime).toHaveBeenCalledWith(25, 0, 0.025)

    sonifier.setParam('crossCoupling', 0.5)
    expect(mockWorkletParams.get('crossCoupling').setTargetAtTime).toHaveBeenCalledWith(0.5, 0, 0.025)
  })

  it('posts tuning preset changes to the worklet port', async () => {
    await sonifier.init(mockContext, mockOutput)

    sonifier.setParam('tuningPreset', 'open-d')
    expect(sonifier._workletNode.port.postMessage).toHaveBeenCalledWith({
      type: 'tuning',
      preset: 'open-d'
    })
  })

  it('updates master volume with smoothing', async () => {
    await sonifier.init(mockContext, mockOutput)

    sonifier.setParam('volume', 0.85)
    expect(sonifier._masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.85, 0, 0.025)
  })

  it('ramps master gain to zero on destroy() for click-free teardown', async () => {
    await sonifier.init(mockContext, mockOutput)

    sonifier.destroy()
    expect(sonifier._masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.015)

    vi.advanceTimersByTime(60)
    expect(sonifier._workletNode.disconnect).toHaveBeenCalled()
    expect(sonifier._masterGain.disconnect).toHaveBeenCalled()
  })
})
