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
import {
  renderAutomatedEditor,
  getOutputRangeBounds,
  formatRangeValue,
  createDualRangeSlider,
  createSingleSlider,
  createDiscreteParamCard,
  createBooleanParamCard,
  createContinuousParamCard,
  isDiscreteParam,
  isBooleanParam
} from './AutomatedParameterEditor.js'

export {
  renderAutomatedEditor,
  getOutputRangeBounds,
  formatRangeValue,
  createDualRangeSlider,
  createSingleSlider,
  createDiscreteParamCard,
  createBooleanParamCard,
  createContinuousParamCard,
  isDiscreteParam,
  isBooleanParam
}

// ---------------------------------------------------------------------------
// Rate Options
// ---------------------------------------------------------------------------

export const RATE_OPTIONS = [
  { value: 1000,   label: '1 / sec' },
  { value: 500,    label: '2 / sec' },
  { value: 250,    label: '4 / sec' },
  { value: 2000,   label: '1 / 2s' },
  { value: 5000,   label: '1 / 5s' },
  { value: 10000,  label: '1 / 10s' },
  { value: 30000,  label: '1 / 30s' },
  { value: 60000,  label: '1 / min' },
  { value: 300000, label: '1 / 5m' },
  { value: 600000, label: '1 / 10m' }
]

// ---------------------------------------------------------------------------
// DataFeed Class (Independent Brownian Walk Engine)
// ---------------------------------------------------------------------------

export class DataFeed {
  constructor({ id, label, value = 50, rateMs = 1000, stepSize = 6 }) {
    this.id = id
    this.label = label || `Feed ${id}`
    this.value = Math.max(0, Math.min(100, typeof value === 'number' ? value : 50))
    this.previousValue = this.value
    this.rateMs = rateMs
    this.stepSize = Math.max(1, Math.min(20, stepSize))
    this.timerId = null
    this.listeners = new Set()
  }

  start() {
    this.stop()
    this._notify()
    this.timerId = setInterval(() => {
      this.tick()
    }, this.rateMs)
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

  setRate(rateMs) {
    this.rateMs = rateMs
    if (this.timerId) {
      this.start()
    }
  }

  setStepSize(stepSize) {
    this.stepSize = Math.max(1, Math.min(20, stepSize))
  }

  tick() {
    this.previousValue = this.value
    const delta = (Math.random() - 0.5) * 2 * this.stepSize
    this.value = Math.max(0, Math.min(100, this.value + delta))
    this._notify()
  }

  subscribe(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener(this)
      } catch (e) {
        console.error('Error in feed listener:', e)
      }
    }
  }

  toJSON() {
    return {
      id: this.id,
      label: this.label,
      value: this.value,
      rateMs: this.rateMs,
      stepSize: this.stepSize
    }
  }
}

// ---------------------------------------------------------------------------
// UI Elements
// ---------------------------------------------------------------------------

const sonifierSelectEl = document.getElementById('sonifier-select')
const btnPlay          = document.getElementById('btn-play')
const btnStop          = document.getElementById('btn-stop')
const masterVolumeEl   = document.getElementById('master-volume')
const masterVolDispEl  = document.getElementById('master-volume-display')
const statusEl         = document.getElementById('status')
const parametersPanel  = document.getElementById('parameters-panel')
const feedsContainer   = document.getElementById('feeds-container')
const btnAddFeed       = document.getElementById('btn-add-feed')

// ---------------------------------------------------------------------------
// Sonifier Registry & Schema Inspection (AudioContext-free)
// ---------------------------------------------------------------------------

export const SONIFIER_CLASSES = {
  tone: ToneSonifier,
  geiger: GeigerSonifier,
  purr: PurrSonifier,
  engine: EngineSonifier,
  liquid: LiquidSonifier,
  mallet: MalletSonifier,
  drone: DroneSonifier,
  vosc: VoscSonifier,
  rain: RainSonifier,
  ocean: OceanSonifier
}

