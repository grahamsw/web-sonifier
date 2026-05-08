/**
 * GeigerSonifier
 *
 * A sonifier that simulates a Geiger counter. Emits random "clicks" (noise bursts)
 * where the average frequency is controlled by a 'rate' parameter.
 *
 * Parameters:
 *   rate   - average clicks per second (0..1000)
 *   volume - gain of this sonifier (0..1)
 */

import { SonifierBase } from '@web-sonify/core'

export class GeigerSonifier extends SonifierBase {

  getParamSchema() {
    return [
      {
        name: 'rate',
        type: 'number',
        range: [0, 1000],
        default: 10,
        group: 'geiger',
        label: 'Rate',
        description: 'Average clicks per second'
      },
      {
        name: 'volume',
        type: 'number',
        range: [0, 1],
        default: 0.5,
        group: 'geiger',
        label: 'Volume',
        description: 'Volume of the clicks'
      }
    ]
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._output = outputNode

    // Internal gain for this sonifier
    this._gainNode = audioContext.createGain()
    this._gainNode.gain.value = 0 // setParam(volume) will update this
    this._gainNode.connect(outputNode)

    // Pre-calculate the click sound (short burst of white noise)
    this._clickBuffer = this._createClickBuffer()

    // Scheduler state
    this._nextClickTime = audioContext.currentTime
    this._timer = null
    this._lookahead = 0.1        // How far ahead to schedule (seconds)
    this._scheduleInterval = 25   // How often to check for new scheduling (ms)

    this._schedule()
  }

  onParam(name, value) {
    if (name === 'volume' && this._gainNode) {
      this._gainNode.gain.setTargetAtTime(value, this._ctx.currentTime, 0.01)
    }
    // 'rate' is used dynamically in the _schedule loop
  }

  destroy() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    if (this._gainNode) {
      this._gainNode.disconnect()
      this._gainNode = null
    }
    this._ctx = null
    this._clickBuffer = null
  }

  /**
   * Generates a short white noise buffer with an exponential decay.
   * @private
   */
  _createClickBuffer() {
    const duration = 0.005 // 5ms
    const sampleRate = this._ctx.sampleRate
    const frameCount = sampleRate * duration
    const buffer = this._ctx.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < frameCount; i++) {
      const t = i / frameCount
      const decay = Math.exp(-t * 15) // sharp decay
      data[i] = (Math.random() * 2 - 1) * decay
    }
    return buffer
  }

  /**
   * The lookahead scheduling loop.
   * @private
   */
  _schedule() {
    if (!this._ctx) return

    const now = this._ctx.currentTime
    const rate = this.getParam('rate') || 0

    // Schedule any clicks that fall within the lookahead window
    // We use a Poisson process: the interval between events follows an exponential distribution.
    while (rate > 0 && this._nextClickTime < now + this._lookahead) {
      this._playClick(this._nextClickTime)

      // Time to next click: -ln(U) / rate, where U is a uniform random (0, 1]
      const u = Math.max(0.0001, Math.random())
      const delta = -Math.log(u) / rate
      this._nextClickTime += delta
    }

    // If rate is 0 or extremely low, keep the next click time moving forward
    // to avoid a burst when the rate is suddenly increased.
    if (rate <= 0 || this._nextClickTime < now) {
      this._nextClickTime = now + this._lookahead
    }

    this._timer = setTimeout(() => this._schedule(), this._scheduleInterval)
  }

  /**
   * Plays a single click at the designated time.
   * @private
   */
  _playClick(time) {
    const source = this._ctx.createBufferSource()
    source.buffer = this._clickBuffer
    source.connect(this._gainNode)
    // Scheduling for the exact time in the future provided by the audio context
    source.start(time)
  }
}
