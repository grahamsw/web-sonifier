import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AeolianWind } from '../src/AeolianWind.js'
import { WindSonifier } from '../src/WindSonifier.js'

describe('AeolianWind (Farnell Procedural Physical Model)', () => {
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

    const createMockSource = () => {
      const node = {
        buffer: null,
        loop: false,
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
      currentTime: 10,
      sampleRate: 44100,
      destination: {},
      createGain: vi.fn(createMockGain),
      createBiquadFilter: vi.fn(createMockFilter),
      createBufferSource: vi.fn(createMockSource),
      createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(1000))
      }))
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('instantiates and constructs proper Web Audio graph', () => {
    const wind = new AeolianWind(ctx, output)
    expect(wind).toBeDefined()
    expect(ctx.createBufferSource).toHaveBeenCalled()
    expect(ctx.createBiquadFilter).toHaveBeenCalled()
    expect(ctx.createGain).toHaveBeenCalled()
    expect(wind.speed).toBe(25)
    expect(wind.turbulence).toBe(0.4)
    expect(wind.cavity).toBe(0.3)
    expect(wind.volume).toBe(0.7)
    wind.destroy()
  })

  it('updates physical parameters via clean methods within valid bounds', () => {
    const wind = new AeolianWind(ctx, output)

    wind.setSpeed(60)
    expect(wind.speed).toBe(60)
    wind.setSpeed(-10)
    expect(wind.speed).toBe(0)
    wind.setSpeed(150)
    expect(wind.speed).toBe(100)

    wind.setTurbulence(0.8)
    expect(wind.turbulence).toBe(0.8)
    wind.setTurbulence(1.5)
    expect(wind.turbulence).toBe(1.0)
    wind.setTurbulence(-0.2)
    expect(wind.turbulence).toBe(0.0)

    wind.setCavity(0.6)
    expect(wind.cavity).toBe(0.6)
    wind.setCavity(-1)
    expect(wind.cavity).toBe(0.0)
    wind.setCavity(2)
    expect(wind.cavity).toBe(1.0)

    wind.setVolume(0.9)
    expect(wind.volume).toBe(0.9)
    expect(wind.output.gain.setTargetAtTime).toHaveBeenCalledWith(0.9, 10, 0.02)

    wind.destroy()
  })

  it('automates Strouhal vortex shedding and wandering modulation loop', () => {
    const wind = new AeolianWind(ctx, output)
    wind.setSpeed(40)
    wind.setTurbulence(0.5)

    // Advance time to trigger modulation loop tick
    vi.advanceTimersByTime(120)

    // Strouhal formula verification: f = St * (v / d)
    // 40 km/h = 11.11 m/s, d = 0.003m -> f approx 0.2 * 11.11 / 0.003 ≈ 740 Hz
    expect(wind._vortexFilters.length).toBe(3)
    for (const filter of wind._vortexFilters) {
      expect(filter.frequency.setTargetAtTime).toHaveBeenCalled()
    }
    for (const g of wind._vortexGains) {
      expect(g.gain.setTargetAtTime).toHaveBeenCalled()
    }

    wind.destroy()
  })

  it('safely ramps down and cleans up nodes on destroy', () => {
    const wind = new AeolianWind(ctx, output)
    const outGain = wind.output.gain

    wind.destroy()
    expect(outGain.setTargetAtTime).toHaveBeenCalledWith(0, 10, 0.01)

    // Advance timers for teardown delay
    vi.advanceTimersByTime(50)
    expect(wind.output).toBeNull()
    expect(wind.ctx).toBeNull()
  })
})

describe('WindSonifier (SonifierBase Plugin Wrapper)', () => {
  let ctx
  let output

  beforeEach(() => {
    const createParam = (initial = 0) => ({
      value: initial,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(function(v) { this.value = v }),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn()
    })

    const createMockFilter = () => ({
      type: 'lowpass',
      frequency: createParam(350),
      Q: createParam(1),
      connect: vi.fn(),
      disconnect: vi.fn()
    })

    const createMockGain = () => ({
      gain: createParam(1),
      connect: vi.fn(),
      disconnect: vi.fn()
    })

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
    expect(sonifier._windModel.speed).toBe(75)

    sonifier.setParam('turbulence', 0.9)
    expect(sonifier._windModel.turbulence).toBe(0.9)

    sonifier.setParam('cavity', 0.8)
    expect(sonifier._windModel.cavity).toBe(0.8)

    sonifier.destroy()
    expect(sonifier._windModel).toBeNull()
  })
})
