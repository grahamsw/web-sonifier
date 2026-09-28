import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EnoFigureSonifier } from '../src/EnoFigureSonifier.js'

describe('EnoFigureSonifier', () => {
  let ctx, output, mockNodes, sonifier

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

    const createMockGain = () => {
      const node = { gain: createParam(1), connect: vi.fn(), disconnect: vi.fn() }
      mockNodes.push(node)
      return node
    }

    const createMockOscillator = () => {
      const node = {
        type: 'sine',
        frequency: createParam(440),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
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
      createOscillator: vi.fn(createMockOscillator)
    }

    sonifier = new EnoFigureSonifier()
  })

  afterEach(() => {
    if (sonifier) sonifier.destroy()
    vi.useRealTimers()
  })

  it('Schema has 7 params with correct types and ranges', () => {
    const schema = sonifier.getParamSchema()
    expect(schema).toHaveLength(7)
    
    const paramMap = {}
    for (const p of schema) paramMap[p.name] = p
      
    expect(paramMap.pitch).toMatchObject({ type: 'number', range: [200, 2000] })
    expect(paramMap.sustain).toMatchObject({ type: 'number', range: [0.5, 8.0] })
    expect(paramMap.brightness).toMatchObject({ type: 'number', range: [0, 1] })
    expect(paramMap.autoRate).toMatchObject({ type: 'number', range: [0, 2] })
    expect(paramMap.scatter).toMatchObject({ type: 'number', range: [0, 1] })
    expect(paramMap.scale).toMatchObject({ type: 'enum', values: ['major', 'minor', 'pentatonic', 'dorian', 'chromatic'] })
    expect(paramMap.volume).toMatchObject({ type: 'number', range: [0, 1] })
  })

  it('Init + applyDefaults stores correct default values', () => {
    sonifier.init(ctx, output)
    sonifier.applyDefaults()
    
    expect(sonifier.getParam('pitch')).toBe(523.25)
    expect(sonifier.getParam('sustain')).toBe(3.0)
    expect(sonifier.getParam('scale')).toBe('pentatonic')
    expect(sonifier.getParam('volume')).toBe(0.45)
  })

  it('setParam dispatches to model', () => {
    sonifier.init(ctx, output)
    sonifier.applyDefaults()
    
    sonifier.setParam('pitch', 800)
    expect(sonifier._model._pitch).toBe(800)
    
    sonifier.setParam('volume', 0.8)
    expect(sonifier._model._output.gain.setTargetAtTime).toHaveBeenCalledWith(0.8, 0, 0.05)
  })

  it('trigger() method exists and creates oscillator nodes', () => {
    sonifier.init(ctx, output)
    sonifier.applyDefaults()
    
    sonifier.trigger({ pitch: 440 })
    expect(ctx.createOscillator).toHaveBeenCalled()
    expect(sonifier._model._activeVoices.length).toBe(1)
  })

  it('Auto-trigger timer starts when autoRate > 0 and clears when set to 0', () => {
    sonifier.init(ctx, output)
    sonifier.applyDefaults()
    
    // Default autoRate is 0.3, so timer should be active
    expect(sonifier._model._autoTimer).not.toBeNull()
    
    sonifier.setParam('autoRate', 0)
    expect(sonifier._model._autoTimer).toBeNull()
  })

  it('destroy() nullifies _model reference and clears timers', () => {
    sonifier.init(ctx, output)
    sonifier.applyDefaults()
    
    sonifier.destroy()
    
    expect(sonifier._model).toBeNull()
  })
})
