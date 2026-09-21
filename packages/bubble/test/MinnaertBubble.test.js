import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MinnaertBubble } from '../src/MinnaertBubble.js'

describe('MinnaertBubble (Standalone Procedural Engine)', () => {
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
        getChannelData: vi.fn(() => new Float32Array(176))
      })),
      createStereoPanner: vi.fn(() => ({
        pan: createParam(0),
        connect: vi.fn(),
        disconnect: vi.fn()
      }))
    }
  })

  it('instantiates and connects to provided destination', () => {
    const bubble = new MinnaertBubble(ctx, output)
    expect(bubble).toBeDefined()
    expect(ctx.createGain).toHaveBeenCalled()
    expect(bubble.radius).toBe(0.004)
    expect(bubble.depth).toBe(0.1)
  })

  it('updates physical parameters within valid bounds', () => {
    const bubble = new MinnaertBubble(ctx, output)

    bubble.setRadius(0.015)
    expect(bubble.radius).toBe(0.015)

    // Clamps out-of-bounds
    bubble.setRadius(-1)
    expect(bubble.radius).toBe(0.0005)

    bubble.setDepth(1.5)
    expect(bubble.depth).toBe(1.5)

    bubble.setViscosity(0.8)
    expect(bubble.viscosity).toBe(0.8)
  })

  it('triggers a single droplet event with acoustic chirp and damping', () => {
    const bubble = new MinnaertBubble(ctx, output)
    const handle = bubble.trigger({ radius: 0.003, depth: 0.05, energy: 0.9 })

    expect(ctx.createOscillator).toHaveBeenCalled()
    expect(ctx.createBufferSource).toHaveBeenCalled()
    expect(handle).toHaveProperty('stop')
    expect(typeof handle.stop).toBe('function')
  })

  it('starts and stops continuous Poisson droplet scheduling', () => {
    vi.useFakeTimers()
    const bubble = new MinnaertBubble(ctx, output)

    bubble.setRate(10)
    expect(bubble.rate).toBe(10)

    // Advancing timers should trigger drops
    vi.advanceTimersByTime(100)
    expect(ctx.createOscillator).toHaveBeenCalled()

    bubble.setRate(0)
    expect(bubble._isRunning).toBe(false)
    vi.useRealTimers()
  })

  it('cleans up resources cleanly on destroy without popping', () => {
    const bubble = new MinnaertBubble(ctx, output)
    bubble.destroy()
    expect(bubble.output).toBeNull()
  })
})
