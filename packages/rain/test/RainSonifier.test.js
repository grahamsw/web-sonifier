import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RainSonifier } from '../src/RainSonifier.js'

describe('RainSonifier', () => {
  let sonifier
  let mockContext
  let mockOutput
  let mockGainNode
  let mockWashGain
  let mockWashFilter
  let mockWashSource

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

    mockWashGain = {
      gain: createMockParam(0),
      connect: vi.fn(),
      disconnect: vi.fn()
    }

    mockWashFilter = {
      frequency: createMockParam(1000),
      Q: createMockParam(1),
      type: 'lowpass',
      connect: vi.fn(),
      disconnect: vi.fn()
    }

    mockWashSource = {
      buffer: null,
      loop: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }

    let gainCallCount = 0
    let filterCallCount = 0
    let sourceCallCount = 0
    let currentTime = 10
    mockContext = {
      get currentTime() { return currentTime },
      set currentTime(val) { currentTime = val },
      sampleRate: 44100,
      createGain: vi.fn(() => {
        gainCallCount++
        if (gainCallCount === 1) return mockGainNode
        if (gainCallCount === 2) return mockWashGain
        return {
          gain: createMockParam(0),
          connect: vi.fn(),
          disconnect: vi.fn()
        }
      }),
      createBiquadFilter: vi.fn(() => {
        filterCallCount++
        if (filterCallCount === 1) return mockWashFilter
        return {
          frequency: createMockParam(1200),
          Q: createMockParam(1),
          type: 'bandpass',
          connect: vi.fn(),
          disconnect: vi.fn()
        }
      }),
      createBuffer: vi.fn((channels, length) => ({
        numberOfChannels: channels,
        length,
        getChannelData: vi.fn(() => new Float32Array(length))
      })),
      createBufferSource: vi.fn(() => {
        sourceCallCount++
        if (sourceCallCount === 1) return mockWashSource
        return {
          buffer: null,
          loop: false,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn()
        }
      }),
      createStereoPanner: vi.fn(() => ({
        pan: createMockParam(0),
        connect: vi.fn(),
        disconnect: vi.fn()
      }))
    }

    mockOutput = { connect: vi.fn() }
    sonifier = new RainSonifier()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('declares the expected parameter schema with 2 primary dimensions', () => {
    const schema = sonifier.getParamSchema()
    const intensity = schema.find(p => p.name === 'intensity')
    const pitch = schema.find(p => p.name === 'pitch')
    const dropletSize = schema.find(p => p.name === 'dropletSize')
    const spread = schema.find(p => p.name === 'spread')
    const volume = schema.find(p => p.name === 'volume')

    expect(intensity).toBeDefined()
    expect(intensity.type).toBe('number')
    expect(intensity.range).toEqual([0, 500])
    expect(intensity.default).toBe(30)

    expect(pitch).toBeDefined()
    expect(pitch.type).toBe('number')
    expect(pitch.range).toEqual([200, 4000])
    expect(pitch.default).toBe(1200)

    expect(dropletSize).toBeDefined()
    expect(spread).toBeDefined()
    expect(volume).toBeDefined()
  })

  it('initializes audio nodes and connects to outputNode', () => {
    vi.useFakeTimers()
    sonifier.init(mockContext, mockOutput)

    expect(mockContext.createGain).toHaveBeenCalled()
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockOutput)
    expect(mockContext.createBuffer).toHaveBeenCalled()
    expect(mockContext.createBufferSource).toHaveBeenCalled()
  })

  it('smooths volume adjustments with setTargetAtTime', () => {
    sonifier.init(mockContext, mockOutput)
    sonifier.setParam('volume', 0.8)

    expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0.8, 10, 0.02)
    expect(sonifier.getParam('volume')).toBe(0.8)
  })

  it('smooths intensity updates on wash gain', () => {
    sonifier.init(mockContext, mockOutput)
    sonifier.setParam('intensity', 150)

    expect(sonifier.getParam('intensity')).toBe(150)
    expect(mockWashGain.gain.setTargetAtTime).toHaveBeenCalled()
  })

  it('smooths pitch changes on wash filter', () => {
    sonifier.init(mockContext, mockOutput)
    sonifier.setParam('pitch', 2400)

    expect(sonifier.getParam('pitch')).toBe(2400)
    expect(mockWashFilter.frequency.setTargetAtTime).toHaveBeenCalled()
  })

  it('schedules droplets over time when intensity > 0', () => {
    vi.useFakeTimers()
    sonifier.init(mockContext, mockOutput)
    sonifier.setParam('intensity', 100)

    const initialBufferSourceCalls = mockContext.createBufferSource.mock.calls.length

    // Advance audio context time and timers
    mockContext.currentTime += 0.15
    vi.advanceTimersByTime(100)

    // New buffer sources created for scheduled droplet hits
    expect(mockContext.createBufferSource.mock.calls.length).toBeGreaterThan(initialBufferSourceCalls)
    expect(mockContext.createBiquadFilter).toHaveBeenCalled()
  })

  it('safely ramps gain to zero and cleans up resources on destroy', () => {
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