export function getSonifierSchema(type) {
  if (activeSonifier && activeSonifierType === type && typeof activeSonifier.getParamSchema === 'function') {
    return activeSonifier.getParamSchema()
  }
  const SonifierClass = SONIFIER_CLASSES[type] || runtime._registry?.[type]
  if (SonifierClass) {
    try {
      const temp = new SonifierClass()
      if (typeof temp.getParamSchema === 'function') {
        return temp.getParamSchema()
      }
    } catch (e) {
      console.warn('Could not inspect schema for sonifier:', type, e)
    }
  }
  return []
}

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
  sonifierType: 'tone',
  masterVolume: 0.8,
  feeds: [
    { id: 'A', label: 'Feed A', value: 50, rateMs: 1000, stepSize: 6 },
    { id: 'B', label: 'Feed B', value: 50, rateMs: 2000, stepSize: 4 }
  ],
  tone: {
    sonifiedParams:  ['frequency'],
    paramFeeds:      { frequency: 'A', volume: 'B' },
    paramRanges:     { frequency: [110, 440], volume: [0.1, 0.9] },
    curve:           'exponential',
    waveform:        'sine',
    volume:          0.5,
    frequency:       440
  },
  geiger: {
    sonifiedParams:  ['rate'],
    paramFeeds:      { rate: 'A', volume: 'B' },
    paramRanges:     { rate: [1, 50], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.7,
    rate:            10
  },
  purr: {
    sonifiedParams:  ['frequency'],
    paramFeeds:      { frequency: 'A', volume: 'B' },
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
    paramFeeds:      { pitch: 'A', rate: 'B', volume: 'A' },
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
    paramFeeds:      { frequency: 'A', viscosity: 'B', resonatorVolume: 'B', volume: 'A' },
    paramRanges:     { frequency: [20, 80], viscosity: [0.1, 0.9], resonatorVolume: [0.1, 0.9], volume: [0.1, 0.9] },
    curve:           'linear',
    volume:          0.5,
    frequency:       50,
    viscosity:       0.5,
    resonatorVolume: 0.5
  },
  mallet: {
    sonifiedParams:  ['strikeRate'],
    paramFeeds:      { strikeRate: 'A', hardness: 'B', boxSize: 'B', volume: 'A' },
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
    paramFeeds:      { frequency: 'A', nharm: 'B', detune: 'B', pan: 'A', volume: 'A' },
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
    paramFeeds:      { frequency: 'A', amplitude: 'B', spread: 'B', volume: 'A' },
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
    paramFeeds:      { intensity: 'A', pitch: 'B', dropletSize: 'A', volume: 'A' },
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
    paramFeeds:        { intensity: 'A', pitch: 'B', swellPeriod: 'B', swellDepth: 'A', volume: 'A' },
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
export const feeds = new Map()          // Map<feedId, DataFeed>

const STORAGE_KEY = 'web-sonify-demo-settings'

// ---------------------------------------------------------------------------
// URL Serialization & Deserialization (Deep Linking)
// ---------------------------------------------------------------------------

export function parseUrlState() {
  if (typeof window === 'undefined' || !window.location) return null
  const hash = (window.location.hash && window.location.hash.startsWith('#'))
    ? window.location.hash.slice(1)
    : ((window.location.search && window.location.search.startsWith('?')) ? window.location.search.slice(1) : '')

  if (!hash) return null

  const params = new URLSearchParams(hash)
  if (!params.has('sonifier')) return null

  const type = params.get('sonifier')
  const parsedSettings = JSON.parse(JSON.stringify(defaultSettings))
  parsedSettings.sonifierType = type

  if (params.has('vol')) {
    parsedSettings.masterVolume = Math.max(0, Math.min(1, parseFloat(params.get('vol')) || 0.8))
  }

  if (params.has('feeds')) {
    const feedDefs = params.get('feeds').split(',')
    const parsedFeeds = []
    for (const def of feedDefs) {
      const [id, rate, step] = def.split(':')
      if (id) {
        parsedFeeds.push({
          id,
          label: `Feed ${id}`,
          rateMs: parseInt(rate, 10) || 1000,
          stepSize: parseInt(step, 10) || 6,
          value: 50
        })
      }
    }
    if (parsedFeeds.length > 0) {
      parsedSettings.feeds = parsedFeeds
    }
  }

  if (!parsedSettings[type]) {
    parsedSettings[type] = {
      sonifiedParams: [],
      paramFeeds: {},
      paramRanges: {}
    }
  }

  const sonifierSettings = parsedSettings[type]
  sonifierSettings.sonifiedParams = []
  if (!sonifierSettings.paramFeeds) sonifierSettings.paramFeeds = {}
  if (!sonifierSettings.paramRanges) sonifierSettings.paramRanges = {}
  if (!sonifierSettings.paramInverts) sonifierSettings.paramInverts = {}
  if (!sonifierSettings.paramCurves) sonifierSettings.paramCurves = {}

  const schema = getSonifierSchema(type)
  for (const param of schema) {
    if (params.has(param.name)) {
      const rawVal = params.get(param.name)
      if (rawVal.includes(':')) {
        const parts = rawVal.split(':')
        const feedId = parts[0]
        const rangeStr = parts[1]
        const rangeParts = rangeStr.split('-').map(Number)
        sonifierSettings.sonifiedParams.push(param.name)
        sonifierSettings.paramFeeds[param.name] = feedId || 'A'
        if (rangeParts.length === 2 && !isNaN(rangeParts[0]) && !isNaN(rangeParts[1])) {
          sonifierSettings.paramRanges[param.name] = [rangeParts[0], rangeParts[1]]
        }

        let isInv = false
        let curveVal = param.curve || 'linear'
        for (let i = 2; i < parts.length; i++) {
          const token = parts[i].toLowerCase()
          if (token === 'inv') {
            isInv = true
          } else if (token === 'lin' || token === 'linear') {
            curveVal = 'linear'
          } else if (token === 'exp' || token === 'exponential') {
            curveVal = 'exponential'
          } else if (token === 'log' || token === 'logarithmic') {
            curveVal = 'logarithmic'
          }
        }
        sonifierSettings.paramInverts[param.name] = isInv
        sonifierSettings.paramCurves[param.name] = curveVal
      } else {
        const num = Number(rawVal)
        sonifierSettings[param.name] = isNaN(num) ? rawVal : num
      }
    }
  }

  return parsedSettings
}

export function updateUrlState() {
  if (typeof window === 'undefined' || !window.history || !window.location) return

  const currentType = sonifierSelectEl ? sonifierSelectEl.value : settings.sonifierType
  const s = settings[currentType] || {}
  const schema = getSonifierSchema(currentType)

  const searchParams = new URLSearchParams()
  searchParams.set('sonifier', currentType)
  searchParams.set('vol', (settings.masterVolume ?? 0.8).toFixed(2))

  // Feeds format: A:1000:6,B:2000:4
  const feedList = Array.from(feeds.values()).map(f => `${f.id}:${f.rateMs}:${f.stepSize}`)
  searchParams.set('feeds', feedList.join(','))

  const sonifiedSet = new Set(s.sonifiedParams || [])

  for (const param of schema) {
    if (sonifiedSet.has(param.name)) {
      const feedId = s.paramFeeds?.[param.name] || 'A'
      const bounds = getOutputRangeBounds(param)
      const range = s.paramRanges?.[param.name] || [bounds.min, bounds.max]
      const invFlag = s.paramInverts?.[param.name] ? ':inv' : ''
      const curve = s.paramCurves?.[param.name] || param.curve || 'linear'
      searchParams.set(param.name, `${feedId}:${formatRangeValue(range[0])}-${formatRangeValue(range[1])}:${curve}${invFlag}`)
    } else {
      const val = s[param.name] !== undefined ? s[param.name] : param.default
      if (val !== undefined) {
        searchParams.set(param.name, typeof val === 'number' ? formatRangeValue(val) : val)
      }
    }
  }

  const newHash = '#' + searchParams.toString()
  try {
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash)
    }
  } catch (e) {
    console.warn('Could not update URL state:', e)
  }
}

