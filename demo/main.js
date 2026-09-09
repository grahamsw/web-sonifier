import { Runtime, Adapter } from '@web-sonifier/core'
import { ToneSonifier } from '@web-sonifier/tone'
import { GeigerSonifier } from '@web-sonifier/geiger'
import { PurrSonifier } from '@web-sonifier/purr'
import { LiquidSonifier } from '@web-sonifier/liquid'
import { MalletSonifier } from '@web-sonifier/mallet'
import { EngineSonifier } from '@web-sonifier/engine'
import { DroneSonifier } from '@web-sonifier/drone'
import { VoscSonifier } from '@web-sonifier/vosc'
import { RainSonifier } from '@web-sonifier/rain'
import { OceanSonifier } from '@web-sonifier/ocean'

// ---------------------------------------------------------------------------
// Simulated data feed — random walk between 0 and 100
// ---------------------------------------------------------------------------

let currentFeedValue = 50
let previousFeedValue = 50
export const feedMin = 0
export const feedMax = 100

export function startFeed(onUpdate, intervalMs = 1000) {
  onUpdate(currentFeedValue)
  return setInterval(() => {
    previousFeedValue = currentFeedValue
    currentFeedValue += (Math.random() - 0.5) * 6
    currentFeedValue = Math.max(feedMin, Math.min(feedMax, currentFeedValue))
    onUpdate(currentFeedValue, previousFeedValue)
  }, intervalMs)
}

// ---------------------------------------------------------------------------
// UI Elements
// ---------------------------------------------------------------------------

const sonifierSelectEl = document.getElementById('sonifier-select')
const feedRateSelectEl = document.getElementById('feed-rate-select')
const btnPlay          = document.getElementById('btn-play')
const btnStop          = document.getElementById('btn-stop')
const masterVolumeEl   = document.getElementById('master-volume')
const masterVolDispEl  = document.getElementById('master-volume-display')
const statusEl         = document.getElementById('status')
const parametersPanel  = document.getElementById('parameters-panel')

// ---------------------------------------------------------------------------
// Default Settings & UI Facet Configurations
// ---------------------------------------------------------------------------

