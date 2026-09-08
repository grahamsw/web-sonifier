import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OceanSonifier } from '../src/OceanSonifier.js'

describe('OceanSonifier', () => {
  let sonifier
  let mockContext
  let mockOutput
  let mockGainNode
  let mockNoiseSource
  let gainNodesCreated
  let filtersCreated

  beforeEach(() => {
    const createMockParam = (initial = 0) => ({
      value: initial,
      setValueAtTime: vi.fn((val) => { this.value = val }),
      setTargetAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    })

    mockGainNode = {
      gain: createMockParam(0),
      connect: vi.fn(),
      disconnect: vi.fn()
    }

    mockNoiseSource = {
      buffer: null,
      loop: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }

    gainNodesCreated = []
    filtersCreated = []
    let currentTime = 10

    mockContext = {
      get currentTime() { return currentTime },
      set currentTime(val) { currentTime = val },
      sampleRate: 44100,
      createGain: vi.fn(() => {
        const node = {
          gain: createMockParam(0),
          connect: vi.fn(),
          disconnect: vi.fn()
        }
        gainNodesCreated.push(node)
        if (gainNodesCreated.length === 1) return mockGainNode
        return node
      }),
      createBiquadFilter: vi.fn(() => {
        const filter = {
          frequency: createMockParam(500),
          Q: createMockParam(1),
          type: 'lowpass',
          connect: vi.fn(),
          disconnect: vi.fn()
        }
        filtersCreated.push(filter)
        return filter
      }),
      createBuffer: vi.fn((channels, length) => ({
        numberOfChannels: channels,
        length,
        getChannelData: vi.fn(() => new Float32Array(length))
      })),
      createBufferSource: vi.fn(() => mockNoiseSource)
    }

    mockOutput = { connect: vi.fn() }
    sonifier = new OceanSonifier()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('declares the parameter schema with 2 primary dimensions and wave controls', () => {
    const schema = sonifier.getParamSchema()
    const intensity = schema.find(p => p.name === 'intensity')
    const pitch = schema.find(p => p.name === 'pitch')
    const swellPeriod = schema.find(p => p.name === 'swellPeriod')
    const foam = schema.find(p => p.name === 'foam')
    const volume = schema.find(p => p.name === 'volume')

    expect(intensity).toBeDefined()
    expect(intensity.type).toBe('number')
    expect(intensity.range).toEqual([0, 100])
    expect(intensity.default).toBe(50)

    expect(pitch).toBeDefined()
    expect(pitch.type).toBe('number')
    expect(pitch.range).toEqual([80, 2500])
    expect(pitch.default).toBe(500)

    expect(swellPeriod).toBeDefined()
    expect(swellPeriod.default).toBe(8.0)

    expect(foam).toBeDefined()
    expect(volume).toBeDefined()
  })

  it('initializes tri-band audio graph and connects to outputNode', () => {
    vi.useFakeTimers()
    sonifier.init(mockContext, mockOutput)

    // Master gain connected to output
    expect(mockContext.createGain).toHaveBeenCalled()
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockOutput)

    // Noise generator created
    expect(mockContext.createBuffer).toHaveBeenCalled()
    expect(mockContext.createBufferSource).toHaveBeenCalled()
    expect(mockNoiseSource.loop).toBe(true)

    // 3 filter bands created (undertow, surf, foam)
    expect(filtersCreated.length).toBe(3)
  })

  it('smooths volume updates on master gain', () => {
    sonifier.init(mockContext, mockOutput)
    sonifier.setParam('volume', 0.75)

    expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0.75, 10, 0.02)
    expect(sonifier.getParam('volume')).toBe(0.75)
  })

  it('modulates wave cycle dynamics over time', () => {
    vi.useFakeTimers()
    sonifier.init(mockContext, mockOutput)
    sonifier.setParam('intensity', 80)
    sonifier.setParam('pitch', 800)

    expect(sonifier.getParam('intensity')).toBe(80)
    expect(sonifier.getParam('pitch')).toBe(800)

    // Advance time through part of wave swell
    mockContext.currentTime += 2.0
    vi.advanceTimersByTime(2000)

    // Bands should have setTargetAtTime called during swell cycle
    const surfFilter = filtersCreated[1]
    expect(surfFilter.frequency.setTargetAtTime).toHaveBeenCalled()
  })

  it('tears down cleanly with gain ramp down and resource cleanup', () => {
    vi.useFakeTimers()
    sonifier.init(mockContext, mockOutput)
    sonifier.destroy()

    // Gain ramped down to prevent clicks
    expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0, 10, 0.01)

    // Advance past cleanup timer
    vi.advanceTimersByTime(50)

    expect(sonifier._ctx).toBeNull()
    expect(sonifier._gainNode).toBeNull()
    expect(sonifier._timer).toBeNull()
  })
})
