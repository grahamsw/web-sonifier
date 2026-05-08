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

  it('suspends and resumes', async () => {
    runtime.start()
    const suspendSpy = vi.spyOn(runtime._audioContext, 'suspend')
    const resumeSpy = vi.spyOn(runtime._audioContext, 'resume')
    
    await runtime.suspend()
    expect(suspendSpy).toHaveBeenCalled()
    
    await runtime.resume()
    expect(resumeSpy).toHaveBeenCalled()
  })

  it('destroys all instances and closes context', async () => {
    runtime.register('mock', MockSonifier)
    runtime.start()
    const s1 = runtime.create('mock', 's1')
    const s2 = runtime.create('mock', 's2')
    const closeSpy = vi.spyOn(runtime._audioContext, 'close')
    
    await runtime.destroyAll()
    
    expect(s1.destroyed).toBe(true)
    expect(s2.destroyed).toBe(true)
    expect(closeSpy).toHaveBeenCalled()
    expect(runtime.getMasterVolume()).toBe(1.0) // fallback when no gain node
  })
})
