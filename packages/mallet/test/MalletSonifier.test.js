import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MalletSonifier } from '../src/MalletSonifier.js'
import '../../core/test/setup.js'

describe('MalletSonifier', () => {
  let sonifier
  let mockContext
  let mockOutput

  beforeEach(() => {
    const mockParam = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn()
    })

    mockContext = {
      currentTime: 0,
      sampleRate: 44100,
      createGain: vi.fn(() => ({
        gain: mockParam(),
        connect: vi.fn(),
        disconnect: vi.fn()
      })),
      createBiquadFilter: vi.fn(() => ({
        frequency: mockParam(),
        Q: mockParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        type: 'lowpass'
      })),
      createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(100))
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      }))
    }

    mockOutput = { connect: vi.fn() }
    sonifier = new MalletSonifier()
  })

  it('has correct parameter schema', () => {
    const schema = sonifier.getParamSchema()
    expect(schema.find(p => p.name === 'strikeRate')).toBeDefined()
    expect(schema.find(p => p.name === 'boxSize')).toBeDefined()
    expect(schema.find(p => p.name === 'resonance')).toBeDefined()
    expect(schema.find(p => p.name === 'force')).toBeDefined()
    expect(schema.find(p => p.name === 'hardness')).toBeDefined()
    expect(schema.find(p => p.name === 'volume')).toBeDefined()
  })

  it('initializes and starts automatically', () => {
    vi.useFakeTimers()
    const startSpy = vi.spyOn(sonifier, 'start')
    sonifier.init(mockContext, mockOutput)
    
    expect(mockContext.createGain).toHaveBeenCalled()
    expect(startSpy).toHaveBeenCalled()
    expect(sonifier._isStarted).toBe(true)
    
    vi.useRealTimers()
  })

  it('updates parameters', () => {
    sonifier.init(mockContext, mockOutput)
    sonifier.setParam('strikeRate', 5)
    expect(sonifier.getParam('strikeRate')).toBe(5)
  })

  it('starts and strikes correctly', () => {
    vi.useFakeTimers()
    sonifier.init(mockContext, mockOutput)
    sonifier.start()
    
    expect(mockContext.createBuffer).toHaveBeenCalled()
    expect(mockContext.createBufferSource).toHaveBeenCalled()
    expect(mockContext.createBiquadFilter).toHaveBeenCalled()
    
    vi.advanceTimersByTime(1000)
    // Should have struck again
    expect(mockContext.createBuffer).toHaveBeenCalledTimes(2)
    
    sonifier.stop()
    vi.useRealTimers()
  })

  it('tears down correctly', () => {
    vi.useFakeTimers()
    sonifier.init(mockContext, mockOutput)
    sonifier.destroy()
    vi.runAllTimers()
    expect(sonifier._ctx).toBeNull()
    vi.useRealTimers()
  })
})
