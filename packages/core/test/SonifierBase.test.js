import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SonifierBase } from '../src/SonifierBase.js'
import './setup.js'

class TestSonifier extends SonifierBase {
  getParamSchema() {
    return [
      { name: 'num',  type: 'number', range: [0, 100], default: 50 },
      { name: 'int',  type: 'integer', range: [1, 10], default: 5 },
      { name: 'opt',  type: 'enum',   values: ['a', 'b'], default: 'a' },
      { name: 'optObj', type: 'enum', options: [{ label: 'First', value: 10 }, { label: 'Second', value: 20 }], default: 10 },
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

  it('validates and rounds integer values', () => {
    sonifier.setParam('int', 7.4)
    expect(sonifier.getParam('int')).toBe(7)

    sonifier.setParam('int', 7.6)
    expect(sonifier.getParam('int')).toBe(8)

    // Clamps to range
    sonifier.setParam('int', 15)
    expect(sonifier.getParam('int')).toBe(10)

    sonifier.setParam('int', -5)
    expect(sonifier.getParam('int')).toBe(1)
  })

  it('validates enum values with options objects', () => {
    sonifier.setParam('optObj', 20)
    expect(sonifier.getParam('optObj')).toBe(20)

    sonifier.setParam('optObj', 999)
    expect(sonifier.getParam('optObj')).toBe(10) // default
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
