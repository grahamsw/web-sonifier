/**
 * DroneResonatorProcessor.js
 * 
 * Replicates a SuperCollider drone synth.
 */

class DroneResonatorProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 40, minValue: 10, maxValue: 1000 },
      { name: 'nharm', defaultValue: 12, minValue: 1, maxValue: 50 },
      { name: 'detune', defaultValue: 0.2, minValue: 0, maxValue: 2 },
      { name: 'pan', defaultValue: 0, minValue: -1, maxValue: 1 },
      { name: 'amplitude', defaultValue: 0.5, minValue: 0, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    this.numChannels = 16;
    
    // Frequency modulators (LFNoise1 0.2 Hz)
    this.freqMods = new Float32Array(this.numChannels);
    this.freqModTargets = new Float32Array(this.numChannels);
    this.freqModSteps = new Float32Array(this.numChannels);
    this.freqModCounter = 0;
    this.freqModPeriod = 0; // Will be set in process based on sampleRate

    // Amplitude modulators (LFNoise1 0.5 Hz)
    this.ampMods = new Float32Array(this.numChannels);
    this.ampModTargets = new Float32Array(this.numChannels);
    this.ampModSteps = new Float32Array(this.numChannels);
    this.ampModCounter = 0;
    this.ampModPeriod = 0;

    // Oscillator phases
    this.phases = new Float32Array(this.numChannels);

    this.initialized = false;
  }

  _init(sRate) {
    this.freqModPeriod = (sRate / 0.2) | 0;
    this.ampModPeriod = (sRate / 0.5) | 0;

    for (let i = 0; i < this.numChannels; i++) {
      this.freqMods[i] = (Math.random() * 2 - 1);
      this.freqModTargets[i] = (Math.random() * 2 - 1);
      this.freqModSteps[i] = (this.freqModTargets[i] - this.freqMods[i]) / this.freqModPeriod;

      this.ampMods[i] = Math.random();
      this.ampModTargets[i] = Math.random();
      this.ampModSteps[i] = (this.ampModTargets[i] - this.ampMods[i]) / this.ampModPeriod;
      
      this.phases[i] = Math.random();
    }
    this.initialized = true;
  }

  // Simplified Blip implementation: Sum of harmonics
  // SC Blip.ar(freq, numharm) = (1/N) * sum_{i=1}^N cos(2pi * i * freq * t)
  // Actually SC Blip is not normalized by 1/N by default, but let's be careful.
  _blip(phase, nharm) {
    let sum = 0;
    const n = Math.floor(nharm);
    if (n < 1) return 0;
    
    // Band-limited impulse approximation using the formula:
    // sin(n * pi * x) / (n * sin(pi * x))
    // We use x = phase (0 to 1)
    const x = phase * Math.PI;
    const sinX = Math.sin(x);
    if (Math.abs(sinX) < 1e-6) return 1.0;
    
    return Math.sin(n * x) / (n * sinX);
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const left = output[0];
    const right = output[1];
    const sRate = sampleRate || 44100;

    if (!this.initialized) this._init(sRate);

    const freq = parameters.frequency[0];
    const nharm = parameters.nharm[0];
    const detune = parameters.detune[0];
    const pan = parameters.pan[0];
    const amplitude = parameters.amplitude[0];

    for (let i = 0; i < left.length; i++) {
      // Update Modulators
      if (this.freqModCounter >= this.freqModPeriod) {
        this.freqModCounter = 0;
        for (let c = 0; c < this.numChannels; c++) {
          this.freqMods[c] = this.freqModTargets[c];
          this.freqModTargets[c] = (Math.random() * 2 - 1);
          this.freqModSteps[c] = (this.freqModTargets[c] - this.freqMods[c]) / this.freqModPeriod;
        }
      }
      if (this.ampModCounter >= this.ampModPeriod) {
        this.ampModCounter = 0;
        for (let c = 0; c < this.numChannels; c++) {
          this.ampMods[c] = this.ampModTargets[c];
          this.ampModTargets[c] = Math.random();
          this.ampModSteps[c] = (this.ampModTargets[c] - this.ampMods[c]) / this.ampModPeriod;
        }
      }

      let sumL = 0;
      let sumR = 0;

      for (let c = 0; c < this.numChannels; c++) {
        // Frequency Modulation
        // SC: freq * LFNoise1.kr(0.2).bipolar(detune.neg, detune).midiratio
        const detuneVal = this.freqMods[c] * detune;
        const multiplier = Math.pow(2, detuneVal / 12); // midiratio
        const currentFreq = freq * multiplier;

        // Amplitude Modulation
        // SC: LFNoise1.kr(0.5).exprange(0.1, 1)
        // Math.exp(log(0.1) + noise * (log(1) - log(0.1)))
        const ampMod = Math.exp(Math.log(0.1) + this.ampMods[c] * (Math.log(1) - Math.log(0.1)));

        // Oscillator
        const sig = this._blip(this.phases[c], nharm) * ampMod;
        
        // Update phase
        this.phases[c] += currentFreq / sRate;
        if (this.phases[c] >= 1.0) this.phases[c] -= 1.0;

        // Splay-like spreading
        // channels are spread from -1 to 1
        const spread = (c / (this.numChannels - 1)) * 2 - 1;
        // Simple constant-power panning for spread
        const angle = (spread + 1) * Math.PI / 4;
        sumL += sig * Math.cos(angle);
        sumR += sig * Math.sin(angle);

        // Advance Modulators
        this.freqMods[c] += this.freqModSteps[c];
        this.ampMods[c] += this.ampModSteps[c];
      }

      this.freqModCounter++;
      this.ampModCounter++;

      // Final Stereo Panning and Master Amplitude
      // Balance2.ar(sig[0], sig[1], pan)
      const panAngle = (pan + 1) * Math.PI / 4;
      const panL = Math.cos(panAngle);
      const panR = Math.sin(panAngle);

      left[i] = sumL * panL * amplitude * 0.25; // Scale down to avoid clipping
      right[i] = sumR * panR * amplitude * 0.25;
    }

    return true;
  }
}

registerProcessor('drone-resonator-processor', DroneResonatorProcessor);
