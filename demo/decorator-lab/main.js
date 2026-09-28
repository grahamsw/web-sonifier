/**
 * Decorator & Pipeline Lab Controller
 *
 * Provides real-time bidirectional visual and textual inspection of
 * Adapter pipelines and Decorator transformers.
 */

import { Adapter, Transforms, Quantize, Scales } from '@web-sonifier/core'

// ---------------------------------------------------------------------------
// Pipeline & Simulation State
// ---------------------------------------------------------------------------

export const state = {
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
      decorators: ['ema:0.25', 'quantize:pentatonic']
    }
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

  // 1. Scales
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

  // 2. Math & Discrete
  if (decToken === 'round' || decToken === 'integer') {
    return Math.round
  }

  // 3. Stateful Transforms
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

  // 1. Raw adapter without decorators
  activeRawAdapter = new Adapter({
    param: state.mapping.target.param,
    inputRange: [...adapter.inputRange],
    outputRange: [...adapter.outputRange],
    curve: adapter.curve,
    invert: adapter.invert
  })

  // 2. Full pipeline adapter with decorators
  activeDecoratedAdapter = new Adapter({
    param: state.mapping.target.param,
    inputRange: [...adapter.inputRange],
    outputRange: [...adapter.outputRange],
    curve: adapter.curve,
    invert: adapter.invert
  })

  for (const dec of adapter.decorators) {
    const fn = resolveDecoratorTransformer(dec)
    if (fn) {
      activeDecoratedAdapter.pipe(fn)
    }
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

  // 3. Decorated Output (Emerald stepped)
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
// Code & JSON Generation (Bidirectional Synchronization)
// ---------------------------------------------------------------------------

export function generateMappingsJson() {
  const doc = {
    version: 1,
    name: 'Live Pipeline Specification',
    feedSpecId: 'telemetry-stream',
    mappings: [
      {
        feedId: state.feed.id,
        target: {
          objectId: state.mapping.target.objectId,
          param: state.mapping.target.param
        },
        adapter: {
          inputRange: [...state.mapping.adapter.inputRange],
          outputRange: [...state.mapping.adapter.outputRange],
          curve: state.mapping.adapter.curve,
          invert: state.mapping.adapter.invert,
          decorators: [...state.mapping.adapter.decorators]
        }
      }
    ]
  }
  return JSON.stringify(doc, null, 2)
}

export function generateFluentJsCode() {
  const { adapter, target } = state.mapping
  const decPipes = adapter.decorators.map(dec => {
    if (dec.startsWith('ema')) {
      const alpha = dec.includes(':') ? dec.split(':')[1] : '0.25'
      return `  .pipe(Transforms.ema(${alpha}))`
    }
    if (dec.startsWith('sma')) {
      const win = dec.includes(':') ? dec.split(':')[1] : '5'
      return `  .pipe(Transforms.sma(${win}))`
    }
    if (dec.startsWith('quantize:')) {
      const scaleName = dec.split(':')[1]
      return `  .pipe(Quantize.scale(Scales.${scaleName}))`
    }
    if (dec === 'delta') {
      return `  .pipe(Transforms.delta())`
    }
    if (dec === 'accumulate') {
      return `  .pipe(Transforms.accumulate())`
    }
    if (dec.startsWith('threshold:')) {
      const thresh = dec.split(':')[1]
      return `  .pipe(Transforms.threshold({ threshold: ${thresh} }))`
    }
    if (dec === 'round') {
      return `  .pipe(Math.round)`
    }
    return `  .pipe(/* ${dec} */)`
  }).join('\n')

  return `import { Adapter, Transforms, Quantize, Scales } from '@web-sonifier/core'

// 1. Configure Adapter with Range & Curve
const ${target.param}Adapter = new Adapter({
  param: '${target.param}',
  inputRange: [${adapter.inputRange.join(', ')}],
  outputRange: [${adapter.outputRange.join(', ')}],
  curve: '${adapter.curve}',
  invert: ${adapter.invert}
})
${decPipes ? decPipes + '\n' : ''}
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

  const { adapter, target, feedId } = mapEntry
  if (feedId) state.feed.id = feedId
  if (target && target.param) state.mapping.target.param = target.param
  if (target && target.objectId) state.mapping.target.objectId = target.objectId

  if (Array.isArray(adapter.inputRange)) state.mapping.adapter.inputRange = [...adapter.inputRange]
  if (Array.isArray(adapter.outputRange)) state.mapping.adapter.outputRange = [...adapter.outputRange]
  if (adapter.curve) state.mapping.adapter.curve = adapter.curve
  if (typeof adapter.invert === 'boolean') state.mapping.adapter.invert = adapter.invert
  if (Array.isArray(adapter.decorators)) state.mapping.adapter.decorators = [...adapter.decorators]

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
    decorators: ['ema:0.25', 'quantize:pentatonic'],
    profile: 'brownian',
    voice: 'sine'
  },
  'hirajoshi-walk': {
    inputRange: [0, 100],
    outputRange: [180, 720],
    curve: 'exponential',
    invert: false,
    decorators: ['ema:0.18', 'quantize:hirajoshi'],
    profile: 'sine',
    voice: 'triangle'
  },
  'delta-velocity': {
    inputRange: [-10, 10],
    outputRange: [100, 1500],
    curve: 'linear',
    invert: false,
    decorators: ['delta', 'ema:0.35'],
    profile: 'step',
    voice: 'sine'
  },
  'accumulator': {
    inputRange: [0, 500],
    outputRange: [80, 600],
    curve: 'logarithmic',
    invert: false,
    decorators: ['accumulate'],
    profile: 'brownian',
    voice: 'sine'
  },
  'moving-average': {
    inputRange: [0, 100],
    outputRange: [200, 800],
    curve: 'linear',
    invert: false,
    decorators: ['sma:5'],
    profile: 'brownian',
    voice: 'sine'
  },
  'threshold-gate': {
    inputRange: [0, 100],
    outputRange: [300, 1200],
    curve: 'exponential',
    invert: false,
    decorators: ['threshold:65', 'quantize:pentatonic'],
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
      const scales = ['pentatonic', 'minorPentatonic', 'hirajoshi', 'dorian']
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
    btnRemove.title = 'Remove Decorator'
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

  // 2. Decorator Chips
  const chipsContainer = document.getElementById('decorator-chips-container')
  renderDecoratorChips(chipsContainer, () => {
    rebuildPipelineAdapters()
    syncCodeDrawer()
  })

  // 3. Code Drawer
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
  syncUiFromState()

  const canvas = document.getElementById('scope-canvas')
  if (canvas) {
    const rect = canvas.parentElement.getBoundingClientRect()
    canvas.width = rect.width * (window.devicePixelRatio || 1)
    canvas.height = rect.height * (window.devicePixelRatio || 1)
  }

  // Adapter inputs listeners
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

  // Add decorator select
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
      addSelect.selectedIndex = 0

      rebuildPipelineAdapters()
      syncUiFromState()
    })
  }

  // Feed profile & scrub listeners
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
      // Resume autonomous walk after scrub release
      setTimeout(() => { state.feed.scrubOverride = false }, 1000)
    })
  }

  // Scope tools
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

  // Audio audition button
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

  // Start simulation loop
  restartSimTimer()

  // Start animation loop for scope
  function renderLoop() {
    drawScopeCanvas(canvas)
    requestAnimationFrame(renderLoop)
  }
  requestAnimationFrame(renderLoop)
}

function restartSimTimer() {
  if (simTimer) clearInterval(simTimer)
  const intervalMs = Math.max(16, Math.round(1000 / state.feed.rate))
  simTimer = setInterval(() => {
    const rawVal = tickFeedSimulator()
    if (!activeRawAdapter || !activeDecoratedAdapter) return

    const rawScaledVal = activeRawAdapter.map(rawVal)
    const decoratedVal = activeDecoratedAdapter.map(rawVal)

    // Update block values in DOM
    const dispFeed = document.getElementById('disp-feed-val')
    const blockFeedVal = document.getElementById('block-feed-val')
    const meterFeedBar = document.getElementById('meter-feed-bar')
    if (dispFeed) dispFeed.textContent = rawVal.toFixed(2)
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
  window.addEventListener('DOMContentLoaded', initDecoratorLab)
}
