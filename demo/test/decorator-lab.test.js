// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  state,
  resolveDecoratorTransformer,
  parseDecoratorToken,
  rebuildPipelineAdapters,
  generateMappingsJson,
  generateFluentJsCode,
  applyMappingsJson,
  renderDecoratorChips,
  syncUiFromState,
  feedTemporalBatch,
  initTemporalScatter,
  PRESETS
} from '../decorator-lab/main.js'

describe('Decorator & Pipeline Lab Controller', () => {
  beforeEach(() => {
    // Reset state to default baseline
    state.activeMode = 'tuning'
    state.feed = {
      id: 'traffic_rps',
      value: 50.0,
      range: [0, 100],
      profile: 'brownian',
      rate: 30,
      noise: 0.35,
      scrubOverride: false
    }
    state.mapping = {
      target: {
        objectId: 'chimes',
        param: 'pitch',
        unit: 'Hz'
      },
      adapter: {
        inputRange: [0, 100],
        outputRange: [220, 880],
        curve: 'exponential',
        invert: false,
        tuningMode: 'scale',
        scale: 'pentatonic',
        rootFreq: 220,
        fundamental: 110,
        decorators: ['ema:0.25']
      }
    }
    state.temporal = {
      eventCount: 5,
      windowSeconds: 10,
      strategy: 'poisson',
      autoRepeat: true,
      scheduledEvents: [],
      windowStartTime: 0,
      firedCount: 0
    }
    rebuildPipelineAdapters()
  })

  describe('Decorator Token Parsing & Resolution', () => {
    it('should parse decorator tokens with and without arguments', () => {
      expect(parseDecoratorToken('ema:0.3')).toEqual({ name: 'ema', arg: '0.3', raw: 'ema:0.3' })
      expect(parseDecoratorToken('quantize:hirajoshi')).toEqual({ name: 'quantize', arg: 'hirajoshi', raw: 'quantize:hirajoshi' })
      expect(parseDecoratorToken('harmonics:110')).toEqual({ name: 'harmonics', arg: '110', raw: 'harmonics:110' })
      expect(parseDecoratorToken('delta')).toEqual({ name: 'delta', arg: undefined, raw: 'delta' })
      expect(parseDecoratorToken('accumulate')).toEqual({ name: 'accumulate', arg: undefined, raw: 'accumulate' })
      expect(parseDecoratorToken('round')).toEqual({ name: 'round', arg: undefined, raw: 'round' })
    })

    it('should resolve scale quantizer functions for modal scales', () => {
      const qPent = resolveDecoratorTransformer('quantize:pentatonic')
      expect(typeof qPent).toBe('function')
      // 440 Hz is A4; 450 should snap to nearest pentatonic note
      const snapped = qPent(450)
      expect(typeof snapped).toBe('number')
      expect(snapped).not.toBe(450)

      expect(typeof resolveDecoratorTransformer('quantize:minorPentatonic')).toBe('function')
      expect(typeof resolveDecoratorTransformer('quantize:hirajoshi')).toBe('function')
      expect(typeof resolveDecoratorTransformer('quantize:dorian')).toBe('function')
      expect(typeof resolveDecoratorTransformer('quantize:wholeTone')).toBe('function')
      expect(typeof resolveDecoratorTransformer('quantize:major')).toBe('function')
      expect(typeof resolveDecoratorTransformer('quantize:minor')).toBe('function')
    })

    it('should resolve harmonic series overtone quantizer functions', () => {
      const qHarm = resolveDecoratorTransformer('harmonics:100')
      expect(typeof qHarm).toBe('function')
      // Overtones of 100 Hz are 100, 200, 300, 400...
      expect(qHarm(240)).toBe(200)
      expect(qHarm(265)).toBe(300)
    })

    it('should resolve stateful numeric transforms (ema, sma, delta, accumulate, threshold)', () => {
      const ema = resolveDecoratorTransformer('ema:0.5')
      expect(typeof ema).toBe('function')
      const val1 = ema(100)
      const val2 = ema(200)
      expect(val2).toBe(150) // 0.5 * 200 + 0.5 * 100 = 150

      const delta = resolveDecoratorTransformer('delta')
      expect(typeof delta).toBe('function')
      expect(delta(10)).toBe(0)
      expect(delta(25)).toBe(15)

      const acc = resolveDecoratorTransformer('accumulate')
      expect(typeof acc).toBe('function')
      expect(acc(5)).toBe(5)
      expect(acc(10)).toBe(15)

      const thresh = resolveDecoratorTransformer('threshold:50')
      expect(typeof thresh).toBe('function')
      expect(thresh(30)).toBe(0)
      expect(thresh(60)).toBe(1)

      const round = resolveDecoratorTransformer('round')
      expect(round(43.7)).toBe(44)
    })
  })

  describe('Continuous Musical Tuning & Pipeline Evaluation', () => {
    it('should execute adapter pipeline and apply scale quantizer', () => {
      state.mapping.adapter.tuningMode = 'scale'
      state.mapping.adapter.scale = 'pentatonic'
      state.mapping.adapter.rootFreq = 220
      rebuildPipelineAdapters()

      // Generating code reflects scale tuning
      const code = generateFluentJsCode()
      expect(code).toContain('Quantize.scale(Scales.pentatonic, { rootFreq: 220 })')
    })

    it('should execute adapter pipeline and apply harmonic series overtone quantizer', () => {
      state.mapping.adapter.tuningMode = 'harmonics'
      state.mapping.adapter.fundamental = 110
      rebuildPipelineAdapters()

      // Generating code reflects harmonic series overtone quantizer
      const code = generateFluentJsCode()
      expect(code).toContain('Quantize.harmonics(110)')
    })
  })

  describe('Temporal Event Scatter (EventScatterAdapter)', () => {
    it('should schedule batch events across window with offsets', () => {
      state.temporal.eventCount = 8
      state.temporal.windowSeconds = 12
      state.temporal.strategy = 'poisson'

      feedTemporalBatch()

      expect(state.temporal.scheduledEvents).toHaveLength(8)
      state.temporal.scheduledEvents.forEach(evt => {
        expect(evt.offsetMs).toBeGreaterThanOrEqual(0)
        expect(evt.offsetMs).toBeLessThanOrEqual(12000)
        expect(evt.fired).toBe(false)
      })
    })

    it('should generate mappings JSON and fluent code for temporal scatter mode', () => {
      state.activeMode = 'temporal'
      state.temporal.eventCount = 6
      state.temporal.windowSeconds = 15
      state.temporal.strategy = 'random'

      const jsonStr = generateMappingsJson()
      const doc = JSON.parse(jsonStr)

      expect(doc.mappings[0].type).toBe('event-scatter')
      expect(doc.mappings[0].adapter.windowSeconds).toBe(15)
      expect(doc.mappings[0].adapter.strategy).toBe('random')

      const code = generateFluentJsCode()
      expect(code).toContain("import { EventScatterAdapter } from '@web-sonifier/core'")
      expect(code).toContain('windowSeconds: 15')
      expect(code).toContain("strategy: 'random'")
      expect(code).toContain('scatterAdapter.feed(6)')
    })
  })

  describe('Bidirectional JSON & Code Specification', () => {
    it('should serialize mapping state into .mappings.json format', () => {
      state.activeMode = 'tuning'
      const jsonStr = generateMappingsJson()
      const doc = JSON.parse(jsonStr)

      expect(doc.version).toBe(1)
      expect(doc.mappings).toHaveLength(1)
      expect(doc.mappings[0].feedId).toBe('traffic_rps')
      expect(doc.mappings[0].target.objectId).toBe('chimes')
      expect(doc.mappings[0].target.param).toBe('pitch')
      expect(doc.mappings[0].adapter.inputRange).toEqual([0, 100])
      expect(doc.mappings[0].adapter.outputRange).toEqual([220, 880])
      expect(doc.mappings[0].adapter.curve).toBe('exponential')
      expect(doc.mappings[0].adapter.decorators).toEqual(['ema:0.25'])
      expect(doc.mappings[0].adapter.tuning.mode).toBe('scale')
      expect(doc.mappings[0].adapter.tuning.scale).toBe('pentatonic')
    })

    it('should parse and apply JSON specification bidirectionally', () => {
      const incomingJson = JSON.stringify({
        version: 1,
        mappings: [
          {
            feedId: 'cpu_usage',
            target: { objectId: 'synth', param: 'filterCutoff' },
            adapter: {
              inputRange: [0, 1000],
              outputRange: [100, 3000],
              curve: 'linear',
              invert: true,
              tuning: {
                mode: 'harmonics',
                fundamental: 120
              },
              decorators: ['sma:8']
            }
          }
        ]
      })

      applyMappingsJson(incomingJson)

      expect(state.activeMode).toBe('tuning')
      expect(state.feed.id).toBe('cpu_usage')
      expect(state.mapping.target.objectId).toBe('synth')
      expect(state.mapping.target.param).toBe('filterCutoff')
      expect(state.mapping.adapter.inputRange).toEqual([0, 1000])
      expect(state.mapping.adapter.outputRange).toEqual([100, 3000])
      expect(state.mapping.adapter.curve).toBe('linear')
      expect(state.mapping.adapter.invert).toBe(true)
      expect(state.mapping.adapter.tuningMode).toBe('harmonics')
      expect(state.mapping.adapter.fundamental).toBe(120)
      expect(state.mapping.adapter.decorators).toEqual(['sma:8'])
    })

    it('should parse event-scatter JSON and switch active mode to temporal', () => {
      const scatterJson = JSON.stringify({
        version: 1,
        mappings: [
          {
            feedId: 'errors',
            type: 'event-scatter',
            target: { objectId: 'chimes', action: 'strike' },
            adapter: {
              windowSeconds: 20,
              strategy: 'uniform'
            }
          }
        ]
      })

      applyMappingsJson(scatterJson)

      expect(state.activeMode).toBe('temporal')
      expect(state.temporal.windowSeconds).toBe(20)
      expect(state.temporal.strategy).toBe('uniform')
    })

    it('should throw error on invalid JSON document structure', () => {
      expect(() => applyMappingsJson('{"invalid": true}')).toThrow(
        /Invalid mappings document/
      )
    })
  })

  describe('UI Decorator Chips Rendering & Advanced SP Drawer', () => {
    it('should render chips for each decorator in order', () => {
      state.mapping.adapter.decorators = ['ema:0.25', 'delta']
      const container = document.createElement('div')
      let updated = false
      const onUpdate = () => { updated = true }

      renderDecoratorChips(container, onUpdate)

      const chips = container.querySelectorAll('.decorator-chip')
      expect(chips).toHaveLength(2)
      expect(chips[0].textContent).toContain('EMA')
      expect(chips[1].textContent).toContain('Delta')
    })

    it('should support reordering decorator chips in drawer', () => {
      state.mapping.adapter.decorators = ['delta', 'ema:0.25']
      const container = document.createElement('div')
      renderDecoratorChips(container, () => {})

      const moveDownBtn = container.querySelector('.btn-chip-reorder[title*="Later"]')
      expect(moveDownBtn).not.toBeNull()
      moveDownBtn.click()

      expect(state.mapping.adapter.decorators).toEqual(['ema:0.25', 'delta'])
    })

    it('should immediately update the DOM container when a chip is removed via syncUiFromState', () => {
      state.mapping.adapter.decorators = ['ema:0.25', 'sma:5']
      document.body.innerHTML = `
        <div id="decorator-chips-container"></div>
        <textarea id="json-editor"></textarea>
        <pre><code id="code-display"></code></pre>
      `
      syncUiFromState()

      const container = document.getElementById('decorator-chips-container')
      let chips = container.querySelectorAll('.decorator-chip')
      expect(chips).toHaveLength(2)

      // Click remove on the first chip
      const removeBtn = chips[0].querySelector('.btn-chip-remove')
      removeBtn.click()

      // Should immediately update DOM without page reload or manual refresh
      chips = container.querySelectorAll('.decorator-chip')
      expect(chips).toHaveLength(1)
      expect(state.mapping.adapter.decorators).toEqual(['sma:5'])
      expect(chips[0].textContent).toContain('SMA')
    })
  })

  describe('Presets Catalog', () => {
    it('should define complete valid preset configurations', () => {
      expect(PRESETS['smooth-pitch']).toBeDefined()
      expect(PRESETS['hirajoshi-walk']).toBeDefined()
      expect(PRESETS['delta-velocity']).toBeDefined()
      expect(PRESETS['accumulator']).toBeDefined()
      expect(PRESETS['moving-average']).toBeDefined()
      expect(PRESETS['threshold-gate']).toBeDefined()

      for (const [key, p] of Object.entries(PRESETS)) {
        expect(Array.isArray(p.inputRange)).toBe(true)
        expect(Array.isArray(p.outputRange)).toBe(true)
        expect(typeof p.curve).toBe('string')
        expect(Array.isArray(p.decorators)).toBe(true)
      }
    })
  })
})
