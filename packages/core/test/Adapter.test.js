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
        outputRange: [100, 1600], // 4 octaves (100 -> 200 -> 400 -> 800 -> 1600)
        curve: 'exponential'
      })
      
      // With perceptual mapping:
      // at 0.0 -> 100
      // at 0.25 -> 200 (1 octave up)
      // at 0.5 -> 400 (2 octaves up)
      // at 0.75 -> 800 (3 octaves up)
      // at 1.0 -> 1600 (4 octaves up)
      
      expect(adapter.map(0)).toBe(100)
      expect(adapter.map(25)).toBe(200)
      expect(adapter.map(50)).toBe(400)
      expect(adapter.map(75)).toBe(800)
      expect(adapter.map(100)).toBe(1600)
    })

    it('applies logarithmic curve correctly', () => {
      const adapter = new Adapter({
        param: 'vol',
        inputRange: [0, 100],
        outputRange: [0, 1],
        curve: 'logarithmic'
      })
      // Logarithmic curve: log1p(t * (E - 1))
      // At input 50, normalized t=0.5
      // Expected: log1p(0.5 * (E - 1)) = log(1 + 0.5 * 1.718...) = log(1.859...) approx 0.62
      expect(adapter.map(50)).toBeCloseTo(0.62, 2)
      expect(adapter.map(0)).toBe(0)
      expect(adapter.map(100)).toBe(1)
    })

    it('inverts linear mapping when invert is true', () => {
      const adapter = new Adapter({
        param: 'vol',
        inputRange: [0, 100],
        outputRange: [0, 0.5],
        curve: 'linear',
        invert: true
      })
      expect(adapter.map(0)).toBe(0.5)
      expect(adapter.map(50)).toBe(0.25)
      expect(adapter.map(100)).toBe(0)
    })

    it('inverts exponential mapping when invert is true', () => {
      const adapter = new Adapter({
        param: 'freq',
        inputRange: [0, 100],
        outputRange: [100, 1600],
        curve: 'exponential',
        invert: true
      })
      // Inverted: input 0 -> t_norm=1 -> 1600; input 100 -> t_norm=0 -> 100
      expect(adapter.map(0)).toBe(1600)
      expect(adapter.map(50)).toBe(400)
      expect(adapter.map(100)).toBe(100)
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
      expect(adapter.map(10)).toBe(0) // Still returns min output

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

    it('returns null for getInputRange if window too small', () => {
      const adapter = new Adapter({
        param: 'a',
        outputRange: [0, 1],
        autoRange: { windowSize: 5 }
      })
      expect(adapter.getInputRange()).toBeNull()
      adapter.seed([10])
      expect(adapter.getInputRange()).toBeNull()
      adapter.seed([20])
      expect(adapter.getInputRange()).toEqual([9.5, 20.5]) // Default 5% padding
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

    it('returns full config via getConfig', () => {
      const config = {
        param: 'freq',
        outputRange: [100, 1000],
        inputRange: [0, 100],
        curve: 'exponential',
        invert: false,
        autoRange: null
      }
      const adapter = new Adapter(config)
      expect(adapter.getConfig()).toEqual(config)

      adapter.setConfig({ invert: true })
      expect(adapter.getConfig().invert).toBe(true)
    })
  })
})
