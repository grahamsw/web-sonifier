import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChimeSonifier } from '../src/ChimeSonifier.js'

describe('ChimeSonifier (SonifierBase Plugin)', () => {
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
        getChannelData: vi.fn(() => new Float32Array(264))
      })),
      createStereoPanner: vi.fn(() => ({
        pan: createParam(0),
        connect: vi.fn(),
        disconnect: vi.fn()
      }))
    }
  })

  it('exposes param schema with physical chime attributes', () => {
    const sonifier = new ChimeSonifier()
    const schema = sonifier.getParamSchema()
    const names = schema.map(s => s.name)
    expect(names).toContain('pitch')
    expect(names).toContain('material')
    expect(names).toContain('damping')
    expect(names).toContain('windSpeed')
    expect(names).toContain('volume')
  })

  it('initializes and acts on parameter updates', () => {
    const sonifier = new ChimeSonifier()
    sonifier.init(ctx, output)
    sonifier.applyDefaults()

    expect(sonifier.getParam('material')).toBe('aluminum')
    sonifier.setParam('material', 'bronze')
    expect(sonifier._chimeModel.material).toBe('bronze')

    sonifier.setParam('windSpeed', 45)
    expect(sonifier._chimeModel.windSpeed).toBe(45)
  })

  it('supports event strike triggering via strike()', () => {
    const sonifier = new ChimeSonifier()
    sonifier.init(ctx, output)
    sonifier.applyDefaults()

    const res = sonifier.strike({ pitch: 523.25, velocity: 0.9 })
    expect(res).toHaveProperty('stop')
  })

  it('cleans up cleanly on destroy', () => {
    const sonifier = new ChimeSonifier()
    sonifier.init(ctx, output)
    sonifier.destroy()
    expect(sonifier._chimeModel).toBeNull()
  })
})
