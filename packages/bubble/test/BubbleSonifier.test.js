import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BubbleSonifier } from '../src/BubbleSonifier.js'

describe('BubbleSonifier (SonifierBase Plugin)', () => {
  let ctx
  let output

  beforeEach(() => {
    const createParam = (initial = 0) => ({
      value: initial,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn()
    })

    const mockNode = () => ({
      gain: createParam(1),
      frequency: createParam(440),
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    })

    output = mockNode()

    ctx = {
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createGain: vi.fn(mockNode),
      createOscillator: vi.fn(mockNode),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })),
      createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(176))
      })),
      createStereoPanner: vi.fn(() => ({
        pan: createParam(0),
        connect: vi.fn(),
        disconnect: vi.fn()
      }))
    }
  })

  it('exposes a valid parameter schema with physical controls', () => {
    const sonifier = new BubbleSonifier()
    const schema = sonifier.getParamSchema()

    expect(schema).toBeInstanceOf(Array)
    const names = schema.map(p => p.name)
    expect(names).toContain('radius')
    expect(names).toContain('depth')
    expect(names).toContain('viscosity')
    expect(names).toContain('rate')
    expect(names).toContain('volume')
  })

  it('initializes and responds to parameter changes', () => {
    const sonifier = new BubbleSonifier()
    sonifier.init(ctx, output)
    sonifier.applyDefaults()

    expect(sonifier.getParam('radius')).toBe(0.004)
    expect(sonifier.getParam('depth')).toBe(0.1)

    sonifier.setParam('radius', 0.01)
    expect(sonifier.getParam('radius')).toBe(0.01)
    expect(sonifier._bubbleModel.radius).toBe(0.01)

    sonifier.setParam('rate', 15)
    expect(sonifier.getParam('rate')).toBe(15)
    expect(sonifier._bubbleModel.rate).toBe(15)
  })

  it('supports discrete event triggering via triggerBubble()', () => {
    const sonifier = new BubbleSonifier()
    sonifier.init(ctx, output)
    sonifier.applyDefaults()

    const res = sonifier.triggerBubble({ radius: 0.005, energy: 0.8 })
    expect(res).toHaveProperty('stop')
  })

  it('cleans up cleanly on destroy', () => {
    const sonifier = new BubbleSonifier()
    sonifier.init(ctx, output)
    sonifier.destroy()

    expect(sonifier._bubbleModel).toBeNull()
  })
})
