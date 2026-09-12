import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MetalMachineSonifier } from '../src/MetalMachineSonifier.js'

describe('MetalMachineSonifier', () => {
  let ctx
  let output

  beforeEach(() => {
    const createAudioParam = (initialValue = 0) => ({
      value: initialValue,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn()
    })

    const createNode = () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      gain: createAudioParam(1),
      frequency: createAudioParam(440),
      Q: createAudioParam(1),
      delayTime: createAudioParam(0.01),
      pan: createAudioParam(0),
      threshold: createAudioParam(-6),
      knee: createAudioParam(6),
      ratio: createAudioParam(16),
      attack: createAudioParam(0.003),
      release: createAudioParam(0.05)
    })

    ctx = {
      sampleRate: 44100,
      currentTime: 10,
      createGain: vi.fn(createNode),
      createOscillator: vi.fn(createNode),
      createBiquadFilter: vi.fn(createNode),
      createDelay: vi.fn(createNode),
      createWaveShaper: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        curve: null,
        oversample: 'none'
      })),
      createDynamicsCompressor: vi.fn(createNode),
      createStereoPanner: vi.fn(createNode),
      createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(88200))
      })),
      createBufferSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        buffer: null,
        loop: false
      }))
    }

    output = createNode()
  })

  it('should initialize correctly with default parameters', () => {
    const sonifier = new MetalMachineSonifier()
    sonifier.init(ctx, output)

    expect(ctx.createGain).toHaveBeenCalled()
    expect(ctx.createDelay).toHaveBeenCalled()
    expect(ctx.createBiquadFilter).toHaveBeenCalled()
    expect(ctx.createWaveShaper).toHaveBeenCalled()
    expect(ctx.createOscillator).toHaveBeenCalled()
    expect(ctx.createBuffer).toHaveBeenCalled()
    expect(ctx.createDynamicsCompressor).toHaveBeenCalled()
  })

  it('should expose an annotated parameter schema with groups', () => {
    const sonifier = new MetalMachineSonifier()
    const schema = sonifier.getParamSchema()

    expect(schema).toBeInstanceOf(Array)
    expect(schema.length).toBeGreaterThanOrEqual(10)

    const paramNames = schema.map(p => p.name)
    expect(paramNames).toContain('frequency')
    expect(paramNames).toContain('feedback')
    expect(paramNames).toContain('screech')
    expect(paramNames).toContain('rate')
    expect(paramNames).toContain('clash')
    expect(paramNames).toContain('depth')
    expect(paramNames).toContain('drive')
    expect(paramNames).toContain('instability')
    expect(paramNames).toContain('spread')
    expect(paramNames).toContain('volume')

    const groups = new Set(schema.map(p => p.group))
    expect(groups).toContain('Feedback & Overtones')
    expect(groups).toContain('Modulation & Tremolo')
    expect(groups).toContain('Distortion & Texture')
    expect(groups).toContain('Output')
  })

  it('should smoothly update parameters via setParam()', () => {
    const sonifier = new MetalMachineSonifier()
    sonifier.init(ctx, output)

    // Test tuning change
    sonifier.setParam('frequency', 82.4)
    expect(sonifier.delay1.delayTime.setTargetAtTime).toHaveBeenCalledWith(
      expect.closeTo(1 / 82.4, 0.001),
      expect.any(Number),
      expect.any(Number)
    )

    // Test feedback adjustment
    sonifier.setParam('feedback', 1.15)
    expect(sonifier.fbGain1.gain.setTargetAtTime).toHaveBeenCalled()

    // Test screech adjustment
    sonifier.setParam('screech', 0.8)
    expect(sonifier.fbGain3.gain.setTargetAtTime).toHaveBeenCalled()

    // Test tremolo rate adjustment
    sonifier.setParam('rate', 12)
    expect(sonifier.leftLfo.frequency.setTargetAtTime).toHaveBeenCalledWith(
      12,
      expect.any(Number),
      expect.any(Number)
    )

    // Test clash adjustment
    sonifier.setParam('clash', 0.5)
    expect(sonifier.rightLfo.frequency.setTargetAtTime).toHaveBeenCalled()

    // Test drive adjustment (regenerates waveshaper curve)
    sonifier.setParam('drive', 30)
    expect(sonifier.fuzzShaper.curve).toBeInstanceOf(Float32Array)

    // Test volume adjustment
    sonifier.setParam('volume', 0.75)
    expect(sonifier.masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(
      0.75,
      expect.any(Number),
      expect.any(Number)
    )
  })

  it('should ramp down master gain to zero in destroy() to avoid clicks', () => {
    const sonifier = new MetalMachineSonifier()
    sonifier.init(ctx, output)

    sonifier.destroy()

    expect(sonifier.masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number)
    )
  })
})
