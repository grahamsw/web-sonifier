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
import { SettingsFormBuilder } from './SettingsFormBuilder.js'

// ---------------------------------------------------------------------------
// Simulated data feed — random walk between 0 and 100
// ---------------------------------------------------------------------------

let currentFeedValue = 50
let previousFeedValue = 50
const feedMin = 0
const feedMax = 100

function startFeed(onUpdate) {
  onUpdate(currentFeedValue)
  return setInterval(() => {
    previousFeedValue = currentFeedValue
    currentFeedValue += (Math.random() - 0.5) * 6
    currentFeedValue = Math.max(feedMin, Math.min(feedMax, currentFeedValue))
    onUpdate(currentFeedValue, previousFeedValue)
  }, settings.feedIntervalMs || 1000)
}

// ---------------------------------------------------------------------------
// UI elements
// ---------------------------------------------------------------------------

const priceValueEl     = document.getElementById('price-value')
const priceChangeEl    = document.getElementById('price-change')
const sonifierSelectEl = document.getElementById('sonifier-select')
const feedRateSelectEl = document.getElementById('feed-rate-select')
const btnPlay          = document.getElementById('btn-play')
const btnStop          = document.getElementById('btn-stop')
const btnSettings      = document.getElementById('btn-settings')
const masterVolumeEl   = document.getElementById('master-volume')
const masterVolDispEl  = document.getElementById('master-volume-display')
const statusEl         = document.getElementById('status')
const dialog           = document.getElementById('settings-dialog')

// Dialog mapping inputs (dynamic feed, mapped parameter, and dual-ended range picker)
const mappedParamSelectEl  = document.getElementById('mapped-param-select')
const feedRangeDisplayEl   = document.getElementById('feed-range-display')
const outputMinValEl       = document.getElementById('output-min-val')
const outputMaxValEl       = document.getElementById('output-max-val')
const rangeProgressEl      = document.getElementById('range-progress')
const rangeSliderMinEl     = document.getElementById('range-slider-min')
const rangeSliderMaxEl     = document.getElementById('range-slider-max')
const curveSelectEl        = document.getElementById('curve-select')
const outputRangeLabelEl   = document.getElementById('output-range-label')

// Container for dynamic sonifier-specific inputs
const dynamicContainer   = document.getElementById('dynamic-params-container')

// Mode toggle & workbench elements
const btnModeFeed            = document.getElementById('btn-mode-feed')
const btnModeManual          = document.getElementById('btn-mode-manual')
const feedDisplaySection     = document.getElementById('feed-display-section')
const manualWorkbenchSection = document.getElementById('manual-workbench-section')
const manualParamsContainer  = document.getElementById('manual-params-container')
const feedRateGroup          = document.getElementById('feed-rate-group')

let currentMode = 'feed'

// ---------------------------------------------------------------------------
// UI configurations ("facets") for sonifiers
// ---------------------------------------------------------------------------

