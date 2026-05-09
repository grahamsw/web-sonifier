import { Runtime, Adapter } from '@web-sonify/core'
import { ToneSonifier } from '@web-sonify/tone'
import { GeigerSonifier } from '@web-sonify/geiger'
import { PurrSonifier } from '@web-sonify/purr'
import { LiquidSonifier } from '@web-sonify/liquid'
import { MalletSonifier } from '@web-sonify/mallet'

// ---------------------------------------------------------------------------
// Mocked oil price feed — random walk, updates every 3 seconds
// ---------------------------------------------------------------------------

let currentPrice = 100
let previousPrice = 100
const FEED_INTERVAL_MS = 3000

function startFeed(onUpdate) {
  onUpdate(currentPrice)
  return setInterval(() => {
    previousPrice = currentPrice
    currentPrice += (Math.random() - 0.5) * 4
    currentPrice = Math.max(70, Math.min(130, currentPrice)) // keep in bounds
    onUpdate(currentPrice, previousPrice)
  }, FEED_INTERVAL_MS)
}

// ---------------------------------------------------------------------------
// UI elements
// ---------------------------------------------------------------------------

const priceValueEl    = document.getElementById('price-value')
const priceChangeEl   = document.getElementById('price-change')
const sonifierSelectEl = document.getElementById('sonifier-select')
const btnPlay         = document.getElementById('btn-play')
const btnStop         = document.getElementById('btn-stop')
const btnSettings     = document.getElementById('btn-settings')
const masterVolumeEl  = document.getElementById('master-volume')
const masterVolDispEl = document.getElementById('master-volume-display')
const statusEl        = document.getElementById('status')
const dialog          = document.getElementById('settings-dialog')

// Dialog inputs
const inputMinEl        = document.getElementById('input-min')
const inputMaxEl        = document.getElementById('input-max')
const outputMinEl       = document.getElementById('output-min')
const outputMaxEl       = document.getElementById('output-max')
const curveSelectEl     = document.getElementById('curve-select')
const waveformSelectEl  = document.getElementById('waveform-select')
const sonifierVolumeEl  = document.getElementById('sonifier-volume')

// Dialog elements for dynamic updates
const outputRangeLabelEl = document.getElementById('output-range-label')
const groupLabelEl       = document.getElementById('group-label')
const rowWaveformEl      = document.getElementById('row-waveform')

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const runtime = new Runtime()
runtime.register('tone', ToneSonifier)
runtime.register('geiger', GeigerSonifier)
runtime.register('purr', PurrSonifier)
runtime.register('liquid', LiquidSonifier)
runtime.register('mallet', MalletSonifier)

let activeSonifier = null
let activeAdapter = null
let feedInterval = null

const STORAGE_KEY = 'web-sonify-demo-settings'

