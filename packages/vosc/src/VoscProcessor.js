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
    
    // Target and current values of the Dbrown random walks
    this.targetBufindex = null;
    this.targetDetune = null;
    this.targetPan = null;
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

    // Last gains for interpolating panning
    this.lastGainsL = new Float32Array(this.numVoices);
    this.lastGainsR = new Float32Array(this.numVoices);

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

    // Safe parameter loading (ensures arrays are defined and fall back to default arrays if empty)
    const freqArray = parameters.frequency && parameters.frequency.length > 0 ? parameters.frequency : [400];
    const ampArray = parameters.amplitude && parameters.amplitude.length > 0 ? parameters.amplitude : [0.5];
    const bufLow = parameters.bufLow && parameters.bufLow.length > 0 ? parameters.bufLow[0] : 0;
    const bufHigh = parameters.bufHigh && parameters.bufHigh.length > 0 ? parameters.bufHigh[0] : 7;
    const bufSteps = parameters.bufSteps && parameters.bufSteps.length > 0 ? parameters.bufSteps[0] : 10;
    const detuneLow = parameters.detuneLow && parameters.detuneLow.length > 0 ? parameters.detuneLow[0] : 0.01;
    const detuneHigh = parameters.detuneHigh && parameters.detuneHigh.length > 0 ? parameters.detuneHigh[0] : 0.1;
    const detuneSteps = parameters.detuneSteps && parameters.detuneSteps.length > 0 ? parameters.detuneSteps[0] : 10;
    const panLow = parameters.panLow && parameters.panLow.length > 0 ? parameters.panLow[0] : -1;
    const panHigh = parameters.panHigh && parameters.panHigh.length > 0 ? parameters.panHigh[0] : 1;
    const panSteps = parameters.panSteps && parameters.panSteps.length > 0 ? parameters.panSteps[0] : 10;
    const spreadArray = parameters.spread && parameters.spread.length > 0 ? parameters.spread : [0.5];
    const releaseTime = parameters.releaseTime && parameters.releaseTime.length > 0 ? parameters.releaseTime[0] : 10;
    const gateArray = parameters.gate && parameters.gate.length > 0 ? parameters.gate : [1];

    const len = left.length;

    // Detect if parameters are block-constant (length 1)
    const isFreqConstant = freqArray.length === 1;
    const isAmpConstant = ampArray.length === 1;
    const isSpreadConstant = spreadArray.length === 1;
    const isGateConstant = gateArray.length === 1;

    // Initialize Dbrown values and panning state if not already set
    if (this.targetBufindex === null) {
      this.targetBufindex = (bufLow + bufHigh) / 2;
      this.targetDetune = (detuneLow + detuneHigh) / 2;
      this.targetPan = (panLow + panHigh) / 2;

      this.currentBufindex = this.targetBufindex;
      this.currentDetune = this.targetDetune;
      this.currentPan = this.targetPan;

      const initSpread = spreadArray[0];
      for (let j = 0; j < this.numVoices; j++) {
        const relativePan = initSpread * ((j / (this.numVoices - 1)) * 2 - 1);
        const voicePan = Math.min(1.0, Math.max(-1.0, this.currentPan + relativePan));
        const angle = (voicePan + 1.0) * Math.PI / 4.0;
        this.lastGainsL[j] = Math.cos(angle);
        this.lastGainsR[j] = Math.sin(angle);
      }
    }

    // ASR Envelope steps
    const attackStep = 1.0 / (0.01 * sRate); // 10ms attack
    const releaseStep = releaseTime > 0 ? 1.0 / (releaseTime * sRate) : 1.0;

    // 20ms smoothing coefficient for random walk targets
    const smoothCoeff = 1.0 - Math.exp(-1.0 / (0.02 * sRate));

    // Precalculate voice midiratios at block-rate (Math.pow optimization)
    const midiratios = new Float32Array(this.numVoices);
    for (let j = 0; j < this.numVoices; j++) {
      const detuneVal = this.lfNoiseVals[j] * this.currentDetune;
      midiratios[j] = Math.pow(2, detuneVal / 12);
    }

    // Project target end-of-block pan and precalculate pan gains
    const targetGainsL = new Float32Array(this.numVoices);
    const targetGainsR = new Float32Array(this.numVoices);
    const stepGainsL = new Float32Array(this.numVoices);
    const stepGainsR = new Float32Array(this.numVoices);

    const endSpread = isSpreadConstant ? spreadArray[0] : spreadArray[len - 1];
    const decay = Math.pow(1.0 - smoothCoeff, len);
    const endPan = this.targetPan + (this.currentPan - this.targetPan) * decay;

    for (let j = 0; j < this.numVoices; j++) {
      const relativePan = endSpread * ((j / (this.numVoices - 1)) * 2 - 1);
      const voicePan = Math.min(1.0, Math.max(-1.0, endPan + relativePan));
      const angle = (voicePan + 1.0) * Math.PI / 4.0;
      targetGainsL[j] = Math.cos(angle);
      targetGainsR[j] = Math.sin(angle);
      
      stepGainsL[j] = (targetGainsL[j] - this.lastGainsL[j]) / len;
      stepGainsR[j] = (targetGainsR[j] - this.lastGainsR[j]) / len;
    }

    for (let i = 0; i < len; i++) {
      // 1. ASR Envelope logic
      const gate = isGateConstant ? gateArray[0] : gateArray[i];
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

        // bufindex random walk
        const bufStepSize = bufSteps > 0 ? (bufHigh - bufLow) / bufSteps : 0;
        if (bufStepSize > 0) {
          const walk = (Math.random() * 2 - 1) * bufStepSize;
          this.targetBufindex = Math.min(bufHigh, Math.max(bufLow, this.targetBufindex + walk));
        } else {
          this.targetBufindex = bufLow;
        }

        // detune random walk
        const detuneStepSize = detuneSteps > 0 ? (detuneHigh - detuneLow) / detuneSteps : 0;
        if (detuneStepSize > 0) {
          const walk = (Math.random() * 2 - 1) * detuneStepSize;
          this.targetDetune = Math.min(detuneHigh, Math.max(detuneLow, this.targetDetune + walk));
        } else {
          this.targetDetune = detuneLow;
        }

        // pan random walk
        const panStepSize = panSteps > 0 ? (panHigh - panLow) / panSteps : 0;
        if (panStepSize > 0) {
          const walk = (Math.random() * 2 - 1) * panStepSize;
          this.targetPan = Math.min(panHigh, Math.max(panLow, this.targetPan + walk));
        } else {
          this.targetPan = panLow;
        }
      }
      this.triggerCounter++;

      // Exponential smoothing of the random walk target values
      this.currentBufindex += (this.targetBufindex - this.currentBufindex) * smoothCoeff;
      this.currentDetune += (this.targetDetune - this.currentDetune) * smoothCoeff;
      this.currentPan += (this.targetPan - this.currentPan) * smoothCoeff;

      // 3. Process LFNoise1 and calculate frequencies + lookup VOsc for each voice
      let sumL = 0;
      let sumR = 0;

      const baseFreq = isFreqConstant ? freqArray[0] : freqArray[i];
      const amp = isAmpConstant ? ampArray[0] : ampArray[i];

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
        const voiceFreq = baseFreq * midiratios[j];

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

        // Constant-power panning (linearly interpolated gains)
        const gainL = this.lastGainsL[j] + i * stepGainsL[j];
        const gainR = this.lastGainsR[j] + i * stepGainsR[j];

        sumL += sig * gainL;
        sumR += sig * gainR;
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

    // Save final gains for next block's starting gains
    for (let j = 0; j < this.numVoices; j++) {
      this.lastGainsL[j] = targetGainsL[j];
      this.lastGainsR[j] = targetGainsR[j];
    }

    return true;
  }
}

registerProcessor('vosc-processor', VoscProcessor);
