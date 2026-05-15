import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DroneSonifier } from '../src/DroneSonifier.js'
import '../../core/test/setup.js'

describe('DroneSonifier', () => {
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
          ['nharm', mockParam()],
          ['detune', mockParam()],
          ['pan', mockParam()],
          ['amplitude', mockParam()]
        ])
      }
      connect = vi.fn()
      disconnect = vi.fn()
    }

    mockOutput = { connect: vi.fn() }
    sonifier = new DroneSonifier()
  })

  it('has correct parameter schema', () => {
    const schema = sonifier.getParamSchema()
    expect(schema.find(p => p.name === 'frequency')).toBeDefined()
    expect(schema.find(p => p.name === 'nharm')).toBeDefined()
    expect(schema.find(p => p.name === 'detune')).toBeDefined()
    expect(schema.find(p => p.name === 'pan')).toBeDefined()
    expect(schema.find(p => p.name === 'volume')).toBeDefined()
  })

  it('initializes correctly', async () => {
    await sonifier.init(mockContext, mockOutput)
    sonifier.applyDefaults()
    
    expect(mockContext.audioWorklet.addModule).toHaveBeenCalled()
    expect(audioWorkletNodeSpy).toHaveBeenCalled()

    // Check that master gain was updated
    expect(sonifier._gainNode.gain.setTargetAtTime).toHaveBeenCalled()
  })

  it('updates parameters', async () => {
    await sonifier.init(mockContext, mockOutput)
    sonifier.setParam('frequency', 60)
    expect(sonifier.getParam('frequency')).toBe(60)
  })

  it('tears down correctly', async () => {
    await sonifier.init(mockContext, mockOutput)
    sonifier.destroy()
    expect(sonifier._gainNode).toBeNull()
  })
})
