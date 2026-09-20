import { describe, it, expect, vi } from 'vitest'
import { MetaParameter, Macro } from '../src/MetaParameter.js'
import { SonifierBase } from '../src/SonifierBase.js'

describe('MetaParameter', () => {

  it('exports MetaParameter and Macro as identical class references', () => {
    expect(MetaParameter).toBeDefined()
    expect(Macro).toBe(MetaParameter)
  })

  it('initialises with default configuration', () => {
    const meta = new MetaParameter({
      name: 'frenzy',
      mappings: [
        { param: 'speed', range: [1, 10] }
      ]
    })
    expect(meta.name).toBe('frenzy')
    expect(meta.label).toBe('frenzy')
    expect(meta.range).toEqual([0, 1])
    expect(meta.default).toBe(0.5)
    expect(meta.mappings.length).toBe(1)
  })

  it('throws an error if name is missing', () => {
    expect(() => new MetaParameter({})).toThrow(/name/)
  })

  describe('Single-Segment Mappings', () => {
    it('maps multiple parameters linearly', () => {
      const meta = new MetaParameter({
        name: 'intensity',
        range: [0, 1],
        mappings: [
          { param: 'volume', range: [0, 1], curve: 'linear' },
          { param: 'cutoff', range: [100, 500], curve: 'linear' }
        ]
      })

      const at0 = meta.map(0)
      expect(at0.volume).toBe(0)
      expect(at0.cutoff).toBe(100)

      const atHalf = meta.map(0.5)
      expect(atHalf.volume).toBe(0.5)
      expect(atHalf.cutoff).toBe(300)

      const at1 = meta.map(1)
      expect(at1.volume).toBe(1)
      expect(at1.cutoff).toBe(500)
    })

    it('supports inverted ranges via invert flag or swapped range bounds', () => {
      const meta = new MetaParameter({
        name: 'calm',
        range: [0, 1],
        mappings: [
          { param: 'noise', range: [0, 1], invert: true },
          { param: 'flutter', range: [100, 0] }
        ]
      })

      expect(meta.map(0).noise).toBe(1)
      expect(meta.map(1).noise).toBe(0)
      expect(meta.map(0.5).noise).toBe(0.5)

      expect(meta.map(0).flutter).toBe(100)
      expect(meta.map(1).flutter).toBe(0)
      expect(meta.map(0.5).flutter).toBe(50)
    })

    it('applies exponential curves with perceptual octave scaling', () => {
      const meta = new MetaParameter({
        name: 'pitchMacro',
        range: [0, 1],
        mappings: [
          { param: 'freq', range: [100, 1600], curve: 'exponential' } // 4 octaves
        ]
      })

      expect(meta.map(0).freq).toBeCloseTo(100, 2)
      expect(meta.map(0.25).freq).toBeCloseTo(200, 2) // 1 octave up
      expect(meta.map(0.50).freq).toBeCloseTo(400, 2) // 2 octaves up
      expect(meta.map(0.75).freq).toBeCloseTo(800, 2) // 3 octaves up
      expect(meta.map(1.0).freq).toBeCloseTo(1600, 2)
    })

    it('applies logarithmic curve correctly', () => {
      const meta = new MetaParameter({
        name: 'logMacro',
        range: [0, 1],
        mappings: [
          { param: 'gain', range: [0, 1], curve: 'logarithmic' }
        ]
      })

      expect(meta.map(0).gain).toBe(0)
      expect(meta.map(1).gain).toBe(1)
      // Logarithmic curve should rise faster in lower half
      expect(meta.map(0.5).gain).toBeGreaterThan(0.5)
    })

    it('applies smooth s-curve correctly', () => {
      const meta = new MetaParameter({
        name: 'sMacro',
        range: [0, 1],
        mappings: [
          { param: 'presence', range: [0, 1], curve: 's-curve' }
        ]
      })

      expect(meta.map(0).presence).toBe(0)
      expect(meta.map(1).presence).toBe(1)
      expect(meta.map(0.5).presence).toBeCloseTo(0.5, 4)
      // S-curve is flatter at ends
      expect(meta.map(0.1).presence).toBeLessThan(0.1)
      expect(meta.map(0.9).presence).toBeGreaterThan(0.9)
    })

    it('clamps input values outside defined range', () => {
      const meta = new MetaParameter({
        name: 'clamped',
        range: [10, 20],
        mappings: [
          { param: 'target', range: [0, 100] }
        ]
      })

      expect(meta.map(5).target).toBe(0)   // below min
      expect(meta.map(25).target).toBe(100) // above max
      expect(meta.map(15).target).toBe(50)  // midpoint
    })
  })

  describe('SuperCollider-Style Multi-Segment Piecewise Envelopes', () => {
    it('interpolates multi-point breakpoints with mixed segment curves', () => {
      // Piecewise envelope:
      // At u=0.0 -> 0
      // Rises exponentially to 100 at u=0.4
      // Slopes linearly down to 20 at u=1.0
      const meta = new MetaParameter({
        name: 'shriekEnvelope',
        range: [0, 1],
        mappings: [
          {
            param: 'screech',
            points: [
              [0.0, 0],
              [0.4, 100, 'exponential'],
              [1.0, 20, 'linear']
            ]
          }
        ]
      })

      expect(meta.map(0).screech).toBe(0)
      expect(meta.map(0.4).screech).toBeCloseTo(100, 2)
      expect(meta.map(1.0).screech).toBe(20)

      // In second segment [0.4, 1.0]: midpoint is 0.7, linear between 100 and 20 -> 60
      expect(meta.map(0.7).screech).toBeCloseTo(60, 2)

      // Clamps before first point and after last point
      expect(meta.map(-0.2).screech).toBe(0)
      expect(meta.map(1.5).screech).toBe(20)
    })

    it('supports SuperCollider-style levels, times, and curves syntax', () => {
      // Env([0, 100, 20], [0.4, 0.6], ['linear', 'linear'])
      const meta = new MetaParameter({
        name: 'envMacro',
        mappings: [
          {
            param: 'cutoff',
            levels: [0, 100, 20],
            times: [0.4, 0.6],
            curves: ['linear', 'linear']
          }
        ]
      })

      expect(meta.map(0).cutoff).toBe(0)
      expect(meta.map(0.4).cutoff).toBeCloseTo(100, 2)
      expect(meta.map(1.0).cutoff).toBeCloseTo(20, 2)
      expect(meta.map(0.7).cutoff).toBeCloseTo(60, 2)
    })
  })

  describe('Custom Functional Transforms', () => {
    it('executes custom map functions', () => {
      const meta = new MetaParameter({
        name: 'mathMacro',
        mappings: [
          {
            param: 'customFreq',
            map: (u) => 440 * Math.pow(2, u * 2) // 440 to 1760 Hz
          }
        ]
      })

      expect(meta.map(0).customFreq).toBe(440)
      expect(meta.map(0.5).customFreq).toBe(880)
      expect(meta.map(1.0).customFreq).toBe(1760)
    })
  })

  describe('apply() Execution on Sonifiers', () => {
    it('dispatches setParam to target sonifier for all mapped parameters', () => {
      const mockSonifier = {
        setParam: vi.fn()
      }

      const meta = new MetaParameter({
        name: 'roar',
        mappings: [
          { param: 'gain', range: [0.5, 1.5] },
          { param: 'shriek', range: [0, 1] }
        ]
      })

      const updates = meta.apply(0.8, mockSonifier)

      expect(updates).toEqual({
        gain: 1.3,
        shriek: 0.8
      })
      expect(mockSonifier.setParam).toHaveBeenCalledWith('gain', 1.3)
      expect(mockSonifier.setParam).toHaveBeenCalledWith('shriek', 0.8)
    })

    it('throws if sonifier has no setParam method', () => {
      const meta = new MetaParameter({ name: 'test', mappings: [] })
      expect(() => meta.apply(0.5, {})).toThrow(/setParam/)
    })

    it('evaluate() is an alias of map()', () => {
      const meta = new MetaParameter({
        name: 'aliasTest',
        mappings: [{ param: 'val', range: [10, 20] }]
      })
      expect(meta.evaluate(0.5)).toEqual(meta.map(0.5))
    })
  })

  describe('SonifierBase Integration', () => {
    class TestSynth extends SonifierBase {
      getParamSchema() {
        return [
          { name: 'cutoff', type: 'number', range: [100, 2000], default: 500 },
          { name: 'resonance', type: 'number', range: [0, 1], default: 0.2 },
          { name: 'drive', type: 'number', range: [1, 10], default: 1 }
        ]
      }

      getMetaParamSchema() {
        return [
          {
            name: 'bite',
            label: 'Filter Bite',
            mappings: [
              { param: 'cutoff', range: [200, 1800], curve: 'exponential' },
              { param: 'resonance', range: [0.2, 0.9], curve: 'linear' },
              { param: 'drive', range: [1, 8], curve: 'linear' }
            ]
          }
        ]
      }

      init(ctx, out) {}
      onParam(name, val) {}
      destroy() {}
    }

    it('allows sonifiers to declare and set native meta-parameters', () => {
      const synth = new TestSynth()
      const metaSchema = synth.getMetaParamSchema()
      expect(metaSchema.length).toBe(1)
      expect(metaSchema[0].name).toBe('bite')

      // Retrieve MetaParameter instance
      const metaParam = synth.getMetaParam('bite')
      expect(metaParam).toBeInstanceOf(MetaParameter)
      expect(synth.getMetaParam('bite')).toBe(metaParam) // cached instance

      // setMetaParam updates underlying parameters through validation and onParam
      synth.setMetaParam('bite', 1.0)
      expect(synth.getParam('cutoff')).toBeCloseTo(1800, 1)
      expect(synth.getParam('resonance')).toBeCloseTo(0.9, 2)
      expect(synth.getParam('drive')).toBeCloseTo(8, 2)

      synth.setMetaParam('bite', 0.0)
      expect(synth.getParam('cutoff')).toBeCloseTo(200, 1)
      expect(synth.getParam('resonance')).toBeCloseTo(0.2, 2)
      expect(synth.getParam('drive')).toBeCloseTo(1, 2)
    })

    it('gracefully handles unknown meta-parameters', () => {
      const synth = new TestSynth()
      expect(synth.getMetaParam('unknown')).toBeNull()
      expect(() => synth.setMetaParam('unknown', 0.5)).not.toThrow()
    })
  })
})