export function loadSettings() {
  // 1. Check URL state first
  const urlState = parseUrlState()
  if (urlState) {
    return urlState
  }

  // 2. Fall back to localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return JSON.parse(JSON.stringify(defaultSettings))

    const loaded = JSON.parse(saved)
    const settings = JSON.parse(JSON.stringify(defaultSettings))

    for (const key of Object.keys(defaultSettings)) {
      if (typeof defaultSettings[key] === 'object' && defaultSettings[key] !== null && !Array.isArray(defaultSettings[key])) {
        if (loaded[key]) {
          settings[key] = { ...defaultSettings[key], ...loaded[key] }

          // Ensure sonifiedParams is an array
          if (!Array.isArray(settings[key].sonifiedParams)) {
            if (settings[key].mappedParam) {
              settings[key].sonifiedParams = [settings[key].mappedParam]
            } else if (defaultSettings[key].sonifiedParams) {
              settings[key].sonifiedParams = [...defaultSettings[key].sonifiedParams]
            } else {
              settings[key].sonifiedParams = []
            }
          }

          // Ensure paramRanges, paramFeeds, paramInverts, and paramCurves exist
          if (!settings[key].paramRanges) {
            settings[key].paramRanges = { ...(defaultSettings[key].paramRanges || {}) }
          }
          if (!settings[key].paramFeeds) {
            settings[key].paramFeeds = { ...(defaultSettings[key].paramFeeds || {}) }
          }
          if (!settings[key].paramInverts) {
            settings[key].paramInverts = { ...(defaultSettings[key].paramInverts || {}) }
          }
          if (!settings[key].paramCurves) {
            settings[key].paramCurves = { ...(defaultSettings[key].paramCurves || {}) }
          }

          if (settings[key].outputRange && settings[key].mappedParam && !settings[key].paramRanges[settings[key].mappedParam]) {
            settings[key].paramRanges[settings[key].mappedParam] = settings[key].outputRange
          }
        }
      } else if (key === 'feeds' && Array.isArray(loaded.feeds) && loaded.feeds.length > 0) {
        settings.feeds = loaded.feeds
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
    s.feeds = Array.from(feeds.values()).map(f => f.toJSON())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch (e) {
    console.warn('Could not save settings to localStorage:', e)
  }
  updateUrlState()
}

export let settings = loadSettings()

// Initialize feeds
export function initFeedsFromSettings() {
  for (const f of feeds.values()) {
    f.stop()
  }
  feeds.clear()

  const feedConfigs = (settings.feeds && settings.feeds.length > 0)
    ? settings.feeds
    : defaultSettings.feeds

  for (const conf of feedConfigs) {
    const feed = new DataFeed(conf)
    feed.subscribe(handleFeedUpdate)
    feeds.set(feed.id, feed)
  }

  // Ensure at least A and B exist
  if (!feeds.has('A')) {
    const feedA = new DataFeed({ id: 'A', label: 'Feed A', value: 50, rateMs: 1000, stepSize: 6 })
    feedA.subscribe(handleFeedUpdate)
    feeds.set('A', feedA)
  }
  if (!feeds.has('B')) {
    const feedB = new DataFeed({ id: 'B', label: 'Feed B', value: 50, rateMs: 2000, stepSize: 4 })
    feedB.subscribe(handleFeedUpdate)
    feeds.set('B', feedB)
  }
}

initFeedsFromSettings()

if (sonifierSelectEl) sonifierSelectEl.value = settings.sonifierType
if (masterVolumeEl) {
  masterVolumeEl.disabled = false
  masterVolumeEl.value = settings.masterVolume
}
if (masterVolDispEl) masterVolDispEl.textContent = settings.masterVolume.toFixed(2)

// ---------------------------------------------------------------------------
// Feed Tick & Parameter Linking
// ---------------------------------------------------------------------------

export function handleFeedUpdate(feed) {
  // 1. Update feed card display in left panel
  const valLarge = document.getElementById(`feed-val-large-${feed.id}`)
  const meterBar = document.getElementById(`feed-meter-bar-${feed.id}`)
  if (valLarge) valLarge.textContent = feed.value.toFixed(1)
  if (meterBar) meterBar.style.width = `${Math.max(0, Math.min(100, feed.value))}%`

  // 2. Modulate sonifier parameters linked to this feed
  const currentType = sonifierSelectEl ? sonifierSelectEl.value : settings.sonifierType
  const s = settings[currentType]
  if (!s) return

  const sonifiedList = s.sonifiedParams || []
  const paramFeeds = s.paramFeeds || {}

  for (const paramName of sonifiedList) {
    const linkedFeedId = paramFeeds[paramName] || 'A'
    if (linkedFeedId === feed.id) {
      const paramFeedValEl = document.getElementById(`feed-val-${paramName}`)
      if (paramFeedValEl) paramFeedValEl.textContent = feed.value.toFixed(1)

      const adapter = activeAdapters.get(paramName)
      const mappedVal = adapter ? adapter.map(feed.value) : feed.value

      const mappedValEl = document.getElementById(`mapped-val-${paramName}`)
      if (mappedValEl) mappedValEl.textContent = formatRangeValue(mappedVal)

      if (activeSonifier) {
        activeSonifier.setParam(paramName, mappedVal)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Audio Application & Synchronization
// ---------------------------------------------------------------------------

export function applySettings() {
  const type = sonifierSelectEl ? sonifierSelectEl.value : settings.sonifierType
  const s = settings[type]
  if (!s) return

  const sonifiedSet = new Set(s.sonifiedParams || [])
  const schema = getSonifierSchema(type)
  const schemaMap = new Map(schema.map(p => [p.name, p]))

  for (const [paramName, adapter] of activeAdapters.entries()) {
    const range = s.paramRanges?.[paramName] || [0, 100]
    const pDef = schemaMap.get(paramName) || { name: paramName }
    const isInverted = Boolean(s.paramInverts?.[paramName])
    const curve = s.paramCurves?.[paramName] || pDef.curve || s.curve || 'linear'
    adapter.setConfig({
      param: paramName,
      inputRange: [0, 100],
      outputRange: range,
      curve,
      invert: isInverted
    })
  }

  if (activeSonifier) {
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
  const paramFeeds = s.paramFeeds || {}
  const schema = getSonifierSchema(type)
  const schemaMap = new Map(schema.map(p => [p.name, p]))

  for (const paramName of sonifiedList) {
    const paramDef = schemaMap.get(paramName) || { name: paramName }
    const bounds = getOutputRangeBounds(paramDef)
    const range = s.paramRanges?.[paramName] || [bounds.min, bounds.max]
    const isInverted = Boolean(s.paramInverts?.[paramName])
    const curve = s.paramCurves?.[paramName] || paramDef.curve || s.curve || 'linear'
    const adapter = new Adapter({
      param: paramName,
      inputRange: [0, 100],
      outputRange: range,
      curve,
      invert: isInverted
    })
    activeAdapters.set(paramName, adapter)

    const linkedFeedId = paramFeeds[paramName] || 'A'
    const feed = feeds.get(linkedFeedId) || feeds.get('A')
    const feedVal = feed ? feed.value : 50
    const mapped = adapter.map(feedVal)
    activeSonifier.setParam(paramName, mapped)

    const mappedValEl = document.getElementById(`mapped-val-${paramName}`)
    if (mappedValEl) {
      mappedValEl.textContent = `${formatRangeValue(mapped)}${paramDef.unit ? ' ' + paramDef.unit : ''}`
    }
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
// Parameters Panel Rendering (Automated Editor)
// ---------------------------------------------------------------------------

export function renderParametersPanel() {
  if (!parametersPanel) return
  const type = sonifierSelectEl ? sonifierSelectEl.value : settings.sonifierType
  const schema = getSonifierSchema(type)
  const schemaMap = new Map(schema.map(p => [p.name, p]))

  renderAutomatedEditor({
    container: parametersPanel,
    schema,
    settings,
    sonifierType: type,
    feeds,
    callbacks: {
      onParamChange: (paramName, newVal) => {
        if (activeSonifier && activeSonifierType === type) {
          activeSonifier.setParam(paramName, newVal)
        }
        saveSettings(settings)
      },
      onSonifyToggle: (paramName, isSonified) => {
        const s = settings[type]
        if (activeSonifier && activeSonifierType === type) {
          if (isSonified) {
            const paramDef = schemaMap.get(paramName) || { name: paramName }
            const bounds = getOutputRangeBounds(paramDef)
            const range = s.paramRanges[paramName] || [bounds.min, bounds.max]
            const isInverted = Boolean(s.paramInverts?.[paramName])
            const curve = s.paramCurves?.[paramName] || paramDef.curve || 'linear'
            const adapter = new Adapter({
              param: paramName,
              inputRange: [0, 100],
              outputRange: range,
              curve,
              invert: isInverted
            })
            activeAdapters.set(paramName, adapter)
            const linkedFeedId = s.paramFeeds?.[paramName] || 'A'
            const feed = feeds.get(linkedFeedId)
            if (feed) handleFeedUpdate(feed)
          } else {
            activeAdapters.delete(paramName)
            const staticVal = s[paramName] !== undefined ? s[paramName] : 0
            activeSonifier.setParam(paramName, staticVal)
          }
        }
        saveSettings(settings)
      },
      onFeedLinkChange: (paramName, newFeedId) => {
        saveSettings(settings)
        if (activeSonifier && activeSonifierType === type) {
          const newFeed = feeds.get(newFeedId)
          if (newFeed) {
            const adapter = activeAdapters.get(paramName)
            if (adapter) {
              const mapped = adapter.map(newFeed.value)
              activeSonifier.setParam(paramName, mapped)
              const mappedValEl = document.getElementById(`mapped-val-${paramName}`)
              if (mappedValEl) {
                const paramDef = schemaMap.get(paramName) || {}
                mappedValEl.textContent = `${formatRangeValue(mapped)}${paramDef.unit ? ' ' + paramDef.unit : ''}`
              }
            }
          }
        }
      },
      onRangeChange: (paramName, newRange) => {
        saveSettings(settings)
        const adapter = activeAdapters.get(paramName)
        if (adapter) {
          adapter.setConfig({ outputRange: newRange })
          if (activeSonifier && activeSonifierType === type) {
            const s = settings[type]
            const linkedFeedId = s.paramFeeds?.[paramName] || 'A'
            const feed = feeds.get(linkedFeedId)
            if (feed) handleFeedUpdate(feed)
          }
        }
      },
      onInvertToggle: (paramName, isInverted) => {
        saveSettings(settings)
        const adapter = activeAdapters.get(paramName)
        if (adapter) {
          adapter.setConfig({ invert: isInverted })
          if (activeSonifier && activeSonifierType === type) {
            const s = settings[type]
            const linkedFeedId = s.paramFeeds?.[paramName] || 'A'
            const feed = feeds.get(linkedFeedId)
            if (feed) handleFeedUpdate(feed)
          }
        }
      },
      onCurveChange: (paramName, newCurve) => {
        saveSettings(settings)
        const adapter = activeAdapters.get(paramName)
        if (adapter) {
          adapter.setConfig({ curve: newCurve })
          if (activeSonifier && activeSonifierType === type) {
            const s = settings[type]
            const linkedFeedId = s.paramFeeds?.[paramName] || 'A'
            const feed = feeds.get(linkedFeedId)
            if (feed) handleFeedUpdate(feed)
          }
        }
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Feeds Panel Rendering
// ---------------------------------------------------------------------------

export function renderFeedsPanel() {
  if (!feedsContainer) return
  feedsContainer.innerHTML = ''

  for (const feed of feeds.values()) {
    const card = createFeedCard(feed)
    feedsContainer.appendChild(card)
  }
}

function createFeedCard(feed) {
  const card = document.createElement('div')
  card.className = `feed-card feed-theme-${feed.id}`
  card.id = `feed-card-${feed.id}`

  // Header: Tag + Large value readout
  const header = document.createElement('div')
  header.className = 'feed-card-header'

  const tag = document.createElement('div')
  tag.className = 'feed-tag'
  const pill = document.createElement('span')
  pill.className = 'feed-badge-pill'
  const title = document.createElement('span')
  title.textContent = feed.label || `Feed ${feed.id}`
  tag.appendChild(pill)
  tag.appendChild(title)

  const valLarge = document.createElement('div')
  valLarge.className = 'feed-val-large'
  valLarge.id = `feed-val-large-${feed.id}`
  valLarge.textContent = feed.value.toFixed(1)

  header.appendChild(tag)
  header.appendChild(valLarge)
  card.appendChild(header)

  // Progress Meter
  const meterTrack = document.createElement('div')
  meterTrack.className = 'feed-meter-track'
  const meterBar = document.createElement('div')
  meterBar.className = 'feed-meter-bar'
  meterBar.id = `feed-meter-bar-${feed.id}`
  meterBar.style.width = `${Math.max(0, Math.min(100, feed.value))}%`
  meterTrack.appendChild(meterBar)
  card.appendChild(meterTrack)

  // Controls Grid (Rate & Brownian Step Size)
  const controlsGrid = document.createElement('div')
  controlsGrid.className = 'feed-controls-grid'

  // Rate Control
  const rateGroup = document.createElement('div')
  rateGroup.className = 'feed-control-group'
  const rateLabel = document.createElement('label')
  rateLabel.textContent = 'Rate:'
  const rateSelect = document.createElement('select')
  rateSelect.id = `feed-rate-select-${feed.id}`

  for (const opt of RATE_OPTIONS) {
    const optEl = document.createElement('option')
    optEl.value = opt.value
    optEl.textContent = opt.label
    if (opt.value === feed.rateMs) optEl.selected = true
    rateSelect.appendChild(optEl)
  }

  rateSelect.addEventListener('change', () => {
    feed.setRate(parseInt(rateSelect.value, 10))
    saveSettings(settings)
  })

  rateGroup.appendChild(rateLabel)
  rateGroup.appendChild(rateSelect)
  controlsGrid.appendChild(rateGroup)

  // Brownian Step Size Control
  const stepGroup = document.createElement('div')
  stepGroup.className = 'feed-control-group'
  const stepLabel = document.createElement('label')
  stepLabel.textContent = 'Step Size (1–20):'

  const stepRow = document.createElement('div')
  stepRow.className = 'feed-step-row'

  const stepSlider = document.createElement('input')
  stepSlider.type = 'range'
  stepSlider.id = `feed-step-slider-${feed.id}`
  stepSlider.min = '1'
  stepSlider.max = '20'
  stepSlider.step = '1'
  stepSlider.value = feed.stepSize

  const stepInput = document.createElement('input')
  stepInput.type = 'number'
  stepInput.id = `feed-step-input-${feed.id}`
  stepInput.min = '1'
  stepInput.max = '20'
  stepInput.step = '1'
  stepInput.value = feed.stepSize

  const updateStep = (val) => {
    const num = Math.max(1, Math.min(20, parseInt(val, 10) || 1))
    stepSlider.value = num
    stepInput.value = num
    feed.setStepSize(num)
    saveSettings(settings)
  }

  stepSlider.addEventListener('input', () => updateStep(stepSlider.value))
  stepInput.addEventListener('input', () => updateStep(stepInput.value))

  stepRow.appendChild(stepSlider)
  stepRow.appendChild(stepInput)
  stepGroup.appendChild(stepLabel)
  stepGroup.appendChild(stepRow)
  controlsGrid.appendChild(stepGroup)

  card.appendChild(controlsGrid)

  // Delete button if more than 2 feeds (keep A & B protected)
  if (feed.id !== 'A' && feed.id !== 'B') {
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'feed-delete-btn'
    deleteBtn.type = 'button'
    deleteBtn.title = `Remove Feed ${feed.id}`
    deleteBtn.innerHTML = '×'
    deleteBtn.addEventListener('click', () => {
      removeFeed(feed.id)
    })
    card.appendChild(deleteBtn)
  }

  return card
}

export function addFeed() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let nextId = null
  for (let i = 0; i < alphabet.length; i++) {
    const char = alphabet[i]
    if (!feeds.has(char)) {
      nextId = char
      break
    }
  }

  if (!nextId) {
    alert('Maximum number of feeds reached.')
    return null
  }

  const newFeed = new DataFeed({
    id: nextId,
    label: `Feed ${nextId}`,
    value: 50,
    rateMs: 1000,
    stepSize: 6
  })

  newFeed.subscribe(handleFeedUpdate)
  feeds.set(nextId, newFeed)
  newFeed.start()

  saveSettings(settings)
  renderFeedsPanel()
  renderParametersPanel()
  return newFeed
}

export function removeFeed(feedId) {
  if (feedId === 'A' || feedId === 'B') return
  const feed = feeds.get(feedId)
  if (feed) {
    feed.stop()
    feeds.delete(feedId)
  }

  for (const key of Object.keys(settings)) {
    if (settings[key]?.paramFeeds) {
      for (const [paramName, id] of Object.entries(settings[key].paramFeeds)) {
        if (id === feedId) {
          settings[key].paramFeeds[paramName] = 'A'
        }
      }
    }
  }

  saveSettings(settings)
  renderFeedsPanel()
  renderParametersPanel()
}

if (btnAddFeed) {
  btnAddFeed.addEventListener('click', () => {
    addFeed()
  })
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
            paramFeeds:     { [mappedParam]: 'A' },
            paramRanges:    {},
            paramInverts:   {},
            paramCurves:    {},
            curve:          'linear',
            volume:         0.5
          }
          for (const param of schema) {
            if (param.default !== undefined) {
              settings[name][param.name] = param.default
            }
          }
        }

        SONIFIER_CLASSES[name] = SonifierClass
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
// Hashchange Listener (History & Back/Forward)
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const urlState = parseUrlState()
    if (urlState) {
      settings = urlState
      if (sonifierSelectEl) sonifierSelectEl.value = settings.sonifierType
      if (masterVolumeEl) masterVolumeEl.value = settings.masterVolume
      if (masterVolDispEl) masterVolDispEl.textContent = settings.masterVolume.toFixed(2)
      initFeedsFromSettings()
      renderFeedsPanel()
      renderParametersPanel()
      if (activeSonifier) {
        applySettings()
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

renderFeedsPanel()
renderParametersPanel()
updateUrlState()

// Start all feeds
for (const feed of feeds.values()) {
  feed.start()
}
