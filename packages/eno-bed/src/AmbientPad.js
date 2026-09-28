export class AmbientPad {
  constructor(audioContext, destination) {
    this._ctx = audioContext;
    
    this._outputGain = this._ctx.createGain();
    this._outputGain.gain.value = 0;
    this._outputGain.connect(destination);

    this._filter = this._ctx.createBiquadFilter();
    this._filter.type = 'lowpass';
    this._filter.frequency.value = 200 + 0.65 * 7800; // default warmth
    this._filter.connect(this._outputGain);

    this._lfo = this._ctx.createOscillator();
    this._lfo.type = 'sine';
    this._lfo.frequency.value = 0.08; // default driftRate
    
    this._lfoGain = this._ctx.createGain();
    this._lfoGain.gain.value = 0.3 * 800; // default drift
    
    this._lfo.connect(this._lfoGain);
    this._lfoGain.connect(this._filter.frequency);
    this._lfo.start();

    this._oscMergeGain = this._ctx.createGain();
    this._oscMergeGain.gain.value = 1.0;
    this._oscMergeGain.connect(this._filter);

    this._oscs = [];
    
    const types = ['sine', 'sine', 'triangle', 'triangle'];
    for (let i = 0; i < 4; i++) {
      const osc = this._ctx.createOscillator();
      osc.type = types[i];
      osc.connect(this._oscMergeGain);
      osc.start();
      this._oscs.push(osc);
    }
    
    this._currentPitch = 130.81;
    this._currentDetune = 0.4;
    
    this._updateOscillators();
  }

  _updateOscillators() {
    const detuneCents = this._currentDetune * 15;
    const now = this._ctx.currentTime;
    const timeConstant = 0.03;
    
    this._oscs[0].frequency.setTargetAtTime(this._currentPitch, now, timeConstant);
    this._oscs[0].detune.setTargetAtTime(-detuneCents, now, timeConstant);
    
    this._oscs[1].frequency.setTargetAtTime(this._currentPitch, now, timeConstant);
    this._oscs[1].detune.setTargetAtTime(detuneCents, now, timeConstant);
    
    this._oscs[2].frequency.setTargetAtTime(this._currentPitch, now, timeConstant);
    this._oscs[2].detune.setTargetAtTime(-detuneCents * 0.7, now, timeConstant);
    
    this._oscs[3].frequency.setTargetAtTime(this._currentPitch, now, timeConstant);
    this._oscs[3].detune.setTargetAtTime(detuneCents * 0.7, now, timeConstant);
  }

  setPitch(hz) {
    this._currentPitch = Math.max(20, Math.min(20000, hz));
    this._updateOscillators();
  }

  setWarmth(v) {
    const warmth = Math.max(0, Math.min(1, v));
    const cutoff = 200 + warmth * 7800;
    this._filter.frequency.setTargetAtTime(cutoff, this._ctx.currentTime, 0.03);
  }

  setDetune(v) {
    this._currentDetune = Math.max(0, Math.min(1, v));
    this._updateOscillators();
  }

  setDrift(v) {
    const drift = Math.max(0, Math.min(1, v));
    this._lfoGain.gain.setTargetAtTime(drift * 800, this._ctx.currentTime, 0.03);
  }

  setDriftRate(v) {
    const rate = Math.max(0.001, Math.min(100, v));
    this._lfo.frequency.setTargetAtTime(rate, this._ctx.currentTime, 0.03);
  }

  setVolume(v) {
    const vol = Math.max(0, Math.min(1, v));
    this._outputGain.gain.setTargetAtTime(vol, this._ctx.currentTime, 0.03);
  }

  destroy() {
    const now = this._ctx.currentTime;
    this._outputGain.gain.cancelScheduledValues(now);
    this._outputGain.gain.setTargetAtTime(0, now, 0.03);
    
    setTimeout(() => {
      this._oscs.forEach(osc => {
        try { osc.stop(); } catch (e) {}
        try { osc.disconnect(); } catch (e) {}
      });
      try { this._lfo.stop(); } catch(e) {}
      try { this._lfo.disconnect(); } catch (e) {}
      try { this._lfoGain.disconnect(); } catch (e) {}
      try { this._filter.disconnect(); } catch (e) {}
      try { this._oscMergeGain.disconnect(); } catch (e) {}
      try { this._outputGain.disconnect(); } catch (e) {}
    }, 100);
  }
}
