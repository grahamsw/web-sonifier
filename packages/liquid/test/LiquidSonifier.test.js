import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LiquidSonifier } from '../src/LiquidSonifier.js'
import '../../core/test/setup.js'

describe('LiquidSonifier', () => {
  let sonifier
  let mockContext
  let mockOutput
  let audioWorkletNodeSpy

  beforeEach(() => {
    const mockParam = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn()
    })

    mockContext = {
      currentTime: 0,
      audioWorklet: {
        addModule: vi.fn(() => Promise.resolve())
      },
      createGain: vi.fn(() => ({
        gain: mockParam(),
        connect: vi.fn(),
        disconnect: vi.fn()
      }))
    }
    
    // Global AudioWorkletNode mock
    audioWorkletNodeSpy = vi.fn();
    global.AudioWorkletNode = class {
      constructor(...args) {
        audioWorkletNodeSpy(...args);
        this.parameters = new Map([
          ['frequency', mockParam()],
          ['viscosity', mockParam()],
          ['volume', mockParam()]
        ])
      }
      connect = vi.fn()
      disconnect = vi.fn()
    }

    mockOutput = { connect: vi.fn() }
    sonifier = new LiquidSonifier()
  })

  it('has correct parameter schema', () => {
    const schema = sonifier.getParamSchema()
    expect(schema.find(p => p.name === 'frequency')).toBeDefined()
    expect(schema.find(p => p.name === 'viscosity')).toBeDefined()
    expect(schema.find(p => p.name === 'volume')).toBeDefined()
  })

  it('initializes correctly', async () => {
    await sonifier.init(mockContext, mockOutput)
    expect(mockContext.audioWorklet.addModule).toHaveBeenCalled()
    expect(audioWorkletNodeSpy).toHaveBeenCalled()
  })

  it('updates parameters', async () => {
    await sonifier.init(mockContext, mockOutput)
    sonifier.setParam('frequency', 50)
    expect(sonifier.getParam('frequency')).toBe(50)
  })

  it('tears down correctly', async () => {
    await sonifier.init(mockContext, mockOutput)
    sonifier.destroy()
    expect(sonifier._gainNode).toBeNull()
  })
})
