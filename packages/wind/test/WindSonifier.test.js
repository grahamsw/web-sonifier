import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WindSonifier } from '../src/WindSonifier.js'

describe('WindSonifier (SonifierBase Plugin)', () => {
  let ctx
  let output
  let mockNodes

  beforeEach(() => {
    vi.useFakeTimers()
    mockNodes = []

    const createParam = (initial = 0) => ({
      value: initial,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(function(v) { this.value = v }),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn()
    })

    const createMockFilter = () => {
      const node = {
        type: 'lowpass',
        frequency: createParam(350),
        Q: createParam(1),
        connect: vi.fn(),
        disconnect: vi.fn()
      }
      mockNodes.push(node)
      return node
    }

    const createMockGain = () => {
      const node = {
        gain: createParam(1),
        connect: vi.fn(),
        disconnect: vi.fn()
      }
      mockNodes.push(node)
      return node
    }

    output = createMockGain()

    ctx = {
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createGain: vi.fn(createMockGain),
      createBiquadFilter: vi.fn(createMockFilter),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        loop: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })),
      createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(500))
      }))
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exposes a valid schema with aerodynamic parameters', () => {
    const sonifier = new WindSonifier()
    const schema = sonifier.getParamSchema()
    expect(schema).toBeInstanceOf(Array)
    const names = schema.map(p => p.name)
    expect(names).toContain('speed')
    expect(names).toContain('turbulence')
    expect(names).toContain('cavity')
    expect(names).toContain('volume')
  })

  it('initializes, applies defaults, and dispatches parameter updates', () => {
    const sonifier = new WindSonifier()
    sonifier.init(ctx, output)
    sonifier.applyDefaults()

    expect(sonifier.getParam('speed')).toBe(25)
    expect(sonifier.getParam('turbulence')).toBe(0.4)
    expect(sonifier.getParam('cavity')).toBe(0.3)
    expect(sonifier.getParam('volume')).toBe(0.7)

    sonifier.setParam('speed', 75)
    expect(sonifier.getParam('speed')).toBe(75)
    expect(sonifier._windModel.speed).toBe(75)

    sonifier.setParam('turbulence', 0.9)
    expect(sonifier.getParam('turbulence')).toBe(0.9)
    expect(sonifier._windModel.turbulence).toBe(0.9)

    sonifier.setParam('cavity', 0.8)
    expect(sonifier.getParam('cavity')).toBe(0.8)
    expect(sonifier._windModel.cavity).toBe(0.8)

    sonifier.setParam('volume', 0.5)
    expect(sonifier.getParam('volume')).toBe(0.5)

    sonifier.destroy()
    expect(sonifier._windModel).toBeNull()
  })
})
