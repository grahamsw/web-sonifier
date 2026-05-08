import { describe, it, expect, beforeEach } from 'vitest'
import { Adapter } from '../src/Adapter.js'

describe('Adapter', () => {

  it('initialises with correct config', () => {
    const adapter = new Adapter({
      param: 'freq',
      outputRange: [100, 200],
      curve: 'linear'
    })
    expect(adapter.param).toBe('freq')
    expect(adapter.outputRange).toEqual([100, 200])
    expect(adapter.curve).toBe('linear')
  })

  describe('Mapping', () => {
    it('maps linearly within range', () => {
      const adapter = new Adapter({
        param: 'vol',
        inputRange: [0, 100],
        outputRange: [0, 1],
        curve: 'linear'
      })
      expect(adapter.map(50)).toBe(0.5)
      expect(adapter.map(0)).toBe(0)
      expect(adapter.map(100)).toBe(1)
    })

    it('clamps values outside input range', () => {
      const adapter = new Adapter({
        param: 'vol',
        inputRange: [0, 100],
        outputRange: [0, 1]
      })
      expect(adapter.map(-10)).toBe(0)
      expect(adapter.map(110)).toBe(1)
    })

    it('applies exponential curve correctly', () => {
      const adapter = new Adapter({
        param: 'freq',
        inputRange: [0, 100],
        outputRange: [100, 1000],
        curve: 'exponential'
      })
      // Exponential curve: t^2
      // At input 50, normalized t=0.5, t^2=0.25
      // Output: 100 + 0.25 * (1000 - 100) = 100 + 225 = 325
      expect(adapter.map(50)).toBe(325)
    })
  })

  describe('Auto-ranging', () => {
    it('derives range from rolling window', () => {
      const adapter = new Adapter({
        param: 'freq',
        outputRange: [0, 1],
        autoRange: { windowSize: 3, padding: 0 }
      })

      // Not enough data yet
      expect(adapter.map(10)).toBe(0)

      adapter.map(10) // window: [10, 10] -> still min=max
      adapter.map(20) // window: [10, 10, 20] -> range [10, 20]

      // Now it maps. Input 15 in range [10, 20] -> 0.5
      expect(adapter.map(15)).toBe(0.5)
    })

    it('applies padding to auto-range', () => {
      const adapter = new Adapter({
        param: 'freq',
        outputRange: [0, 1],
        autoRange: { windowSize: 5, padding: 0.1 }
      })

      adapter.seed([100, 200]) 
      // Diff = 100, Padding = 10. Range: [90, 210]
      // Input 100: (100 - 90) / (210 - 90) = 10 / 120 = 0.0833
      expect(adapter.map(100)).toBeCloseTo(0.0833, 4)
    })

    it('respects window size', () => {
      const adapter = new Adapter({
        param: 'freq',
        outputRange: [0, 1],
        autoRange: { windowSize: 2, padding: 0 }
      })

      adapter.seed([10, 20]) // Window: [10, 20]
      adapter.seed([100])    // Window: [20, 100]
      
      // map(60) will update window to [100, 60]
      // Range is [60, 100]. Input 60 is at the bottom (0).
      expect(adapter.map(60)).toBe(0)

      // Next map(80) will update window to [60, 80]
      // Range is [60, 80]. Input 80 is at the top (1).
      expect(adapter.map(80)).toBe(1)
    })
  })

  describe('Configuration', () => {
    it('updates config via setConfig', () => {
      const adapter = new Adapter({
        param: 'a',
        outputRange: [0, 1]
      })
      adapter.setConfig({ param: 'b', outputRange: [10, 20] })
      expect(adapter.param).toBe('b')
      expect(adapter.outputRange).toEqual([10, 20])
    })
  })
})
