export class ShimmerCloud {
  constructor(audioContext, destination) {
    this._ctx = audioContext;
    this._destination = destination;

    this._outputGain = this._ctx.createGain();
    this._outputGain.gain.value = 0; // Starts at 0, updated by setVolume
    this._outputGain.connect(this._destination);

    // Initial state
    this.pitch = 261.63;
    this.shimmer = 0.6;
    this.brightness = 0.5;
    this.density = 0.5;
    this.evolution = 0.4;

    this.voiceRatios = [1.0, 1.002, 0.998, 1.005, 0.995, 1.008];
    this.voiceTypes = ['sine', 'sine', 'triangle', 'sine', 'triangle', 'sine'];
    this.phaseSpeeds = [0.013, 0.021, 0.008, 0.034, 0.015, 0.026];
    
    this.voices = [];
    
    for (let i = 0; i < 6; i++) {
      const osc = this._ctx.createOscillator();
      const bpf = this._ctx.createBiquadFilter();
      const gain = this._ctx.createGain();

      osc.type = this.voiceTypes[i];
      bpf.type = 'bandpass';
      bpf.Q.value = 2.0;

      gain.gain.value = 0; // Will be set by timer

      osc.connect(bpf);
      bpf.connect(gain);
      gain.connect(this._outputGain);
      
      osc.start();

      this.voices.push({
        osc,
        bpf,
        gain,
        ratio: this.voiceRatios[i],
        phaseSpeed: this.phaseSpeeds[i],
        phase: Math.random() * Math.PI * 2 // Random initial phase
      });
    }

    this._updatePitch();
    
    // Modulation timer (~80ms tick)
    this._timer = setInterval(() => this._tick(), 80);
  }

  _tick() {
    const activeThreshold = 1 - this.density; // if density is 1, threshold is 0.
    
    for (const voice of this.voices) {
      voice.phase += voice.phaseSpeed * this.evolution;
      
      let val = 0.5 + 0.5 * Math.sin(voice.phase); // 0 to 1
      
      let targetGain = 0;
      if (val > activeThreshold) {
        // Map remaining range above threshold to 0-1 (roughly, max gain 0.3 per voice)
        let normalized = (val - activeThreshold) / (1 - activeThreshold);
        targetGain = normalized * 0.3;
      }

      voice.gain.gain.setTargetAtTime(targetGain, this._ctx.currentTime, 0.05);
    }
  }

  _updatePitch() {
    for (const voice of this.voices) {
      // Calculate detuned ratio based on shimmer
      const offset = voice.ratio - 1.0;
      const effectiveRatio = 1.0 + (offset * this.shimmer);
      
      const freq = this.pitch * effectiveRatio;
      voice.osc.frequency.setTargetAtTime(Math.max(1, Math.min(22000, freq)), this._ctx.currentTime, 0.05);
      
      const bpfFreq = freq * (0.5 + this.brightness * 1.5);
      voice.bpf.frequency.setTargetAtTime(Math.max(1, Math.min(22000, bpfFreq)), this._ctx.currentTime, 0.05);
    }
  }

  setPitch(hz) {
    this.pitch = Math.max(10, Math.min(hz, 20000));
    this._updatePitch();
  }

  setShimmer(v) {
    this.shimmer = Math.max(0, Math.min(v, 1));
    this._updatePitch();
  }

  setBrightness(v) {
    this.brightness = Math.max(0, Math.min(v, 1));
    this._updatePitch();
  }

  setDensity(v) {
    this.density = Math.max(0, Math.min(v, 1));
  }

  setEvolution(v) {
    this.evolution = Math.max(0, Math.min(v, 1));
  }

  setVolume(v) {
    const safeV = Math.max(0, Math.min(v, 1));
    this._outputGain.gain.setTargetAtTime(safeV, this._ctx.currentTime, 0.05);
  }

  destroy() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }

    if (this._outputGain) {
      this._outputGain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.01);
      
      setTimeout(() => {
        for (const voice of this.voices) {
          try { voice.osc.stop(); } catch(e) {}
          voice.osc.disconnect();
          voice.bpf.disconnect();
          voice.gain.disconnect();
        }
        this._outputGain.disconnect();
      }, 30);
    }
  }
}
