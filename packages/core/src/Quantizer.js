/**
 * Quantizer & Scales
 *
 * Musical and physical transformation decorators for Adapters.
 * Allows snapping continuous mapped data values (like frequency in Hz)
 * to musical scales, harmonic series overtones, or discrete step buckets.
 */

export const Scales = {
  // Pentatonic (major) - open, bright, universally consonant
  pentatonic: [0, 2, 4, 7, 9],
  // Minor Pentatonic (blues / modal)
  minorPentatonic: [0, 3, 5, 7, 10],
  // Dorian mode - jazz / mystical ambient
  dorian: [0, 2, 3, 5, 7, 9, 10],
  // Japanese Hirajoshi pentatonic - traditional meditative chime tuning
  hirajoshi: [0, 2, 3, 7, 8],
  // Whole tone - dreamlike, floating, impressionistic
  wholeTone: [0, 2, 4, 6, 8, 10],
  // Natural major (Ionian)
  major: [0, 2, 4, 5, 7, 9, 11],
  // Natural minor (Aeolian)
  minor: [0, 2, 3, 5, 7, 8, 10]
}

export const Quantize = {
  /**
   * Snaps a continuous frequency (in Hz) to the nearest pitch in a musical scale.
   *
   * @param {number[]} scaleDegrees - Array of semitone intervals relative to root (e.g. Scales.pentatonic)
   * @param {Object} [options]
   * @param {number} [options.rootFreq=220] - Root frequency of scale in Hz (e.g. 220 = A3)
   * @returns {(freq: number) => number} Transformer function
   */
  scale(scaleDegrees = Scales.pentatonic, options = {}) {
    const rootFreq = options.rootFreq ?? 220

    return (freq) => {
      if (freq <= 0) return rootFreq

      // Calculate semitone distance from root: s = 12 * log2(freq / rootFreq)
      const semitonesFromRoot = 12 * Math.log2(freq / rootFreq)
      const octave = Math.floor(semitonesFromRoot / 12)
      const degreeInOctave = ((semitonesFromRoot % 12) + 12) % 12

      // Find nearest scale degree
      let nearestDegree = scaleDegrees[0]
      let minDiff = Infinity
      for (const deg of scaleDegrees) {
        const diff = Math.abs(deg - degreeInOctave)
        if (diff < minDiff) {
          minDiff = diff
          nearestDegree = deg
        }
      }

      // Also check degree + 12 (wrap-around to next octave)
      if (Math.abs((scaleDegrees[0] + 12) - degreeInOctave) < minDiff) {
        nearestDegree = scaleDegrees[0] + 12
      }

      const totalSemitones = octave * 12 + nearestDegree
      return rootFreq * Math.pow(2, totalSemitones / 12)
    }
  },

  /**
   * Snaps a frequency to the nearest integer harmonic multiple of a fundamental f0.
   * (Acoustic overtone series: f0, 2f0, 3f0, 4f0...)
   *
   * @param {number} f0 - Fundamental frequency in Hz
   * @returns {(freq: number) => number} Transformer function
   */
  harmonics(f0 = 100) {
    const fundamental = Math.max(1, f0)
    return (freq) => {
      const harmonicNumber = Math.max(1, Math.round(freq / fundamental))
      return harmonicNumber * fundamental
    }
  },

  /**
   * Quantizes any numerical value to discrete step multiples (buckets).
   *
   * @param {number} stepSize
   * @returns {(val: number) => number} Transformer function
   */
  steps(stepSize = 1.0) {
    const step = Math.max(0.00001, stepSize)
    return (val) => Math.round(val / step) * step
  }
}
