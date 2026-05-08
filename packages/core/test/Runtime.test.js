import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Runtime } from '../src/Runtime.js'
import { SonifierBase } from '../src/SonifierBase.js'
import './setup.js'

class MockSonifier extends SonifierBase {
  getParamSchema() { return [] }
  init(ctx, out) { this.initialized = true }
  onParam() {}
  destroy() { this.destroyed = true }
}

describe('Runtime', () => {
  let runtime

  beforeEach(() => {
    runtime = new Runtime()
  })

  it('registers sonifiers', () => {
    runtime.register('mock', MockSonifier)
    expect(runtime.listRegistered()).toContain('mock')
  })

  it('fails to create before start()', () => {
    runtime.register('mock', MockSonifier)
    expect(() => runtime.create('mock')).toThrow(/must be called before create/)
  })

  it('creates and initialises sonifiers', () => {
    runtime.register('mock', MockSonifier)
    runtime.start()
    const instance = runtime.create('mock')
    expect(instance).toBeInstanceOf(MockSonifier)
    expect(instance.initialized).toBe(true)
  })

  it('handles multiple instances via instanceId', () => {
    runtime.register('mock', MockSonifier)
    runtime.start()
    const s1 = runtime.create('mock', 'one')
    const s2 = runtime.create('mock', 'two')
    expect(s1).not.toBe(s2)
  })

  it('destroys instances', () => {
    runtime.register('mock', MockSonifier)
    runtime.start()
    const instance = runtime.create('mock')
    runtime.destroy('mock')
    expect(instance.destroyed).toBe(true)
  })

  it('sets master volume', () => {
    runtime.start()
    runtime.setMasterVolume(0.5)
    expect(runtime.getMasterVolume()).toBe(0.5)
  })
})
