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

  it('defines, retrieves, and lists open attentional layers', () => {
    const layers = landscape.listLayers()
    expect(layers).toContain('bed')
    expect(layers).toContain('texture')
    expect(layers).toContain('figure')
    expect(layers).toContain('event')
    expect(layers).toContain('alert')

    // Custom layer
    const custom = landscape.defineLayer('machinery', { gain: 0.85 })
    expect(custom.baseGain).toBe(0.85)
    expect(custom.gainNode).toBeDefined()
    expect(landscape.listLayers()).toContain('machinery')

    landscape.setLayerGain('machinery', 0.6)
    expect(landscape.getLayerGain('machinery')).toBe(0.6)
  })

  it('routes objects into their assigned layer gain node', () => {
    const wind = new MockWindSonifier()
    const rain = new MockWindSonifier()

    const windEntry = landscape.addObject('wind', wind, { layer: 'bed' })
    const rainEntry = landscape.addObject('rain', rain, { layer: 'texture' })

    expect(windEntry.layer).toBe('bed')
    expect(rainEntry.layer).toBe('texture')

    const bedLayer = landscape.getLayer('bed')
    const textureLayer = landscape.getLayer('texture')
    expect(bedLayer.gainNode).toBeDefined()
    expect(textureLayer.gainNode).toBeDefined()
  })

  it('triggers olivocochlear ducking on target layers when event strikes', () => {
    const bedLayer = landscape.getLayer('bed')
    const textureLayer = landscape.getLayer('texture')

    expect(bedLayer.baseGain).toBe(1.0)
    expect(textureLayer.baseGain).toBe(1.0)

    const chime = new MockChimeSonifier()
    landscape.addObject('chimes', chime, { layer: 'figure' })

    // Calling trigger on figure object should duck bed and texture
    landscape.trigger('chimes', 'strike', 0.9)

    // With depth = 0.35, ducked gain = 1.0 * (1 - 0.35) = 0.65
    expect(bedLayer.gainNode.gain.value).toBeCloseTo(0.65, 2)
    expect(textureLayer.gainNode.gain.value).toBeCloseTo(0.65, 2)
  })

  it('allows opting out of ducking on trigger when duck: false is passed', () => {
    const bedLayer = landscape.getLayer('bed')
    bedLayer.gainNode.gain.value = 1.0

    const chime = new MockChimeSonifier()
    landscape.addObject('chimes', chime, { layer: 'figure' })

    landscape.trigger('chimes', 'strike', { velocity: 0.8, duck: false })
    expect(bedLayer.gainNode.gain.value).toBe(1.0)
  })

  it('couples parameters declaratively with scaling, curves, and transforms', () => {
    const wind = new MockWindSonifier()
    const chime = new MockWindSonifier()
    landscape.addObject('wind', wind)
    landscape.addObject('chimes', chime)

    // Linear coupling: wind.speed -> chimes.speed with scale 0.8 and offset 5
    landscape.couple('wind', 'speed', 'chimes', 'speed', { scale: 0.8, offset: 5 })
    landscape.setParam('wind', 'speed', 50)
    expect(chime.speed).toBe(50 * 0.8 + 5) // 45

    // Transform function
    landscape.couple('wind', 'speed', 'chimes', 'speed', {
      transform: v => v * 2
    })
    landscape.setParam('wind', 'speed', 30)
    expect(chime.speed).toBe(60)

    // Uncouple
    landscape.uncouple('wind', 'speed', 'chimes', 'speed')
    landscape.setParam('wind', 'speed', 70)
    expect(chime.speed).toBe(60) // Unchanged
  })

  it('prevents cyclic recursion in bidirectional couplings', () => {
    const wind = new MockWindSonifier()
    const chime = new MockWindSonifier()
    landscape.addObject('wind', wind)
    landscape.addObject('chimes', chime)

    // A -> B and B -> A
    landscape.couple('wind', 'speed', 'chimes', 'speed', { scale: 1.0 })
    landscape.couple('chimes', 'speed', 'wind', 'speed', { scale: 1.0 })

    // Must not crash with stack overflow
    expect(() => {
      landscape.setParam('wind', 'speed', 42)
    }).not.toThrow()
    expect(chime.speed).toBe(42)
  })

  it('models distance by attenuating channel gain and increasing reverb send', () => {
    const wind = new MockWindSonifier()
    const entry = landscape.addObject('wind', wind, { gain: 1.0, distance: 0, reverbSend: 0.2 })

    // At distance 0
    expect(entry.channelGain.gain.value).toBe(1.0)
    expect(entry.sendGain.gain.value).toBe(0.2)

    // At distance 10: atten = 1 / sqrt(1 + 0.1 * 10) = 1 / sqrt(2) ~ 0.707
    landscape.setParam('wind', 'distance', 10)
    expect(entry.channelGain.gain.value).toBeCloseTo(0.707, 2)
    // Send gain: 0.2 + 0.04 * 10 = 0.6
    expect(entry.sendGain.gain.value).toBeCloseTo(0.6, 2)
  })

  it('controls master volume with bounds clamping', () => {
    landscape.setMasterVolume(0.7)
    expect(landscape.getMasterVolume()).toBe(0.7)

    landscape.setMasterVolume(1.5)
    expect(landscape.getMasterVolume()).toBe(1.0)

    landscape.setMasterVolume(-0.5)
    expect(landscape.getMasterVolume()).toBe(0.0)
  })

  it('registers and retrieves plugin classes', () => {
    landscape.register('wind', MockWindSonifier)
    landscape.register('chime', MockChimeSonifier)

    expect(landscape.listRegistered()).toEqual(['wind', 'chime'])
    expect(landscape.getRegistered('wind')).toBe(MockWindSonifier)
    expect(landscape.getRegistered('unknown')).toBeNull()
  })

  it('serializes entire landscape state to a SceneDescriptor via exportScene()', () => {
    landscape.setSpace({ decay: 3.2, wet: 0.35, warmth: 0.7 })
    landscape.setMasterVolume(0.85)

    const wind = new MockWindSonifier()
    landscape.addObject('wind', wind, {
      type: 'wind',
      layer: 'bed',
      gain: 0.7,
      pan: -0.2,
      distance: 8,
      spread: 0.6,
      reverbSend: 0.25
    })
    landscape.setParam('wind', 'speed', 48)

    landscape.couple('wind', 'speed', 'wind', 'pan', { scale: 0.01 })

    const scene = landscape.exportScene({ name: 'Test Scene' })
    expect(scene.version).toBe(1)
    expect(scene.name).toBe('Test Scene')
    expect(scene.space.decay).toBe(3.2)
    expect(scene.space.wet).toBe(0.35)
    expect(scene.masterVolume).toBe(0.85)
    expect(scene.layers.bed).toBeDefined()
    expect(scene.objects.wind).toBeDefined()
    expect(scene.objects.wind.type).toBe('wind')
    expect(scene.objects.wind.layer).toBe('bed')
    expect(scene.objects.wind.gain).toBe(0.7)
    expect(scene.objects.wind.pan).toBe(-0.2)
    expect(scene.objects.wind.distance).toBe(8)
    expect(scene.objects.wind.spread).toBe(0.6)
    expect(scene.objects.wind.params.speed).toBe(48)
    expect(scene.couplings.length).toBe(1)
    expect(scene.couplings[0].sourceId).toBe('wind')
  })

  it('loads scene descriptor and dynamically instantiates objects via registry', async () => {
    landscape.register('wind', MockWindSonifier)
    landscape.register('chime', MockChimeSonifier)

    const sceneConfig = {
      version: 1,
      name: 'Dynamic Forest',
      space: { decay: 2.8, wet: 0.3, warmth: 0.6 },
      masterVolume: 0.9,
      layers: {
        bed: { gain: 0.8 },
        figure: { gain: 1.0, ducking: { targets: ['bed'], depth: 0.4 } }
      },
      objects: {
        wind: {
          type: 'wind',
          layer: 'bed',
          gain: 0.65,
          pan: -0.1,
          distance: 5,
          params: { speed: 38 }
        },
        chimes: {
          type: 'chime',
          layer: 'figure',
          gain: 0.75,
          pan: 0.5,
          distance: 2
        }
      },
      couplings: [
        { sourceId: 'wind', sourceParam: 'speed', targetId: 'chimes', targetParam: 'speed', scale: 0.8 }
      ]
    }

    await landscape.loadScene(sceneConfig)

    expect(landscape.listObjects()).toContain('wind')
    expect(landscape.listObjects()).toContain('chimes')
    expect(landscape.getSpace().decay).toBe(2.8)
    expect(landscape.getMasterVolume()).toBe(0.9)
    expect(landscape.getObject('wind').sonifier.speed).toBe(38)
    expect(landscape.listCouplings().length).toBe(1)

    // Triggering wind speed should route to chimes via restored coupling
    landscape.setParam('wind', 'speed', 50)
    // chimes is MockChimeSonifier which doesn't have speed in schema, but coupling was dispatched
    expect(landscape.listCouplings()[0].scale).toBe(0.8)
  })

  it('preserves round-trip fidelity when exporting and reloading', async () => {
    landscape.register('wind', MockWindSonifier)

    const original = {
      version: 1,
      name: 'RoundTrip',
      space: { decay: 3.0, wet: 0.4, warmth: 0.8 },
      masterVolume: 0.75,
      layers: {
        bed: { gain: 0.85, ducking: null }
      },
      objects: {
        wind: {
          type: 'wind',
          layer: 'bed',
          gain: 0.6,
          pan: 0.2,
          distance: 4,
          spread: 0.5,
          reverbSend: 0.3,
          params: { speed: 25 }
        }
      },
      couplings: []
    }

    await landscape.loadScene(original)
    const exported = landscape.exportScene({ name: 'RoundTrip' })

    expect(exported.name).toBe(original.name)
    expect(exported.space.decay).toBe(original.space.decay)
    expect(exported.masterVolume).toBe(original.masterVolume)
    expect(exported.objects.wind.gain).toBe(original.objects.wind.gain)
    expect(exported.objects.wind.params.speed).toBe(25)
  })

  it('destroys entire landscape, layers, and child objects without error', async () => {
    const wind = new MockWindSonifier()
    const chime = new MockChimeSonifier()
    landscape.addObject('wind', wind)
    landscape.addObject('chimes', chime)
    landscape.couple('wind', 'speed', 'chimes', 'speed')

    await landscape.destroy()
    expect(landscape.listObjects().length).toBe(0)
    expect(landscape.listLayers().length).toBe(0)
    expect(landscape.listCouplings().length).toBe(0)
    expect(wind.destroyed).toBe(true)
    expect(landscape._masterGain).toBeNull()
  })
})
