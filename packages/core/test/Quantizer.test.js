import { describe, it, expect } from 'vitest'
import { Quantize, Scales } from '../src/Quantizer.js'
import { Adapter } from '../src/Adapter.js'

describe('Quantizer & Scales', () => {
  it('snaps frequencies to nearest pentatonic scale degrees', () => {
    // Root A3 = 220Hz. Pentatonic semitones: [0, 2, 4, 7, 9]
    // Expected notes: 220 (A), 246.94 (B), 277.18 (C#), 329.63 (E), 369.99 (F#), 440 (A)
    const snap = Quantize.scale(Scales.pentatonic, { rootFreq: 220 })

    // 222 Hz is closest to 220
    expect(Math.round(snap(222))).toBe(220)

    // 240 Hz is closest to B3 (246.94)
    expect(Math.round(snap(240))).toBe(247)

    // 430 Hz is closest to A4 (440)
    expect(Math.round(snap(430))).toBe(440)
  })

  it('snaps frequencies to nearest harmonic series multiples', () => {
    const snapHarmonics = Quantize.harmonics(100) // 100, 200, 300, 400...

    expect(snapHarmonics(90)).toBe(100)
    expect(snapHarmonics(260)).toBe(300)
    expect(snapHarmonics(410)).toBe(400)
  })

  it('quantizes to discrete steps', () => {
    const snapSteps = Quantize.steps(5)
    expect(snapSteps(12)).toBe(10)
    expect(snapSteps(13)).toBe(15)
  })

  it('chains seamlessly with Adapter.pipe()', () => {
    const adapter = new Adapter({
      param: 'pitch',
      inputRange: [0, 100],
      outputRange: [200, 500]
    })

    // Pipe through pentatonic quantizer
    adapter.pipe(Quantize.scale(Scales.pentatonic, { rootFreq: 220 }))

    // Raw mapped value would be 200 + (50/100)*300 = 350
    // Snapped to pentatonic near 350 (F# is 369.99, E is 329.63, difference to E is 20.37 vs 19.99 to F#)
    const snapped = adapter.map(50)
    expect(Math.round(snapped)).toBe(370)
  })
})