const UI_CONFIGS = {
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
      },
      {
        title: 'VOSC Random Walk Settings',
        params: {
          bufLow: { control: 'slider', label: 'Buffer Low (0-7)', step: 1 },
          bufHigh: { control: 'slider', label: 'Buffer High (0-7)', step: 1 },
          bufSteps: { control: 'slider', label: 'Buffer Steps', step: 1 },
          detuneLow: { control: 'slider', label: 'Detune Low (st)', step: 0.01 },
          detuneHigh: { control: 'slider', label: 'Detune High (st)', step: 0.01 },
          detuneSteps: { control: 'slider', label: 'Detune Steps', step: 1 },
          panLow: { control: 'slider', label: 'Pan Low', step: 0.05 },
          panHigh: { control: 'slider', label: 'Pan High', step: 0.05 },
          panSteps: { control: 'slider', label: 'Pan Steps', step: 1 }
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
          swellDepthStdDev: { control: 'slider', label: 'Depth Std Dev', step: 0.02 }
        }
      },
      {
        title: 'Timbre & Master Settings',
        params: {
          pitch: { control: 'slider', label: 'Spectral Depth (Hz)', step: 10 },
          foam: { control: 'slider', label: 'Foam & Spray', step: 0.05 },
          volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
        }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// State & Defaults
// ---------------------------------------------------------------------------

const runtime = new Runtime()
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

let activeSonifier = null
let activeSonifierType = null
let activeAdapter = null
let feedInterval = null
let settingsBackup = null

const STORAGE_KEY = 'web-sonify-demo-settings'

const defaultSettings = {
  sonifierType:    'tone',
  feedIntervalMs:  1000,
  masterVolume:    0.8,
  tone: {
    mappedParam:     'frequency',
    inputRange:      [0, 100],
    outputRange:     [110, 440],
    paramRanges:     { frequency: [110, 440], volume: [0.1, 0.9] },
    curve:           'exponential',
    waveform:        'sine',
    volume:          0.5,
    frequency:       440
  },
  geiger: {
    mappedParam:     'rate',
    inputRange:      [0, 100],
    outputRange:     [1, 50],
    paramRanges:     { rate: [1, 50], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.7,
    rate:            10
  },
  purr: {
    mappedParam:     'frequency',
    inputRange:      [0, 100],
    outputRange:     [20, 150],
    paramRanges:     { frequency: [20, 150], volume: [0.1, 0.9] },
    curve:           'exponential',
    volume:          0.6,
    frequency:       50,
    jitter:          0.5,
    rumble:          0.5,
    breath:          0.5
  },
  engine: {
    mappedParam:     'pitch',
    inputRange:      [0, 100],
    outputRange:     [20, 2000],
    paramRanges:     { pitch: [20, 2000], rate: [2, 40], volume: [0.1, 0.8] },
    curve:           'exponential',
    volume:          0.25,
    pitch:           65,
    rate:            25,
    volumeVariance:  0.1,
    rolloff:         -96
  },
  liquid: {
    mappedParam:     'frequency',
    inputRange:      [0, 100],
    outputRange:     [20, 80],
    paramRanges:     { frequency: [20, 80], viscosity: [0.1, 0.9], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.5,
    frequency:       50,
    viscosity:       0.5,
    resonatorVolume: 0.5
  },
  mallet: {
    mappedParam:     'strikeRate',
    inputRange:      [0, 100],
    outputRange:     [0.5, 10],
    paramRanges:     { strikeRate: [0.5, 10], hardness: [0.1, 0.9], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.7,
    strikeRate:      2,
    hardness:        0.5,
    boxSize:         1.0,
    resonance:       0.4,
    force:           0.7
  },
  drone: {
    mappedParam:     'frequency',
    inputRange:      [0, 100],
    outputRange:     [20, 200],
    paramRanges:     { frequency: [20, 200], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.5,
    frequency:       100,
    nharm:           12,
    detune:          0.2,
    pan:             0
  },
  vosc: {
    mappedParam:     'frequency',
    inputRange:      [0, 100],
    outputRange:     [100, 1000],
    paramRanges:     { frequency: [100, 1000], volume: [0.1, 0.9] },
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
    mappedParam:     'intensity',
    inputRange:      [0, 100],
    outputRange:     [5, 120],
    paramRanges:     { intensity: [5, 120], pitch: [400, 3000], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.5,
    intensity:       50,
    pitch:           1200,
    dropletSize:     0.4,
    spread:          0.8
  },
  ocean: {
    mappedParam:       'intensity',
    inputRange:        [0, 100],
    outputRange:       [15, 85],
    paramRanges:       { intensity: [15, 85], pitch: [200, 1200], swellPeriod: [3, 15], swellDepth: [0.1, 0.9], volume: [0.1, 0.9] },
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

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return JSON.parse(JSON.stringify(defaultSettings))
    
    const loaded = JSON.parse(saved)
    const settings = JSON.parse(JSON.stringify(defaultSettings))
    
    for (const key of Object.keys(defaultSettings)) {
      if (typeof defaultSettings[key] === 'object' && defaultSettings[key] !== null) {
        if (loaded[key]) {
          settings[key] = { ...defaultSettings[key], ...loaded[key] }
          // Migrate old 85..115 inputRange to [0, 100]
          if (Array.isArray(settings[key].inputRange) && 
              settings[key].inputRange[0] === 85 && settings[key].inputRange[1] === 115) {
            settings[key].inputRange = [0, 100]
          }
          // Migrate sonifierVolume -> volume
          if (loaded[key].sonifierVolume !== undefined) {
            settings[key].volume = loaded[key].sonifierVolume
            delete settings[key].sonifierVolume
          }
          // Ensure mappedParam and paramRanges exist
          if (!settings[key].mappedParam && UI_CONFIGS[key]) {
            settings[key].mappedParam = UI_CONFIGS[key].mappedParam
          }
          if (!settings[key].paramRanges) {
            settings[key].paramRanges = {}
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

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

let settings = loadSettings()
sonifierSelectEl.value = settings.sonifierType
feedRateSelectEl.value = settings.feedIntervalMs
btnSettings.disabled = false
masterVolumeEl.disabled = false

// ---------------------------------------------------------------------------
// Apply settings to live objects
// ---------------------------------------------------------------------------

function applySettings() {
  const type = sonifierSelectEl.value
  const s = settings[type]
  const uiConfig = UI_CONFIGS[type]
  
  if (!uiConfig || !s) return

  const mappedParam = s.mappedParam || uiConfig.mappedParam

  if (activeAdapter) {
    activeAdapter.setConfig({
      param:       mappedParam,
      inputRange:  s.inputRange,
      outputRange: s.outputRange,
      curve:       s.curve
    })
  }

  if (activeSonifier) {
    // Apply all schema parameters (except mappedParam when in feed mode)
    const schema = typeof activeSonifier.getParamSchema === 'function' ? activeSonifier.getParamSchema() : []
    for (const param of schema) {
      if (currentMode === 'feed' && param.name === mappedParam) {
        continue
      }
      if (s[param.name] !== undefined) {
        activeSonifier.setParam(param.name, s[param.name])
      }
    }

    // Apply fixed parameters if any
    for (const [paramName, value] of Object.entries(uiConfig.fixedParams || {})) {
      activeSonifier.setParam(paramName, value)
    }
  }

  runtime.setMasterVolume(settings.masterVolume)
  masterVolumeEl.value = settings.masterVolume
  masterVolDispEl.textContent = settings.masterVolume.toFixed(2)
}

function initFeed() {
  if (feedInterval) clearInterval(feedInterval)
  feedInterval = startFeed((price, prev) => {
    updatePriceDisplay(price, prev)
    if (currentMode === 'feed' && activeAdapter && activeSonifier) {
      const mappedValue = activeAdapter.map(price)
      activeSonifier.setParam(activeAdapter.param, mappedValue)
    }
  })
}

// ---------------------------------------------------------------------------
// Play / Stop / Switch
// ---------------------------------------------------------------------------

async function startSonifier() {
  const type = sonifierSelectEl.value
  const s = settings[type]
  const uiConfig = UI_CONFIGS[type]
  
  if (!uiConfig) return

  activeSonifier = runtime.create(type)
  activeSonifierType = type

  activeAdapter = new Adapter({
    param:        s.mappedParam || uiConfig.mappedParam,
    inputRange:   s.inputRange,
    outputRange:  s.outputRange,
    curve:        s.curve
  })

  applySettings()

  statusEl.textContent = currentMode === 'manual' ? 'Sonifying (Manual Workbench)…' : 'Sonifying…'
  btnPlay.disabled      = true
  btnStop.disabled      = false

  if (currentMode === 'manual') {
    renderManualWorkbench()
  }
}

function stopSonifier() {
  if (activeSonifierType) {
    runtime.destroy(activeSonifierType)
  }
  activeSonifier = null
  activeSonifierType = null
  activeAdapter = null

  statusEl.textContent    = 'Stopped.'
  btnPlay.disabled        = false
  btnStop.disabled        = true
}

btnPlay.addEventListener('click', async () => {
  await runtime.start()
  startSonifier()
})

btnStop.addEventListener('click', () => {
  stopSonifier()
})

sonifierSelectEl.addEventListener('change', async () => {
  const isPlaying = !!activeSonifier
  if (isPlaying) {
    stopSonifier()
    startSonifier()
  }
  settings.sonifierType = sonifierSelectEl.value
  saveSettings(settings)
  if (currentMode === 'manual') {
    renderManualWorkbench()
  }
})

feedRateSelectEl.addEventListener('change', () => {
  settings.feedIntervalMs = parseInt(feedRateSelectEl.value, 10)
  saveSettings(settings)
  initFeed()
})

// Start the visual feed immediately on load
initFeed()

// ---------------------------------------------------------------------------
// Master volume
// ---------------------------------------------------------------------------

masterVolumeEl.addEventListener('input', e => {
  const v = parseFloat(e.target.value)
  runtime.setMasterVolume(v)
  masterVolDispEl.textContent = v.toFixed(2)
  settings.masterVolume = v
  saveSettings(settings)
})

// ---------------------------------------------------------------------------
// Price display
// ---------------------------------------------------------------------------

function updatePriceDisplay(price, prev) {
  priceValueEl.textContent = price.toFixed(2)
  if (prev === undefined) {
    priceChangeEl.textContent = ' '
    priceChangeEl.className = 'change'
    return
  }
  const diff = price - prev
  const sign = diff >= 0 ? '+' : ''
  priceChangeEl.textContent = `${sign}${diff.toFixed(2)}`
  priceChangeEl.className   = `change ${diff >= 0 ? 'up' : 'down'}`
}

// ---------------------------------------------------------------------------
// Manual Workbench & Mode Navigation
// ---------------------------------------------------------------------------

function renderManualWorkbench() {
  if (!manualParamsContainer) return
  manualParamsContainer.innerHTML = ''

  const type = sonifierSelectEl.value
  const s = settings[type] || {}
  const uiConfig = UI_CONFIGS[type]

  let tempInstance = activeSonifier
  let isTemp = false
  if (!tempInstance) {
    try {
      tempInstance = runtime.create(type)
      isTemp = true
    } catch (e) {
      console.warn('Could not instantiate sonifier for schema inspection:', e)
    }
  }

  const schema = (tempInstance && typeof tempInstance.getParamSchema === 'function')
    ? tempInstance.getParamSchema()
    : []

  if (schema.length === 0) {
    manualParamsContainer.innerHTML = '<div style="font-size: 0.8rem; color: #666; text-align: center; padding: 0.5rem;">No parameters available for this sonifier.</div>'
    if (isTemp) runtime.destroy(type)
    return
  }

  for (const param of schema) {
    const row = document.createElement('div')
    row.className = 'workbench-param-row'

    const label = document.createElement('label')
    label.textContent = param.label || param.name
    label.title = `${param.name}${param.description ? ': ' + param.description : ''}`

    const isEnum = param.type === 'enum' && Array.isArray(param.values || param.options)
    const options = isEnum ? (param.values || param.options) : []

    if (isEnum) {
      const select = document.createElement('select')
      select.style.cssText = 'background: #0f1117; border: 1px solid #2a2d3a; border-radius: 4px; color: #fff; font-size: 0.8rem; padding: 0.2rem 0.4rem; flex: 1;'
      for (const opt of options) {
        const optEl = document.createElement('option')
        optEl.value = opt
        optEl.textContent = opt
        select.appendChild(optEl)
      }
      const currentVal = s[param.name] !== undefined ? s[param.name] : param.default
      if (s[param.name] === undefined && currentVal !== undefined) {
        s[param.name] = currentVal
      }
      select.value = currentVal

      select.addEventListener('change', () => {
        s[param.name] = select.value
        if (activeSonifier) {
          activeSonifier.setParam(param.name, select.value)
        }
        saveSettings(settings)
      })

      row.appendChild(label)
      row.appendChild(select)
    } else {
      // Numeric slider + number input
      const range = param.range || [0, 1]
      const min = range[0]
      const max = range[1]

      // Determine step from schema or uiConfig
      let step = param.step
      if (!step && uiConfig?.groups) {
        for (const g of uiConfig.groups) {
          if (g.params?.[param.name]?.step !== undefined) {
            step = g.params[param.name].step
            break
          }
        }
      }
      if (!step) {
        const span = max - min
        if (span <= 2) step = 0.01
        else if (span <= 20) step = 0.1
        else if (span <= 200) step = 1
        else step = 10
      }

      const currentVal = s[param.name] !== undefined
        ? s[param.name]
        : (param.default !== undefined ? param.default : min)

      if (s[param.name] === undefined && currentVal !== undefined) {
        s[param.name] = currentVal
      }

      const slider = document.createElement('input')
      slider.type = 'range'
      slider.min = min
      slider.max = max
      slider.step = step
      slider.value = currentVal

      const number = document.createElement('input')
      number.type = 'number'
      number.min = min
      number.max = max
      number.step = step
      number.value = currentVal

      const updateValue = (val) => {
        let numVal = parseFloat(val)
        if (isNaN(numVal)) return
        numVal = Math.max(min, Math.min(max, numVal))
        slider.value = numVal
        number.value = numVal
        s[param.name] = numVal
        if (activeSonifier) {
          activeSonifier.setParam(param.name, numVal)
        }
        saveSettings(settings)
      }

      slider.addEventListener('input', () => updateValue(slider.value))
      number.addEventListener('input', () => updateValue(number.value))

      row.appendChild(label)
      row.appendChild(slider)
      row.appendChild(number)
    }

    manualParamsContainer.appendChild(row)
  }

  if (isTemp) {
    runtime.destroy(type)
  }
}

function setMode(mode) {
  currentMode = mode
  if (mode === 'manual') {
    if (btnModeFeed) {
      btnModeFeed.classList.remove('active')
      btnModeFeed.setAttribute('aria-selected', 'false')
    }
    if (btnModeManual) {
      btnModeManual.classList.add('active')
      btnModeManual.setAttribute('aria-selected', 'true')
    }

    if (feedDisplaySection) feedDisplaySection.style.display = 'none'
    if (manualWorkbenchSection) manualWorkbenchSection.style.display = 'block'
    if (feedRateGroup) feedRateGroup.style.display = 'none'

    // Pause feed while in manual mode
    if (feedInterval) {
      clearInterval(feedInterval)
      feedInterval = null
    }

    renderManualWorkbench()

    if (activeSonifier) {
      applySettings()
      if (statusEl) statusEl.textContent = 'Sonifying (Manual Workbench)…'
    }
  } else {
    if (btnModeManual) {
      btnModeManual.classList.remove('active')
      btnModeManual.setAttribute('aria-selected', 'false')
    }
    if (btnModeFeed) {
      btnModeFeed.classList.add('active')
      btnModeFeed.setAttribute('aria-selected', 'true')
    }

    if (manualWorkbenchSection) manualWorkbenchSection.style.display = 'none'
    if (feedDisplaySection) feedDisplaySection.style.display = ''
    if (feedRateGroup) feedRateGroup.style.display = ''

    // Resume feed
    initFeed()

    if (activeSonifier) {
      applySettings()
      if (activeAdapter) {
        const mappedValue = activeAdapter.map(currentPrice)
        activeSonifier.setParam(activeAdapter.param, mappedValue)
      }
      if (statusEl) statusEl.textContent = 'Sonifying…'
    }
  }
}

if (btnModeFeed && btnModeManual) {
  btnModeFeed.addEventListener('click', () => setMode('feed'))
  btnModeManual.addEventListener('click', () => setMode('manual'))
}

// ---------------------------------------------------------------------------
// Settings dialog & Dual-Ended Range Slider
// ---------------------------------------------------------------------------

function getOutputRangeBounds(schemaParam) {
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

function formatRangeValue(val) {
  if (Number.isInteger(val)) return String(val)
  const absVal = Math.abs(val)
  if (absVal >= 100) return val.toFixed(0)
  if (absVal >= 10) return val.toFixed(1)
  return val.toFixed(2)
}

function updateRangeSliderUI(minVal, maxVal, trackMin, trackMax) {
  if (!rangeProgressEl || !outputMinValEl || !outputMaxValEl) return
  const span = trackMax - trackMin
  if (span <= 0) return

  const leftPercent = Math.max(0, Math.min(100, ((minVal - trackMin) / span) * 100))
  const rightPercent = Math.max(0, Math.min(100, ((maxVal - trackMin) / span) * 100))

  rangeProgressEl.style.left = `${leftPercent}%`
  rangeProgressEl.style.width = `${Math.max(0, rightPercent - leftPercent)}%`

  outputMinValEl.textContent = formatRangeValue(minVal)
  outputMaxValEl.textContent = formatRangeValue(maxVal)
}

function setupRangeSlider(type) {
  const s = settings[type]
  const uiConfig = UI_CONFIGS[type]
  if (!s || !uiConfig) return

  let tempSonifierInstance = activeSonifier
  let isTemp = false
  if (!tempSonifierInstance || activeSonifierType !== type) {
    tempSonifierInstance = runtime.create(type)
    isTemp = true
  }

  const schema = typeof tempSonifierInstance.getParamSchema === 'function' ? tempSonifierInstance.getParamSchema() : []
  const mappableParams = schema.filter(p => {
    return (p.type === 'number' || p.type === undefined) && Array.isArray(p.range) && p.range.length === 2
  })

  const currentMappedParam = s.mappedParam || uiConfig.mappedParam || (mappableParams[0] ? mappableParams[0].name : 'frequency')
  s.mappedParam = currentMappedParam

  if (mappedParamSelectEl) {
    mappedParamSelectEl.innerHTML = ''
    for (const p of mappableParams) {
      const opt = document.createElement('option')
      opt.value = p.name
      opt.textContent = p.label || p.name
      if (p.name === currentMappedParam) {
        opt.selected = true
      }
      mappedParamSelectEl.appendChild(opt)
    }
  }

  const mappedEntry = schema.find(p => p.name === currentMappedParam) || mappableParams[0]

  if (mappedEntry && outputRangeLabelEl) {
    outputRangeLabelEl.textContent = `Output range (${mappedEntry.label || currentMappedParam})`
  }

  const bounds = getOutputRangeBounds(mappedEntry)

  if (feedRangeDisplayEl) {
    feedRangeDisplayEl.textContent = `${feedMin} to ${feedMax}`
  }

  if (rangeSliderMinEl && rangeSliderMaxEl) {
    rangeSliderMinEl.min = bounds.min
    rangeSliderMinEl.max = bounds.max
    rangeSliderMinEl.step = bounds.step

    rangeSliderMaxEl.min = bounds.min
    rangeSliderMaxEl.max = bounds.max
    rangeSliderMaxEl.step = bounds.step

    if (!s.paramRanges) s.paramRanges = {}
    let [curMin, curMax] = s.paramRanges[currentMappedParam] || s.outputRange || [bounds.min, bounds.max]

    curMin = Math.max(bounds.min, Math.min(bounds.max, curMin))
    curMax = Math.max(bounds.min, Math.min(bounds.max, curMax))
    if (curMin > curMax) curMin = curMax

    s.outputRange = [curMin, curMax]
    s.paramRanges[currentMappedParam] = [curMin, curMax]

    rangeSliderMinEl.value = curMin
    rangeSliderMaxEl.value = curMax

    updateRangeSliderUI(curMin, curMax, bounds.min, bounds.max)
  }

  if (curveSelectEl) {
    curveSelectEl.value = s.curve || 'linear'
  }

  if (isTemp) {
    runtime.destroy(type)
  }
}

if (rangeSliderMinEl && rangeSliderMaxEl) {
  const handleRangeInput = (source) => {
    const type = sonifierSelectEl.value
    const s = settings[type]
    if (!s) return

    let valMin = parseFloat(rangeSliderMinEl.value)
    let valMax = parseFloat(rangeSliderMaxEl.value)
    const trackMin = parseFloat(rangeSliderMinEl.min)
    const trackMax = parseFloat(rangeSliderMinEl.max)

    if (source === 'min') {
      if (valMin > valMax) {
        valMin = valMax
        rangeSliderMinEl.value = valMin
      }
      rangeSliderMinEl.style.zIndex = '4'
      rangeSliderMaxEl.style.zIndex = '3'
    } else {
      if (valMax < valMin) {
        valMax = valMin
        rangeSliderMaxEl.value = valMax
      }
      rangeSliderMaxEl.style.zIndex = '4'
      rangeSliderMinEl.style.zIndex = '3'
    }

    s.outputRange = [valMin, valMax]
    if (!s.paramRanges) s.paramRanges = {}
    const curParam = s.mappedParam || UI_CONFIGS[type]?.mappedParam
    if (curParam) {
      s.paramRanges[curParam] = [valMin, valMax]
    }
    updateRangeSliderUI(valMin, valMax, trackMin, trackMax)
    applySettings()
    saveSettings(settings)
  }

  rangeSliderMinEl.addEventListener('input', () => handleRangeInput('min'))
  rangeSliderMaxEl.addEventListener('input', () => handleRangeInput('max'))
}

if (mappedParamSelectEl) {
  mappedParamSelectEl.addEventListener('change', () => {
    const type = sonifierSelectEl.value
    const s = settings[type]
    const uiConfig = UI_CONFIGS[type]
    if (!s || !uiConfig) return

    const newParam = mappedParamSelectEl.value
    const oldParam = s.mappedParam || uiConfig.mappedParam
    if (newParam === oldParam) return

    // Cache current range for the old parameter
    if (!s.paramRanges) s.paramRanges = {}
    if (s.outputRange) {
      s.paramRanges[oldParam] = s.outputRange
    }

    // Set new mapped parameter
    s.mappedParam = newParam

    // Update range slider for the new parameter
    setupRangeSlider(type)

    // Re-render single-value controls in dynamic settings form
    let tempSonifierInstance = activeSonifier
    let isTemp = false
    if (!tempSonifierInstance) {
      tempSonifierInstance = runtime.create(type)
      isTemp = true
    }

    SettingsFormBuilder.build(dynamicContainer, tempSonifierInstance, uiConfig, s, (paramName, value) => {
      s[paramName] = value
      applySettings()
      saveSettings(settings)
    }, s.mappedParam)

    if (isTemp) {
      runtime.destroy(type)
    }

    // If the old parameter has a single value in s, apply it to the active sonifier
    if (activeSonifier && s[oldParam] !== undefined) {
      activeSonifier.setParam(oldParam, s[oldParam])
    }

    applySettings()
    saveSettings(settings)
  })
}

if (curveSelectEl) {
  curveSelectEl.addEventListener('change', () => {
    const type = sonifierSelectEl.value
    const s = settings[type]
    if (!s) return
    s.curve = curveSelectEl.value
    applySettings()
    saveSettings(settings)
  })
}

btnSettings.addEventListener('click', () => {
  const type = sonifierSelectEl.value
  const s = settings[type]
  const uiConfig = UI_CONFIGS[type]

  // Backup current settings for revert on cancel
  settingsBackup = JSON.parse(JSON.stringify(settings))

  // Setup dynamic feed readout and dual-range picker
  setupRangeSlider(type)

  let tempSonifierInstance = activeSonifier
  let isTemp = false
  if (!tempSonifierInstance) {
    tempSonifierInstance = runtime.create(type)
    isTemp = true
  }

  // Render dynamic setting controls (excluding currently mapped parameter)
  SettingsFormBuilder.build(dynamicContainer, tempSonifierInstance, uiConfig, s, (paramName, value) => {
    s[paramName] = value
    applySettings()
    saveSettings(settings)
  }, s.mappedParam)

  if (isTemp) {
    runtime.destroy(type)
  }

  dialog.showModal()
})

document.getElementById('btn-save').addEventListener('click', () => {
  saveSettings(settings)
  applySettings()
  if (currentMode === 'manual') {
    renderManualWorkbench()
  }
  dialog.close()
})

document.getElementById('btn-cancel').addEventListener('click', () => {
  if (settingsBackup) {
    settings = settingsBackup
    saveSettings(settings)
    applySettings()
    setupRangeSlider(sonifierSelectEl.value)
    if (currentMode === 'manual') {
      renderManualWorkbench()
    }
  }
  dialog.close()
})

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
    customErrorEl.textContent = ''
    customDialog.showModal()
  })

  btnCustomCancel.addEventListener('click', () => {
    customDialog.close()
  })

  btnCustomLoad.addEventListener('click', async () => {
    customErrorEl.textContent = ''
    const url = customUrlInput.value.trim()
    if (!url) {
      customErrorEl.textContent = 'Please provide a module URL or relative path.'
      return
    }

    try {
      btnCustomLoad.disabled = true
      btnCustomLoad.textContent = 'Loading…'

      // Import the ES module dynamically
      const mod = await import(url)

      // Identify the sonifier class
      const explicitExport = customExportInput.value.trim()
      let SonifierClass = null

      if (explicitExport) {
        SonifierClass = mod[explicitExport]
      } else if (mod.default && typeof mod.default === 'function') {
        SonifierClass = mod.default
      } else {
        // Find first exported class or function
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

      // Generate or normalize name
      let name = customNameInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
      if (!name) {
        name = SonifierClass.name ? SonifierClass.name.replace(/Sonifier$/, '').toLowerCase() : 'custom'
      }

      const displayName = customNameInput.value.trim() || SonifierClass.name || name

      // Instantiate temporarily to read parameter schema if available
      let tempInstance = null
      let schema = []
      try {
        tempInstance = new SonifierClass()
        if (typeof tempInstance.getParamSchema === 'function') {
          schema = tempInstance.getParamSchema()
        }
      } catch {
        // Constructor might require audioContext; runtime handles audioContext instantiation
      }

      // Determine mapped parameter
      let mappedParam = customMappedParamInput.value.trim()
      if (!mappedParam) {
        if (schema.length > 0) {
          mappedParam = schema[0].name
        } else {
          mappedParam = 'frequency'
        }
      }

      // Build UI configuration
      const paramControls = {
        volume: { control: 'slider', label: 'Sonifier Volume', step: 0.05 }
      }

      for (const param of schema) {
        if (param.name !== mappedParam && param.name !== 'volume') {
          paramControls[param.name] = {
            control: 'slider',
            label: param.label || param.name,
            step: param.step || 0.01
          }
        }
      }

      UI_CONFIGS[name] = {
        mappedParam,
        groups: [
          {
            title: `${displayName} Settings`,
            params: paramControls
          }
        ]
      }

      // Setup initial settings for this sonifier
      if (!settings[name]) {
        settings[name] = {
          inputRange:  [85, 115],
          outputRange: [100, 1000],
          curve:       'linear',
          volume:      0.5
        }
        for (const param of schema) {
          if (param.name !== 'volume' && param.default !== undefined) {
            settings[name][param.name] = param.default
          }
        }
      }

      // Register with runtime
      runtime.register(name, SonifierClass)

      // Add to select dropdown if not already present
      let option = sonifierSelectEl.querySelector(`option[value="${name}"]`)
      if (!option) {
        option = document.createElement('option')
        option.value = name
        option.textContent = `${displayName} (External)`
        sonifierSelectEl.appendChild(option)
      }

      // Switch to this sonifier
      const wasPlaying = !!activeSonifier
      if (wasPlaying) {
        stopSonifier()
      }

      sonifierSelectEl.value = name
      settings.sonifierType = name
      saveSettings(settings)

      if (wasPlaying) {
        startSonifier()
      } else if (currentMode === 'manual') {
        renderManualWorkbench()
      }

      customDialog.close()
    } catch (err) {
      console.error('Failed to load external sonifier:', err)
      customErrorEl.textContent = `Error: ${err.message}`
    } finally {
      btnCustomLoad.disabled = false
      btnCustomLoad.textContent = 'Load'
    }
  })
}

