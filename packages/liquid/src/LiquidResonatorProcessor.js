/**
 * LiquidResonatorProcessor.js
 * 
 * Ported from grahamsw/purr.
 * A physical modeling liquid resonator.
 */

class LiquidResonatorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 40, minValue: 10, maxValue: 100 },
      { name: 'viscosity', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'volume', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    this.L = 16384;
    this.delays = [
      new Float32Array(this.L), new Float32Array(this.L),
      new Float32Array(this.L), new Float32Array(this.L)
    ];
    this.ptrs = new Int32Array(4);
    this.primes = [1487, 2333, 3163, 4001];

    this.sineTable = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      this.sineTable[i] = Math.sin((i / 1024) * 6.283185307179586);
    }
    this.phase = 0;
    this.antiDenormal = 1e-15;

    // Smoothing state
    this.sf = 40;
    this.sv = 0.5;
    this.svol = 0.5;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0] && outputs[0][0];
    if (!output) return true;

    const input = inputs[0] && inputs[0][0];
    const sRate = sampleRate || 44100;
    const L = this.L;

    for (let i = 0; i < output.length; i++) {
      // 1. Smooth Parameters
      const targetF = parameters.frequency.length > 1 ? parameters.frequency[i] : parameters.frequency[0];
      const targetV = parameters.viscosity.length > 1 ? parameters.viscosity[i] : parameters.viscosity[0];
      const targetVol = parameters.volume.length > 1 ? parameters.volume[i] : parameters.volume[0];

      this.sf = this.sf * 0.995 + targetF * 0.005;
      this.sv = this.sv * 0.995 + targetV * 0.005;
      this.svol = this.svol * 0.995 + targetVol * 0.005;

      const phaseInc = (this.sf / sRate) * 1024;
      const feedback = 0.92 + (0.05 * (1.0 - this.sv));
      const damping = 0.05 * this.sv;
      const invDamping = 1.0 - damping;
      const volMod = 0.5 + this.svol * 1.5;

      // 2. Excitation
      this.phase += phaseInc;
      if (this.phase >= 1024) this.phase -= 1024;
      const sigIn = (input ? input[i] : 0) + (this.sineTable[this.phase | 0] * 0.1) + this.antiDenormal;

      // 3. Linearly Interpolated Delay Reads
      let sum = 0;
      let dOuts = [0, 0, 0, 0];

      for (let d = 0; d < 4; d++) {
        const targetLen = this.primes[d] * volMod;
        let floatIdx = this.ptrs[d] - targetLen;
        while (floatIdx < 0) floatIdx += L;

        const i0 = floatIdx | 0;
        const i1 = (i0 + 1) % L;
        const frac = floatIdx - i0;

        const val = this.delays[d][i0] + frac * (this.delays[d][i1] - this.delays[d][i0]);
        dOuts[d] = val;
        sum += val;
      }

      sum *= 0.5;

      // 4. Update Modes
      for (let d = 0; d < 4; d++) {
        const delayIn = sigIn + (dOuts[d] - sum) * feedback;
        let prevPtr = (this.ptrs[d] - 1); if (prevPtr < 0) prevPtr += L;

        this.delays[d][this.ptrs[d]] = delayIn * invDamping + this.delays[d][prevPtr] * damping;
        this.ptrs[d] = (this.ptrs[d] + 1) % L;
      }

      // 5. Output
      const raw = (dOuts[0] + dOuts[1] + dOuts[2] + dOuts[3]) * 1.5;
      output[i] = raw / (1.0 + (raw < 0 ? -raw : raw));
    }

    return true;
  }
}

registerProcessor('liquid-resonator-processor', LiquidResonatorProcessor);
