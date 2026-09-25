import { describe, it, expect } from 'vitest'
import { Transforms } from '../src/Transforms.js'
import { Adapter } from '../src/Adapter.js'

describe('Numeric Stateful Transforms', () => {
  describe('Exponential Moving Average (EMA)', () => {
    it('initializes to first received sample without delay', () => {
      const ema = Transforms.ema(0.2)
      expect(ema(100)).toBe(100)
    })

    it('smooths noisy step input progressively', () => {
      const ema = Transforms.ema(0.5)
      expect(ema(0)).toBe(0)
      // Step to 100: y1 = 0.5 * 100 + 0.5 * 0 = 50
      expect(ema(100)).toBe(50)
      // Next sample 100: y2 = 0.5 * 100 + 0.5 * 50 = 75
      expect(ema(100)).toBe(75)
      // Next sample 100: y3 = 0.5 * 100 + 0.5 * 75 = 87.5
      expect(ema(100)).toBe(87.5)
    })

    it('supports manual state reset', () => {
      const ema = Transforms.ema(0.5)
      ema(100)
      ema(100)
      ema.reset(0)
      expect(ema(100)).toBe(50)
    })
  })

  describe('Simple Moving Average (SMA)', () => {
    it('averages over window of size N', () => {
      const sma = Transforms.sma(3)
      expect(sma(10)).toBe(10) // [10] => 10
      expect(sma(20)).toBe(15) // [10, 20] => 15
      expect(sma(30)).toBe(20) // [10, 20, 30] => 20
      expect(sma(40)).toBe(30) // [20, 30, 40] => 30
    })

    it('clears buffer on reset', () => {
      const sma = Transforms.sma(3)
      sma(10)
      sma(20)
      sma.reset()
      expect(sma(50)).toBe(50)
    })
  })

  describe('Rate of Change (Delta)', () => {
    it('returns zero on first sample and calculates derivative on subsequent samples', () => {
      const delta = Transforms.delta()
      expect(delta(10)).toBe(0)
      expect(delta(15)).toBe(5)
      expect(delta(12)).toBe(-3)
      expect(delta(30)).toBe(18)
    })

    it('resets previous value state', () => {
      const delta = Transforms.delta()
      delta(10)
      delta(25) // delta is 15
      delta.reset()
      expect(delta(50)).toBe(0)
    })
  })

  describe('Threshold Gate', () => {
    it('switches state above and below threshold', () => {
      const gate = Transforms.threshold({ threshold: 50, above: 1, below: 0 })
      expect(gate(40)).toBe(0)
      expect(gate(60)).toBe(1)
      expect(gate(49)).toBe(0)
    })

    it('supports hysteresis to prevent boundary flutter', () => {
      const gate = Transforms.threshold({ threshold: 50, hysteresis: 5, above: 1, below: 0 })
      // Threshold is 50 with hyst 5: triggers high at >= 55, drops low at <= 45
      expect(gate(52)).toBe(0)
      expect(gate(55)).toBe(1)
      // Stays high even if it drops to 52
      expect(gate(52)).toBe(1)
      expect(gate(48)).toBe(1)
      // Drops to 0 when <= 45
      expect(gate(44)).toBe(0)
    })
  })

  describe('Accumulator', () => {
    it('integrates incoming numbers with bounds clamping', () => {
      const acc = Transforms.accumulate(0, 0, 100)
      expect(acc(10)).toBe(10)
      expect(acc(15)).toBe(25)
      expect(acc(85)).toBe(100) // clamped at max 100
      expect(acc(-150)).toBe(0) // clamped at min 0
    })
  })

  describe('Adapter Pipe Integration', () => {
    it('pipes transforms through Adapter pipeline seamlessly', () => {
      const ema = Transforms.ema(0.5)
      const adapter = new Adapter({
        inputRange: [0, 100],
        outputRange: [200, 800],
        curve: 'linear'
      })

      // Pipe EMA before range scaling
      adapter.pipe(ema)

      // First sample 100: EMA gives 100, mapped to 800
      expect(adapter.map(100)).toBe(800)
      // Step to 0: EMA gives 0.5 * 0 + 0.5 * 100 = 50, mapped to 500
      expect(adapter.map(0)).toBe(500)
    })
  })
})
