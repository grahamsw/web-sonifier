import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventScatterAdapter } from '../src/EventScatterAdapter.js'

describe('EventScatterAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('generates N random offsets and triggers callbacks across window', () => {
    const triggerSpy = vi.fn()
    const scatter = new EventScatterAdapter({
      windowSeconds: 60,
      strategy: 'random',
      onTrigger: triggerSpy
    })

    const offsets = scatter.feed(5, { source: 'signups' })
    expect(offsets).toHaveLength(5)
    expect(scatter.pendingCount).toBe(5)

    // All offsets should be within [0, 60000] ms
    for (const off of offsets) {
      expect(off).toBeGreaterThanOrEqual(0)
      expect(off).toBeLessThanOrEqual(60000)
    }

    // Advance 30 seconds
    vi.advanceTimersByTime(30000)
    // Some triggers should have fired
    const firedCountAt30 = triggerSpy.mock.calls.length

    // Advance remainder of the 60s window
    vi.advanceTimersByTime(35000)
    expect(triggerSpy).toHaveBeenCalledTimes(5)
    expect(scatter.pendingCount).toBe(0)
  })

  it('supports uniform distribution strategy', () => {
    const triggerSpy = vi.fn()
    const scatter = new EventScatterAdapter({
      windowSeconds: 10,
      strategy: 'uniform',
      onTrigger: triggerSpy
    })

    const offsets = scatter.feed(2)
    // Uniform for n=2 over 10s gives 10/(2+1) = 3.333s and 6.666s
    expect(offsets[0]).toBeCloseTo(3333.33, 0)
    expect(offsets[1]).toBeCloseTo(6666.67, 0)
  })

  it('can cancel all pending scheduled events', () => {
    const triggerSpy = vi.fn()
    const scatter = new EventScatterAdapter({
      windowSeconds: 60,
      onTrigger: triggerSpy
    })

    scatter.feed(10)
    expect(scatter.pendingCount).toBe(10)

    scatter.cancel()
    expect(scatter.pendingCount).toBe(0)

    vi.advanceTimersByTime(70000)
    expect(triggerSpy).not.toHaveBeenCalled()
  })
})