export const UI_CONFIGS = {
  tone: {
    mappedParam: 'frequency',
    groups: [
      {
        title: 'Tone Settings',
        params: {
          waveform: { control: 'select', label: 'Waveform' },
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  },
  geiger: {
    mappedParam: 'rate',
    groups: [
      {
        title: 'Geiger Settings',
        params: {
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  },
  purr: {
    mappedParam: 'frequency',
    groups: [
      {
        title: 'Purr Settings',
        params: {
          jitter: { control: 'slider', label: 'Jitter', step: 0.05 },
          rumble: { control: 'slider', label: 'Rumble', step: 0.05 },
          breath: { control: 'slider', label: 'Breath', step: 0.05 },
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  },
  engine: {
    mappedParam: 'pitch',
    groups: [
      {
        title: 'Engine Settings',
        params: {
          rate: { control: 'slider', label: 'Engine Rate', step: 0.1 },
          volumeVariance: { control: 'slider', label: 'Throttle Depth', step: 0.01 },
          rolloff: { control: 'select', label: 'Rolloff' },
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  },
  liquid: {
    mappedParam: 'frequency',
    groups: [
      {
        title: 'Liquid Settings',
        params: {
          viscosity: { control: 'slider', label: 'Viscosity', step: 0.05 },
          resonatorVolume: { control: 'slider', label: 'Resonator Vol (Size)', step: 0.05 },
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  },
  mallet: {
    mappedParam: 'strikeRate',
    groups: [
      {
        title: 'Mallet Settings',
        params: {
          hardness: { control: 'slider', label: 'Hardness', step: 0.05 },
          boxSize: { control: 'slider', label: 'Size (Body)', step: 0.05 },
          resonance: { control: 'slider', label: 'Resonance (Q)', step: 0.05 },
          force: { control: 'slider', label: 'Force (Impact)', step: 0.05 },
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  },
  drone: {
    mappedParam: 'frequency',
    groups: [
      {
        title: 'Drone Settings',
        params: {
          nharm: { control: 'slider', label: 'Harmonics', step: 1 },
          detune: { control: 'slider', label: 'Detune (st)', step: 0.01 },
          pan: { control: 'slider', label: 'Pan', step: 0.05 },
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  },
  vosc: {
    mappedParam: 'frequency',
    groups: [
      {
        title: 'VOSC Basic Settings',
        params: {
          amplitude: { control: 'slider', label: 'Amplitude', step: 0.05 },
          spread: { control: 'slider', label: 'Spread', step: 0.05 },
          waveSet: { control: 'select', label: 'Wave Set', values: [0, 1, 2, 3] },
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  },
  rain: {
    mappedParam: 'intensity',
    groups: [
      {
        title: 'Rain Synthesis Settings',
        params: {
          pitch: { control: 'slider', label: 'Rain Pitch (Hz)', step: 10 },
          dropletSize: { control: 'slider', label: 'Droplet Size', step: 0.05 },
          spread: { control: 'slider', label: 'Stereo Spread', step: 0.05 },
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  },
  ocean: {
    mappedParam: 'intensity',
    groups: [
      {
        title: 'Ocean Swell Dynamics',
        params: {
          swellPeriod: { control: 'slider', label: 'Swell Period Mean (s)', step: 0.5 },
          swellPeriodStdDev: { control: 'slider', label: 'Period Std Dev (s)', step: 0.1 },
          swellDepth: { control: 'slider', label: 'Swell Depth Mean', step: 0.05 },
          swellDepthStdDev: { control: 'slider', label: 'Depth Std Dev', step: 0.02 },
          pitch: { control: 'slider', label: 'Spectral Depth (Hz)', step: 10 },
          foam: { control: 'slider', label: 'Foam & Spray', step: 0.05 },
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  }
}

export const defaultSettings = {
  sonifierType:   'tone',
  feedIntervalMs: 1000,
  masterVolume:   0.8,
  tone: {
    sonifiedParams:  ['frequency'],
    paramRanges:     { frequency: [110, 440], volume: [0.1, 0.9] },
    curve:           'exponential',
    waveform:        'sine',
    volume:          0.5,
    frequency:       440
  },
  geiger: {
    sonifiedParams:  ['rate'],
    paramRanges:     { rate: [1, 50], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.7,
    rate:            10
  },
  purr: {
    sonifiedParams:  ['frequency'],
    paramRanges:     { frequency: [20, 150], volume: [0.1, 0.9], jitter: [0.2, 0.8], rumble: [0.2, 0.8], breath: [0.2, 0.8] },
    curve:           'exponential',
    volume:          0.6,
    frequency:       50,
    jitter:          0.5,
    rumble:          0.5,
    breath:          0.5
  },
  engine: {
    sonifiedParams:  ['pitch'],
    paramRanges:     { pitch: [20, 2000], rate: [2, 40], volume: [0.1, 0.8], volumeVariance: [0.02, 0.2] },
    curve:           'exponential',
    volume:          0.25,
    pitch:           65,
    rate:            25,
    volumeVariance:  0.1,
    rolloff:         -96
  },
  liquid: {
    sonifiedParams:  ['frequency'],
    paramRanges:     { frequency: [20, 80], viscosity: [0.1, 0.9], resonatorVolume: [0.1, 0.9], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.5,
    frequency:       50,
    viscosity:       0.5,
    resonatorVolume: 0.5
  },
  mallet: {
    sonifiedParams:  ['strikeRate'],
    paramRanges:     { strikeRate: [0.5, 10], hardness: [0.1, 0.9], boxSize: [0.2, 2.0], resonance: [0.1, 0.9], force: [0.2, 0.9], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.7,
    strikeRate:      2,
    hardness:        0.5,
    boxSize:         1.0,
    resonance:       0.4,
    force:           0.7
  },
  drone: {
    sonifiedParams:  ['frequency'],
    paramRanges:     { frequency: [20, 200], nharm: [2, 24], detune: [0.05, 0.5], pan: [-0.8, 0.8], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.5,
    frequency:       100,
    nharm:           12,
    detune:          0.2,
    pan:             0
  },
  vosc: {
    sonifiedParams:  ['frequency'],
    paramRanges:     { frequency: [100, 1000], amplitude: [0.1, 0.9], spread: [0.1, 0.9], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.5,
    frequency:       200,
    amplitude:       0.5,
    bufLow:          0,
    bufHigh:         7,
    bufSteps:        10,
    detuneLow:       0.01,
    detuneHigh:      0.1,
    detuneSteps:     10,
    panLow:          -1,
    panHigh:         1,
    panSteps:        10,
    spread:          0.5,
    releaseTime:     10,
    gate:            1,
    waveSet:         0
  },
  rain: {
    sonifiedParams:  ['intensity'],
    paramRanges:     { intensity: [5, 120], pitch: [400, 3000], dropletSize: [0.1, 0.8], spread: [0.1, 0.9], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.5,
    intensity:       50,
    pitch:           1200,
    dropletSize:     0.4,
    spread:          0.8
  },
  ocean: {
    sonifiedParams:    ['intensity'],
    paramRanges:       { intensity: [15, 85], pitch: [200, 1200], swellPeriod: [3, 15], swellPeriodStdDev: [0.5, 3.0], swellDepth: [0.1, 0.9], swellDepthStdDev: [0.05, 0.3], foam: [0.1, 0.9], volume: [0.1, 0.9] },
    curve:             'linear',
    volume:            0.5,
    intensity:         50,
    pitch:             500,
    swellPeriod:       8.0,
    swellPeriodStdDev: 1.5,
    swellDepth:        0.7,
    swellDepthStdDev:  0.15,
    foam:              0.5
  }
}

// ---------------------------------------------------------------------------
// State & Storage
// ---------------------------------------------------------------------------

export const runtime = new Runtime()
runtime.register('tone', ToneSonifier)
runtime.register('geiger', GeigerSonifier)
runtime.register('purr', PurrSonifier)
runtime.register('engine', EngineSonifier)
runtime.register('liquid', LiquidSonifier)
runtime.register('mallet', MalletSonifier)
runtime.register('drone', DroneSonifier)
runtime.register('vosc', VoscSonifier)
runtime.register('rain', RainSonifier)
runtime.register('ocean', OceanSonifier)

export let activeSonifier = null
export let activeSonifierType = null
export const activeAdapters = new Map() // Map<paramName, Adapter>
let feedInterval = null

const STORAGE_KEY = 'web-sonify-demo-settings'

export function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return JSON.parse(JSON.stringify(defaultSettings))

    const loaded = JSON.parse(saved)
    const settings = JSON.parse(JSON.stringify(defaultSettings))

    for (const key of Object.keys(defaultSettings)) {
      if (typeof defaultSettings[key] === 'object' && defaultSettings[key] !== null) {
        if (loaded[key]) {
          settings[key] = { ...defaultSettings[key], ...loaded[key] }

          // Migrate sonifiedParams from legacy mappedParam
          if (!Array.isArray(settings[key].sonifiedParams)) {
            if (settings[key].mappedParam) {
              settings[key].sonifiedParams = [settings[key].mappedParam]
            } else if (defaultSettings[key].sonifiedParams) {
              settings[key].sonifiedParams = [...defaultSettings[key].sonifiedParams]
            } else {
              settings[key].sonifiedParams = []
            }
          }

          if (!settings[key].paramRanges) {
            settings[key].paramRanges = { ...(defaultSettings[key].paramRanges || {}) }
          }
          if (settings[key].outputRange && settings[key].mappedParam && !settings[key].paramRanges[settings[key].mappedParam]) {
            settings[key].paramRanges[settings[key].mappedParam] = settings[key].outputRange
          }
        }
      } else if (loaded[key] !== undefined) {
        settings[key] = loaded[key]
      }
    }
    return settings
  } catch {
    return JSON.parse(JSON.stringify(defaultSettings))
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch (e) {
    console.warn('Could not save settings to localStorage:', e)
  }
}

export let settings = loadSettings()

if (sonifierSelectEl) sonifierSelectEl.value = settings.sonifierType
if (feedRateSelectEl) feedRateSelectEl.value = settings.feedIntervalMs
if (masterVolumeEl) {
  masterVolumeEl.disabled = false
  masterVolumeEl.value = settings.masterVolume
}
if (masterVolDispEl) masterVolDispEl.textContent = settings.masterVolume.toFixed(2)

// ---------------------------------------------------------------------------
// Audio Application & Synchronization
// ---------------------------------------------------------------------------

export function applySettings() {
  const type = sonifierSelectEl ? sonifierSelectEl.value : settings.sonifierType
  const s = settings[type]
  if (!s) return

  const sonifiedSet = new Set(s.sonifiedParams || [])

  // Synchronize active adapter output ranges and curves
  for (const [paramName, adapter] of activeAdapters.entries()) {
    const range = s.paramRanges?.[paramName] || [0, 100]
    adapter.setConfig({
      param: paramName,
      inputRange: [feedMin, feedMax],
      outputRange: range,
      curve: s.curve || 'linear'
    })
  }

  // Synchronize non-sonified static parameters to active sonifier
  if (activeSonifier) {
    const schema = typeof activeSonifier.getParamSchema === 'function' ? activeSonifier.getParamSchema() : []
    for (const param of schema) {
      if (!sonifiedSet.has(param.name)) {
        if (s[param.name] !== undefined) {
          activeSonifier.setParam(param.name, s[param.name])
        }
      }
    }
  }

  runtime.setMasterVolume(settings.masterVolume)
  if (masterVolumeEl) masterVolumeEl.value = settings.masterVolume
  if (masterVolDispEl) masterVolDispEl.textContent = settings.masterVolume.toFixed(2)
}

// ---------------------------------------------------------------------------
// Feed Tick & Audio Modulation
// ---------------------------------------------------------------------------

export function initFeed() {
  if (feedInterval) clearInterval(feedInterval)
  feedInterval = startFeed((val) => {
    // 1. Update live feed readouts for all sonified parameters currently displayed
    const currentType = sonifierSelectEl ? sonifierSelectEl.value : settings.sonifierType
    const sonifiedList = settings[currentType]?.sonifiedParams || []

    for (const paramName of sonifiedList) {
      const feedValEl = document.getElementById(`feed-val-${paramName}`)
      if (feedValEl) {
        feedValEl.textContent = val.toFixed(1)
      }
    }

    // 2. Modulate audio parameters for all active adapters
    if (activeSonifier && activeAdapters.size > 0) {
      for (const [paramName, adapter] of activeAdapters.entries()) {
        const mappedValue = adapter.map(val)
        activeSonifier.setParam(paramName, mappedValue)
      }
    }
  }, settings.feedIntervalMs || 1000)
}

// ---------------------------------------------------------------------------
// Sonifier Transport (Start / Stop)
// ---------------------------------------------------------------------------

export async function startSonifier() {
  const type = sonifierSelectEl ? sonifierSelectEl.value : settings.sonifierType
  const s = settings[type]
  if (!s) return

  activeSonifier = runtime.create(type)
  activeSonifierType = type
  activeAdapters.clear()

  const sonifiedList = s.sonifiedParams || []
  for (const paramName of sonifiedList) {
    const bounds = getOutputRangeBounds({ name: paramName })
    const range = s.paramRanges?.[paramName] || [bounds.min, bounds.max]
    activeAdapters.set(paramName, new Adapter({
      param: paramName,
      inputRange: [feedMin, feedMax],
      outputRange: range,
      curve: s.curve || 'linear'
    }))
  }

  applySettings()

  if (statusEl) {
    statusEl.textContent = 'Sonifying…'
    statusEl.classList.add('active')
  }
  if (btnPlay) btnPlay.disabled = true
  if (btnStop) btnStop.disabled = false
}

export function stopSonifier() {
  if (activeSonifierType) {
    runtime.destroy(activeSonifierType)
  }
  activeSonifier = null
  activeSonifierType = null
  activeAdapters.clear()

  if (statusEl) {
    statusEl.textContent = 'Stopped'
    statusEl.classList.remove('active')
  }
  if (btnPlay) btnPlay.disabled = false
  if (btnStop) btnStop.disabled = true
}

if (btnPlay) {
  btnPlay.addEventListener('click', async () => {
    await runtime.start()
    startSonifier()
  })
}

if (btnStop) {
  btnStop.addEventListener('click', () => {
    stopSonifier()
  })
}

if (sonifierSelectEl) {
  sonifierSelectEl.addEventListener('change', async () => {
    const isPlaying = !!activeSonifier
    if (isPlaying) {
      stopSonifier()
      startSonifier()
    }
    settings.sonifierType = sonifierSelectEl.value
    saveSettings(settings)
    renderParametersPanel()
  })
}

if (feedRateSelectEl) {
  feedRateSelectEl.addEventListener('change', () => {
    settings.feedIntervalMs = parseInt(feedRateSelectEl.value, 10)
    saveSettings(settings)
    initFeed()
  })
}

if (masterVolumeEl) {
  masterVolumeEl.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    runtime.setMasterVolume(v)
    if (masterVolDispEl) masterVolDispEl.textContent = v.toFixed(2)
    settings.masterVolume = v
    saveSettings(settings)
  })
}

// ---------------------------------------------------------------------------
// Range Calculations & Formatting
// ---------------------------------------------------------------------------

export function getOutputRangeBounds(schemaParam) {
  if (!schemaParam || !schemaParam.range) {
    return { min: 0, max: 1000, step: 1 }
  }
  const [sMin, sMax] = schemaParam.range
  const span = sMax - sMin
  // Add plenty of head and tail room (25% extension on each end)
  const headTail = span * 0.25
  let trackMin = sMin >= 0 ? Math.max(0, sMin - headTail) : (sMin - headTail)
  let trackMax = sMax + headTail

  // For frequency/pitch ranges, keep minimum at a safe audible floor (e.g. 15-20 Hz)
  if ((schemaParam.name === 'frequency' || schemaParam.name === 'pitch') && sMin >= 20) {
    trackMin = Math.max(20, Math.floor(trackMin))
    trackMax = Math.max(2500, Math.ceil(trackMax / 100) * 100)
  } else if (sMax <= 1 && sMin >= 0) {
    trackMin = 0
    trackMax = 1.0
  } else if (trackMax >= 100) {
    trackMin = Math.floor(trackMin)
    trackMax = Math.ceil(trackMax / 10) * 10
  }

  let step = schemaParam.step
  if (!step) {
    const totalSpan = trackMax - trackMin
    if (totalSpan <= 1.5) step = 0.01
    else if (totalSpan <= 10) step = 0.1
    else if (totalSpan <= 100) step = 0.5
    else if (totalSpan <= 500) step = 1
    else step = 5
  }

  return { min: trackMin, max: trackMax, step }
}

export function formatRangeValue(val) {
  if (typeof val !== 'number' || isNaN(val)) return String(val)
  if (Number.isInteger(val)) return String(val)
  const absVal = Math.abs(val)
  if (absVal >= 100) return val.toFixed(0)
  if (absVal >= 10) return val.toFixed(1)
  return val.toFixed(2)
}

// ---------------------------------------------------------------------------
// Slider Control Builders
// ---------------------------------------------------------------------------

/**
 * Creates a dual-ended range slider supporting dragging both end thumbs
 * as well as middle-drag (shifting both ends together while strictly preserving span).
 */
export function createDualRangeSlider(param, bounds, currentRange, onRangeChange) {
  const wrapper = document.createElement('div')
  wrapper.className = 'dual-range-wrapper'
  wrapper.id = `dual-slider-${param.name}`

  const track = document.createElement('div')
  track.className = 'dual-range-track'

  const progress = document.createElement('div')
  progress.className = 'dual-range-progress'
  progress.id = `progress-${param.name}`
  track.appendChild(progress)
  wrapper.appendChild(track)

  const sliderMin = document.createElement('input')
  sliderMin.type = 'range'
  sliderMin.className = 'dual-range-input slider-min'
  sliderMin.id = `range-slider-min-${param.name}`
  sliderMin.min = bounds.min
  sliderMin.max = bounds.max
  sliderMin.step = bounds.step
  sliderMin.value = currentRange[0]
  sliderMin.style.zIndex = '3'

  const sliderMax = document.createElement('input')
  sliderMax.type = 'range'
  sliderMax.className = 'dual-range-input slider-max'
  sliderMax.id = `range-slider-max-${param.name}`
  sliderMax.min = bounds.min
  sliderMax.max = bounds.max
  sliderMax.step = bounds.step
  sliderMax.value = currentRange[1]
  sliderMax.style.zIndex = '3'

  wrapper.appendChild(sliderMin)
  wrapper.appendChild(sliderMax)

  const boundsSpan = bounds.max - bounds.min

  const updateProgress = (minVal, maxVal) => {
    if (boundsSpan <= 0) return
    const leftPercent = Math.max(0, Math.min(100, ((minVal - bounds.min) / boundsSpan) * 100))
    const rightPercent = Math.max(0, Math.min(100, ((maxVal - bounds.min) / boundsSpan) * 100))
    progress.style.left = `${leftPercent}%`
    progress.style.width = `${Math.max(0, rightPercent - leftPercent)}%`
  }

  updateProgress(currentRange[0], currentRange[1])

  const handleInput = (source) => {
    let minVal = parseFloat(sliderMin.value)
    let maxVal = parseFloat(sliderMax.value)

    if (source === 'min') {
      if (minVal > maxVal) {
        minVal = maxVal
        sliderMin.value = minVal
      }
      sliderMin.style.zIndex = '4'
      sliderMax.style.zIndex = '3'
    } else {
      if (maxVal < minVal) {
        maxVal = minVal
        sliderMax.value = maxVal
      }
      sliderMax.style.zIndex = '4'
      sliderMin.style.zIndex = '3'
    }

    updateProgress(minVal, maxVal)
    onRangeChange([minVal, maxVal])
  }

  sliderMin.addEventListener('input', () => handleInput('min'))
  sliderMax.addEventListener('input', () => handleInput('max'))

  // -------------------------------------------------------------------------
  // Middle-drag implementation: shifts window while preserving span
  // -------------------------------------------------------------------------
  let isDraggingMiddle = false
  let dragStartX = 0
  let dragStartMin = 0
  let dragStartMax = 0
  let dragSpan = 0

  progress.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    if (e.button !== 0 && e.button !== undefined) return
    isDraggingMiddle = true
    dragStartX = e.clientX
    dragStartMin = parseFloat(sliderMin.value)
    dragStartMax = parseFloat(sliderMax.value)
    dragSpan = dragStartMax - dragStartMin

    if (typeof progress.setPointerCapture === 'function' && e.pointerId) {
      try {
        progress.setPointerCapture(e.pointerId)
      } catch {}
    }
  })

  progress.addEventListener('pointermove', (e) => {
    if (!isDraggingMiddle) return
    const rect = wrapper.getBoundingClientRect()
    // Fallback to 200 in environments like jsdom where bounding rect width is 0
    const trackWidth = rect.width > 0 ? rect.width : 200
    const deltaX = e.clientX - dragStartX
    const deltaValue = (deltaX / trackWidth) * boundsSpan

    let newMin = dragStartMin + deltaValue
    let newMax = newMin + dragSpan

    // Clamp while preserving span strictly
    if (newMin < bounds.min) {
      newMin = bounds.min
      newMax = newMin + dragSpan
    } else if (newMax > bounds.max) {
      newMax = bounds.max
      newMin = newMax - dragSpan
    }

    if (bounds.step) {
      newMin = Math.round((newMin - bounds.min) / bounds.step) * bounds.step + bounds.min
      newMax = newMin + dragSpan
    }

    sliderMin.value = newMin
    sliderMax.value = newMax
    updateProgress(newMin, newMax)
    onRangeChange([newMin, newMax])
  })

  const endDrag = (e) => {
    if (isDraggingMiddle) {
      isDraggingMiddle = false
      if (typeof progress.releasePointerCapture === 'function' && e && e.pointerId) {
        try {
          progress.releasePointerCapture(e.pointerId)
        } catch {}
      }
    }
  }

  progress.addEventListener('pointerup', endDrag)
  progress.addEventListener('pointercancel', endDrag)

  return wrapper
}

/**
 * Creates a single slider + numeric input for setting a fixed parameter value.
 */
export function createSingleSlider(param, bounds, currentValue, onValueChange) {
  const wrapper = document.createElement('div')
  wrapper.className = 'single-slider-wrapper'
  wrapper.id = `single-control-${param.name}`

  const slider = document.createElement('input')
  slider.type = 'range'
  slider.id = `single-slider-${param.name}`
  slider.min = bounds.min
  slider.max = bounds.max
  slider.step = bounds.step
  slider.value = currentValue

  const numberInput = document.createElement('input')
  numberInput.type = 'number'
  numberInput.id = `single-input-${param.name}`
  numberInput.min = bounds.min
  numberInput.max = bounds.max
  numberInput.step = bounds.step
  numberInput.value = currentValue

  const update = (val) => {
    let num = parseFloat(val)
    if (isNaN(num)) return
    num = Math.max(bounds.min, Math.min(bounds.max, num))
    slider.value = num
    numberInput.value = num
    onValueChange(num)
  }

  slider.addEventListener('input', () => update(slider.value))
  numberInput.addEventListener('input', () => update(numberInput.value))

  wrapper.appendChild(slider)
  wrapper.appendChild(numberInput)
  return wrapper
}

// ---------------------------------------------------------------------------
// Parameter Card Rendering
// ---------------------------------------------------------------------------

function createEnumParamCard(param, s, type) {
  const card = document.createElement('div')
  card.className = 'param-card'
  card.id = `param-card-${param.name}`

  const header = document.createElement('div')
  header.className = 'param-header'

  const label = document.createElement('label')
  label.className = 'param-toggle-label'
  label.style.cursor = 'default'
  label.textContent = param.label || param.name
  header.appendChild(label)
  card.appendChild(header)

  const enumRow = document.createElement('div')
  enumRow.className = 'enum-control-row'

  const select = document.createElement('select')
  select.id = `select-${param.name}`
  const options = param.values || param.options || []
  for (const opt of options) {
    const optEl = document.createElement('option')
    optEl.value = opt
    optEl.textContent = opt
    if (String(s[param.name]) === String(opt) || (s[param.name] === undefined && String(param.default) === String(opt))) {
      optEl.selected = true
    }
    select.appendChild(optEl)
  }

  select.addEventListener('change', () => {
    s[param.name] = select.value
    if (activeSonifier && activeSonifierType === type) {
      activeSonifier.setParam(param.name, select.value)
    }
    saveSettings(settings)
  })

  enumRow.appendChild(select)
  card.appendChild(enumRow)
  return card
}

function renderParamControls(param, s, type, card, isSonified) {
  const readouts = card.querySelector('.param-readouts')
  const controlContainer = card.querySelector('.param-control-container')
  readouts.innerHTML = ''
  controlContainer.innerHTML = ''

  const bounds = getOutputRangeBounds(param)

  if (isSonified) {
    card.classList.add('sonified')

    // Feed readout badge
    const feedBadge = document.createElement('div')
    feedBadge.className = 'param-feed-badge'
    feedBadge.id = `feed-badge-${param.name}`
    feedBadge.innerHTML = `<span class="feed-label">Feed:</span><span class="feed-val" id="feed-val-${param.name}">${currentFeedValue.toFixed(1)}</span>`
    readouts.appendChild(feedBadge)

    // Range readout badge
    if (!s.paramRanges[param.name]) {
      s.paramRanges[param.name] = [param.range ? param.range[0] : bounds.min, param.range ? param.range[1] : bounds.max]
    }
    const [curMin, curMax] = s.paramRanges[param.name]
    const rangeBadge = document.createElement('div')
    rangeBadge.className = 'param-range-badge'
    rangeBadge.id = `range-badge-${param.name}`
    rangeBadge.textContent = `${formatRangeValue(curMin)} – ${formatRangeValue(curMax)}`
    readouts.appendChild(rangeBadge)

    // Dual-ended range slider
    const dualSlider = createDualRangeSlider(param, bounds, [curMin, curMax], (newRange) => {
      s.paramRanges[param.name] = newRange
      rangeBadge.textContent = `${formatRangeValue(newRange[0])} – ${formatRangeValue(newRange[1])}`
      const adapter = activeAdapters.get(param.name)
      if (adapter) {
        adapter.setConfig({
          outputRange: newRange
        })
      }
      saveSettings(settings)
    })
    controlContainer.appendChild(dualSlider)

  } else {
    card.classList.remove('sonified')

    const currentVal = s[param.name] !== undefined ? s[param.name] : (param.default !== undefined ? param.default : bounds.min)
    s[param.name] = currentVal

    // Static value readout badge
    const valueBadge = document.createElement('div')
    valueBadge.className = 'param-value-badge'
    valueBadge.id = `value-badge-${param.name}`
    valueBadge.textContent = formatRangeValue(currentVal)
    readouts.appendChild(valueBadge)

    // Single slider
    const singleSlider = createSingleSlider(param, bounds, currentVal, (newVal) => {
      s[param.name] = newVal
      valueBadge.textContent = formatRangeValue(newVal)
      if (activeSonifier && activeSonifierType === type) {
        activeSonifier.setParam(param.name, newVal)
      }
      saveSettings(settings)
    })
    controlContainer.appendChild(singleSlider)
  }
}

function createParamCard(param, s, type) {
  const isEnum = param.type === 'enum' || Array.isArray(param.values || param.options)
  if (isEnum) {
    return createEnumParamCard(param, s, type)
  }

  const card = document.createElement('div')
  card.className = 'param-card'
  card.id = `param-card-${param.name}`

  const header = document.createElement('div')
  header.className = 'param-header'

  const toggleLabel = document.createElement('label')
  toggleLabel.className = 'param-toggle-label'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.id = `checkbox-${param.name}`
  const isSonified = Array.isArray(s.sonifiedParams) && s.sonifiedParams.includes(param.name)
  checkbox.checked = isSonified

  const labelSpan = document.createElement('span')
  labelSpan.textContent = param.label || param.name

  toggleLabel.appendChild(checkbox)
  toggleLabel.appendChild(labelSpan)
  header.appendChild(toggleLabel)

  const readouts = document.createElement('div')
  readouts.className = 'param-readouts'
  header.appendChild(readouts)
  card.appendChild(header)

  const controlContainer = document.createElement('div')
  controlContainer.className = 'param-control-container'
  card.appendChild(controlContainer)

  renderParamControls(param, s, type, card, checkbox.checked)

  checkbox.addEventListener('change', () => {
    const checked = checkbox.checked
    if (!Array.isArray(s.sonifiedParams)) s.sonifiedParams = []

    if (checked) {
      if (!s.sonifiedParams.includes(param.name)) {
        s.sonifiedParams.push(param.name)
      }
      if (activeSonifier && activeSonifierType === type) {
        const bounds = getOutputRangeBounds(param)
        const range = s.paramRanges[param.name] || [bounds.min, bounds.max]
        const adapter = new Adapter({
          param: param.name,
          inputRange: [feedMin, feedMax],
          outputRange: range,
          curve: s.curve || 'linear'
        })
        activeAdapters.set(param.name, adapter)
        activeSonifier.setParam(param.name, adapter.map(currentFeedValue))
      }
    } else {
      s.sonifiedParams = s.sonifiedParams.filter(p => p !== param.name)
      if (activeAdapters.has(param.name)) {
        activeAdapters.delete(param.name)
      }
      if (activeSonifier && activeSonifierType === type) {
        const staticVal = s[param.name] !== undefined ? s[param.name] : (param.default !== undefined ? param.default : 0)
        activeSonifier.setParam(param.name, staticVal)
      }
    }
    saveSettings(settings)
    renderParamControls(param, s, type, card, checked)
  })

  return card
}

export function renderParametersPanel() {
  if (!parametersPanel) return
  parametersPanel.innerHTML = ''

  const type = sonifierSelectEl ? sonifierSelectEl.value : settings.sonifierType
  const s = settings[type] || {}

  let tempInstance = activeSonifier
  let isTemp = false
  if (!tempInstance || activeSonifierType !== type) {
    try {
      tempInstance = runtime.create(type)
      isTemp = true
    } catch (e) {
      console.warn('Could not inspect schema for sonifier:', type, e)
    }
  }

  const schema = (tempInstance && typeof tempInstance.getParamSchema === 'function')
    ? tempInstance.getParamSchema()
    : []

  if (schema.length === 0) {
    parametersPanel.innerHTML = '<div style="color: #777; font-size: 0.85rem; padding: 1rem; text-align: center;">No parameters available for this sonifier.</div>'
    if (isTemp) runtime.destroy(type)
    return
  }

  if (!s.sonifiedParams) s.sonifiedParams = []
  if (!s.paramRanges) s.paramRanges = {}

  for (const param of schema) {
    const card = createParamCard(param, s, type)
    parametersPanel.appendChild(card)
  }

  if (isTemp) {
    runtime.destroy(type)
  }
}

// ---------------------------------------------------------------------------
// External / Custom Sonifier Dynamic Loader
// ---------------------------------------------------------------------------

const btnOpenLoadCustom      = document.getElementById('btn-open-load-custom')
const customDialog           = document.getElementById('custom-sonifier-dialog')
const customUrlInput         = document.getElementById('custom-url-input')
const customNameInput        = document.getElementById('custom-name-input')
const customExportInput      = document.getElementById('custom-export-input')
const customMappedParamInput = document.getElementById('custom-mapped-param-input')
const customErrorEl          = document.getElementById('custom-load-error')
const btnCustomLoad          = document.getElementById('btn-custom-load')
const btnCustomCancel        = document.getElementById('btn-custom-cancel')

if (btnOpenLoadCustom && customDialog) {
  btnOpenLoadCustom.addEventListener('click', () => {
    if (customErrorEl) customErrorEl.textContent = ''
    customDialog.showModal()
  })

  if (btnCustomCancel) {
    btnCustomCancel.addEventListener('click', () => {
      customDialog.close()
    })
  }

  if (btnCustomLoad) {
    btnCustomLoad.addEventListener('click', async () => {
      if (customErrorEl) customErrorEl.textContent = ''
      const url = customUrlInput ? customUrlInput.value.trim() : ''
      if (!url) {
        if (customErrorEl) customErrorEl.textContent = 'Please provide a module URL or relative path.'
        return
      }

      try {
        btnCustomLoad.disabled = true
        btnCustomLoad.textContent = 'Loading…'

        const mod = await import(url)
        const explicitExport = customExportInput ? customExportInput.value.trim() : ''
        let SonifierClass = null

        if (explicitExport) {
          SonifierClass = mod[explicitExport]
        } else if (mod.default && typeof mod.default === 'function') {
          SonifierClass = mod.default
        } else {
          for (const key of Object.keys(mod)) {
            if (typeof mod[key] === 'function') {
              SonifierClass = mod[key]
              break
            }
          }
        }

        if (!SonifierClass) {
          throw new Error('No valid Sonifier class/function found in the loaded module.')
        }

        let name = customNameInput ? customNameInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') : ''
        if (!name) {
          name = SonifierClass.name ? SonifierClass.name.replace(/Sonifier$/, '').toLowerCase() : 'custom'
        }

        const displayName = (customNameInput && customNameInput.value.trim()) || SonifierClass.name || name

        let tempInstance = null
        let schema = []
        try {
          tempInstance = new SonifierClass()
          if (typeof tempInstance.getParamSchema === 'function') {
            schema = tempInstance.getParamSchema()
          }
        } catch {}

        let mappedParam = customMappedParamInput ? customMappedParamInput.value.trim() : ''
        if (!mappedParam) {
          mappedParam = schema.length > 0 ? schema[0].name : 'frequency'
        }

        if (!settings[name]) {
          settings[name] = {
            sonifiedParams: [mappedParam],
            paramRanges:    {},
            curve:          'linear',
            volume:         0.5
          }
          for (const param of schema) {
            if (param.default !== undefined) {
              settings[name][param.name] = param.default
            }
          }
        }

        runtime.register(name, SonifierClass)

        if (sonifierSelectEl) {
          let option = sonifierSelectEl.querySelector(`option[value="${name}"]`)
          if (!option) {
            option = document.createElement('option')
            option.value = name
            option.textContent = `${displayName} (External)`
            sonifierSelectEl.appendChild(option)
          }

          const wasPlaying = !!activeSonifier
          if (wasPlaying) {
            stopSonifier()
          }

          sonifierSelectEl.value = name
          settings.sonifierType = name
          saveSettings(settings)

          if (wasPlaying) {
            startSonifier()
          }
          renderParametersPanel()
        }

        customDialog.close()
      } catch (err) {
        console.error('Failed to load external sonifier:', err)
        if (customErrorEl) customErrorEl.textContent = `Error: ${err.message}`
      } finally {
        btnCustomLoad.disabled = false
        btnCustomLoad.textContent = 'Load'
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

renderParametersPanel()
initFeed()
