/**
 * VoscProcessor.js
 * 
 * Recreates the SuperCollider VoscPlayer synth in a Web Audio AudioWorklet.
 */

class VoscProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 400, minValue: 10, maxValue: 20000 },
      { name: 'amplitude', defaultValue: 0.5, minValue: 0, maxValue: 1 },
      { name: 'bufLow', defaultValue: 0, minValue: 0, maxValue: 7 },
      { name: 'bufHigh', defaultValue: 7, minValue: 0, maxValue: 7 },
      { name: 'bufSteps', defaultValue: 10, minValue: 1, maxValue: 100 },
      { name: 'detuneLow', defaultValue: 0.01, minValue: 0, maxValue: 12 },
      { name: 'detuneHigh', defaultValue: 0.1, minValue: 0, maxValue: 12 },
      { name: 'detuneSteps', defaultValue: 10, minValue: 1, maxValue: 100 },
      { name: 'panLow', defaultValue: -1, minValue: -1, maxValue: 1 },
      { name: 'panHigh', defaultValue: 1, minValue: -1, maxValue: 1 },
      { name: 'panSteps', defaultValue: 10, minValue: 1, maxValue: 100 },
      { name: 'spread', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'releaseTime', defaultValue: 10, minValue: 0, maxValue: 100 },
      { name: 'gate', defaultValue: 1, minValue: 0, maxValue: 1 }
    ];
  }

  constructor(options) {
    super();
    this.numVoices = 8;
    
    // Waveforms (8 buffers of size 1024)
    this.wavetables = options.processorOptions?.wavetables || [];
    
    // If no wavetables provided, initialize with silent tables
    if (this.wavetables.length === 0) {
      for (let i = 0; i < 8; i++) {
        this.wavetables.push(new Float32Array(1024));
      }
    }

    this.port.onmessage = (event) => {
      if (event.data?.type === 'wavetables') {
        this.wavetables = event.data.wavetables;
      }
    };

    // Voice phases (random initial phases)
    this.phases = new Float32Array(this.numVoices);
    for (let i = 0; i < this.numVoices; i++) {
      this.phases[i] = Math.random();
    }

    // Dbrown / Trigger state
    this.triggerCounter = 0;
    this.triggerPeriod = 0; // will set in _init based on sampleRate
    
    // Current values of the Dbrown random walks
    this.currentBufindex = 0;
    this.currentDetune = 0;
    this.currentPan = 0;

    // LFNoise1 state for detuning of the 8 voices
    this.rates = new Float32Array(this.numVoices);
    this.lfNoiseVals = new Float32Array(this.numVoices);
    this.lfNoiseTargets = new Float32Array(this.numVoices);
    this.lfNoiseSteps = new Float32Array(this.numVoices);
    this.lfNoisePeriods = new Int32Array(this.numVoices);
    this.lfNoiseCounters = new Int32Array(this.numVoices);

    // LeakDC filter states (L / R)
    this.prevSigL = 0;
    this.prevSigR = 0;
    this.leakL = 0;
    this.leakR = 0;

    // Envelope state
    this.envelopeValue = 0;

    this.initialized = false;
  }

  _init(sRate) {
    // trigger runs at 10Hz
    this.triggerPeriod = (sRate / 10) | 0;
    this.triggerCounter = this.triggerPeriod; // force immediate trigger at start

    for (let j = 0; j < this.numVoices; j++) {
      // LFNoise1 rate random choice between 0.08 and 0.15 Hz
      this.rates[j] = Math.random() * (0.15 - 0.08) + 0.08;
      this.lfNoisePeriods[j] = (sRate / this.rates[j]) | 0;
      this.lfNoiseVals[j] = Math.random() * 2 - 1;
      this.lfNoiseTargets[j] = Math.random() * 2 - 1;
      this.lfNoiseSteps[j] = (this.lfNoiseTargets[j] - this.lfNoiseVals[j]) / this.lfNoisePeriods[j];
      this.lfNoiseCounters[j] = 0;
    }

    this.initialized = true;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const left = output[0];
    const right = output[1];
    const sRate = sampleRate || 44100;

    if (!this.initialized) this._init(sRate);

    // Parameters (either constant or audio-rate, we'll read index [0] or sample index)
    const baseFreq = parameters.frequency && parameters.frequency.length > 0 ? parameters.frequency[0] : 400;
    const amp = parameters.amplitude[0];
    const bufLow = parameters.bufLow[0];
    const bufHigh = parameters.bufHigh[0];
    const bufSteps = parameters.bufSteps[0];
    const detuneLow = parameters.detuneLow[0];
    const detuneHigh = parameters.detuneHigh[0];
    const detuneSteps = parameters.detuneSteps[0];
    const panLow = parameters.panLow[0];
    const panHigh = parameters.panHigh[0];
    const panSteps = parameters.panSteps[0];
    const spread = parameters.spread[0];
    const releaseTime = parameters.releaseTime[0];
    const gate = parameters.gate[0];

    const len = left.length;

    // ASR Envelope steps
    const attackStep = 1.0 / (0.01 * sRate); // 10ms attack
    const releaseStep = releaseTime > 0 ? 1.0 / (releaseTime * sRate) : 1.0;

    for (let i = 0; i < len; i++) {
      // 1. ASR Envelope logic
      if (gate > 0) {
        this.envelopeValue += attackStep;
        if (this.envelopeValue > 1.0) this.envelopeValue = 1.0;
      } else {
        this.envelopeValue -= releaseStep;
        if (this.envelopeValue < 0.0) this.envelopeValue = 0.0;
      }

      // 2. 10Hz Trigger & Dbrown Random Walks
      if (this.triggerCounter >= this.triggerPeriod) {
        this.triggerCounter = 0;

        // Initialize Dbrown values to midpoint if we just started
        if (this.currentBufindex === 0 && this.currentDetune === 0 && this.currentPan === 0) {
          this.currentBufindex = (bufLow + bufHigh) / 2;
          this.currentDetune = (detuneLow + detuneHigh) / 2;
          this.currentPan = (panLow + panHigh) / 2;
        }

        // bufindex random walk
        const bufStepSize = bufSteps > 0 ? (bufHigh - bufLow) / bufSteps : 0;
        if (bufStepSize > 0) {
          const walk = (Math.random() * 2 - 1) * bufStepSize;
          this.currentBufindex = Math.min(bufHigh, Math.max(bufLow, this.currentBufindex + walk));
        } else {
          this.currentBufindex = bufLow;
        }

        // detune random walk
        const detuneStepSize = detuneSteps > 0 ? (detuneHigh - detuneLow) / detuneSteps : 0;
        if (detuneStepSize > 0) {
          const walk = (Math.random() * 2 - 1) * detuneStepSize;
          this.currentDetune = Math.min(detuneHigh, Math.max(detuneLow, this.currentDetune + walk));
        } else {
          this.currentDetune = detuneLow;
        }

        // pan random walk
        const panStepSize = panSteps > 0 ? (panHigh - panLow) / panSteps : 0;
        if (panStepSize > 0) {
          const walk = (Math.random() * 2 - 1) * panStepSize;
          this.currentPan = Math.min(panHigh, Math.max(panLow, this.currentPan + walk));
        } else {
          this.currentPan = panLow;
        }
      }
      this.triggerCounter++;

      // 3. Process LFNoise1 and calculate frequencies + lookup VOsc for each voice
      let sumL = 0;
      let sumR = 0;

      for (let j = 0; j < this.numVoices; j++) {
        // Advance LFNoise1
        if (this.lfNoiseCounters[j] >= this.lfNoisePeriods[j]) {
          this.lfNoiseCounters[j] = 0;
          this.lfNoiseVals[j] = this.lfNoiseTargets[j];
          this.lfNoiseTargets[j] = Math.random() * 2 - 1;
          this.lfNoiseSteps[j] = (this.lfNoiseTargets[j] - this.lfNoiseVals[j]) / this.lfNoisePeriods[j];
        }
        this.lfNoiseVals[j] += this.lfNoiseSteps[j];
        this.lfNoiseCounters[j]++;

        // Calculate detuned frequency
        const detuneVal = this.lfNoiseVals[j] * this.currentDetune;
        const midiratio = Math.pow(2, detuneVal / 12);
        const voiceFreq = baseFreq * midiratio;

        // VOsc lookup
        // Update phase
        this.phases[j] += voiceFreq / sRate;
        if (this.phases[j] >= 1.0) this.phases[j] -= 1.0;

        const pos = this.phases[j] * 1024;
        const idx0 = Math.floor(pos) % 1024;
        const idx1 = (idx0 + 1) % 1024;
        const t = pos - Math.floor(pos);

        // Clamp bufindex to valid loaded tables range
        const bufVal = Math.min(this.wavetables.length - 1, Math.max(0, this.currentBufindex));
        const b0 = Math.floor(bufVal);
        const b1 = Math.min(this.wavetables.length - 1, b0 + 1);
        const frac = bufVal - b0;

        // Lookup in table b0
        const w0 = (1 - t) * this.wavetables[b0][idx0] + t * this.wavetables[b0][idx1];
        // Lookup in table b1
        const w1 = (1 - t) * this.wavetables[b1][idx0] + t * this.wavetables[b1][idx1];

        // Bilinear interpolated signal value
        const sig = (1 - frac) * w0 + frac * w1;

        // Panning spread (Splay)
        // Spread is distributed evenly from -spread to +spread around currentPan
        const relativePan = spread * ((j / (this.numVoices - 1)) * 2 - 1);
        const voicePan = Math.min(1.0, Math.max(-1.0, this.currentPan + relativePan));
        
        // Constant-power panning
        const angle = (voicePan + 1.0) * Math.PI / 4.0;
        sumL += sig * Math.cos(angle);
        sumR += sig * Math.sin(angle);
      }

      // Splay scale factor: 1 / sqrt(N) to normalize power
      const splayScale = 1.0 / Math.sqrt(this.numVoices);
      let rawL = sumL * splayScale * amp * this.envelopeValue;
      let rawR = sumR * splayScale * amp * this.envelopeValue;

      // 4. LeakDC One-Pole High-pass filter
      const outL = rawL - this.prevSigL + 0.995 * this.leakL;
      const outR = rawR - this.prevSigR + 0.995 * this.leakR;

      this.prevSigL = rawL;
      this.prevSigR = rawR;
      this.leakL = outL;
      this.leakR = outR;

      left[i] = outL;
      right[i] = outR;
    }

    return true;
  }
}

registerProcessor('vosc-processor', VoscProcessor);
