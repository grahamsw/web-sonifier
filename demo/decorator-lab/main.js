/**
 * Decorator & Pipeline Lab Controller
 *
 * Provides real-time bidirectional visual and textual inspection of:
 * 1. Continuous Musical Tuning: Adapter curves & musical pitch quantization (Scales & Harmonics).
 * 2. Temporal Event Scatter: De-quantizing batch event counts across time using EventScatterAdapter.
 * 3. Advanced Signal Processing Drawer: Optional telemetry filtering & calculus transforms (EMA, SMA, Delta).
 */

import { Adapter, Transforms, Quantize, Scales, EventScatterAdapter } from '@web-sonifier/core'

// ---------------------------------------------------------------------------
// Pipeline & Simulation State
// ---------------------------------------------------------------------------

export const state = {
  activeMode: 'tuning', // 'tuning' | 'temporal'
  feed: {
    id: 'traffic_rps',
    value: 50.0,
    range: [0, 100],
    profile: 'brownian',
    rate: 30, // Hz
    noise: 0.35,
    scrubOverride: false
  },
  mapping: {
    target: {
      objectId: 'chimes',
      param: 'pitch',
      unit: 'Hz'
    },
    adapter: {
      inputRange: [0, 100],
      outputRange: [220, 880],
      curve: 'exponential',
      invert: false,
      tuningMode: 'scale', // 'scale' | 'harmonics' | 'none'
      scale: 'pentatonic', // 'pentatonic' | 'minorPentatonic' | 'hirajoshi' | 'dorian' | 'wholeTone' | 'major' | 'minor'
      rootFreq: 220,
      fundamental: 110,
      decorators: ['ema:0.25']
    }
  },
  temporal: {
    eventCount: 5,
    windowSeconds: 10,
    strategy: 'poisson', // 'poisson' | 'random' | 'uniform'
    autoRepeat: true,
    scheduledEvents: [], // [{ id, offsetMs, fired }]
    windowStartTime: 0,
    firedCount: 0
  },
  audio: {
    active: false,
    mode: 'decorated', // 'decorated' | 'raw'
    voice: 'sine',     // 'sine' | 'triangle' | 'chime'
    volume: 0.60
  },
  scope: {
    paused: false,
    bufferSize: 300,
    history: [] // { raw, scaled, decorated, time }
  }
}

// ---------------------------------------------------------------------------
// Decorator Resolvers & Helpers
// ---------------------------------------------------------------------------

export function resolveDecoratorTransformer(decToken) {
  if (typeof decToken !== 'string') return null

  // 1. Musical Scales (Direct Scale Quantization)
  if (decToken === 'quantize:pentatonic' || decToken === 'quantizePentatonic') {
    return Quantize.scale(Scales.pentatonic)
  }
  if (decToken === 'quantize:minorPentatonic' || decToken === 'quantizeMinorPentatonic') {
    return Quantize.scale(Scales.minorPentatonic)
  }
  if (decToken === 'quantize:hirajoshi' || decToken === 'quantizeHirajoshi') {
    return Quantize.scale(Scales.hirajoshi)
  }
  if (decToken === 'quantize:dorian' || decToken === 'quantizeDorian') {
    return Quantize.scale(Scales.dorian)
  }
  if (decToken === 'quantize:wholeTone' || decToken === 'quantizeWholeTone') {
    return Quantize.scale(Scales.wholeTone)
  }
  if (decToken === 'quantize:major' || decToken === 'quantizeMajor') {
    return Quantize.scale(Scales.major)
  }
  if (decToken === 'quantize:minor' || decToken === 'quantizeMinor') {
    return Quantize.scale(Scales.minor)
  }

  // 2. Harmonic Series Overtones
  if (decToken.startsWith('harmonics:') || decToken === 'harmonics') {
    const parts = decToken.split(':')
    const fund = parts.length > 1 ? parseFloat(parts[1]) : 100
    return Quantize.harmonics(isNaN(fund) ? 100 : fund)
  }

  // 3. Math & Discrete
  if (decToken === 'round' || decToken === 'integer') {
    return Math.round
  }

  // 4. Advanced Signal Conditioning (Stateful Transforms)
  if (decToken === 'ema' || decToken.startsWith('ema:')) {
    const parts = decToken.split(':')
    const alpha = parts.length > 1 ? parseFloat(parts[1]) : 0.25
    return Transforms.ema(isNaN(alpha) ? 0.25 : alpha)
  }
  if (decToken === 'sma' || decToken.startsWith('sma:')) {
    const parts = decToken.split(':')
    const win = parts.length > 1 ? parseInt(parts[1], 10) : 5
    return Transforms.sma(isNaN(win) ? 5 : win)
  }
  if (decToken === 'delta') {
    return Transforms.delta()
  }
  if (decToken === 'accumulate') {
    return Transforms.accumulate()
  }
  if (decToken.startsWith('threshold:')) {
    const parts = decToken.split(':')
    const thresh = parseFloat(parts[1])
    return Transforms.threshold({ threshold: isNaN(thresh) ? 50 : thresh })
  }

  return null
}

export function parseDecoratorToken(decToken) {
  const [name, arg] = decToken.split(':')
  return { name, arg, raw: decToken }
}

// ---------------------------------------------------------------------------
// Pipeline Factory & Execution
// ---------------------------------------------------------------------------

let activeDecoratedAdapter = null
let activeRawAdapter = null

export function rebuildPipelineAdapters() {
  const { adapter } = state.mapping

  // 1. Raw adapter without decorators or tuning
  activeRawAdapter = new Adapter({
    param: state.mapping.target.param,
    inputRange: [...adapter.inputRange],
    outputRange: [...adapter.outputRange],
    curve: adapter.curve,
    invert: adapter.invert
  })

  // 2. Full pipeline adapter
  activeDecoratedAdapter = new Adapter({
    param: state.mapping.target.param,
    inputRange: [...adapter.inputRange],
    outputRange: [...adapter.outputRange],
    curve: adapter.curve,
    invert: adapter.invert
  })

  // A. Advanced Signal Conditioning filters
  if (Array.isArray(adapter.decorators)) {
    for (const dec of adapter.decorators) {
      const fn = resolveDecoratorTransformer(dec)
      if (fn) {
        activeDecoratedAdapter.pipe(fn)
      }
    }
  }

  // B. Musical Tuning Quantization
  if (adapter.tuningMode === 'scale') {
    const scaleDegrees = Scales[adapter.scale] || Scales.pentatonic
    const root = Number(adapter.rootFreq) || 220
    activeDecoratedAdapter.pipe(Quantize.scale(scaleDegrees, { rootFreq: root }))
  } else if (adapter.tuningMode === 'harmonics') {
    const fund = Number(adapter.fundamental) || 110
    activeDecoratedAdapter.pipe(Quantize.harmonics(fund))
  }
}

