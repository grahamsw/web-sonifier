import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SonifierBase } from '../src/SonifierBase.js'
import './setup.js'

class TestSonifier extends SonifierBase {
  getParamSchema() {
    return [
      { name: 'num',  type: 'number', range: [0, 100], default: 50 },
      { name: 'opt',  type: 'enum',   values: ['a', 'b'], default: 'a' },
      { name: 'bool', type: 'boolean', default: false }
    ]
  }
  init(ctx, out) {
    this.initialized = true
  }
  onParam(name, value) {
    this.lastParam = { name, value }
  }
  destroy() {
    this.destroyed = true
  }
}

describe('SonifierBase', () => {
  let sonifier

  beforeEach(() => {
    sonifier = new TestSonifier()
  })

  it('stores parameter values', () => {
    sonifier.setParam('num', 75)
    expect(sonifier.getParam('num')).toBe(75)
    expect(sonifier.lastParam).toEqual({ name: 'num', value: 75 })
  })

  it('clamps numbers to range', () => {
    sonifier.setParam('num', 150)
    expect(sonifier.getParam('num')).toBe(100)
    
    sonifier.setParam('num', -50)
    expect(sonifier.getParam('num')).toBe(0)
  })

  it('validates enum values', () => {
    sonifier.setParam('opt', 'b')
    expect(sonifier.getParam('opt')).toBe('b')

    // Invalid value should fall back to default
    sonifier.setParam('opt', 'invalid')
    expect(sonifier.getParam('opt')).toBe('a')
  })

  it('coerces booleans', () => {
    sonifier.setParam('bool', 1)
    expect(sonifier.getParam('bool')).toBe(true)

    sonifier.setParam('bool', 0)
    expect(sonifier.getParam('bool')).toBe(false)
  })

  it('applies default values', () => {
    sonifier.applyDefaults()
    expect(sonifier.getParam('num')).toBe(50)
    expect(sonifier.getParam('opt')).toBe('a')
    expect(sonifier.getParam('bool')).toBe(false)
  })

  it('handles unknown parameters gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    sonifier.setParam('unknown', 123)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown param "unknown"'))
    warnSpy.mockRestore()
  })

  it('calls destroy()', () => {
    sonifier.destroy()
    expect(sonifier.destroyed).toBe(true)
  })

  it('warns when clamping numbers', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    sonifier.setParam('num', 200)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('clamped to [0, 100]'))
    warnSpy.mockRestore()
  })

  it('warns on invalid type and uses default', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    sonifier.setParam('num', 'not-a-number')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('expected a number'))
    expect(sonifier.getParam('num')).toBe(50) // default
    warnSpy.mockRestore()
  })
})
