import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Landscape } from '../src/Landscape.js'
import { SonifierBase } from '../src/SonifierBase.js'
import './setup.js'

class MockWindSonifier extends SonifierBase {
  constructor() {
    super()
    this.speed = 20
    this.initialized = false
    this.destroyed = false
  }
  getParamSchema() {
    return [{ name: 'speed', type: 'number', range: [0, 100], default: 20 }]
  }
  init(ctx, out) {
    this.initialized = true
    this.outputNode = out
  }
  onParam(name, value) {
    if (name === 'speed') this.speed = value
  }
  destroy() {
    this.destroyed = true
  }
}

class MockChimeSonifier extends SonifierBase {
  constructor() {
    super()
    this.strikeCount = 0
    this.lastVelocity = 0
  }
  getParamSchema() { return [] }
  init(ctx, out) {}
  onParam() {}
  strike(velocity = 0.8) {
    this.strikeCount++
    this.lastVelocity = velocity
    return true
  }
  destroy() {}
}

describe('Landscape Orchestrator', () => {
  let ctx
  let landscape

  beforeEach(() => {
    ctx = new AudioContext()
    landscape = new Landscape({ audioContext: ctx })
  })

  it('initializes master spatial bus with dry, reverb, and master gain nodes', () => {
    expect(landscape._masterGain).toBeDefined()
    expect(landscape._dryGain).toBeDefined()
    expect(landscape._reverbGain).toBeDefined()
    expect(landscape._convolver).toBeDefined()
    expect(landscape.getMasterVolume()).toBe(1.0)
  })

  it('synthesizes and updates shared acoustic space reverberation', () => {
    const initialSpace = landscape.getSpace()
    expect(initialSpace.decay).toBe(2.2)
    expect(initialSpace.wet).toBe(0.28)

    landscape.setSpace({ decay: 3.5, wet: 0.4, warmth: 0.8 })
    const updated = landscape.getSpace()
    expect(updated.decay).toBe(3.5)
    expect(updated.wet).toBe(0.4)
    expect(updated.warmth).toBe(0.8)
    expect(landscape._convolver.buffer).not.toBeNull()
  })

  it('adds sound objects with channel strip nodes and initializes sonifier', () => {
    const wind = new MockWindSonifier()
    const entry = landscape.addObject('wind', wind, { gain: 0.8, pan: -0.4, reverbSend: 0.25 })

    expect(entry).toBeDefined()
    expect(landscape.listObjects()).toEqual(['wind'])
    expect(landscape.getObject('wind').sonifier).toBe(wind)
    expect(wind.initialized).toBe(true)
    expect(entry.channelGain.gain.value).toBe(0.8)
    expect(entry.panner.pan.value).toBe(-0.4)
    expect(entry.sendGain.gain.value).toBe(0.25)
  })

  it('routes continuous parameters to channel strip and child sonifiers', () => {
    const wind = new MockWindSonifier()
    const entry = landscape.addObject('wind', wind, { gain: 0.5, pan: 0 })

    // Channel strip pan
    landscape.setParam('wind', 'pan', 0.6)
    expect(entry.panner.pan.value).toBe(0.6)

    // Channel strip gain
    landscape.setParam('wind', 'gain', 0.9)
    expect(entry.channelGain.gain.value).toBe(0.9)

    // Child sonifier parameter
    landscape.setParam('wind', 'speed', 65)
    expect(wind.speed).toBe(65)
  })

  it('dispatches discrete event triggers to child objects', () => {
    const chime = new MockChimeSonifier()
    landscape.addObject('chimes', chime)

    const res = landscape.trigger('chimes', 'strike', 0.95)
    expect(res).toBe(true)
    expect(chime.strikeCount).toBe(1)
    expect(chime.lastVelocity).toBe(0.95)
  })

  it('removes objects and tears down their nodes cleanly', () => {
    const wind = new MockWindSonifier()
    landscape.addObject('wind', wind)
    expect(landscape.listObjects()).toContain('wind')

    landscape.removeObject('wind')
    expect(landscape.listObjects()).not.toContain('wind')
    expect(wind.destroyed).toBe(true)
  })

  it('controls master volume with bounds clamping', () => {
    landscape.setMasterVolume(0.7)
    expect(landscape.getMasterVolume()).toBe(0.7)

    landscape.setMasterVolume(1.5)
    expect(landscape.getMasterVolume()).toBe(1.0)

    landscape.setMasterVolume(-0.5)
    expect(landscape.getMasterVolume()).toBe(0.0)
  })

  it('destroys entire landscape and child objects without error', async () => {
    const wind = new MockWindSonifier()
    const chime = new MockChimeSonifier()
    landscape.addObject('wind', wind)
    landscape.addObject('chimes', chime)

    await landscape.destroy()
    expect(landscape.listObjects().length).toBe(0)
    expect(wind.destroyed).toBe(true)
    expect(landscape._masterGain).toBeNull()
  })
})
