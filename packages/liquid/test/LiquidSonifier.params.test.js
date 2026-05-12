import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LiquidSonifier } from '../src/LiquidSonifier.js'
import '../../core/test/setup.js'

describe('LiquidSonifier Parameters', () => {
  let sonifier
  let mockContext
  let mockOutput
  let workletParams

  beforeEach(() => {
    const mockParam = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn()
    })

    workletParams = new Map([
      ['frequency', mockParam()],
      ['viscosity', mockParam()],
      ['volume', mockParam()]
    ])

    mockContext = {
      currentTime: 10,
      audioWorklet: {
        addModule: vi.fn(() => Promise.resolve())
      },
      createGain: vi.fn(() => ({
        gain: mockParam(),
        connect: vi.fn(),
        disconnect: vi.fn()
      }))
    }
    
    global.AudioWorkletNode = class {
      constructor() {
        this.parameters = workletParams
      }
      connect = vi.fn()
      disconnect = vi.fn()
    }

    mockOutput = { connect: vi.fn() }
    sonifier = new LiquidSonifier()
  })

  it('verifies "volume" controls master gain and worklet volume uses resonatorVolume default (0.5)', async () => {
    await sonifier.init(mockContext, mockOutput)
    
    // Set volume to 0.7
    sonifier.setParam('volume', 0.7)
    
    // Master gain should be 0.7
    expect(sonifier._gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(0.7, 10, 0.05)
    
    // Worklet volume should be 0.5 (default resonatorVolume)
    const workletVol = workletParams.get('volume')
    expect(workletVol.setTargetAtTime).toHaveBeenCalledWith(0.5, 10, 0.05)
  })

  it('verifies "resonatorVolume" is in schema', () => {
    const schema = sonifier.getParamSchema()
    const p = schema.find(p => p.name === 'resonatorVolume')
    expect(p).toBeDefined()
    expect(p.default).toBe(0.5)
    expect(p.range).toEqual([0, 1])
  })

  it('verifies "resonatorVolume" updates worklet volume parameter', async () => {
    await sonifier.init(mockContext, mockOutput)
    
    // Set resonatorVolume to 0.8
    sonifier.setParam('resonatorVolume', 0.8)
    
    // Worklet volume should be 0.8
    const workletVol = workletParams.get('volume')
    expect(workletVol.setTargetAtTime).toHaveBeenCalledWith(0.8, 10, 0.05)
  })
})