// ---------------------------------------------------------------------------
// Telemetry Feed Simulator
// ---------------------------------------------------------------------------

let simTimer = null
let sinePhase = 0
let stepTimer = 0
let lastStepVal = 50

export function tickFeedSimulator() {
  if (state.feed.scrubOverride) {
    return state.feed.value
  }

  const noise = (Math.random() - 0.5) * 2 * state.feed.noise * 12

  switch (state.feed.profile) {
    case 'brownian': {
      let next = state.feed.value + (Math.random() - 0.5) * 6 * (state.feed.noise + 0.1)
      if (next < 0) next = Math.abs(next)
      if (next > 100) next = 100 - (next - 100)
      state.feed.value = Math.max(0, Math.min(100, next))
      break
    }
    case 'sine': {
      sinePhase += 0.05
      const base = 50 + 35 * Math.sin(sinePhase)
      state.feed.value = Math.max(0, Math.min(100, base + noise))
      break
    }
    case 'step': {
      stepTimer++
      if (stepTimer % 45 === 0) {
        lastStepVal = Math.floor(Math.random() * 8) * 12.5 + 5
      }
      state.feed.value = Math.max(0, Math.min(100, lastStepVal + noise * 0.2))
      break
    }
    case 'spikes': {
      if (Math.random() < 0.08) {
        state.feed.value = Math.min(100, 30 + Math.random() * 65)
      } else {
        state.feed.value += (15 - state.feed.value) * 0.15
      }
      break
    }
    case 'ramp': {
      let next = state.feed.value + 0.8
      if (next > 100) next = 0
      state.feed.value = next
      break
    }
  }

  return state.feed.value
}

// ---------------------------------------------------------------------------
// Real-Time Audio Engine (Web Audio)
// ---------------------------------------------------------------------------

let audioCtx = null
let oscNode = null
let gainNode = null

export function initAudioEngine() {
  if (audioCtx) return
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  audioCtx = new AudioContextClass()

  gainNode = audioCtx.createGain()
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime)
  gainNode.connect(audioCtx.destination)

  oscNode = audioCtx.createOscillator()
  oscNode.type = state.audio.voice === 'triangle' ? 'triangle' : 'sine'
  oscNode.frequency.setValueAtTime(440, audioCtx.currentTime)
  oscNode.connect(gainNode)
  oscNode.start()
}

export function updateAudioAudition(targetValue) {
  if (!audioCtx || !state.audio.active) return

  const now = audioCtx.currentTime
  const targetGain = state.audio.volume
  gainNode.gain.setTargetAtTime(targetGain, now, 0.02)

  // Clamp frequency to safe audible bounds
  const pitch = Math.max(20, Math.min(4000, targetValue))
  oscNode.frequency.setTargetAtTime(pitch, now, 0.015)
}

export function muteAudioAudition() {
  if (!audioCtx || !gainNode) return
  gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02)
}

export function triggerStrikeAudio(pitch = 587.33, velocity = 0.7) {
  if (!audioCtx || !state.audio.active) return
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }

  const t = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const strikeGain = audioCtx.createGain()

  osc.type = state.audio.voice === 'triangle' ? 'triangle' : 'sine'
  osc.frequency.setValueAtTime(pitch, t)

  const vol = (state.audio.volume || 0.6) * velocity
  strikeGain.gain.setValueAtTime(vol, t)
  strikeGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)

  osc.connect(strikeGain)
  strikeGain.connect(audioCtx.destination)

  osc.start(t)
  osc.stop(t + 0.5)
}

// ---------------------------------------------------------------------------
// Oscilloscope & Visualization
// ---------------------------------------------------------------------------

export function recordScopeSample(raw, scaled, decorated) {
  if (state.scope.paused) return

  const [outMin, outMax] = state.mapping.adapter.outputRange
  const span = Math.max(0.0001, outMax - outMin)

  const rawNorm = (raw - state.feed.range[0]) / (state.feed.range[1] - state.feed.range[0])
  const scaledNorm = (scaled - outMin) / span
  const decoratedNorm = (decorated - outMin) / span

  state.scope.history.push({
    rawNorm: Math.max(0, Math.min(1, rawNorm)),
    scaledNorm: Math.max(0, Math.min(1, scaledNorm)),
    decoratedNorm: Math.max(0, Math.min(1, decoratedNorm)),
    time: Date.now()
  })

  if (state.scope.history.length > state.scope.bufferSize) {
    state.scope.history.shift()
  }
}

