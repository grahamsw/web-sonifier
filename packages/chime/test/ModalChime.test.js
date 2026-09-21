import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModalChime } from '../src/ModalChime.js'

describe('ModalChime (Standalone Procedural Engine)', () => {
  let ctx
  let output
  let mockGainNode
  let mockOscNode
  let mockBufferSource

  beforeEach(() => {
    const createParam = (initial = 0) => ({
      value: initial,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn()
    })

    mockGainNode = () => ({
      gain: createParam(1),
      connect: vi.fn(),
      disconnect: vi.fn()
    })

    mockOscNode = () => ({
      frequency: createParam(440),
      type: 'sine',
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    })

    mockBufferSource = () => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    })

    output = mockGainNode()

    ctx = {
      currentTime: 10,
      sampleRate: 44100,
      destination: {},
      createGain: vi.fn(mockGainNode),
      createOscillator: vi.fn(mockOscNode),
      createBufferSource: vi.fn(mockBufferSource),
      createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(264))
      })),
      createStereoPanner: vi.fn(() => ({
        pan: createParam(0),
        connect: vi.fn(),
        disconnect: vi.fn()
      }))
    }
  })

  it('instantiates and initializes physical defaults', () => {
    const chime = new ModalChime(ctx, output)
    expect(chime).toBeDefined()
    expect(chime.pitch).toBe(587.33)
    expect(chime.material).toBe('aluminum')
    expect(chime.damping).toBe(0.3)
  })

  it('strikes the chime and creates Euler-Bernoulli modal oscillators', () => {
    const chime = new ModalChime(ctx, output)
    const handle = chime.strike({ pitch: 440, velocity: 0.9 })

    // 4 inharmonic modes = 4 oscillators created
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4)
    expect(ctx.createBufferSource).toHaveBeenCalled() // clapper impulse
    expect(handle).toHaveProperty('stop')
  })

  it('supports material switching and damping parameter bounds', () => {
    const chime = new ModalChime(ctx, output)
    chime.setMaterial('bronze')
    expect(chime.material).toBe('bronze')

    chime.setDamping(0.8)
    expect(chime.damping).toBe(0.8)

    chime.setDamping(-5)
    expect(chime.damping).toBe(0.02)
  })

  it('schedules stochastic strikes when wind speed > 0', () => {
    vi.useFakeTimers()
    const chime = new ModalChime(ctx, output)

    chime.setWindSpeed(50)
    expect(chime.windSpeed).toBe(50)

    vi.advanceTimersByTime(200)
    expect(ctx.createOscillator).toHaveBeenCalled()

    chime.setWindSpeed(0)
    expect(chime._isWindRunning).toBe(false)
    vi.useRealTimers()
  })

  it('cleans up resources cleanly on destroy', () => {
    const chime = new ModalChime(ctx, output)
    chime.destroy()
    expect(chime.output).toBeNull()
  })
})
