import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ModalChime } from '../src/ModalChime.js'
import { MinnaertBubble } from '../../bubble/src/MinnaertBubble.js'

describe('Adversarial DSP & Stress Tests (ModalChime & MinnaertBubble)', () => {
  let ctx
  let outputNode
  let createdNodes

  // Strict Web Audio Param simulator enforcing standard Web Audio constraints
  const createStrictAudioParam = (initialValue = 0) => {
    const param = {
      value: initialValue,
      setValueAtTime: vi.fn((val, time) => {
        if (!Number.isFinite(val)) {
          throw new TypeError(`Failed to execute 'setValueAtTime' on 'AudioParam': The provided float value ${val} is non-finite.`)
        }
        if (!Number.isFinite(time) || time < 0) {
          throw new TypeError(`Failed to execute 'setValueAtTime' on 'AudioParam': Invalid time ${time}.`)
        }
        param.value = val
      }),
      setTargetAtTime: vi.fn((target, startTime, timeConstant) => {
        if (!Number.isFinite(target)) {
          throw new TypeError(`Failed to execute 'setTargetAtTime' on 'AudioParam': The target value ${target} is non-finite.`)
        }
        if (!Number.isFinite(startTime) || startTime < 0) {
          throw new TypeError(`Failed to execute 'setTargetAtTime' on 'AudioParam': Invalid startTime ${startTime}.`)
        }
        if (!Number.isFinite(timeConstant) || timeConstant < 0) {
          throw new TypeError(`Failed to execute 'setTargetAtTime' on 'AudioParam': Invalid timeConstant ${timeConstant}.`)
        }
        param.value = target
      }),
      linearRampToValueAtTime: vi.fn((val, time) => {
        if (!Number.isFinite(val)) {
          throw new TypeError(`Failed to execute 'linearRampToValueAtTime' on 'AudioParam': The value ${val} is non-finite.`)
        }
        if (!Number.isFinite(time) || time < 0) {
          throw new TypeError(`Failed to execute 'linearRampToValueAtTime' on 'AudioParam': Invalid time ${time}.`)
        }
        param.value = val
      }),
      exponentialRampToValueAtTime: vi.fn((val, time) => {
        if (!Number.isFinite(val)) {
          throw new TypeError(`Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': The value ${val} is non-finite.`)
        }
        if (val <= 0) {
          throw new RangeError(`Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': The float value provided (${val}) must be greater than 0.`)
        }
        if (!Number.isFinite(time) || time < 0) {
          throw new TypeError(`Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': Invalid time ${time}.`)
        }
        param.value = val
      }),
      cancelScheduledValues: vi.fn((time) => {
        if (!Number.isFinite(time) || time < 0) {
          throw new TypeError(`Failed to execute 'cancelScheduledValues' on 'AudioParam': Invalid time ${time}.`)
        }
      })
    }
    return param
  }

  beforeEach(() => {
    createdNodes = {
      gains: [],
      oscillators: [],
      bufferSources: [],
      panners: []
    }

    const mockGainNode = () => {
      const node = {
        type: 'gain',
        gain: createStrictAudioParam(1.0),
        connect: vi.fn(),
        disconnect: vi.fn()
      }
      createdNodes.gains.push(node)
      return node
    }

    const mockOscNode = () => {
      const node = {
        type: 'oscillator',
        frequency: createStrictAudioParam(440),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      }
      createdNodes.oscillators.push(node)
      return node
    }

    const mockBufferSource = () => {
      const node = {
        type: 'bufferSource',
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      }
      createdNodes.bufferSources.push(node)
      return node
    }

    const mockStereoPanner = () => {
      const node = {
        type: 'panner',
        pan: createStrictAudioParam(0),
        connect: vi.fn(),
        disconnect: vi.fn()
      }
      createdNodes.panners.push(node)
      return node
    }

    outputNode = mockGainNode()

    ctx = {
      currentTime: 10,
      sampleRate: 44100,
      destination: {},
      createGain: vi.fn(mockGainNode),
      createOscillator: vi.fn(mockOscNode),
      createBufferSource: vi.fn(mockBufferSource),
      createStereoPanner: vi.fn(mockStereoPanner),
      createBuffer: vi.fn((channels, length) => ({
        numberOfChannels: channels,
        length,
        sampleRate: 44100,
        getChannelData: vi.fn(() => new Float32Array(length))
      }))
    }
  })

  // ===========================================================================
  // ModalChime Stress Tests
  // ===========================================================================
  describe('ModalChime Adversarial Inputs', () => {
    it('handles NaN, Infinity, negative, and extreme frequency/pitch inputs without throwing', () => {
      const chime = new ModalChime(ctx, outputNode)

      const adversarialPitches = [
        NaN,
        Infinity,
        -Infinity,
        -1000,
        -0.0001,
        0,
        1e-10,
        50000,
        1e9,
        'not-a-number',
        null,
        undefined,
        {}
      ]

      for (const pitch of adversarialPitches) {
        expect(() => {
          chime.setPitch(pitch)
        }).not.toThrow()
        expect(Number.isFinite(chime.pitch)).toBe(true)
        expect(chime.pitch).toBeGreaterThanOrEqual(120)
        expect(chime.pitch).toBeLessThanOrEqual(4000)

        expect(() => {
          chime.strike({ pitch })
        }).not.toThrow()
      }
    })

    it('handles adversarial velocity, damping, pan, volume, and windSpeed inputs safely', () => {
      const chime = new ModalChime(ctx, outputNode)

      const adversarialValues = [NaN, Infinity, -Infinity, -999, 999, 'bad']

      for (const bad of adversarialValues) {
        expect(() => chime.setDamping(bad)).not.toThrow()
        expect(Number.isFinite(chime.damping)).toBe(true)
        expect(chime.damping).toBeGreaterThanOrEqual(0.02)
        expect(chime.damping).toBeLessThanOrEqual(1.0)

        expect(() => chime.setVolume(bad)).not.toThrow()
        expect(() => chime.setWindSpeed(bad)).not.toThrow()

        expect(() => {
          chime.strike({
            velocity: bad,
            damping: bad,
            pan: bad,
            time: bad
          })
        }).not.toThrow()
      }
    })
  })

  describe('ModalChime High-Density Trigger Bursts', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('safely handles firing 200 strikes in 100ms and cleans up all nodes and timers', () => {
      const chime = new ModalChime(ctx, outputNode)
      const handles = []

      // Fire 200 high-density strikes across 100ms
      for (let i = 0; i < 200; i++) {
        ctx.currentTime = 10 + (i * 0.0005) // 0.5ms steps = 100ms total
        const handle = chime.strike({
          pitch: 200 + (i % 20) * 50,
          velocity: 0.1 + (i % 10) * 0.08,
          damping: 0.2 + (i % 5) * 0.1
        })
        expect(handle).toBeDefined()
        expect(typeof handle.stop).toBe('function')
        handles.push(handle)
      }

      // 200 strikes * 4 oscillators per strike = 800 oscillators
      expect(createdNodes.oscillators.length).toBe(800)
      expect(chime._activeVoices.size).toBe(200)

      // Advance time through decay window
      vi.advanceTimersByTime(10000)

      // All cleanup timers should have fired and disconnected nodes
      expect(chime._activeVoices.size).toBe(0)
      for (const osc of createdNodes.oscillators) {
        expect(osc.disconnect).toHaveBeenCalled()
      }
    })
  })

  describe('ModalChime Mid-Decay Teardown Integrity', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('performs clean teardown with no pops or errors when destroy() is called mid-decay', () => {
      const chime = new ModalChime(ctx, outputNode)

      // Fire a rapid burst of 50 strikes
      for (let i = 0; i < 50; i++) {
        chime.strike({ pitch: 440 + i * 10, velocity: 0.8 })
      }

      expect(chime._activeVoices.size).toBe(50)

      const chimeOutput = chime.output

      // Call destroy() immediately mid-decay
      expect(() => chime.destroy()).not.toThrow()

      // Output gain should be smoothly ramped to 0 using setTargetAtTime
      expect(chimeOutput.gain.cancelScheduledValues).toHaveBeenCalled()
      expect(chimeOutput.gain.setTargetAtTime).toHaveBeenCalledWith(0, ctx.currentTime, 0.01)

      // All active voices should have been stopped and cleared
      expect(chime._activeVoices.size).toBe(0)

      // Advance past the 30ms teardown timer
      vi.advanceTimersByTime(50)
      expect(chimeOutput.disconnect).toHaveBeenCalled()
      expect(chime.output).toBeNull()

      // Post-destroy operations should be safe no-ops
      expect(() => chime.strike({ pitch: 500 })).not.toThrow()
      expect(() => chime.setVolume(0.5)).not.toThrow()
      expect(() => chime.setPitch(300)).not.toThrow()
      expect(() => chime.setWindSpeed(20)).not.toThrow()
      expect(() => chime.destroy()).not.toThrow()
    })
  })

  // ===========================================================================
  // MinnaertBubble Stress Tests
  // ===========================================================================
  describe('MinnaertBubble Adversarial Inputs', () => {
    it('handles NaN, Infinity, negative, and extreme radius/depth inputs without throwing', () => {
      const bubble = new MinnaertBubble(ctx, outputNode)

      const adversarialRadii = [
        NaN,
        Infinity,
        -Infinity,
        -0.5,
        0,
        0.000001,
        100,
        'bogus',
        null,
        undefined
      ]

      for (const radius of adversarialRadii) {
        expect(() => bubble.setRadius(radius)).not.toThrow()
        expect(Number.isFinite(bubble.radius)).toBe(true)
        expect(bubble.radius).toBeGreaterThanOrEqual(0.0005)
        expect(bubble.radius).toBeLessThanOrEqual(0.05)

        expect(() => {
          bubble.trigger({ radius })
        }).not.toThrow()
      }
    })

    it('handles adversarial depth, viscosity, energy, pan, volume, and rate inputs safely', () => {
      const bubble = new MinnaertBubble(ctx, outputNode)

      const adversarialValues = [NaN, Infinity, -Infinity, -50, 50, 'bad']

      for (const bad of adversarialValues) {
        expect(() => bubble.setDepth(bad)).not.toThrow()
        expect(Number.isFinite(bubble.depth)).toBe(true)
        expect(bubble.depth).toBeGreaterThanOrEqual(0.01)

        expect(() => bubble.setViscosity(bad)).not.toThrow()
        expect(Number.isFinite(bubble.viscosity)).toBe(true)
        expect(bubble.viscosity).toBeGreaterThanOrEqual(0.01)

        expect(() => bubble.setVolume(bad)).not.toThrow()
        expect(() => bubble.setRate(bad)).not.toThrow()

        expect(() => {
          bubble.trigger({
            depth: bad,
            viscosity: bad,
            energy: bad,
            pan: bad,
            time: bad
          })
        }).not.toThrow()
      }
    })
  })

  describe('MinnaertBubble High-Density Trigger Bursts', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('safely handles firing 200 droplets in 100ms and cleans up all nodes and timers', () => {
      const bubble = new MinnaertBubble(ctx, outputNode)
      const handles = []

      for (let i = 0; i < 200; i++) {
        ctx.currentTime = 10 + (i * 0.0005)
        const handle = bubble.trigger({
          radius: 0.002 + (i % 10) * 0.001,
          depth: 0.05 + (i % 5) * 0.02,
          energy: 0.5 + (i % 5) * 0.1
        })
        expect(handle).toBeDefined()
        expect(typeof handle.stop).toBe('function')
        handles.push(handle)
      }

      expect(createdNodes.oscillators.length).toBe(200)
      expect(bubble._activeVoices.size).toBe(200)

      // Advance time through droplet ringdown
      vi.advanceTimersByTime(2000)

      expect(bubble._activeVoices.size).toBe(0)
      for (const osc of createdNodes.oscillators) {
        expect(osc.disconnect).toHaveBeenCalled()
      }
    })
  })

  describe('MinnaertBubble Mid-Decay Teardown Integrity', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('performs clean teardown with no pops or errors when destroy() is called mid-decay', () => {
      const bubble = new MinnaertBubble(ctx, outputNode)

      // Fire 50 droplets
      for (let i = 0; i < 50; i++) {
        bubble.trigger({ radius: 0.005, depth: 0.1, energy: 0.9 })
      }

      expect(bubble._activeVoices.size).toBe(50)

      const bubbleOutput = bubble.output

      // Call destroy() mid-decay
      expect(() => bubble.destroy()).not.toThrow()

      // Pop-free parameter smoothing
      expect(bubbleOutput.gain.cancelScheduledValues).toHaveBeenCalled()
      expect(bubbleOutput.gain.setTargetAtTime).toHaveBeenCalledWith(0, ctx.currentTime, 0.01)

      // Active voice collection cleared
      expect(bubble._activeVoices.size).toBe(0)

      // Advance past 30ms teardown timer
      vi.advanceTimersByTime(50)
      expect(bubbleOutput.disconnect).toHaveBeenCalled()
      expect(bubble.output).toBeNull()

      // Post-destroy calls must be safe no-ops
      expect(() => bubble.trigger({ radius: 0.004 })).not.toThrow()
      expect(() => bubble.setVolume(0.5)).not.toThrow()
      expect(() => bubble.setRate(10)).not.toThrow()
      expect(() => bubble.destroy()).not.toThrow()
    })
  })
})