export function drawScopeCanvas(canvas) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const width = canvas.width
  const height = canvas.height

  ctx.clearRect(0, 0, width, height)

  // Grid background
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)'
  ctx.lineWidth = 1
  for (let y = 0.25; y < 1; y += 0.25) {
    ctx.beginPath()
    ctx.moveTo(0, y * height)
    ctx.lineTo(width, y * height)
    ctx.stroke()
  }

  const history = state.scope.history
  if (history.length < 2) return

  const stepX = width / (state.scope.bufferSize - 1)
  const startX = width - (history.length - 1) * stepX

  // 1. Raw Input (Grey dashed)
  ctx.save()
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  history.forEach((pt, i) => {
    const x = startX + i * stepX
    const y = height - (pt.rawNorm * (height - 16) + 8)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.restore()

  // 2. Scaled / Pre-Decorated (Cyan solid)
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 1.75
  ctx.beginPath()
  history.forEach((pt, i) => {
    const x = startX + i * stepX
    const y = height - (pt.scaledNorm * (height - 16) + 8)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  // 3. Decorated & Musically Tuned Output (Emerald stepped)
  ctx.strokeStyle = '#10b981'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  history.forEach((pt, i) => {
    const x = startX + i * stepX
    const y = height - (pt.decoratedNorm * (height - 16) + 8)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// Temporal Event Scatter Engine & Timeline Canvas
// ---------------------------------------------------------------------------

let temporalScatterAdapter = null

export function initTemporalScatter() {
  if (temporalScatterAdapter) {
    temporalScatterAdapter.cancel()
  }

  state.temporal.firedCount = 0
  temporalScatterAdapter = new EventScatterAdapter({
    windowSeconds: state.temporal.windowSeconds,
    strategy: state.temporal.strategy,
    onTrigger: (evt) => {
      if (state.temporal.scheduledEvents[evt.index]) {
        state.temporal.scheduledEvents[evt.index].fired = true
      }
      state.temporal.firedCount++
      updateTemporalStats()

      // Crisp strike audio with modal harmonic offset
      const pentNotes = [440, 493.88, 554.37, 659.25, 739.99]
      const pitch = pentNotes[evt.index % pentNotes.length] || 440
      triggerStrikeAudio(pitch, 0.75)
    }
  })
}

export function feedTemporalBatch() {
  initTemporalScatter()
  const offsets = temporalScatterAdapter.feed(state.temporal.eventCount)
  state.temporal.windowStartTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
  state.temporal.scheduledEvents = offsets.map((ms, idx) => ({
    id: idx,
    offsetMs: ms,
    fired: false
  }))
  updateTemporalStats()
}

export function updateTemporalStats() {
  if (typeof document === 'undefined') return
  const pendingEl = document.getElementById('stat-pending-events')
  const firedEl = document.getElementById('stat-fired-events')
  const total = state.temporal.scheduledEvents.length
  const fired = state.temporal.firedCount
  const pending = Math.max(0, total - fired)

  if (pendingEl) pendingEl.textContent = `Pending: ${pending}`
  if (firedEl) firedEl.textContent = `Fired: ${fired}`
}

export function renderTemporalTimeline(canvas) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const width = canvas.width
  const height = canvas.height

  ctx.clearRect(0, 0, width, height)

  const windowMs = state.temporal.windowSeconds * 1000
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const elapsedMs = now - (state.temporal.windowStartTime || now)
  const progress = Math.min(1, Math.max(0, elapsedMs / windowMs))

  // 1. Grid ticks (every 1 second)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)'
  ctx.lineWidth = 1
  const numSeconds = state.temporal.windowSeconds
  for (let s = 0; s <= numSeconds; s++) {
    const x = (s / numSeconds) * (width - 40) + 20
    ctx.beginPath()
    ctx.moveTo(x, 15)
    ctx.lineTo(x, height - 20)
    ctx.stroke()

    ctx.fillStyle = '#64748b'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${s}s`, x, height - 6)
  }

  // 2. Timeline Center Track
  const trackY = height / 2 - 4
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(20, trackY)
  ctx.lineTo(width - 20, trackY)
  ctx.stroke()

  // 3. Render Scheduled Event Beads
  state.temporal.scheduledEvents.forEach(evt => {
    const beadNorm = Math.min(1, Math.max(0, evt.offsetMs / windowMs))
    const beadX = 20 + beadNorm * (width - 40)

    if (evt.fired) {
      // Emerald glowing pulse
      ctx.fillStyle = '#10b981'
      ctx.shadowColor = '#10b981'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(beadX, trackY, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    } else {
      // Cyan scheduled bead
      ctx.fillStyle = '#38bdf8'
      ctx.shadowColor = '#38bdf8'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(beadX, trackY, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  })

  // 4. Playhead Laser (Red/Rose)
  const playheadX = 20 + progress * (width - 40)
  ctx.strokeStyle = '#f43f5e'
  ctx.lineWidth = 2.5
  ctx.shadowColor = '#f43f5e'
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.moveTo(playheadX, 10)
  ctx.lineTo(playheadX, height - 16)
  ctx.stroke()
  ctx.shadowBlur = 0

  // 5. Auto-repeat check
  if (progress >= 1 && state.temporal.autoRepeat && state.activeMode === 'temporal') {
    feedTemporalBatch()
  }
}

// ---------------------------------------------------------------------------
// Code & JSON Generation (Bidirectional Synchronization)
// ---------------------------------------------------------------------------

export function generateMappingsJson() {
  if (state.activeMode === 'temporal') {
    const doc = {
      version: 1,
      name: 'Temporal Event Scatter Pipeline',
      feedSpecId: 'batch-events',
      mappings: [
        {
          feedId: 'user_signups',
          type: 'event-scatter',
          target: {
            objectId: 'chimes',
            action: 'strike',
            param: 'velocity'
          },
          adapter: {
            windowSeconds: state.temporal.windowSeconds,
            strategy: state.temporal.strategy,
            maxEventsPerWindow: 50
          }
        }
      ]
    }
    return JSON.stringify(doc, null, 2)
  }

  // Continuous Tuning Mode
  const { adapter, target } = state.mapping
  const doc = {
    version: 1,
    name: 'Continuous Musical Tuning Specification',
    feedSpecId: 'telemetry-stream',
    mappings: [
      {
        feedId: state.feed.id,
        target: {
          objectId: target.objectId,
          param: target.param
        },
        adapter: {
          inputRange: [...adapter.inputRange],
          outputRange: [...adapter.outputRange],
          curve: adapter.curve,
          invert: adapter.invert,
          tuning: {
            mode: adapter.tuningMode,
            scale: adapter.tuningMode === 'scale' ? adapter.scale : undefined,
            rootFreq: adapter.tuningMode === 'scale' ? adapter.rootFreq : undefined,
            fundamental: adapter.tuningMode === 'harmonics' ? adapter.fundamental : undefined
          },
          decorators: [...adapter.decorators]
        }
      }
    ]
  }
  return JSON.stringify(doc, null, 2)
}

export function generateFluentJsCode() {
  if (state.activeMode === 'temporal') {
    return `import { EventScatterAdapter } from '@web-sonifier/core'

// 1. Configure Temporal De-Quantizer Adapter
const scatterAdapter = new EventScatterAdapter({
  windowSeconds: ${state.temporal.windowSeconds},
  strategy: '${state.temporal.strategy}',
  onTrigger: (event) => {
    // Fires as each scattered event triggers across the window
    sonifier.strike({
      velocity: 0.75,
      pitch: 587.33 // D5 chime
    })
  }
})

// 2. Feed Batch Event Counts (e.g. ${state.temporal.eventCount} signups)
scatterAdapter.feed(${state.temporal.eventCount})`
  }

  // Tuning Mode
  const { adapter, target } = state.mapping
  const pipes = []

  // Advanced SP filters
  if (Array.isArray(adapter.decorators)) {
    adapter.decorators.forEach(dec => {
      if (dec.startsWith('ema')) {
        const alpha = dec.includes(':') ? dec.split(':')[1] : '0.25'
        pipes.push(`  .pipe(Transforms.ema(${alpha}))`)
      } else if (dec.startsWith('sma')) {
        const win = dec.includes(':') ? dec.split(':')[1] : '5'
        pipes.push(`  .pipe(Transforms.sma(${win}))`)
      } else if (dec === 'delta') {
        pipes.push(`  .pipe(Transforms.delta())`)
      } else if (dec === 'accumulate') {
        pipes.push(`  .pipe(Transforms.accumulate())`)
      } else if (dec.startsWith('threshold:')) {
        const thresh = dec.split(':')[1]
        pipes.push(`  .pipe(Transforms.threshold({ threshold: ${thresh} }))`)
      } else if (dec === 'round') {
        pipes.push(`  .pipe(Math.round)`)
      }
    })
  }

  // Musical Tuning
  if (adapter.tuningMode === 'scale') {
    pipes.push(`  .pipe(Quantize.scale(Scales.${adapter.scale || 'pentatonic'}, { rootFreq: ${adapter.rootFreq || 220} }))`)
  } else if (adapter.tuningMode === 'harmonics') {
    pipes.push(`  .pipe(Quantize.harmonics(${adapter.fundamental || 110}))`)
  }

  const decPipes = pipes.length ? pipes.join('\n') + '\n' : ''

  return `import { Adapter, Transforms, Quantize, Scales } from '@web-sonifier/core'

// 1. Configure Adapter with Range, Curve & Musical Tuning
const ${target.param}Adapter = new Adapter({
  param: '${target.param}',
  inputRange: [${adapter.inputRange.join(', ')}],
  outputRange: [${adapter.outputRange.join(', ')}],
  curve: '${adapter.curve}',
  invert: ${adapter.invert}
})
${decPipes}
// 2. Feed Live Values
function onFeedTick(rawTelemetry) {
  const audioVal = ${target.param}Adapter.map(rawTelemetry)
  sonifier.setParam('${target.param}', audioVal)
}`
}

export function applyMappingsJson(jsonStr) {
  const parsed = JSON.parse(jsonStr)
  const mapEntry = Array.isArray(parsed.mappings) ? parsed.mappings[0] : null
  if (!mapEntry || !mapEntry.adapter) {
    throw new Error('Invalid mappings document: expected mappings array with adapter')
  }

  const { adapter, target, feedId, type } = mapEntry

  if (type === 'event-scatter') {
    state.activeMode = 'temporal'
    if (adapter.windowSeconds) state.temporal.windowSeconds = adapter.windowSeconds
    if (adapter.strategy) state.temporal.strategy = adapter.strategy
  } else {
    state.activeMode = 'tuning'
    if (feedId) state.feed.id = feedId
    if (target && target.param) state.mapping.target.param = target.param
    if (target && target.objectId) state.mapping.target.objectId = target.objectId

    if (Array.isArray(adapter.inputRange)) state.mapping.adapter.inputRange = [...adapter.inputRange]
    if (Array.isArray(adapter.outputRange)) state.mapping.adapter.outputRange = [...adapter.outputRange]
    if (adapter.curve) state.mapping.adapter.curve = adapter.curve
    if (typeof adapter.invert === 'boolean') state.mapping.adapter.invert = adapter.invert

    if (adapter.tuning) {
      if (adapter.tuning.mode) state.mapping.adapter.tuningMode = adapter.tuning.mode
      if (adapter.tuning.scale) state.mapping.adapter.scale = adapter.tuning.scale
      if (adapter.tuning.rootFreq) state.mapping.adapter.rootFreq = adapter.tuning.rootFreq
      if (adapter.tuning.fundamental) state.mapping.adapter.fundamental = adapter.tuning.fundamental
    }
    if (Array.isArray(adapter.decorators)) state.mapping.adapter.decorators = [...adapter.decorators]
  }

  rebuildPipelineAdapters()
  syncUiFromState()
}

// ---------------------------------------------------------------------------
// Preset Configurations
// ---------------------------------------------------------------------------

export const PRESETS = {
  'smooth-pitch': {
    inputRange: [0, 100],
    outputRange: [220, 880],
    curve: 'exponential',
    invert: false,
    tuningMode: 'scale',
    scale: 'pentatonic',
    rootFreq: 220,
    decorators: ['ema:0.25'],
    profile: 'brownian',
    voice: 'sine'
  },
  'hirajoshi-walk': {
    inputRange: [0, 100],
    outputRange: [180, 720],
    curve: 'exponential',
    invert: false,
    tuningMode: 'scale',
    scale: 'hirajoshi',
    rootFreq: 180,
    decorators: ['ema:0.18'],
    profile: 'sine',
    voice: 'triangle'
  },
  'delta-velocity': {
    inputRange: [-10, 10],
    outputRange: [100, 1500],
    curve: 'linear',
    invert: false,
    tuningMode: 'none',
    decorators: ['delta', 'ema:0.35'],
    profile: 'step',
    voice: 'sine'
  },
  'accumulator': {
    inputRange: [0, 500],
    outputRange: [80, 600],
    curve: 'logarithmic',
    invert: false,
    tuningMode: 'none',
    decorators: ['accumulate'],
    profile: 'brownian',
    voice: 'sine'
  },
  'moving-average': {
    inputRange: [0, 100],
    outputRange: [200, 800],
    curve: 'linear',
    invert: false,
    tuningMode: 'none',
    decorators: ['sma:5'],
    profile: 'brownian',
    voice: 'sine'
  },
  'threshold-gate': {
    inputRange: [0, 100],
    outputRange: [300, 1200],
    curve: 'exponential',
    invert: false,
    tuningMode: 'scale',
    scale: 'pentatonic',
    rootFreq: 300,
    decorators: ['threshold:65'],
    profile: 'spikes',
    voice: 'sine'
  }
}

// ---------------------------------------------------------------------------
// DOM Sync & Event Wireup
// ---------------------------------------------------------------------------

export function renderDecoratorChips(container, onUpdate) {
  if (!container) return
  container.innerHTML = ''

  state.mapping.adapter.decorators.forEach((token, index) => {
    const chip = document.createElement('div')
    chip.className = 'decorator-chip'
    chip.dataset.index = String(index)

    const meta = parseDecoratorToken(token)

    let icon = '🏷️'
    let label = meta.name
    let argControl = null

    if (meta.name === 'ema') {
      icon = '📈'
      label = 'EMA'
      const input = document.createElement('input')
      input.type = 'number'
      input.step = '0.05'
      input.min = '0.01'
      input.max = '0.99'
      input.value = meta.arg || '0.25'
      input.className = 'chip-arg-input'
      input.title = 'Smoothing factor alpha (0.01 = sluggish, 0.99 = fast)'
      input.addEventListener('change', () => {
        const val = parseFloat(input.value) || 0.25
        state.mapping.adapter.decorators[index] = `ema:${val}`
        onUpdate()
      })
      argControl = input
    } else if (meta.name === 'sma') {
      icon = '📊'
      label = 'SMA'
      const input = document.createElement('input')
      input.type = 'number'
      input.step = '1'
      input.min = '2'
      input.max = '20'
      input.value = meta.arg || '5'
      input.className = 'chip-arg-input'
      input.title = 'Window size (samples)'
      input.addEventListener('change', () => {
        const val = parseInt(input.value, 10) || 5
        state.mapping.adapter.decorators[index] = `sma:${val}`
        onUpdate()
      })
      argControl = input
    } else if (meta.name === 'quantize') {
      icon = '🪜'
      label = 'Scale'
      const select = document.createElement('select')
      select.className = 'chip-arg-select'
      const scales = ['pentatonic', 'minorPentatonic', 'hirajoshi', 'dorian', 'wholeTone', 'major', 'minor']
      scales.forEach(s => {
        const opt = document.createElement('option')
        opt.value = s
        opt.textContent = s
        if (s === meta.arg) opt.selected = true
        select.appendChild(opt)
      })
      select.addEventListener('change', () => {
        state.mapping.adapter.decorators[index] = `quantize:${select.value}`
        onUpdate()
      })
      argControl = select
    } else if (meta.name === 'delta') {
      icon = '⚡'
      label = 'Delta (Rate)'
    } else if (meta.name === 'accumulate') {
      icon = '🌊'
      label = 'Accumulate'
    } else if (meta.name === 'threshold') {
      icon = '🚧'
      label = 'Threshold'
      const input = document.createElement('input')
      input.type = 'number'
      input.value = meta.arg || '50'
      input.className = 'chip-arg-input'
      input.addEventListener('change', () => {
        state.mapping.adapter.decorators[index] = `threshold:${input.value}`
        onUpdate()
      })
      argControl = input
    } else if (meta.name === 'round') {
      icon = '🔢'
      label = 'Round'
    }

    chip.innerHTML = `
      <div class="chip-meta">
        <span class="chip-icon">${icon}</span>
        <span class="chip-title">${label}</span>
      </div>
    `

    if (argControl) {
      chip.querySelector('.chip-meta').appendChild(argControl)
    }

    const actions = document.createElement('div')
    actions.className = 'chip-actions'

    if (index > 0) {
      const btnUp = document.createElement('button')
      btnUp.type = 'button'
      btnUp.className = 'btn-chip-reorder'
      btnUp.textContent = '◀'
      btnUp.title = 'Move Earlier in Pipeline'
      btnUp.addEventListener('click', () => {
        const temp = state.mapping.adapter.decorators[index]
        state.mapping.adapter.decorators[index] = state.mapping.adapter.decorators[index - 1]
        state.mapping.adapter.decorators[index - 1] = temp
        onUpdate()
      })
      actions.appendChild(btnUp)
    }

    if (index < state.mapping.adapter.decorators.length - 1) {
      const btnDown = document.createElement('button')
      btnDown.type = 'button'
      btnDown.className = 'btn-chip-reorder'
      btnDown.textContent = '▶'
      btnDown.title = 'Move Later in Pipeline'
      btnDown.addEventListener('click', () => {
        const temp = state.mapping.adapter.decorators[index]
        state.mapping.adapter.decorators[index] = state.mapping.adapter.decorators[index + 1]
        state.mapping.adapter.decorators[index + 1] = temp
        onUpdate()
      })
      actions.appendChild(btnDown)
    }

    const btnRemove = document.createElement('button')
    btnRemove.type = 'button'
    btnRemove.className = 'btn-chip-remove'
    btnRemove.textContent = '✖'
    btnRemove.title = 'Remove Filter'
    btnRemove.addEventListener('click', () => {
      state.mapping.adapter.decorators.splice(index, 1)
      onUpdate()
    })
    actions.appendChild(btnRemove)

    chip.appendChild(actions)
    container.appendChild(chip)
  })
}

export function syncUiFromState() {
  if (typeof document === 'undefined') return

  // 0. Active Mode Tab Switcher
  const tabTuning = document.getElementById('tab-mode-tuning')
  const tabTemporal = document.getElementById('tab-mode-temporal')
  const panelTuning = document.getElementById('mode-panel-tuning')
  const panelTemporal = document.getElementById('mode-panel-temporal')

  if (state.activeMode === 'tuning') {
    if (tabTuning) tabTuning.classList.add('active')
    if (tabTemporal) tabTemporal.classList.remove('active')
    if (panelTuning) panelTuning.style.display = 'block'
    if (panelTemporal) panelTemporal.style.display = 'none'
  } else {
    if (tabTemporal) tabTemporal.classList.add('active')
    if (tabTuning) tabTuning.classList.remove('active')
    if (panelTemporal) panelTemporal.style.display = 'block'
    if (panelTuning) panelTuning.style.display = 'none'
  }

  // 1. Adapter inputs
  const inMin = document.getElementById('adapter-in-min')
  const inMax = document.getElementById('adapter-in-max')
  const outMin = document.getElementById('adapter-out-min')
  const outMax = document.getElementById('adapter-out-max')
  const curve = document.getElementById('adapter-curve')
  const invert = document.getElementById('adapter-invert')

  if (inMin) inMin.value = state.mapping.adapter.inputRange[0]
  if (inMax) inMax.value = state.mapping.adapter.inputRange[1]
  if (outMin) outMin.value = state.mapping.adapter.outputRange[0]
  if (outMax) outMax.value = state.mapping.adapter.outputRange[1]
  if (curve) curve.value = state.mapping.adapter.curve
  if (invert) invert.checked = state.mapping.adapter.invert

  // 2. Musical Tuning Controls
  const tuningModeSelect = document.getElementById('tuning-mode-select')
  const scaleSelect = document.getElementById('tuning-scale-select')
  const rootFreqInput = document.getElementById('tuning-root-freq')
  const fundInput = document.getElementById('tuning-fundamental')

  const rowScale = document.getElementById('row-scale-select')
  const rowRoot = document.getElementById('row-root-freq')
  const rowFund = document.getElementById('row-harmonic-fund')

  if (tuningModeSelect) tuningModeSelect.value = state.mapping.adapter.tuningMode || 'scale'
  if (scaleSelect) scaleSelect.value = state.mapping.adapter.scale || 'pentatonic'
  if (rootFreqInput) rootFreqInput.value = state.mapping.adapter.rootFreq || 220
  if (fundInput) fundInput.value = state.mapping.adapter.fundamental || 110

  const mode = state.mapping.adapter.tuningMode || 'scale'
  if (rowScale) rowScale.style.display = mode === 'scale' ? 'flex' : 'none'
  if (rowRoot) rowRoot.style.display = mode === 'scale' ? 'flex' : 'none'
  if (rowFund) rowFund.style.display = mode === 'harmonics' ? 'flex' : 'none'

  // 3. Advanced Signal Processing Chips
  const chipsContainer = document.getElementById('decorator-chips-container')
  renderDecoratorChips(chipsContainer, () => {
    rebuildPipelineAdapters()
    syncUiFromState()
  })

  // 4. Temporal Event Scatter Controls
  const tempCount = document.getElementById('temporal-count')
  const dispTempCount = document.getElementById('disp-temporal-count')
  const tempWindow = document.getElementById('temporal-window')
  const dispTempWindow = document.getElementById('disp-temporal-window')
  const tempStrategy = document.getElementById('temporal-strategy')
  const tempAutoRepeat = document.getElementById('temporal-auto-repeat')

  if (tempCount) tempCount.value = state.temporal.eventCount
  if (dispTempCount) dispTempCount.textContent = `${state.temporal.eventCount} events`
  if (tempWindow) tempWindow.value = state.temporal.windowSeconds
  if (dispTempWindow) dispTempWindow.textContent = `${state.temporal.windowSeconds}s`
  if (tempStrategy) tempStrategy.value = state.temporal.strategy
  if (tempAutoRepeat) tempAutoRepeat.checked = state.temporal.autoRepeat

  updateTemporalStats()

  // 5. Code Drawer
  syncCodeDrawer()
}

export function syncCodeDrawer() {
  const jsonArea = document.getElementById('json-editor')
  const codeDisplay = document.getElementById('code-display')
  if (jsonArea) jsonArea.value = generateMappingsJson()
  if (codeDisplay) codeDisplay.textContent = generateFluentJsCode()
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initDecoratorLab() {
  if (typeof window === 'undefined') return

  rebuildPipelineAdapters()
  feedTemporalBatch()
  syncUiFromState()

  const scopeCanvas = document.getElementById('scope-canvas')
  if (scopeCanvas && scopeCanvas.parentElement) {
    const rect = scopeCanvas.parentElement.getBoundingClientRect()
    scopeCanvas.width = rect.width * (window.devicePixelRatio || 1)
    scopeCanvas.height = rect.height * (window.devicePixelRatio || 1)
  }

  const temporalCanvas = document.getElementById('temporal-canvas')
  if (temporalCanvas && temporalCanvas.parentElement) {
    const rect = temporalCanvas.parentElement.getBoundingClientRect()
    temporalCanvas.width = rect.width * (window.devicePixelRatio || 1)
    temporalCanvas.height = rect.height * (window.devicePixelRatio || 1)
  }

  // 0. Mode Navigation Buttons
  const tabTuning = document.getElementById('tab-mode-tuning')
  const tabTemporal = document.getElementById('tab-mode-temporal')
  if (tabTuning) {
    tabTuning.addEventListener('click', () => {
      state.activeMode = 'tuning'
      syncUiFromState()
    })
  }
  if (tabTemporal) {
    tabTemporal.addEventListener('click', () => {
      state.activeMode = 'temporal'
      syncUiFromState()
    })
  }

  // 1. Adapter inputs listeners
  const inMin = document.getElementById('adapter-in-min')
  const inMax = document.getElementById('adapter-in-max')
  const outMin = document.getElementById('adapter-out-min')
  const outMax = document.getElementById('adapter-out-max')
  const curve = document.getElementById('adapter-curve')
  const invert = document.getElementById('adapter-invert')

  const onAdapterChange = () => {
    if (inMin && inMax) {
      state.mapping.adapter.inputRange = [parseFloat(inMin.value) || 0, parseFloat(inMax.value) || 100]
    }
    if (outMin && outMax) {
      state.mapping.adapter.outputRange = [parseFloat(outMin.value) || 20, parseFloat(outMax.value) || 2000]
    }
    if (curve) state.mapping.adapter.curve = curve.value
    if (invert) state.mapping.adapter.invert = invert.checked

    rebuildPipelineAdapters()
    syncCodeDrawer()
  }

  if (inMin) inMin.addEventListener('input', onAdapterChange)
  if (inMax) inMax.addEventListener('input', onAdapterChange)
  if (outMin) outMin.addEventListener('input', onAdapterChange)
  if (outMax) outMax.addEventListener('input', onAdapterChange)
  if (curve) curve.addEventListener('change', onAdapterChange)
  if (invert) invert.addEventListener('change', onAdapterChange)

  // 2. Musical Tuning Listeners
  const tuningModeSelect = document.getElementById('tuning-mode-select')
  const scaleSelect = document.getElementById('tuning-scale-select')
  const rootFreqInput = document.getElementById('tuning-root-freq')
  const fundInput = document.getElementById('tuning-fundamental')

  if (tuningModeSelect) {
    tuningModeSelect.addEventListener('change', () => {
      state.mapping.adapter.tuningMode = tuningModeSelect.value
      rebuildPipelineAdapters()
      syncUiFromState()
    })
  }
  if (scaleSelect) {
    scaleSelect.addEventListener('change', () => {
      state.mapping.adapter.scale = scaleSelect.value
      rebuildPipelineAdapters()
      syncCodeDrawer()
    })
  }
  if (rootFreqInput) {
    rootFreqInput.addEventListener('input', () => {
      state.mapping.adapter.rootFreq = parseFloat(rootFreqInput.value) || 220
      rebuildPipelineAdapters()
      syncCodeDrawer()
    })
  }
  if (fundInput) {
    fundInput.addEventListener('input', () => {
      state.mapping.adapter.fundamental = parseFloat(fundInput.value) || 110
      rebuildPipelineAdapters()
      syncCodeDrawer()
    })
  }

  // 3. Add decorator select (Advanced SP Drawer)
  const addSelect = document.getElementById('select-add-decorator')
  if (addSelect) {
    addSelect.addEventListener('change', () => {
      const val = addSelect.value
      if (!val) return
      let token = val
      if (val === 'ema') token = 'ema:0.25'
      else if (val === 'sma') token = 'sma:5'
      else if (val === 'threshold') token = 'threshold:50'

      state.mapping.adapter.decorators.push(token)
      addSelect.value = ''
      addSelect.selectedIndex = 0

      rebuildPipelineAdapters()
      syncUiFromState()
    })
  }

  // 4. Feed profile & scrub listeners
  const profileSelect = document.getElementById('feed-profile')
  if (profileSelect) {
    profileSelect.addEventListener('change', () => {
      state.feed.profile = profileSelect.value
    })
  }

  const rateSlider = document.getElementById('feed-rate')
  const dispRate = document.getElementById('disp-feed-rate')
  if (rateSlider) {
    rateSlider.addEventListener('input', () => {
      state.feed.rate = parseInt(rateSlider.value, 10)
      if (dispRate) dispRate.textContent = `${state.feed.rate} Hz`
      restartSimTimer()
    })
  }

  const noiseSlider = document.getElementById('feed-noise')
  const dispNoise = document.getElementById('disp-feed-noise')
  if (noiseSlider) {
    noiseSlider.addEventListener('input', () => {
      state.feed.noise = parseFloat(noiseSlider.value)
      if (dispNoise) dispNoise.textContent = state.feed.noise.toFixed(2)
    })
  }

  const scrubSlider = document.getElementById('feed-scrub')
  const dispScrub = document.getElementById('disp-feed-scrub')
  if (scrubSlider) {
    scrubSlider.addEventListener('input', () => {
      state.feed.scrubOverride = true
      state.feed.value = parseFloat(scrubSlider.value)
      if (dispScrub) dispScrub.textContent = state.feed.value.toFixed(1)
    })
    scrubSlider.addEventListener('change', () => {
      setTimeout(() => { state.feed.scrubOverride = false }, 1000)
    })
  }

  // 5. Scope tools
  const btnPause = document.getElementById('btn-scope-pause')
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      state.scope.paused = !state.scope.paused
      btnPause.textContent = state.scope.paused ? '▶ Resume' : '⏸ Pause'
    })
  }
  const btnClear = document.getElementById('btn-scope-clear')
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      state.scope.history = []
    })
  }

  // 6. Temporal Event Scatter Listeners
  const tempCount = document.getElementById('temporal-count')
  const dispTempCount = document.getElementById('disp-temporal-count')
  const tempWindow = document.getElementById('temporal-window')
  const dispTempWindow = document.getElementById('disp-temporal-window')
  const tempStrategy = document.getElementById('temporal-strategy')
  const tempAutoRepeat = document.getElementById('temporal-auto-repeat')
  const btnFeedBatch = document.getElementById('btn-feed-batch')

  if (tempCount) {
    tempCount.addEventListener('input', () => {
      state.temporal.eventCount = parseInt(tempCount.value, 10) || 5
      if (dispTempCount) dispTempCount.textContent = `${state.temporal.eventCount} events`
      syncCodeDrawer()
    })
  }
  if (tempWindow) {
    tempWindow.addEventListener('input', () => {
      state.temporal.windowSeconds = parseInt(tempWindow.value, 10) || 10
      if (dispTempWindow) dispTempWindow.textContent = `${state.temporal.windowSeconds}s`
      syncCodeDrawer()
    })
  }
  if (tempStrategy) {
    tempStrategy.addEventListener('change', () => {
      state.temporal.strategy = tempStrategy.value
      syncCodeDrawer()
    })
  }
  if (tempAutoRepeat) {
    tempAutoRepeat.addEventListener('change', () => {
      state.temporal.autoRepeat = tempAutoRepeat.checked
    })
  }
  if (btnFeedBatch) {
    btnFeedBatch.addEventListener('click', () => {
      feedTemporalBatch()
    })
  }

  // 7. Master Audio Transport
  const btnAudio = document.getElementById('btn-audio-toggle')
  const audioStatus = document.getElementById('audio-status')
  if (btnAudio) {
    btnAudio.addEventListener('click', () => {
      initAudioEngine()
      if (audioCtx.state === 'suspended') {
        audioCtx.resume()
      }
      state.audio.active = !state.audio.active
      if (state.audio.active) {
        btnAudio.textContent = '■ Stop Audition'
        btnAudio.classList.add('active')
        if (audioStatus) {
          audioStatus.textContent = `Auditioning (${state.audio.mode})`
          audioStatus.classList.add('active')
        }
      } else {
        btnAudio.textContent = '▶ Audition Audio'
        btnAudio.classList.remove('active')
        muteAudioAudition()
        if (audioStatus) {
          audioStatus.textContent = 'Audio Muted'
          audioStatus.classList.remove('active')
        }
      }
    })
  }

  // Audition radio options
  const auditionRadios = document.querySelectorAll('input[name="audition-mode"]')
  auditionRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.audio.mode = radio.value
        if (audioStatus && state.audio.active) {
          audioStatus.textContent = `Auditioning (${state.audio.mode})`
        }
      }
    })
  })

  // Synth voice select
  const voiceSelect = document.getElementById('synth-voice-select')
  if (voiceSelect) {
    voiceSelect.addEventListener('change', () => {
      state.audio.voice = voiceSelect.value
      if (oscNode) {
        oscNode.type = state.audio.voice === 'triangle' ? 'triangle' : 'sine'
      }
    })
  }

  // Master volume
  const volSlider = document.getElementById('master-volume')
  const dispVol = document.getElementById('disp-master-volume')
  if (volSlider) {
    volSlider.addEventListener('input', () => {
      state.audio.volume = parseFloat(volSlider.value)
      if (dispVol) dispVol.textContent = `${Math.round(state.audio.volume * 100)}%`
      if (state.audio.active && gainNode) {
        gainNode.gain.setTargetAtTime(state.audio.volume, audioCtx.currentTime, 0.02)
      }
    })
  }

  // Presets selector
  const presetSelect = document.getElementById('pipeline-presets')
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const p = PRESETS[presetSelect.value]
      if (p) {
        state.mapping.adapter.inputRange = [...p.inputRange]
        state.mapping.adapter.outputRange = [...p.outputRange]
        state.mapping.adapter.curve = p.curve
        state.mapping.adapter.invert = p.invert
        state.mapping.adapter.tuningMode = p.tuningMode || 'scale'
        if (p.scale) state.mapping.adapter.scale = p.scale
        if (p.rootFreq) state.mapping.adapter.rootFreq = p.rootFreq
        if (p.fundamental) state.mapping.adapter.fundamental = p.fundamental
        state.mapping.adapter.decorators = [...p.decorators]

        if (p.profile) {
          state.feed.profile = p.profile
          if (profileSelect) profileSelect.value = p.profile
        }
        if (p.voice) {
          state.audio.voice = p.voice
          if (voiceSelect) voiceSelect.value = p.voice
          if (oscNode) oscNode.type = p.voice === 'triangle' ? 'triangle' : 'sine'
        }
        rebuildPipelineAdapters()
        syncUiFromState()
      }
    })
  }

  // Drawer tabs
  const tabJson = document.getElementById('tab-btn-json')
  const tabCode = document.getElementById('tab-btn-code')
  const viewJson = document.getElementById('view-json')
  const viewCode = document.getElementById('view-code')

  if (tabJson && tabCode && viewJson && viewCode) {
    tabJson.addEventListener('click', () => {
      tabJson.classList.add('active')
      tabCode.classList.remove('active')
      viewJson.style.display = 'block'
      viewCode.style.display = 'none'
    })
    tabCode.addEventListener('click', () => {
      tabCode.classList.add('active')
      tabJson.classList.remove('active')
      viewCode.style.display = 'block'
      viewJson.style.display = 'none'
    })
  }

  // Apply JSON button
  const btnApplyJson = document.getElementById('btn-apply-json')
  const jsonArea = document.getElementById('json-editor')
  const jsonError = document.getElementById('json-error')
  if (btnApplyJson && jsonArea) {
    btnApplyJson.addEventListener('click', () => {
      try {
        applyMappingsJson(jsonArea.value)
        if (jsonError) jsonError.style.display = 'none'
      } catch (err) {
        if (jsonError) {
          jsonError.textContent = `Error: ${err.message}`
          jsonError.style.display = 'block'
        }
      }
    })
  }

  // Copy buttons
  const btnCopyJson = document.getElementById('btn-copy-json')
  if (btnCopyJson && jsonArea) {
    btnCopyJson.addEventListener('click', () => {
      navigator.clipboard.writeText(jsonArea.value)
      btnCopyJson.textContent = '✓ Copied!'
      setTimeout(() => { btnCopyJson.textContent = '📋 Copy' }, 1500)
    })
  }
  const btnCopyCode = document.getElementById('btn-copy-code')
  const codeDisplay = document.getElementById('code-display')
  if (btnCopyCode && codeDisplay) {
    btnCopyCode.addEventListener('click', () => {
      navigator.clipboard.writeText(codeDisplay.textContent)
      btnCopyCode.textContent = '✓ Copied!'
      setTimeout(() => { btnCopyCode.textContent = '📋 Copy' }, 1500)
    })
  }

  // Start continuous simulation loops
  restartSimTimer()

  // Start Animation loop for both canvases
  function loop() {
    if (state.activeMode === 'tuning') {
      const c = document.getElementById('scope-canvas')
      if (c) drawScopeCanvas(c)
    } else {
      const tc = document.getElementById('temporal-canvas')
      if (tc) renderTemporalTimeline(tc)
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
}

export function restartSimTimer() {
  if (simTimer) clearInterval(simTimer)
  const intervalMs = Math.round(1000 / Math.max(1, state.feed.rate))
  simTimer = setInterval(() => {
    const rawVal = tickFeedSimulator()

    // Map through pipeline
    const rawScaledVal = activeRawAdapter ? activeRawAdapter.map(rawVal) : rawVal
    const decoratedVal = activeDecoratedAdapter ? activeDecoratedAdapter.map(rawVal) : rawVal

    // Update DOM indicators
    const dispFeedVal = document.getElementById('disp-feed-val')
    if (dispFeedVal) dispFeedVal.textContent = rawVal.toFixed(2)

    const blockFeedVal = document.getElementById('block-feed-val')
    const meterFeedBar = document.getElementById('meter-feed-bar')
    if (blockFeedVal) blockFeedVal.textContent = rawVal.toFixed(1)
    if (meterFeedBar) meterFeedBar.style.width = `${Math.max(0, Math.min(100, rawVal))}%`

    const blockOutputVal = document.getElementById('block-output-val')
    const meterOutputBar = document.getElementById('meter-output-bar')
    if (blockOutputVal) blockOutputVal.textContent = `${decoratedVal.toFixed(1)} Hz`
    if (meterOutputBar) {
      const [outMin, outMax] = state.mapping.adapter.outputRange
      const span = Math.max(0.001, outMax - outMin)
      const pct = ((decoratedVal - outMin) / span) * 100
      meterOutputBar.style.width = `${Math.max(0, Math.min(100, pct))}%`
    }

    // Record sample in scope history
    recordScopeSample(rawVal, rawScaledVal, decoratedVal)

    // Feed to audio audition
    const audibleVal = state.audio.mode === 'raw' ? rawScaledVal : decoratedVal
    updateAudioAudition(audibleVal)
  }, intervalMs)
}

// Auto-run if running in browser
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initDecoratorLab)
  } else {
    initDecoratorLab()
  }
}
