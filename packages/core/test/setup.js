import { vi } from 'vitest'

/**
 * A minimal mock of the Web Audio API for testing in Node.js
 */

export class AudioParamMock {
  constructor() {
    this.value = 0
  }
  setTargetAtTime(value, startTime, timeConstant) {
    this.value = value
  }
}

export class GainNodeMock {
  constructor() {
    this.gain = new AudioParamMock()
  }
  connect() {}
  disconnect() {}
}

export class OscillatorNodeMock {
  constructor() {
    this.frequency = new AudioParamMock()
    this.type = 'sine'
  }
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}

export class AudioBufferMock {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels
    this.length = length
    this.sampleRate = sampleRate
    this._data = new Float32Array(length)
  }
  getChannelData() {
    return this._data
  }
}

export class AudioContextMock {
  constructor() {
    this.currentTime = 0
    this.sampleRate = 44100
  }
  createGain() { return new GainNodeMock() }
  createOscillator() { return new OscillatorNodeMock() }
  createBuffer(channels, length, sampleRate) {
    return new AudioBufferMock(channels, length, sampleRate)
  }
  createBufferSource() {
    return {
      buffer: null,
      connect: () => {},
      start: () => {},
      stop: () => {},
      disconnect: () => {}
    }
  }
  suspend() { return Promise.resolve() }
  resume() { return Promise.resolve() }
}

globalThis.AudioContext = AudioContextMock
