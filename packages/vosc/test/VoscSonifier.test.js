import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VoscSonifier } from '../src/VoscSonifier.js'
import '../../core/test/setup.js'

describe('VoscSonifier', () => {
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
          ['amplitude', mockParam()],
          ['bufLow', mockParam()],
          ['bufHigh', mockParam()],
          ['bufSteps', mockParam()],
          ['detuneLow', mockParam()],
          ['detuneHigh', mockParam()],
          ['detuneSteps', mockParam()],
          ['panLow', mockParam()],
          ['panHigh', mockParam()],
          ['panSteps', mockParam()],
          ['spread', mockParam()],
          ['releaseTime', mockParam()],
          ['gate', mockParam()]
        ])
        this.port = {
          postMessage: vi.fn(),
          onmessage: null
        }
      }
      connect = vi.fn()
      disconnect = vi.fn()
    }

    mockOutput = { connect: vi.fn() }
    sonifier = new VoscSonifier()
  })

  it('has correct parameter schema', () => {
    const schema = sonifier.getParamSchema()
    expect(schema.find(p => p.name === 'frequency')).toBeDefined()
    expect(schema.find(p => p.name === 'amplitude')).toBeDefined()
    expect(schema.find(p => p.name === 'bufLow')).toBeDefined()
    expect(schema.find(p => p.name === 'bufHigh')).toBeDefined()
    expect(schema.find(p => p.name === 'bufSteps')).toBeDefined()
    expect(schema.find(p => p.name === 'spread')).toBeDefined()
    expect(schema.find(p => p.name === 'waveSet')).toBeDefined()
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
    sonifier.setParam('frequency', 600)
    expect(sonifier.getParam('frequency')).toBe(600)
  })

  it('updates waveSet parameter dynamically via port', async () => {
    await sonifier.init(mockContext, mockOutput)
    sonifier.setParam('waveSet', 1)
    expect(sonifier.getParam('waveSet')).toBe(1)
    expect(sonifier._workletNode.port.postMessage).toHaveBeenCalled()
  })

  it('tears down correctly', async () => {
    await sonifier.init(mockContext, mockOutput)
    sonifier.destroy()
    expect(sonifier._gainNode).toBeNull()
  })
})