const defaultSettings = {
  sonifierType:    'tone',
  masterVolume:    0.8,
  tone: {
    inputRange:      [85, 115],
    outputRange:     [110, 440],
    curve:           'exponential',
    waveform:        'sine',
    sonifierVolume:  0.5
  },
  geiger: {
    inputRange:      [85, 115],
    outputRange:     [1, 50],
    curve:           'linear',
    sonifierVolume:  0.7
  },
  purr: {
    inputRange:      [85, 115],
    outputRange:     [20, 150],
    curve:           'exponential',
    sonifierVolume:  0.6
  },
  liquid: {
    inputRange:      [85, 115],
    outputRange:     [20, 80],
    curve:           'linear',
    sonifierVolume:  0.5
  },
  mallet: {
    inputRange:      [85, 115],
    outputRange:     [0.5, 10],
    curve:           'linear',
    sonifierVolume:  0.7
  }
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return JSON.parse(JSON.stringify(defaultSettings))
    
    // Deep merge or manual repair for migrations
    const settings = JSON.parse(saved)
    if (!settings.tone) settings.tone = { ...defaultSettings.tone }
    if (!settings.geiger) settings.geiger = { ...defaultSettings.geiger }
    if (!settings.purr) settings.purr = { ...defaultSettings.purr }
    if (!settings.liquid) settings.liquid = { ...defaultSettings.liquid }
    if (!settings.mallet) settings.mallet = { ...defaultSettings.mallet }
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMappedParam(type) {
  switch (type) {
    case 'tone':   return 'frequency'
    case 'geiger': return 'rate'
    case 'purr':   return 'frequency'
    case 'liquid': return 'frequency'
    case 'mallet': return 'strikeRate'
    default:       return 'frequency'
  }
}

// ---------------------------------------------------------------------------
// Apply settings to live objects
// ---------------------------------------------------------------------------

function applySettings() {
  const type = sonifierSelectEl.value
  const s = settings[type]
  
  if (activeAdapter) {
    activeAdapter.setConfig({
      param:       getMappedParam(type),
      inputRange:  s.inputRange,
      outputRange: s.outputRange,
      curve:       s.curve
    })
  }
  if (activeSonifier) {
    if (type === 'tone') {
      activeSonifier.setParam('waveform', s.waveform)
    }
    activeSonifier.setParam('volume', s.sonifierVolume)
  }
  runtime.setMasterVolume(settings.masterVolume)
  masterVolumeEl.value = settings.masterVolume
  masterVolDispEl.textContent = settings.masterVolume.toFixed(2)
}

// ---------------------------------------------------------------------------
// Play / Stop
// ---------------------------------------------------------------------------

btnPlay.addEventListener('click', async () => {
  await runtime.start()

  const type = sonifierSelectEl.value
  const s = settings[type]
  
  activeSonifier = runtime.create(type)

  activeAdapter = new Adapter({
    param:        getMappedParam(type),
    inputRange:   s.inputRange,
    outputRange:  s.outputRange,
    curve:        s.curve
  })

  applySettings()

  feedInterval = startFeed((price, prev) => {
    updatePriceDisplay(price, prev)
    const mappedValue = activeAdapter.map(price)
    activeSonifier.setParam(activeAdapter.param, mappedValue)
  })

  statusEl.textContent = 'Sonifying…'
  btnPlay.disabled      = true
  btnStop.disabled      = false
  btnSettings.disabled  = false
  sonifierSelectEl.disabled = true
  masterVolumeEl.disabled = false
})

btnStop.addEventListener('click', () => {
  clearInterval(feedInterval)
  const type = sonifierSelectEl.value
  runtime.destroy(type)
  activeSonifier = null
  activeAdapter = null

  statusEl.textContent    = 'Stopped.'
  btnPlay.disabled        = false
  btnStop.disabled        = true
  btnSettings.disabled    = true
  sonifierSelectEl.disabled = false
  masterVolumeEl.disabled = true
})

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
// Settings dialog
// ---------------------------------------------------------------------------

btnSettings.addEventListener('click', () => {
  const type = sonifierSelectEl.value
  const s = settings[type]

  // Dynamic UI updates
  if (type === 'geiger') {
    outputRangeLabelEl.textContent = 'Output range (Clicks/sec)'
    groupLabelEl.textContent = 'Geiger'
    rowWaveformEl.style.display = 'none'
  } else if (type === 'mallet') {
    outputRangeLabelEl.textContent = 'Output range (Strikes/sec)'
    groupLabelEl.textContent = 'Mallet'
    rowWaveformEl.style.display = 'none'
  } else if (type === 'purr') {
    outputRangeLabelEl.textContent = 'Output range (Hz)'
    groupLabelEl.textContent = 'Purr'
    rowWaveformEl.style.display = 'none'
  } else if (type === 'liquid') {
    outputRangeLabelEl.textContent = 'Output range (Hz)'
    groupLabelEl.textContent = 'Liquid'
    rowWaveformEl.style.display = 'none'
  } else {
    outputRangeLabelEl.textContent = 'Output range (Hz)'
    groupLabelEl.textContent = 'Tone'
    rowWaveformEl.style.display = 'flex'
  }

  // Populate dialog from current settings
  inputMinEl.value       = s.inputRange[0]
  inputMaxEl.value       = s.inputRange[1]
  outputMinEl.value      = s.outputRange[0]
  outputMaxEl.value      = s.outputRange[1]
  curveSelectEl.value    = s.curve
  waveformSelectEl.value = s.waveform || 'sine'
  sonifierVolumeEl.value = s.sonifierVolume

  dialog.showModal()
})

document.getElementById('btn-save').addEventListener('click', () => {
  const type = sonifierSelectEl.value
  const s = settings[type]

  s.inputRange     = [parseFloat(inputMinEl.value), parseFloat(inputMaxEl.value)]
  s.outputRange    = [parseFloat(outputMinEl.value), parseFloat(outputMaxEl.value)]
  s.curve          = curveSelectEl.value
  s.sonifierVolume = parseFloat(sonifierVolumeEl.value)
  
  if (type === 'tone') {
    s.waveform = waveformSelectEl.value
  }

  settings.sonifierType = type

  saveSettings(settings)
  applySettings()
  dialog.close()
})

document.getElementById('btn-cancel').addEventListener('click', () => {
  dialog.close()
})
