export class TapeLoopTone {
  constructor(audioContext, destination) {
    this._ctx = audioContext
    this._output = this._ctx.createGain()
    this._output.connect(destination)
    
    // Params
    this._pitch = 523.25
    this._sustain = 3.0
    this._brightness = 0.3
    this._autoRate = 0.3
    this._scatter = 0.5
    this._scale = 'pentatonic'
    
    // Scales
    this._scales = {
      major: [0, 2, 4, 5, 7, 9, 11, 12],
      minor: [0, 2, 3, 5, 7, 8, 10, 12],
      pentatonic: [0, 2, 4, 7, 9, 12],
      dorian: [0, 2, 3, 5, 7, 9, 10, 12],
      chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    }
    
    // State
    this._activeVoices = []
    this._autoTimer = null
    
    // Schedule auto trigger
    this._scheduleAutoTrigger()
  }
  
  _scheduleAutoTrigger() {
    if (this._autoTimer) {
      clearTimeout(this._autoTimer)
      this._autoTimer = null
    }
    
    if (this._autoRate <= 0) return
    
    const meanInterval = 1 / this._autoRate
    const random = Math.random()
    let intervalSeconds = meanInterval * (1 + (random * 2 - 1) * this._scatter)
    
    // clamp jitter
    intervalSeconds = Math.max(0.1, Math.min(30, intervalSeconds))
    
    this._autoTimer = setTimeout(() => {
      this._doAutoTrigger()
      this._scheduleAutoTrigger()
    }, intervalSeconds * 1000)
  }
  
  _doAutoTrigger() {
    const scale = this._scales[this._scale] || this._scales.pentatonic
    const semitone = scale[Math.floor(Math.random() * scale.length)]
    const pitch = this._pitch * Math.pow(2, semitone / 12)
    
    this.trigger({ pitch, velocity: 0.7 })
  }
  
  trigger(options = {}) {
    const pitch = options.pitch ?? this._pitch
    const velocity = options.velocity ?? 0.7
    const sustain = options.sustain ?? this._sustain
    
    const now = this._ctx.currentTime
    
    // Cull old voices
    if (this._activeVoices.length > 12) {
      const oldest = this._activeVoices.shift()
      this._stopVoice(oldest, now)
    }
    
    const osc1 = this._ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = pitch
    
    const osc2 = this._ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = pitch * 2
    
    const gain1 = this._ctx.createGain()
    gain1.gain.value = 1.0 - (this._brightness * 0.5) // balance 
    
    const gain2 = this._ctx.createGain()
    gain2.gain.value = this._brightness
    
    const noteGain = this._ctx.createGain()
    noteGain.gain.setValueAtTime(0, now)
    noteGain.gain.linearRampToValueAtTime(velocity, now + 0.05) // quick attack
    noteGain.gain.exponentialRampToValueAtTime(0.001, now + sustain)
    
    osc1.connect(gain1)
    osc2.connect(gain2)
    gain1.connect(noteGain)
    gain2.connect(noteGain)
    noteGain.connect(this._output)
    
    osc1.start(now)
    osc2.start(now)
    
    const voice = { osc1, osc2, noteGain, gain1, gain2 }
    this._activeVoices.push(voice)
    
    // Self cleanup
    const stopTime = now + sustain + 0.1
    osc1.stop(stopTime)
    osc2.stop(stopTime)
    
    setTimeout(() => {
      const idx = this._activeVoices.indexOf(voice)
      if (idx !== -1) {
        this._activeVoices.splice(idx, 1)
      }
      try {
        osc1.disconnect()
        osc2.disconnect()
        noteGain.disconnect()
        gain1.disconnect()
        gain2.disconnect()
      } catch (e) {
        // Ignore if already disconnected
      }
    }, (sustain + 0.2) * 1000)
    
    return { frequency: pitch, velocity, sustain }
  }
  
  _stopVoice(voice, time) {
    voice.noteGain.gain.cancelScheduledValues(time)
    voice.noteGain.gain.setTargetAtTime(0, time, 0.05)
    voice.osc1.stop(time + 0.2)
    voice.osc2.stop(time + 0.2)
  }

  setPitch(v) { this._pitch = Math.max(20, Math.min(20000, v)) }
  setSustain(v) { this._sustain = Math.max(0.1, v) }
  setBrightness(v) { this._brightness = Math.max(0, Math.min(1, v)) }
  
  setAutoRate(v) {
    this._autoRate = Math.max(0, v)
    this._scheduleAutoTrigger()
  }
  
  setScatter(v) { this._scatter = Math.max(0, Math.min(1, v)) }
  setScale(name) { this._scale = name }
  
  setVolume(v) {
    const clamp = Math.max(0, Math.min(1, v))
    this._output.gain.setTargetAtTime(clamp, this._ctx.currentTime, 0.05)
  }
  
  destroy() {
    if (this._autoTimer) {
      clearTimeout(this._autoTimer)
      this._autoTimer = null
    }
    
    const now = this._ctx.currentTime
    this._output.gain.setTargetAtTime(0, now, 0.05)
    
    for (const voice of this._activeVoices) {
      this._stopVoice(voice, now)
    }
    this._activeVoices = []
    
    setTimeout(() => {
      try {
        this._output.disconnect()
      } catch (e) {}
    }, 100)
  }
}
