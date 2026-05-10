import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PurrSonifier } from '../src/PurrSonifier.js'
import '../../core/test/setup.js'

describe('PurrSonifier', () => {
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
      createOscillator: vi.fn(() => ({
        frequency: mockParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        setPeriodicWave: vi.fn(),
        type: 'sine'
      })),
      createBiquadFilter: vi.fn(() => ({
        frequency: mockParam(),
        Q: mockParam(),
        gain: mockParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        type: 'lowpass'
      })),
      createPeriodicWave: vi.fn(() => ({})),
    }
    mockOutput = { connect: vi.fn() }
    sonifier = new PurrSonifier()
  })

  it('has correct parameter schema', () => {
    const schema = sonifier.getParamSchema()
    expect(schema.find(p => p.name === 'frequency')).toBeDefined()
    expect(schema.find(p => p.name === 'rate')).toBeDefined()
    expect(schema.find(p => p.name === 'intensity')).toBeDefined()
    expect(schema.find(p => p.name === 'arousal')).toBeDefined()
    expect(schema.find(p => p.name === 'jitter')).toBeDefined()
    expect(schema.find(p => p.name === 'rumble')).toBeDefined()
    expect(schema.find(p => p.name === 'breath')).toBeDefined()
    expect(schema.find(p => p.name === 'volume')).toBeDefined()
  })

  it('initializes correctly with finite values', () => {
    sonifier.init(mockContext, mockOutput)
    sonifier.applyDefaults()
    
    expect(mockContext.createGain).toHaveBeenCalled()

    // Check that master gain was updated (default uses setTargetAtTime)
    expect(sonifier._gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(
      expect.any(Number), 
      expect.any(Number),
      expect.any(Number)
    )
    const call = sonifier._gainNode.gain.setTargetAtTime.mock.calls[0]
    expect(Number.isFinite(call[0])).toBe(true)
  })

  it('updates parameters', () => {
    sonifier.init(mockContext, mockOutput)
    sonifier.setParam('frequency', 100)
    expect(sonifier.getParam('frequency')).toBe(100)
  })

  it('tears down correctly', () => {
    vi.useFakeTimers()
    sonifier.init(mockContext, mockOutput)
    sonifier.destroy()
    
    expect(sonifier._gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), 0.02)
    
    vi.runAllTimers()
    expect(sonifier._ctx).toBeNull()
    vi.useRealTimers()
  })
})
