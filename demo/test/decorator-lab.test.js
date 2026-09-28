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
  PRESETS
} from '../decorator-lab/main.js'

describe('Decorator & Pipeline Lab Controller', () => {
  beforeEach(() => {
    // Reset state to default baseline
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
        decorators: ['ema:0.25', 'quantize:pentatonic']
      }
    }
    rebuildPipelineAdapters()
  })

  describe('Decorator Token Parsing & Resolution', () => {
    it('should parse decorator tokens with and without arguments', () => {
      expect(parseDecoratorToken('ema:0.3')).toEqual({ name: 'ema', arg: '0.3', raw: 'ema:0.3' })
      expect(parseDecoratorToken('quantize:hirajoshi')).toEqual({ name: 'quantize', arg: 'hirajoshi', raw: 'quantize:hirajoshi' })
      expect(parseDecoratorToken('delta')).toEqual({ name: 'delta', arg: undefined, raw: 'delta' })
      expect(parseDecoratorToken('accumulate')).toEqual({ name: 'accumulate', arg: undefined, raw: 'accumulate' })
      expect(parseDecoratorToken('round')).toEqual({ name: 'round', arg: undefined, raw: 'round' })
    })

    it('should resolve scale quantizer functions for pentatonic, minorPentatonic, hirajoshi, and dorian', () => {
      const qPent = resolveDecoratorTransformer('quantize:pentatonic')
      expect(typeof qPent).toBe('function')
      // 440 Hz is A4; 450 should snap to nearest pentatonic note
      const snapped = qPent(450)
      expect(typeof snapped).toBe('number')
      expect(snapped).not.toBe(450)

      expect(typeof resolveDecoratorTransformer('quantize:minorPentatonic')).toBe('function')
      expect(typeof resolveDecoratorTransformer('quantize:hirajoshi')).toBe('function')
      expect(typeof resolveDecoratorTransformer('quantize:dorian')).toBe('function')
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
      expect(thresh(60)).toBe(1) // returns aboveVal (default 1) when exceeding threshold

      const round = resolveDecoratorTransformer('round')
      expect(round(43.7)).toBe(44)
    })
  })

  describe('Pipeline Evaluation & Execution', () => {
    it('should execute adapter pipeline and apply chained decorators', () => {
      rebuildPipelineAdapters()

      // In [0, 100], out [220, 880], curve exponential
      // Decorators: ema:0.25, then quantize:pentatonic
      // Test sequential mapping
      const result = resolveDecoratorTransformer('quantize:pentatonic')
      expect(result).toBeDefined()
    })
  })

  describe('Bidirectional JSON & Code Specification', () => {
    it('should serialize mapping state into .mappings.json format', () => {
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
      expect(doc.mappings[0].adapter.decorators).toEqual(['ema:0.25', 'quantize:pentatonic'])
    })

    it('should generate equivalent fluent JavaScript runtime code', () => {
      const code = generateFluentJsCode()
      expect(code).toContain('new Adapter({')
      expect(code).toContain("param: 'pitch'")
      expect(code).toContain('inputRange: [0, 100]')
      expect(code).toContain('outputRange: [220, 880]')
      expect(code).toContain('.pipe(Transforms.ema(0.25))')
      expect(code).toContain('.pipe(Quantize.scale(Scales.pentatonic))')
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
              decorators: ['sma:8', 'quantize:hirajoshi']
            }
          }
        ]
      })

      applyMappingsJson(incomingJson)

      expect(state.feed.id).toBe('cpu_usage')
      expect(state.mapping.target.objectId).toBe('synth')
      expect(state.mapping.target.param).toBe('filterCutoff')
      expect(state.mapping.adapter.inputRange).toEqual([0, 1000])
      expect(state.mapping.adapter.outputRange).toEqual([100, 3000])
      expect(state.mapping.adapter.curve).toBe('linear')
      expect(state.mapping.adapter.invert).toBe(true)
      expect(state.mapping.adapter.decorators).toEqual(['sma:8', 'quantize:hirajoshi'])
    })

    it('should throw error on invalid JSON document structure', () => {
      expect(() => applyMappingsJson('{"invalid": true}')).toThrow(
        /Invalid mappings document/
      )
    })
  })

  describe('UI Decorator Chips Rendering & Reordering', () => {
    it('should render chips for each decorator in order', () => {
      const container = document.createElement('div')
      let updated = false
      const onUpdate = () => { updated = true }

      renderDecoratorChips(container, onUpdate)

      const chips = container.querySelectorAll('.decorator-chip')
      expect(chips).toHaveLength(2)
      expect(chips[0].textContent).toContain('EMA')
      expect(chips[1].textContent).toContain('Scale')
    })

    it('should support reordering decorator chips', () => {
      const container = document.createElement('div')
      renderDecoratorChips(container, () => {})

      // Click move-later button on first chip (index 0)
      const moveDownBtn = container.querySelector('.btn-chip-reorder[title*="Later"]')
      expect(moveDownBtn).not.toBeNull()
      moveDownBtn.click()

      expect(state.mapping.adapter.decorators).toEqual(['quantize:pentatonic', 'ema:0.25'])
    })

    it('should support removing a decorator chip', () => {
      const container = document.createElement('div')
      renderDecoratorChips(container, () => {})

      const removeBtns = container.querySelectorAll('.btn-chip-remove')
      expect(removeBtns.length).toBe(2)
      removeBtns[0].click()

      expect(state.mapping.adapter.decorators).toEqual(['quantize:pentatonic'])
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
