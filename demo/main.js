import { Runtime, Adapter } from '../packages/core/src/index.js'
import { ToneSonifier } from '../packages/tone/src/ToneSonifier.js'

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

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const runtime = new Runtime()
runtime.register('tone', ToneSonifier)

let tone = null
let pitchAdapter = null
let feedInterval = null

const STORAGE_KEY = 'web-sonify-demo-settings'

const defaultSettings = {
  inputRange:      [85, 115],
  outputRange:     [110, 440],
  curve:           'exponential',
  waveform:        'sine',
  sonifierVolume:  0.5,
  masterVolume:    0.8
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : { ...defaultSettings }
  } catch {
    return { ...defaultSettings }
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

let settings = loadSettings()

// ---------------------------------------------------------------------------
// Apply settings to live objects
// ---------------------------------------------------------------------------

function applySettings() {
  if (pitchAdapter) {
    pitchAdapter.setConfig({
      inputRange:  settings.inputRange,
      outputRange: settings.outputRange,
      curve:       settings.curve
    })
  }
  if (tone) {
    tone.setParam('waveform', settings.waveform)
    tone.setParam('volume',   settings.sonifierVolume)
  }
  runtime.setMasterVolume(settings.masterVolume)
  masterVolumeEl.value = settings.masterVolume
  masterVolDispEl.textContent = settings.masterVolume.toFixed(2)
}

// ---------------------------------------------------------------------------
// Play / Stop
// ---------------------------------------------------------------------------

btnPlay.addEventListener('click', () => {
  runtime.start()

  tone = runtime.create('tone')

  pitchAdapter = new Adapter({
    param:        'frequency',
    inputRange:   settings.inputRange,
    outputRange:  settings.outputRange,
    curve:        settings.curve
  })

  applySettings()

  feedInterval = startFeed((price, prev) => {
    updatePriceDisplay(price, prev)
    const freq = pitchAdapter.map(price)
    tone.setParam('frequency', freq)
  })

  statusEl.textContent = 'Sonifying…'
  btnPlay.disabled      = true
  btnStop.disabled      = false
  btnSettings.disabled  = false
  masterVolumeEl.disabled = false
})

btnStop.addEventListener('click', () => {
  clearInterval(feedInterval)
  runtime.destroy('tone')
  tone = null
  pitchAdapter = null

  statusEl.textContent    = 'Stopped.'
  btnPlay.disabled        = false
  btnStop.disabled        = true
  btnSettings.disabled    = true
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
  // Populate dialog from current settings
  inputMinEl.value       = settings.inputRange[0]
  inputMaxEl.value       = settings.inputRange[1]
  outputMinEl.value      = settings.outputRange[0]
  outputMaxEl.value      = settings.outputRange[1]
  curveSelectEl.value    = settings.curve
  waveformSelectEl.value = settings.waveform
  sonifierVolumeEl.value = settings.sonifierVolume

  dialog.showModal()
})

document.getElementById('btn-save').addEventListener('click', () => {
  settings.inputRange     = [parseFloat(inputMinEl.value), parseFloat(inputMaxEl.value)]
  settings.outputRange    = [parseFloat(outputMinEl.value), parseFloat(outputMaxEl.value)]
  settings.curve          = curveSelectEl.value
  settings.waveform       = waveformSelectEl.value
  settings.sonifierVolume = parseFloat(sonifierVolumeEl.value)

  saveSettings(settings)
  applySettings()
  dialog.close()
})

document.getElementById('btn-cancel').addEventListener('click', () => {
  dialog.close()
})
