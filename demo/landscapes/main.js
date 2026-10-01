import { Landscape } from '@web-sonifier/core'
import { WindSonifier } from '@web-sonifier/wind'
import { RainSonifier } from '@web-sonifier/rain'
import { OceanSonifier } from '@web-sonifier/ocean'
import { ChimeSonifier } from '@web-sonifier/chime'
import { BubbleSonifier } from '@web-sonifier/bubble'
import { EnoBedSonifier } from '@web-sonifier/eno-bed'
import { EnoTextureSonifier } from '@web-sonifier/eno-texture'
import { EnoFigureSonifier } from '@web-sonifier/eno-figure'
import { MalletSonifier } from '@web-sonifier/mallet'
import { PurrSonifier } from '@web-sonifier/purr'
import { VoscSonifier } from '@web-sonifier/vosc'
import { EngineSonifier } from '@web-sonifier/engine'
import { PRESET_SCENES } from './presets.js'
import { createDualRangeSlider, getOutputRangeBounds, formatRangeValue } from '../AutomatedParameterEditor.js'

// ---------------------------------------------------------------------------
// State & Instances
// ---------------------------------------------------------------------------

export const landscape = new Landscape()

// Register all 12 monorepo sonifier plugins for declarative scene hydration
landscape.register('wind', WindSonifier)
landscape.register('rain', RainSonifier)
landscape.register('ocean', OceanSonifier)
landscape.register('chime', ChimeSonifier)
landscape.register('chimes', ChimeSonifier)
landscape.register('bubble', BubbleSonifier)
landscape.register('eno-bed', EnoBedSonifier)
landscape.register('eno-texture', EnoTextureSonifier)
landscape.register('eno-figure', EnoFigureSonifier)
landscape.register('mallet', MalletSonifier)
landscape.register('purr', PurrSonifier)
landscape.register('vosc', VoscSonifier)
landscape.register('engine', EngineSonifier)

export const SONIFIER_CATALOG = {
  wind: { name: 'Aeolian Wind', icon: '🌬️', defaultLayer: 'bed', factory: WindSonifier },
  ocean: { name: 'Ocean Surf', icon: '🌊', defaultLayer: 'bed', factory: OceanSonifier },
  'eno-bed': { name: 'Ambient Pad (Eno)', icon: '🌌', defaultLayer: 'bed', factory: EnoBedSonifier },
  purr: { name: 'Purr Resonator', icon: '🐱', defaultLayer: 'bed', factory: PurrSonifier },
  vosc: { name: 'Variable Osc (Vosc)', icon: '⚡', defaultLayer: 'bed', factory: VoscSonifier },
  engine: { name: 'Combustion Engine', icon: '⚙️', defaultLayer: 'bed', factory: EngineSonifier },
  rain: { name: 'Acoustic Rain', icon: '🌧️', defaultLayer: 'texture', factory: RainSonifier },
  'eno-texture': { name: 'Shimmer Cloud (Eno)', icon: '✨', defaultLayer: 'texture', factory: EnoTextureSonifier },
  bubble: { name: 'Minnaert Bubble', icon: '🫧', defaultLayer: 'texture', factory: BubbleSonifier },
  chime: { name: 'Modal Chimes', icon: '🎐', defaultLayer: 'figure', factory: ChimeSonifier },
  'eno-figure': { name: 'Tape Melodic Lead', icon: '🎹', defaultLayer: 'figure', factory: EnoFigureSonifier },
  mallet: { name: 'Mallet Percussion', icon: '🪵', defaultLayer: 'figure', factory: MalletSonifier }
}

// Register default data feeds (Web Traffic & Infrastructure Telemetry)
landscape.defineFeed('traffic_rps', {
  label: 'HTTP Request Rate',
  type: 'continuous',
  scale: 'macro',
  range: [0, 5000],
  unit: 'req/s',
  description: 'Aggregated global requests per second arriving at edge proxies'
})
landscape.defineFeed('active_users', {
  label: 'Active WebSocket Sessions',
  type: 'continuous',
  scale: 'meso',
  range: [0, 1000],
  unit: 'conns',
  description: 'Currently open full-duplex socket sessions'
})
landscape.defineFeed('cpu_load', {
  label: 'Cluster CPU Load',
  type: 'continuous',
  scale: 'meso',
  range: [0, 100],
  unit: '%',
  description: 'Mean CPU utilization percentage across edge worker nodes'
})
landscape.defineFeed('error_spikes', {
  label: 'HTTP 5xx Error Bursts',
  type: 'event',
  scale: 'micro',
  range: [1, 20],
  unit: 'errors',
  description: 'Discrete 5xx error spikes requiring immediate attentional orientation'
})

// Register default transduction bridge mappings
landscape.addMapping({
  feedId: 'traffic_rps',
  target: { objectId: 'wind', param: 'speed' },
  adapter: { inputRange: [0, 5000], outputRange: [15, 75], curve: 'exponential' }
})
landscape.addMapping({
  feedId: 'active_users',
  target: { objectId: 'ocean', param: 'intensity' },
  adapter: { inputRange: [0, 1000], outputRange: [30, 95], curve: 'linear' }
})
landscape.addMapping({
  feedId: 'cpu_load',
  target: { objectId: 'ocean', param: 'foam' },
  adapter: { inputRange: [0, 100], outputRange: [0.1, 0.95], curve: 'linear' }
})
landscape.addMapping({
  feedId: 'error_spikes',
  target: { objectId: 'chimes', action: 'trigger', event: 'strike' },
  adapter: { inputRange: [1, 20], outputRange: [0.35, 1.0], curve: 'exponential' }
})

let isPlaying = false
let isPlayerMode = false
let currentPresetName = 'rain'

// Visualizer state
let animFrameId = null
const pulses = []

// ---------------------------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------------------------

const btnPlay = document.getElementById('btn-play')
const btnStop = document.getElementById('btn-stop')
const statusEl = document.getElementById('landscape-status')

// Toolbar & Scene Elements
const btnExportScene = document.getElementById('btn-export-scene')
const btnLoadScene = document.getElementById('btn-load-scene')
const btnToggleMode = document.getElementById('btn-toggle-mode')

// Player Elements
const playerView = document.getElementById('player-view')
const playerStatusBadge = document.getElementById('player-status-badge')
const playerSceneTitle = document.getElementById('player-scene-title')
const playerSceneSubtitle = document.getElementById('player-scene-subtitle')
const btnPlayerPlay = document.getElementById('btn-player-play')
const btnPlayerStop = document.getElementById('btn-player-stop')
const playerVolSlider = document.getElementById('player-volume')
const playerVolDisp = document.getElementById('val-player-vol')

// Studio Master Bar & Sections
const studioMasterBar = document.getElementById('studio-master-bar')
const soundstageCard = document.querySelector('.soundstage-card')
const objectsGrid = document.querySelector('.objects-grid')

// Scene Modal Elements
const sceneModal = document.getElementById('scene-modal')
const modalTitle = document.getElementById('modal-title')
const btnCloseModal = document.getElementById('btn-close-modal')
const sceneJsonTextarea = document.getElementById('scene-json-textarea')
const btnModalCopy = document.getElementById('btn-modal-copy')
const btnModalApply = document.getElementById('btn-modal-apply')

// Space Controls
const masterVolSlider = document.getElementById('master-volume')
const masterVolDisp = document.getElementById('val-master-vol')
const reverbDecaySlider = document.getElementById('reverb-decay')
const reverbDecayDisp = document.getElementById('val-reverb-decay')
const reverbWetSlider = document.getElementById('reverb-wet')
const reverbWetDisp = document.getElementById('val-reverb-wet')
const spaceWarmthSlider = document.getElementById('space-warmth')
const spaceWarmthDisp = document.getElementById('val-space-warmth')

// Wind Elements
const windVolSlider = document.getElementById('wind-volume')
const windVolDisp = document.getElementById('disp-wind-volume')
const windPanSlider = document.getElementById('wind-pan')
const windPanDisp = document.getElementById('disp-wind-pan')
const windDistanceSlider = document.getElementById('wind-distance')
const windDistanceDisp = document.getElementById('disp-wind-distance')
const windSpreadSlider = document.getElementById('wind-spread')
const windSpreadDisp = document.getElementById('disp-wind-spread')
const windSpeedSlider = document.getElementById('wind-speed')
const windSpeedDisp = document.getElementById('disp-wind-speed')
const windTurbulenceSlider = document.getElementById('wind-turbulence')
const windTurbulenceDisp = document.getElementById('disp-wind-turbulence')
const windCavitySlider = document.getElementById('wind-cavity')
const windCavityDisp = document.getElementById('disp-wind-cavity')

// Rain Elements
const rainVolSlider = document.getElementById('rain-volume')
const rainVolDisp = document.getElementById('disp-rain-volume')
const rainPanSlider = document.getElementById('rain-pan')
const rainPanDisp = document.getElementById('disp-rain-pan')
const rainDistanceSlider = document.getElementById('rain-distance')
const rainDistanceDisp = document.getElementById('disp-rain-distance')
const rainSpreadSlider = document.getElementById('rain-spread')
const rainSpreadDisp = document.getElementById('disp-rain-spread')
const rainIntensitySlider = document.getElementById('rain-intensity')
const rainIntensityDisp = document.getElementById('disp-rain-intensity')
const rainSurfaceSelect = document.getElementById('rain-surface')
const rainPitchSlider = document.getElementById('rain-pitch')
const rainPitchDisp = document.getElementById('disp-rain-pitch')
const rainSizeSlider = document.getElementById('rain-size')
const rainSizeDisp = document.getElementById('disp-rain-size')

// Ocean Elements
const oceanVolSlider = document.getElementById('ocean-volume')
const oceanVolDisp = document.getElementById('disp-ocean-volume')
const oceanPanSlider = document.getElementById('ocean-pan')
const oceanPanDisp = document.getElementById('disp-ocean-pan')
const oceanDistanceSlider = document.getElementById('ocean-distance')
const oceanDistanceDisp = document.getElementById('disp-ocean-distance')
const oceanSpreadSlider = document.getElementById('ocean-spread')
const oceanSpreadDisp = document.getElementById('disp-ocean-spread')
const oceanIntensitySlider = document.getElementById('ocean-intensity')
const oceanIntensityDisp = document.getElementById('disp-ocean-intensity')
const oceanPeriodSlider = document.getElementById('ocean-period')
const oceanPeriodDisp = document.getElementById('disp-ocean-period')
const oceanFoamSlider = document.getElementById('ocean-foam')
const oceanFoamDisp = document.getElementById('disp-ocean-foam')
const oceanPitchSlider = document.getElementById('ocean-pitch')
const oceanPitchDisp = document.getElementById('disp-ocean-pitch')

// Chime Elements
const chimeVolSlider = document.getElementById('chime-volume')
const chimeVolDisp = document.getElementById('disp-chime-volume')
const chimePanSlider = document.getElementById('chime-pan')
const chimePanDisp = document.getElementById('disp-chime-pan')
const chimeDistanceSlider = document.getElementById('chime-distance')
const chimeDistanceDisp = document.getElementById('disp-chime-distance')
const chimeSpreadSlider = document.getElementById('chime-spread')
const chimeSpreadDisp = document.getElementById('disp-chime-spread')
const chimeCoupledCheck = document.getElementById('chime-wind-coupled')
const btnStrikeChime = document.getElementById('btn-strike-chime')
const chimeMaterialSelect = document.getElementById('chime-material')
const chimePitchSlider = document.getElementById('chime-pitch')
const chimePitchDisp = document.getElementById('disp-chime-pitch')
const chimeDampingSlider = document.getElementById('chime-damping')
const chimeDampingDisp = document.getElementById('disp-chime-damping')

// Presets
const presetRainBtn = document.getElementById('preset-rain')
const presetPacificBtn = document.getElementById('preset-pacific')
const presetStormBtn = document.getElementById('preset-storm')
const presetAlpineBtn = document.getElementById('preset-alpine')

// Canvas
const canvas = document.getElementById('soundstage-canvas')
const ctx2d = canvas ? canvas.getContext('2d') : null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatDistance(distanceMeters) {
  const dist = Math.max(0, distanceMeters)
  const attenLinear = 1 / Math.sqrt(1 + 0.1 * dist)
  const attenDb = 20 * Math.log10(attenLinear)
  const wetReverb = Math.round(Math.min(100, (0.3 + 0.04 * dist) * 100))
  return `${dist.toFixed(1)}m (${attenDb.toFixed(1)} dB, ${wetReverb}% wet)`
}

export function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(56, 189, 248, ${alpha})`
  let c = hex.replace('#', '')
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
  const num = parseInt(c.slice(0, 6), 16)
  if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function updateCardSpatialControls(objectId, pan, distance) {
  const targetId = objectId === 'chimes' ? 'chime' : objectId

  // Pan slider & readout
  const panSlider = document.getElementById(`${targetId}-pan`) ||
                    document.querySelector(`article[data-object-id="${objectId}"] input[data-param="pan"]`)
  const panDisp = document.getElementById(`disp-${targetId}-pan`) ||
                  document.querySelector(`article[data-object-id="${objectId}"] #disp-${targetId}-pan`)
  if (panSlider && pan !== undefined) {
    panSlider.value = pan
    if (panDisp) panDisp.textContent = formatPan(pan)
  }

  // Distance slider & readout
  const distSlider = document.getElementById(`${targetId}-distance`) ||
                     document.querySelector(`article[data-object-id="${objectId}"] input[data-param="distance"]`)
  const distDisp = document.getElementById(`disp-${targetId}-distance`) ||
                   document.querySelector(`article[data-object-id="${objectId}"] #disp-${targetId}-distance`)
  if (distSlider && distance !== undefined) {
    distSlider.value = distance
    if (distDisp) distDisp.textContent = formatDistance(distance)
  }
}

export function setupCardTabs(container = document) {
  const tabBtns = container.querySelectorAll('.card-tab-btn')
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab
      const objectId = btn.dataset.objectId
      const card = btn.closest('.object-card')
      if (!card) return

      card.querySelectorAll('.card-tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')

      const spatialPane = card.querySelector('.tab-spatial-pane')
      const paramsPane = card.querySelector('.tab-params-pane')

      if (targetTab === 'spatial') {
        if (spatialPane) spatialPane.classList.add('active')
        if (paramsPane) paramsPane.classList.remove('active')
      } else {
        if (spatialPane) spatialPane.classList.remove('active')
        if (paramsPane) {
          paramsPane.classList.add('active')
          if (paramsPane.dataset.rendered !== 'true' &&
              objectId !== 'wind' && objectId !== 'rain' && objectId !== 'ocean' && objectId !== 'chimes' && objectId !== 'chime') {
            renderSonifierParameterEditor(objectId, paramsPane)
            paramsPane.dataset.rendered = 'true'
          }
        }
      }
    })
  })
}

export function updateTabMappingBadges() {
  const cards = document.querySelectorAll('.object-card')
  cards.forEach(card => {
    const objectId = card.dataset.objectId || card.id.replace('card-', '')
    const targetId = objectId === 'chime' ? 'chimes' : objectId
    const badge = card.querySelector('.card-tab-badge')
    if (badge) {
      const count = landscape._mappings.filter(m =>
        m.target && (m.target.objectId === targetId || m.target.objectId === objectId)
      ).length
      badge.textContent = count
      badge.classList.toggle('has-mappings', count > 0)
    }
  })
}

function formatPan(val) {
  const deg = Math.round((val + 1) * 90) // 0° left, 90° center, 180° right
  if (Math.abs(val) < 0.04) return 'Center (90°)'
  if (val < 0) return `Left (${deg}°)`
  return `Right (${deg}°)`
}

function formatSpread(val) {
  const deg = Math.round(val * 180)
  if (val < 0.15) return `${deg}° (Point Source)`
  if (val < 0.40) return `${deg}° (Localized)`
  if (val < 0.70) return `${deg}° (Wide Arc)`
  return `${deg}° (Enveloping)`
}

function updateTransportUI(active) {
  if (statusEl) {
    statusEl.textContent = active ? 'Active (4 Elements)' : 'Stopped'
    if (active) statusEl.classList.add('active')
    else statusEl.classList.remove('active')
  }
  if (btnPlay) btnPlay.disabled = active
  if (btnStop) btnStop.disabled = !active

  if (playerStatusBadge) {
    playerStatusBadge.textContent = active ? 'PLAYING NOW' : 'READY TO PLAY'
    if (active) playerStatusBadge.classList.add('active')
    else playerStatusBadge.classList.remove('active')
  }
  if (btnPlayerPlay) btnPlayerPlay.disabled = active
  if (btnPlayerStop) btnPlayerStop.disabled = !active
}

// ---------------------------------------------------------------------------
// Landscape Lifecycle
// ---------------------------------------------------------------------------

export async function playLandscape() {
  if (isPlaying) return

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!landscape._audioContext) {
      const actx = new AudioCtx()
      landscape.init(actx)
    }

    if (landscape._audioContext.state === 'suspended') {
      await landscape._audioContext.resume()
    }

    if (landscape._objects.size === 0) {
      const scene = getCurrentSceneDescriptor()
      await landscape.loadScene(scene)
    }

    isPlaying = true
    updateTransportUI(true)

    syncAllParams()

    // Acoustic emission pulse
    if (landscape._objects.has('wind')) emitPulse('wind', '#38bdf8')
    if (landscape._objects.has('rain')) emitPulse('rain', '#60a5fa')
    if (landscape._objects.has('ocean')) emitPulse('ocean', '#06b6d4')
    if (landscape._objects.has('chimes') || landscape._objects.has('chime')) emitPulse('chimes', '#818cf8')

  } catch (err) {
    console.error('[Landscapes] Play error:', err)
  }
}

export function stopLandscape() {
  if (!isPlaying) return

  try {
    landscape.destroy()
    isPlaying = false
    updateTransportUI(false)
  } catch (err) {
    console.error('[Landscapes] Stop error:', err)
  }
}

export function syncAllParams() {
  if (!landscape._audioContext) return

  // Shared Room Acoustics
  const decay = parseFloat(reverbDecaySlider?.value || 2.5)
  const wet = parseFloat(reverbWetSlider?.value || 0.28)
  const warmth = parseFloat(spaceWarmthSlider?.value || 0.65)
  landscape.setSpace({ decay, wet, warmth })

  const masterVol = parseFloat(masterVolSlider?.value || 0.85)
  landscape.setMasterVolume(masterVol)

  // 1. Wind
  if (landscape._objects.has('wind')) {
    const windGain = parseFloat(windVolSlider?.value || 0.70)
    const windPan = parseFloat(windPanSlider?.value || 0.0)
    const windSpread = parseFloat(windSpreadSlider?.value || 0.80)
    const windSpeed = parseFloat(windSpeedSlider?.value || 35)
    const windTurbulence = parseFloat(windTurbulenceSlider?.value || 0.45)
    const windCavity = parseFloat(windCavitySlider?.value || 0.30)

    landscape.setParam('wind', 'gain', windGain)
    landscape.setParam('wind', 'pan', windPan)
    landscape.setParam('wind', 'spread', windSpread)
    landscape.setParam('wind', 'speed', windSpeed)
    landscape.setParam('wind', 'turbulence', windTurbulence)
    landscape.setParam('wind', 'cavityResonance', windCavity)
  }

  // 2. Rain
  if (landscape._objects.has('rain')) {
    const rainGain = parseFloat(rainVolSlider?.value || 0.65)
    const rainPan = parseFloat(rainPanSlider?.value || 0.0)
    const rainSpread = parseFloat(rainSpreadSlider?.value || 0.95)
    const rainInt = parseFloat(rainIntensitySlider?.value || 120)
    const rainSurf = rainSurfaceSelect?.value || 'puddle'
    const rainPitch = parseFloat(rainPitchSlider?.value || 1400)
    const rainSize = parseFloat(rainSizeSlider?.value || 1.0)

    landscape.setParam('rain', 'gain', rainGain)
    landscape.setParam('rain', 'pan', rainPan)
    landscape.setParam('rain', 'spread', rainSpread)
    landscape.setParam('rain', 'intensity', rainInt)
    landscape.setParam('rain', 'surface', rainSurf)
    landscape.setParam('rain', 'pitch', rainPitch)
    landscape.setParam('rain', 'dropletSize', rainSize)
  }

  // 3. Ocean
  if (landscape._objects.has('ocean')) {
    const oceanGain = parseFloat(oceanVolSlider?.value || 0.55)
    const oceanPan = parseFloat(oceanPanSlider?.value || 0.25)
    const oceanSpread = parseFloat(oceanSpreadSlider?.value || 0.50)
    const oceanInt = parseFloat(oceanIntensitySlider?.value || 60)
    const oceanPer = parseFloat(oceanPeriodSlider?.value || 8.5)
    const oceanFoam = parseFloat(oceanFoamSlider?.value || 0.55)
    const oceanPitch = parseFloat(oceanPitchSlider?.value || 480)

    landscape.setParam('ocean', 'gain', oceanGain)
    landscape.setParam('ocean', 'pan', oceanPan)
    landscape.setParam('ocean', 'spread', oceanSpread)
    landscape.setParam('ocean', 'intensity', oceanInt)
    landscape.setParam('ocean', 'swellPeriod', oceanPer)
    landscape.setParam('ocean', 'foam', oceanFoam)
    landscape.setParam('ocean', 'pitch', oceanPitch)
  }

  // 4. Chimes
  const hasChimes = landscape._objects.has('chimes') || landscape._objects.has('chime')
  const chimesId = landscape._objects.has('chimes') ? 'chimes' : 'chime'
  if (hasChimes) {
    const chimeGain = parseFloat(chimeVolSlider?.value || 0.75)
    const chimePan = parseFloat(chimePanSlider?.value || 0.45)
    const chimeSpread = parseFloat(chimeSpreadSlider?.value || 0.08)
    const chimeCoupled = chimeCoupledCheck ? chimeCoupledCheck.checked : true
    const chimeMat = chimeMaterialSelect?.value || 'aluminum'
    const chimePitch = parseFloat(chimePitchSlider?.value || 587)
    const chimeDamp = parseFloat(chimeDampingSlider?.value || 0.25)
    const windSpeedVal = parseFloat(windSpeedSlider?.value || 35)

    landscape.setParam(chimesId, 'gain', chimeGain)
    landscape.setParam(chimesId, 'pan', chimePan)
    landscape.setParam(chimesId, 'spread', chimeSpread)
    landscape.setParam(chimesId, 'material', chimeMat)
    landscape.setParam(chimesId, 'pitch', chimePitch)
    landscape.setParam(chimesId, 'damping', chimeDamp)
    landscape.setParam(chimesId, 'windSpeed', chimeCoupled ? windSpeedVal * 0.8 : 0)
  }

  // Dynamic cards
  document.querySelectorAll('article.object-card[data-type]').forEach(card => {
    const id = card.dataset.objectId || card.id.replace(/^card-/, '')
    if (landscape._objects.has(id)) {
      const vol = parseFloat(card.querySelector(`[data-param="gain"]`)?.value || 0.70)
      const pan = parseFloat(card.querySelector(`[data-param="pan"]`)?.value || 0.0)
      const spread = parseFloat(card.querySelector(`[data-param="spread"]`)?.value || 0.50)
      landscape.setParam(id, 'gain', vol)
      landscape.setParam(id, 'pan', pan)
      landscape.setParam(id, 'spread', spread)
    }
  })
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

if (btnPlay) btnPlay.addEventListener('click', playLandscape)
if (btnStop) btnStop.addEventListener('click', stopLandscape)

// Master Sliders
if (masterVolSlider) {
  masterVolSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (masterVolDisp) masterVolDisp.textContent = val.toFixed(2)
    landscape.setMasterVolume(val)
  })
}

if (reverbDecaySlider) {
  reverbDecaySlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (reverbDecayDisp) reverbDecayDisp.textContent = `${val.toFixed(1)}s`
    landscape.setSpace({ decay: val })
  })
}

if (reverbWetSlider) {
  reverbWetSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (reverbWetDisp) reverbWetDisp.textContent = `${Math.round(val * 100)}%`
    landscape.setSpace({ wet: val })
  })
}

if (spaceWarmthSlider) {
  spaceWarmthSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (spaceWarmthDisp) spaceWarmthDisp.textContent = `${Math.round(val * 100)}%`
    landscape.setSpace({ warmth: val })
  })
}

// 1. Wind Sliders
if (windVolSlider) {
  windVolSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (windVolDisp) windVolDisp.textContent = `${Math.round(val * 100)}%`
    landscape.setParam('wind', 'gain', val)
  })
}

if (windPanSlider) {
  windPanSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (windPanDisp) windPanDisp.textContent = formatPan(val)
    landscape.setParam('wind', 'pan', val)
  })
}

if (windDistanceSlider) {
  windDistanceSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (windDistanceDisp) windDistanceDisp.textContent = formatDistance(val)
    landscape.setParam('wind', 'distance', val)
  })
}

if (windSpreadSlider) {
  windSpreadSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (windSpreadDisp) windSpreadDisp.textContent = formatSpread(val)
    landscape.setParam('wind', 'spread', val)
  })
}

if (windSpeedSlider) {
  windSpeedSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (windSpeedDisp) windSpeedDisp.textContent = `${v} km/h`
    landscape.setParam('wind', 'speed', v)
    emitPulse('wind', '#38bdf8')
  })
}

if (windTurbulenceSlider) {
  windTurbulenceSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (windTurbulenceDisp) windTurbulenceDisp.textContent = v.toFixed(2)
    landscape.setParam('wind', 'turbulence', v)
  })
}

if (windCavitySlider) {
  windCavitySlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (windCavityDisp) windCavityDisp.textContent = v.toFixed(2)
    landscape.setParam('wind', 'cavityResonance', v)
  })
}

// 2. Rain Sliders
if (rainVolSlider) {
  rainVolSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (rainVolDisp) rainVolDisp.textContent = `${Math.round(val * 100)}%`
    landscape.setParam('rain', 'gain', val)
  })
}

if (rainPanSlider) {
  rainPanSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (rainPanDisp) rainPanDisp.textContent = formatPan(val)
    landscape.setParam('rain', 'pan', val)
  })
}

if (rainDistanceSlider) {
  rainDistanceSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (rainDistanceDisp) rainDistanceDisp.textContent = formatDistance(val)
    landscape.setParam('rain', 'distance', val)
  })
}

if (rainSpreadSlider) {
  rainSpreadSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (rainSpreadDisp) rainSpreadDisp.textContent = formatSpread(val)
    landscape.setParam('rain', 'spread', val)
  })
}

if (rainIntensitySlider) {
  rainIntensitySlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (rainIntensityDisp) rainIntensityDisp.textContent = `${v} drops/s`
    landscape.setParam('rain', 'intensity', v)
    if (v > 0) emitPulse('rain', '#60a5fa')
  })
}

if (rainSurfaceSelect) {
  rainSurfaceSelect.addEventListener('change', e => {
    landscape.setParam('rain', 'surface', e.target.value)
    emitPulse('rain', '#60a5fa', 40)
  })
}

if (rainPitchSlider) {
  rainPitchSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (rainPitchDisp) rainPitchDisp.textContent = `${v} Hz`
    landscape.setParam('rain', 'pitch', v)
  })
}

if (rainSizeSlider) {
  rainSizeSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (rainSizeDisp) rainSizeDisp.textContent = `${v.toFixed(1)}x`
    landscape.setParam('rain', 'dropletSize', v)
  })
}

// 3. Ocean Sliders
if (oceanVolSlider) {
  oceanVolSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (oceanVolDisp) oceanVolDisp.textContent = `${Math.round(val * 100)}%`
    landscape.setParam('ocean', 'gain', val)
  })
}

if (oceanPanSlider) {
  oceanPanSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (oceanPanDisp) oceanPanDisp.textContent = formatPan(val)
    landscape.setParam('ocean', 'pan', val)
  })
}

if (oceanDistanceSlider) {
  oceanDistanceSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (oceanDistanceDisp) oceanDistanceDisp.textContent = formatDistance(val)
    landscape.setParam('ocean', 'distance', val)
  })
}

if (oceanSpreadSlider) {
  oceanSpreadSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (oceanSpreadDisp) oceanSpreadDisp.textContent = formatSpread(val)
    landscape.setParam('ocean', 'spread', val)
  })
}

if (oceanIntensitySlider) {
  oceanIntensitySlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (oceanIntensityDisp) oceanIntensityDisp.textContent = `${v}%`
    landscape.setParam('ocean', 'intensity', v)
    emitPulse('ocean', '#06b6d4')
  })
}

if (oceanPeriodSlider) {
  oceanPeriodSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (oceanPeriodDisp) oceanPeriodDisp.textContent = `${v.toFixed(1)}s`
    landscape.setParam('ocean', 'swellPeriod', v)
  })
}

if (oceanFoamSlider) {
  oceanFoamSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (oceanFoamDisp) oceanFoamDisp.textContent = v.toFixed(2)
    landscape.setParam('ocean', 'foam', v)
  })
}

if (oceanPitchSlider) {
  oceanPitchSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (oceanPitchDisp) oceanPitchDisp.textContent = `${v} Hz`
    landscape.setParam('ocean', 'pitch', v)
  })
}

// 4. Chime Sliders
if (chimeVolSlider) {
  chimeVolSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (chimeVolDisp) chimeVolDisp.textContent = `${Math.round(val * 100)}%`
    landscape.setParam('chimes', 'gain', val)
  })
}

if (chimePanSlider) {
  chimePanSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (chimePanDisp) chimePanDisp.textContent = formatPan(val)
    landscape.setParam('chimes', 'pan', val)
  })
}

if (chimeDistanceSlider) {
  chimeDistanceSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (chimeDistanceDisp) chimeDistanceDisp.textContent = formatDistance(val)
    landscape.setParam('chimes', 'distance', val)
  })
}

if (chimeSpreadSlider) {
  chimeSpreadSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (chimeSpreadDisp) chimeSpreadDisp.textContent = formatSpread(val)
    landscape.setParam('chimes', 'spread', val)
  })
}

if (chimeCoupledCheck) {
  chimeCoupledCheck.addEventListener('change', e => {
    const coupled = e.target.checked
    if (coupled) {
      landscape.couple('wind', 'speed', 'chimes', 'windSpeed', { scale: 0.8 })
      const speed = parseFloat(windSpeedSlider?.value || 35)
      landscape.setParam('chimes', 'windSpeed', speed * 0.8)
    } else {
      landscape.uncouple('wind', 'speed', 'chimes', 'windSpeed')
      landscape.setParam('chimes', 'windSpeed', 0)
    }
  })
}

if (btnStrikeChime) {
  btnStrikeChime.addEventListener('click', async () => {
    if (!isPlaying) await playLandscape()
    landscape.trigger('chimes', 'strike', { velocity: 0.9 })
    emitPulse('chimes', '#818cf8', 55)
  })
}

if (chimeMaterialSelect) {
  chimeMaterialSelect.addEventListener('change', e => {
    landscape.setParam('chimes', 'material', e.target.value)
  })
}

if (chimePitchSlider) {
  chimePitchSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (chimePitchDisp) chimePitchDisp.textContent = `${v} Hz`
    landscape.setParam('chimes', 'pitch', v)
  })
}

if (chimeDampingSlider) {
  chimeDampingSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (chimeDampingDisp) chimeDampingDisp.textContent = v.toFixed(2)
    landscape.setParam('chimes', 'damping', v)
  })
}

// ---------------------------------------------------------------------------
// Atmospheric Presets & Scene Document Ingestion
// ---------------------------------------------------------------------------

function setSlider(el, val, dispEl, dispText) {
  if (!el) return
  el.value = val
  if (dispEl && dispText) dispEl.textContent = dispText
}

function clearActivePresetButtons() {
  presetRainBtn?.classList.remove('active')
  presetPacificBtn?.classList.remove('active')
  presetStormBtn?.classList.remove('active')
  presetAlpineBtn?.classList.remove('active')
}

export function syncSlidersFromScene(scene) {
  if (!scene) return

  if (scene.name && playerSceneTitle) {
    playerSceneTitle.textContent = scene.name
  }

  // Master Volume
  if (scene.masterVolume !== undefined) {
    setSlider(masterVolSlider, scene.masterVolume, masterVolDisp, scene.masterVolume.toFixed(2))
    setSlider(playerVolSlider, scene.masterVolume, playerVolDisp, `${Math.round(scene.masterVolume * 100)}%`)
  }

  // Room Acoustics
  if (scene.space) {
    if (scene.space.decay !== undefined) {
      setSlider(reverbDecaySlider, scene.space.decay, reverbDecayDisp, `${scene.space.decay.toFixed(1)}s`)
    }
    if (scene.space.wet !== undefined) {
      setSlider(reverbWetSlider, scene.space.wet, reverbWetDisp, `${Math.round(scene.space.wet * 100)}%`)
    }
    if (scene.space.warmth !== undefined) {
      setSlider(spaceWarmthSlider, scene.space.warmth, spaceWarmthDisp, `${Math.round(scene.space.warmth * 100)}%`)
    }
  }

  const objs = scene.objects || {}

  // 1. Wind
  const wind = objs.wind
  if (wind) {
    if (wind.gain !== undefined) setSlider(windVolSlider, wind.gain, windVolDisp, `${Math.round(wind.gain * 100)}%`)
    if (wind.pan !== undefined) setSlider(windPanSlider, wind.pan, windPanDisp, formatPan(wind.pan))
    if (wind.spread !== undefined) setSlider(windSpreadSlider, wind.spread, windSpreadDisp, formatSpread(wind.spread))
    if (wind.params) {
      if (wind.params.speed !== undefined) setSlider(windSpeedSlider, wind.params.speed, windSpeedDisp, `${wind.params.speed} km/h`)
      if (wind.params.turbulence !== undefined) setSlider(windTurbulenceSlider, wind.params.turbulence, windTurbulenceDisp, wind.params.turbulence.toFixed(2))
      if (wind.params.cavityResonance !== undefined) setSlider(windCavitySlider, wind.params.cavityResonance, windCavityDisp, wind.params.cavityResonance.toFixed(2))
    }
  }

  // 2. Rain
  const rain = objs.rain
  if (rain) {
    if (rain.gain !== undefined) setSlider(rainVolSlider, rain.gain, rainVolDisp, `${Math.round(rain.gain * 100)}%`)
    if (rain.pan !== undefined) setSlider(rainPanSlider, rainPanDisp, formatPan(rain.pan))
    if (rain.spread !== undefined) setSlider(rainSpreadSlider, rain.spread, rainSpreadDisp, formatSpread(rain.spread))
    if (rain.params) {
      if (rain.params.intensity !== undefined) setSlider(rainIntensitySlider, rain.params.intensity, rainIntensityDisp, `${rain.params.intensity} drops/s`)
      if (rain.params.surface !== undefined && rainSurfaceSelect) rainSurfaceSelect.value = rain.params.surface
      if (rain.params.pitch !== undefined) setSlider(rainPitchSlider, rain.params.pitch, rainPitchDisp, `${rain.params.pitch} Hz`)
      if (rain.params.dropletSize !== undefined) setSlider(rainSizeSlider, rain.params.dropletSize, rainSizeDisp, `${rain.params.dropletSize.toFixed(1)}x`)
    }
  }

  // 3. Ocean
  const ocean = objs.ocean
  if (ocean) {
    if (ocean.gain !== undefined) setSlider(oceanVolSlider, ocean.gain, oceanVolDisp, `${Math.round(ocean.gain * 100)}%`)
    if (ocean.pan !== undefined) setSlider(oceanPanSlider, ocean.pan, oceanPanDisp, formatPan(ocean.pan))
    if (ocean.spread !== undefined) setSlider(oceanSpreadSlider, ocean.spread, oceanSpreadDisp, formatSpread(ocean.spread))
    if (ocean.params) {
      if (ocean.params.intensity !== undefined) setSlider(oceanIntensitySlider, ocean.params.intensity, oceanIntensityDisp, `${ocean.params.intensity}%`)
      if (ocean.params.swellPeriod !== undefined) setSlider(oceanPeriodSlider, ocean.params.swellPeriod, oceanPeriodDisp, `${ocean.params.swellPeriod.toFixed(1)}s`)
      if (ocean.params.foam !== undefined) setSlider(oceanFoamSlider, ocean.params.foam, oceanFoamDisp, ocean.params.foam.toFixed(2))
      if (ocean.params.pitch !== undefined) setSlider(oceanPitchSlider, ocean.params.pitch, oceanPitchDisp, `${ocean.params.pitch} Hz`)
    }
  }

  // 4. Chimes
  const chimes = objs.chimes || objs.chime
  if (chimes) {
    if (chimes.gain !== undefined) setSlider(chimeVolSlider, chimes.gain, chimeVolDisp, `${Math.round(chimes.gain * 100)}%`)
    if (chimes.pan !== undefined) setSlider(chimePanSlider, chimes.pan, chimePanDisp, formatPan(chimes.pan))
    if (chimes.spread !== undefined) setSlider(chimeSpreadSlider, chimes.spread, chimeSpreadDisp, formatSpread(chimes.spread))
    if (chimes.params) {
      if (chimes.params.material !== undefined && chimeMaterialSelect) chimeMaterialSelect.value = chimes.params.material
      if (chimes.params.pitch !== undefined) setSlider(chimePitchSlider, chimes.params.pitch, chimePitchDisp, `${chimes.params.pitch} Hz`)
      if (chimes.params.damping !== undefined) setSlider(chimeDampingSlider, chimes.params.damping, chimeDampingDisp, chimes.params.damping.toFixed(2))
    }
  }

  // Inter-Object Couplings
  if (chimeCoupledCheck) {
    const couplings = scene.couplings || []
    const isCoupled = couplings.some(c => c.sourceId === 'wind' && c.targetId === 'chimes')
    chimeCoupledCheck.checked = isCoupled
  }
}

export async function applyPreset(name) {
  clearActivePresetButtons()
  currentPresetName = name
  const scene = PRESET_SCENES[name]
  if (!scene) return

  if (name === 'rain') presetRainBtn?.classList.add('active')
  else if (name === 'pacific') presetPacificBtn?.classList.add('active')
  else if (name === 'storm') presetStormBtn?.classList.add('active')
  else if (name === 'alpine') presetAlpineBtn?.classList.add('active')

  syncSlidersFromScene(scene)

  if (isPlaying && landscape._audioContext) {
    await landscape.loadScene(scene)
  }
}

export function getCurrentSceneDescriptor() {
  if (landscape._audioContext && landscape._objects.size > 0) {
    return landscape.exportScene({ name: playerSceneTitle?.textContent || 'Custom Scene' })
  }

  const objects = {}

  // 1. Wind
  if (document.getElementById('card-wind') || document.querySelector('article[data-object-id="wind"]')) {
    objects.wind = {
      type: 'wind',
      layer: document.getElementById('layer-select-wind')?.value || 'bed',
      gain: parseFloat(windVolSlider?.value || 0.70),
      pan: parseFloat(windPanSlider?.value || 0.0),
      distance: parseFloat(windDistanceSlider?.value || 12),
      spread: parseFloat(windSpreadSlider?.value || 0.80),
      reverbSend: 0.20,
      params: {
        speed: parseFloat(windSpeedSlider?.value || 35),
        turbulence: parseFloat(windTurbulenceSlider?.value || 0.45),
        cavityResonance: parseFloat(windCavitySlider?.value || 0.30)
      }
    }
  }

  // 2. Rain
  if (document.getElementById('card-rain') || document.querySelector('article[data-object-id="rain"]')) {
    objects.rain = {
      type: 'rain',
      layer: document.getElementById('layer-select-rain')?.value || 'texture',
      gain: parseFloat(rainVolSlider?.value || 0.65),
      pan: parseFloat(rainPanSlider?.value || 0.0),
      distance: parseFloat(rainDistanceSlider?.value || 4),
      spread: parseFloat(rainSpreadSlider?.value || 0.95),
      reverbSend: 0.25,
      params: {
        intensity: parseFloat(rainIntensitySlider?.value || 120),
        surface: rainSurfaceSelect?.value || 'puddle',
        pitch: parseFloat(rainPitchSlider?.value || 1400),
        dropletSize: parseFloat(rainSizeSlider?.value || 1.0)
      }
    }
  }

  // 3. Ocean
  if (document.getElementById('card-ocean') || document.querySelector('article[data-object-id="ocean"]')) {
    objects.ocean = {
      type: 'ocean',
      layer: document.getElementById('layer-select-ocean')?.value || 'bed',
      gain: parseFloat(oceanVolSlider?.value || 0.55),
      pan: parseFloat(oceanPanSlider?.value || 0.25),
      distance: parseFloat(oceanDistanceSlider?.value || 8),
      spread: parseFloat(oceanSpreadSlider?.value || 0.50),
      reverbSend: 0.35,
      params: {
        intensity: parseFloat(oceanIntensitySlider?.value || 60),
        swellPeriod: parseFloat(oceanPeriodSlider?.value || 8.5),
        foam: parseFloat(oceanFoamSlider?.value || 0.55),
        pitch: parseFloat(oceanPitchSlider?.value || 480)
      }
    }
  }

  // 4. Chimes
  if (document.getElementById('card-chime') || document.getElementById('card-chimes') || document.querySelector('article[data-object-id="chimes"]')) {
    objects.chimes = {
      type: 'chime',
      layer: document.getElementById('layer-select-chime')?.value || 'figure',
      gain: parseFloat(chimeVolSlider?.value || 0.75),
      pan: parseFloat(chimePanSlider?.value || 0.45),
      distance: parseFloat(chimeDistanceSlider?.value || 3),
      spread: parseFloat(chimeSpreadSlider?.value || 0.08),
      reverbSend: 0.45,
      params: {
        material: chimeMaterialSelect?.value || 'aluminum',
        pitch: parseFloat(chimePitchSlider?.value || 587),
        damping: parseFloat(chimeDampingSlider?.value || 0.25),
        windSpeed: (chimeCoupledCheck && chimeCoupledCheck.checked && objects.wind) ? parseFloat(windSpeedSlider?.value || 35) * 0.8 : 0
      }
    }
  }

  // Dynamic cards added from catalog
  document.querySelectorAll('article.object-card[data-type]').forEach(card => {
    const id = card.dataset.objectId || card.id.replace(/^card-/, '')
    if (objects[id]) return
    const type = card.dataset.type
    const layer = card.querySelector('.select-change-layer')?.value || 'bed'
    const vol = parseFloat(card.querySelector(`[data-param="gain"]`)?.value || 0.70)
    const pan = parseFloat(card.querySelector(`[data-param="pan"]`)?.value || 0.0)
    const spread = parseFloat(card.querySelector(`[data-param="spread"]`)?.value || 0.50)
    const distance = parseFloat(card.querySelector(`[data-param="distance"]`)?.value || (layer === 'figure' ? 3 : (layer === 'texture' ? 6 : 12)))

    objects[id] = {
      type,
      layer,
      gain: vol,
      pan,
      spread,
      distance,
      reverbSend: layer === 'figure' ? 0.35 : (layer === 'texture' ? 0.25 : 0.20),
      params: {}
    }
  })

  return {
    version: 1,
    name: playerSceneTitle?.textContent || 'Custom Scene',
    space: {
      decay: parseFloat(reverbDecaySlider?.value || 2.5),
      wet: parseFloat(reverbWetSlider?.value || 0.28),
      warmth: parseFloat(spaceWarmthSlider?.value || 0.65)
    },
    masterVolume: parseFloat(masterVolSlider?.value || 0.85),
    layers: {
      bed: { gain: 1.0 },
      texture: { gain: 1.0 },
      figure: {
        gain: 1.0,
        ducking: { targets: ['bed', 'texture'], depth: 0.35, attack: 0.015, release: 0.25 }
      }
    },
    objects,
    couplings: (chimeCoupledCheck && chimeCoupledCheck.checked && objects.wind && objects.chimes) ? [
      {
        sourceId: 'wind',
        sourceParam: 'speed',
        targetId: 'chimes',
        targetParam: 'windSpeed',
        scale: 0.8
      }
    ] : []
  }
}

// ---------------------------------------------------------------------------
// View Mode Toggling (Studio vs Minimal Player)
// ---------------------------------------------------------------------------

export function toggleViewMode() {
  isPlayerMode = !isPlayerMode
  if (isPlayerMode) {
    if (btnToggleMode) btnToggleMode.textContent = '🎛️ Mode: Player'
    if (playerView) playerView.style.display = 'block'
    if (studioMasterBar) studioMasterBar.style.display = 'none'
    if (soundstageCard) soundstageCard.style.display = 'none'
    if (objectsGrid) objectsGrid.style.display = 'none'
    updatePlayerLayerPills()
  } else {
    if (btnToggleMode) btnToggleMode.textContent = '🎧 Mode: Studio'
    if (playerView) playerView.style.display = 'none'
    if (studioMasterBar) studioMasterBar.style.display = 'flex'
    if (soundstageCard) soundstageCard.style.display = 'block'
    if (objectsGrid) objectsGrid.style.display = 'flex'
  }
}

if (btnToggleMode) {
  btnToggleMode.addEventListener('click', toggleViewMode)
}

// Player Mode Controls
if (btnPlayerPlay) btnPlayerPlay.addEventListener('click', playLandscape)
if (btnPlayerStop) btnPlayerStop.addEventListener('click', stopLandscape)

if (playerVolSlider) {
  playerVolSlider.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (playerVolDisp) playerVolDisp.textContent = `${Math.round(val * 100)}%`
    if (masterVolSlider) masterVolSlider.value = val
    if (masterVolDisp) masterVolDisp.textContent = val.toFixed(2)
    landscape.setMasterVolume(val)
  })
}

// ---------------------------------------------------------------------------
// Live Data Feed Simulator Bar
// ---------------------------------------------------------------------------

const simFeedTraffic = document.getElementById('sim-feed-traffic')
const dispFeedTraffic = document.getElementById('disp-feed-traffic')
const simFeedUsers = document.getElementById('sim-feed-users')
const dispFeedUsers = document.getElementById('disp-feed-users')
const simFeedCpu = document.getElementById('sim-feed-cpu')
const dispFeedCpu = document.getElementById('disp-feed-cpu')
const btnTriggerSpike = document.getElementById('btn-trigger-spike')
const btnStreamToggle = document.getElementById('btn-stream-toggle')

let isStreaming = false
let streamInterval = null

if (simFeedTraffic) {
  simFeedTraffic.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (dispFeedTraffic) dispFeedTraffic.textContent = `${Math.round(val)} req/s`
    landscape.pushData('traffic_rps', val)
    const windSpeed = landscape.getObject('wind')?.sonifier?.speed
    if (windSpeed != null && windSpeedSlider) {
      windSpeedSlider.value = windSpeed.toFixed(0)
      if (windSpeedDisp) windSpeedDisp.textContent = `${Math.round(windSpeed)} km/h`
    }
  })
}

if (simFeedUsers) {
  simFeedUsers.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (dispFeedUsers) dispFeedUsers.textContent = `${Math.round(val)} conns`
    landscape.pushData('active_users', val)
    const intensity = landscape.getObject('ocean')?.sonifier?.intensity
    if (intensity != null && oceanIntensitySlider) {
      oceanIntensitySlider.value = intensity.toFixed(0)
      if (oceanIntensityDisp) oceanIntensityDisp.textContent = `${Math.round(intensity)}%`
    }
  })
}

if (simFeedCpu) {
  simFeedCpu.addEventListener('input', e => {
    const val = parseFloat(e.target.value)
    if (dispFeedCpu) dispFeedCpu.textContent = `${Math.round(val)}%`
    landscape.pushData('cpu_load', val)
    const foam = landscape.getObject('ocean')?.sonifier?.foam
    if (foam != null && oceanFoamSlider) {
      oceanFoamSlider.value = foam.toFixed(2)
      if (oceanFoamDisp) oceanFoamDisp.textContent = `${Math.round(foam * 100)}%`
    }
  })
}

if (btnTriggerSpike) {
  btnTriggerSpike.addEventListener('click', () => {
    const spikeMagnitude = Math.floor(Math.random() * 12 + 6)
    landscape.pushData('error_spikes', spikeMagnitude)
    emitPulse('chimes', '#f59e0b', 55)
  })
}

if (btnStreamToggle) {
  btnStreamToggle.addEventListener('click', () => {
    isStreaming = !isStreaming
    if (isStreaming) {
      btnStreamToggle.textContent = '⚡ Stream (Brownian Walk): ON'
      btnStreamToggle.style.borderColor = 'var(--accent-cyan)'
      btnStreamToggle.style.color = 'var(--accent-cyan)'
      streamInterval = setInterval(() => {
        // Step traffic
        if (simFeedTraffic) {
          let t = parseFloat(simFeedTraffic.value) + (Math.random() - 0.5) * 160
          t = Math.max(0, Math.min(5000, t))
          simFeedTraffic.value = t
          if (dispFeedTraffic) dispFeedTraffic.textContent = `${Math.round(t)} req/s`
          landscape.pushData('traffic_rps', t)
          const ws = landscape.getObject('wind')?.sonifier?.speed
          if (ws != null && windSpeedSlider) {
            windSpeedSlider.value = ws.toFixed(0)
            if (windSpeedDisp) windSpeedDisp.textContent = `${Math.round(ws)} km/h`
          }
        }
        // Step users
        if (simFeedUsers) {
          let u = parseFloat(simFeedUsers.value) + (Math.random() - 0.5) * 35
          u = Math.max(0, Math.min(1000, u))
          simFeedUsers.value = u
          if (dispFeedUsers) dispFeedUsers.textContent = `${Math.round(u)} conns`
          landscape.pushData('active_users', u)
          const oi = landscape.getObject('ocean')?.sonifier?.intensity
          if (oi != null && oceanIntensitySlider) {
            oceanIntensitySlider.value = oi.toFixed(0)
            if (oceanIntensityDisp) oceanIntensityDisp.textContent = `${Math.round(oi)}%`
          }
        }
        // Step CPU
        if (simFeedCpu) {
          let c = parseFloat(simFeedCpu.value) + (Math.random() - 0.5) * 5
          c = Math.max(0, Math.min(100, c))
          simFeedCpu.value = c
          if (dispFeedCpu) dispFeedCpu.textContent = `${Math.round(c)}%`
          landscape.pushData('cpu_load', c)
          const of = landscape.getObject('ocean')?.sonifier?.foam
          if (of != null && oceanFoamSlider) {
            oceanFoamSlider.value = of.toFixed(2)
            if (oceanFoamDisp) oceanFoamDisp.textContent = `${Math.round(of * 100)}%`
          }
        }
        // Occasional spike (6% chance per tick)
        if (Math.random() < 0.06) {
          const spike = Math.floor(Math.random() * 15 + 5)
          landscape.pushData('error_spikes', spike)
          emitPulse('chimes', '#f59e0b', 60)
        }
      }, 250)
    } else {
      btnStreamToggle.textContent = '⚡ Stream (Brownian Walk): OFF'
      btnStreamToggle.style.borderColor = ''
      btnStreamToggle.style.color = ''
      if (streamInterval) {
        clearInterval(streamInterval)
        streamInterval = null
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Export Specification Modal (#modal-export)
// ---------------------------------------------------------------------------

const modalExport = document.getElementById('modal-export')
const btnCloseExport = document.getElementById('btn-close-export')
const exportJsonTextarea = document.getElementById('export-json-textarea')
const btnExportCopy = document.getElementById('btn-export-copy')
const btnExportDownload = document.getElementById('btn-export-download')
const specTabs = document.querySelectorAll('.spec-tab')

let currentExportType = 'bundle'

function getExportDoc(type) {
  const sceneName = playerSceneTitle?.textContent || 'Auditory Landscape'
  switch (type) {
    case 'landscape':
      return landscape.exportLandscape ? landscape.exportLandscape({ name: sceneName }) : getCurrentSceneDescriptor()
    case 'feeds':
      return landscape.exportFeeds({ name: `${sceneName} Feeds` })
    case 'mappings':
      return landscape.exportMappings({ name: `${sceneName} Mappings` })
    case 'bundle':
    default:
      return landscape.exportScene({ name: sceneName })
  }
}

function updateExportTextarea() {
  if (!exportJsonTextarea) return
  const doc = getExportDoc(currentExportType)
  exportJsonTextarea.value = JSON.stringify(doc, null, 2)
}

if (btnExportScene) {
  btnExportScene.addEventListener('click', () => {
    currentExportType = 'bundle'
    specTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-export-type') === 'bundle'))
    updateExportTextarea()
    if (modalExport) modalExport.style.display = 'flex'
  })
}

specTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    specTabs.forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentExportType = tab.getAttribute('data-export-type')
    updateExportTextarea()
  })
})

if (btnCloseExport) {
  btnCloseExport.addEventListener('click', () => {
    if (modalExport) modalExport.style.display = 'none'
  })
}

if (modalExport) {
  modalExport.addEventListener('click', e => {
    if (e.target === modalExport) modalExport.style.display = 'none'
  })
}

if (btnExportCopy) {
  btnExportCopy.addEventListener('click', async () => {
    if (!exportJsonTextarea) return
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(exportJsonTextarea.value)
      } else {
        exportJsonTextarea.select()
        document.execCommand('copy')
      }
      const orig = btnExportCopy.textContent
      btnExportCopy.textContent = 'Copied! ✓'
      setTimeout(() => { btnExportCopy.textContent = orig }, 1500)
    } catch (err) {
      console.error('Clipboard copy failed:', err)
      exportJsonTextarea.select()
    }
  })
}

if (btnExportDownload) {
  btnExportDownload.addEventListener('click', () => {
    if (!exportJsonTextarea) return
    try {
      const extMap = {
        bundle: 'scene.json',
        landscape: 'landscape.json',
        feeds: 'feed.json',
        mappings: 'mappings.json'
      }
      const rawTitle = playerSceneTitle?.textContent || 'scene'
      const cleanTitle = rawTitle.replace(/^[^\w]+/, '').trim()
      const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'scene'
      const filename = `${slug}.${extMap[currentExportType] || 'json'}`
      const blob = new Blob([exportJsonTextarea.value], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  })
}

// ---------------------------------------------------------------------------
// Load Specification Modal (#modal-load)
// ---------------------------------------------------------------------------

const modalLoad = document.getElementById('modal-load')
const btnCloseLoad = document.getElementById('btn-close-load')
const loadDropZone = document.getElementById('load-drop-zone')
const loadFileInput = document.getElementById('load-file-input')
const btnBrowseFile = document.getElementById('btn-browse-file')
const loadFileStatus = document.getElementById('load-file-status')
const loadFileName = document.getElementById('load-file-name')
const loadFileDetail = document.getElementById('load-file-detail')
const loadJsonTextarea = document.getElementById('load-json-textarea')
const btnLoadApply = document.getElementById('btn-load-apply')

function inspectAndSetLoadJson(text, filename = 'custom.json') {
  if (loadJsonTextarea) loadJsonTextarea.value = text
  try {
    const parsed = JSON.parse(text)
    let typeName = 'Unknown Document'
    let detail = ''
    if (parsed.landscape || (parsed.objects && parsed.feeds && parsed.mappings)) {
      typeName = 'Unified Scene Bundle (.scene.json)'
      const objCount = Object.keys(parsed.objects || parsed.landscape?.objects || {}).length
      const feedCount = Object.keys(parsed.feeds || {}).length
      const mapCount = (parsed.mappings || []).length
      detail = `${objCount} resonators, ${feedCount} feeds, ${mapCount} mappings`
    } else if (parsed.feeds) {
      typeName = 'Data Feed Specification (.feed.json)'
      detail = `${Object.keys(parsed.feeds).length} feeds defined`
    } else if (parsed.mappings) {
      typeName = 'Parameter Mappings Specification (.mappings.json)'
      detail = `${parsed.mappings.length} mappings configured`
    } else if (parsed.objects || parsed.space) {
      typeName = 'Auditory Landscape Specification (.landscape.json)'
      detail = `${Object.keys(parsed.objects || {}).length} acoustic resonators`
    }
    if (loadFileStatus) loadFileStatus.style.display = 'flex'
    if (loadFileName) loadFileName.textContent = filename
    if (loadFileDetail) loadFileDetail.textContent = `${typeName} — ${detail}`
  } catch (err) {
    if (loadFileStatus) loadFileStatus.style.display = 'flex'
    if (loadFileName) loadFileName.textContent = filename
    if (loadFileDetail) loadFileDetail.textContent = `JSON Parse Warning: ${err.message}`
  }
}

if (btnLoadScene) {
  btnLoadScene.addEventListener('click', () => {
    if (modalLoad) modalLoad.style.display = 'flex'
    if (loadJsonTextarea && !loadJsonTextarea.value.trim()) {
      const desc = getCurrentSceneDescriptor()
      loadJsonTextarea.value = JSON.stringify(desc, null, 2)
    }
  })
}

if (btnCloseLoad) {
  btnCloseLoad.addEventListener('click', () => {
    if (modalLoad) modalLoad.style.display = 'none'
  })
}

if (modalLoad) {
  modalLoad.addEventListener('click', e => {
    if (e.target === modalLoad) modalLoad.style.display = 'none'
  })
}

if (btnBrowseFile && loadFileInput) {
  btnBrowseFile.addEventListener('click', () => loadFileInput.click())
}

if (loadDropZone && loadFileInput) {
  loadDropZone.addEventListener('click', e => {
    if (e.target !== btnBrowseFile) loadFileInput.click()
  })

  loadDropZone.addEventListener('dragover', e => {
    e.preventDefault()
    loadDropZone.classList.add('drag-over')
  })

  loadDropZone.addEventListener('dragleave', () => {
    loadDropZone.classList.remove('drag-over')
  })

  loadDropZone.addEventListener('drop', e => {
    e.preventDefault()
    loadDropZone.classList.remove('drag-over')
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      const reader = new FileReader()
      reader.onload = ev => inspectAndSetLoadJson(ev.target.result, file.name)
      reader.readAsText(file)
    }
  })
}

if (loadFileInput) {
  loadFileInput.addEventListener('change', e => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = ev => inspectAndSetLoadJson(ev.target.result, file.name)
      reader.readAsText(file)
    }
  })
}

if (loadJsonTextarea) {
  loadJsonTextarea.addEventListener('input', () => {
    inspectAndSetLoadJson(loadJsonTextarea.value, 'pasted-specification.json')
  })
}

if (btnLoadApply) {
  btnLoadApply.addEventListener('click', async () => {
    if (!loadJsonTextarea) return
    let parsed
    try {
      parsed = JSON.parse(loadJsonTextarea.value)
    } catch (err) {
      alert(`Invalid JSON Syntax: ${err.message}`)
      return
    }

    if (!parsed || typeof parsed !== 'object') {
      alert('Invalid Specification Document: Root must be a JSON object')
      return
    }

    try {
      if (parsed.feeds && !parsed.objects && !parsed.space && !parsed.landscape) {
        landscape.loadFeeds(parsed)
      } else if (parsed.mappings && !parsed.objects && !parsed.space && !parsed.landscape) {
        landscape.loadMappings(parsed)
      } else {
        clearActivePresetButtons()
        const sceneDescriptor = parsed.landscape || parsed
        syncSlidersFromScene(sceneDescriptor)
        if (isPlaying && landscape._audioContext) {
          await landscape.loadScene(parsed)
        } else {
          if (parsed.feeds) landscape.loadFeeds(parsed.feeds)
          if (parsed.mappings) landscape.loadMappings(parsed.mappings)
        }
      }
      if (modalLoad) modalLoad.style.display = 'none'
    } catch (err) {
      console.error('[Landscapes] Error applying specification:', err)
      alert(`Error applying specification: ${err.message}`)
    }
  })
}

// Legacy modal element bindings for backwards compatibility
if (btnModalCopy && exportJsonTextarea) {
  btnModalCopy.addEventListener('click', () => {
    if (btnExportCopy) btnExportCopy.click()
  })
}

if (btnModalApply && loadJsonTextarea) {
  btnModalApply.addEventListener('click', () => {
    if (btnLoadApply) btnLoadApply.click()
  })
}

if (btnCloseModal) {
  btnCloseModal.addEventListener('click', () => {
    if (modalExport) modalExport.style.display = 'none'
    if (modalLoad) modalLoad.style.display = 'none'
  })
}

// Preset Buttons
if (presetRainBtn) presetRainBtn.addEventListener('click', () => applyPreset('rain'))
if (presetPacificBtn) presetPacificBtn.addEventListener('click', () => applyPreset('pacific'))
if (presetStormBtn) presetStormBtn.addEventListener('click', () => applyPreset('storm'))
if (presetAlpineBtn) presetAlpineBtn.addEventListener('click', () => applyPreset('alpine'))

// ---------------------------------------------------------------------------
// Dynamic Layer Swimlanes, Object Management & Mapping Inspector
// ---------------------------------------------------------------------------

// Catalog Modal Elements
const btnOpenCatalog = document.getElementById('btn-open-catalog')
const modalAddSonifier = document.getElementById('modal-add-sonifier')
const btnCloseCatalog = document.getElementById('btn-close-catalog')
const btnCancelCatalog = document.getElementById('btn-cancel-catalog')
const btnConfirmAddSonifier = document.getElementById('btn-confirm-add-sonifier')
const catalogInstanceId = document.getElementById('catalog-instance-id')
const catalogLayerSelect = document.getElementById('catalog-layer-select')

// Mapping Inspector Elements
const modalMappingInspector = document.getElementById('modal-mapping-inspector')
const btnCloseMapping = document.getElementById('btn-close-mapping')
const btnMappingSave = document.getElementById('btn-mapping-save')
const btnMappingRemove = document.getElementById('btn-mapping-remove')
const mappingTargetObject = document.getElementById('mapping-target-object')
const mappingTargetName = document.getElementById('mapping-target-name')
const mappingTargetParam = document.getElementById('mapping-target-param')
const mappingTargetLayer = document.getElementById('mapping-target-layer')
const mappingParamsContainer = document.getElementById('mapping-params-container')
const mappingFeedSelect = document.getElementById('mapping-feed-select')
const mappingCurveSelect = document.getElementById('mapping-curve-select')
const mappingInMin = document.getElementById('mapping-in-min')
const mappingInMax = document.getElementById('mapping-in-max')
const mappingOutMin = document.getElementById('mapping-out-min')
const mappingOutMax = document.getElementById('mapping-out-max')
const mappingTuningEnable = document.getElementById('mapping-tuning-enable')
const tuningControlsSection = document.getElementById('tuning-controls-section')
const mappingTuningScale = document.getElementById('mapping-tuning-scale')
const mappingTuningRoot = document.getElementById('mapping-tuning-root')
const mappingScatterEnable = document.getElementById('mapping-scatter-enable')
const scatterControlsSection = document.getElementById('scatter-controls-section')
const mappingScatterStrategy = document.getElementById('mapping-scatter-strategy')
const mappingScatterWindow = document.getElementById('mapping-scatter-window')

// Player Layer Breakdown container
const playerLayerPills = document.getElementById('player-layer-pills')

let selectedCatalogType = 'bubble'
let currentMappingTarget = { objectId: 'wind', param: 'speed', layer: 'bed' }

export function updatePlayerLayerPills() {
  const container = document.getElementById('player-layer-pills') || playerLayerPills
  if (!container) return

  const bedItems = []
  const textureItems = []
  const figureItems = []

  const cards = document.querySelectorAll('.object-card')
  cards.forEach(card => {
    const objectId = card.dataset.objectId || card.id.replace('card-', '')
    const layerSelect = card.querySelector('.select-change-layer')
    const layer = layerSelect?.value || (landscape._objects.get(objectId)?.layer) || 'bed'
    const titleEl = card.querySelector('.object-title')
    const title = titleEl ? titleEl.textContent.trim().split(' (')[0] : objectId

    if (layer === 'bed') bedItems.push(title)
    else if (layer === 'texture') textureItems.push(title)
    else if (layer === 'figure') figureItems.push(title)
  })

  container.innerHTML = `
    <div class="player-layer-pill bed">
      <span>🔵 Bed (${bedItems.length}):</span>
      <strong>${bedItems.join(', ') || 'None'}</strong>
    </div>
    <div class="player-layer-pill texture">
      <span>🟢 Texture (${textureItems.length}):</span>
      <strong>${textureItems.join(', ') || 'None'}</strong>
    </div>
    <div class="player-layer-pill figure">
      <span>🟡 Figure (${figureItems.length}):</span>
      <strong>${figureItems.join(', ') || 'None'}</strong>
    </div>
  `
}

export function createSonifierCard(id, type, layer = 'bed') {
  const meta = SONIFIER_CATALOG[type] || { name: type, icon: '🔊', defaultLayer: layer, desc: 'Monorepo Resonator' }
  const article = document.createElement('article')
  article.className = 'object-card'
  article.id = `card-${id}`
  article.dataset.objectId = id
  article.dataset.type = type

  const badgeClass = 'cyan'
  const defaultDist = layer === 'figure' ? 3 : (layer === 'texture' ? 6 : 12)

  article.innerHTML = `
    <div class="object-header">
      <div>
        <div class="object-title">${meta.icon} ${meta.name} <small style="font-size: 0.72rem; color: var(--text-muted);">(${id})</small></div>
        <div class="object-subtitle">${meta.desc || 'Monorepo Resonator Plugin'}</div>
      </div>
      <div class="object-header-actions">
        <span class="badge ${badgeClass}">${type}</span>
        <button type="button" class="btn-remove-object btn-remove-header" data-object-id="${id}" title="Remove sonifier from landscape" aria-label="Remove ${meta.name}">✕</button>
      </div>
    </div>

    <!-- Card Tab Bar -->
    <div class="card-tabs-bar">
      <button type="button" class="card-tab-btn active" data-tab="spatial" data-object-id="${id}">🧭 Spatial</button>
      <button type="button" class="card-tab-btn" data-tab="params" data-object-id="${id}">🎛️ Parameters & Feeds <span class="card-tab-badge" id="tab-badge-${id}">0</span></button>
    </div>

    <!-- Tab 1: Spatial Placement & Depth -->
    <div class="card-tab-pane tab-spatial-pane active" id="tab-spatial-${id}">
      <div class="card-layer-toolbar" style="margin-top: 0;">
        <div class="layer-selector-wrap">
          <label for="layer-select-${id}">Layer:</label>
          <select class="select-change-layer" id="layer-select-${id}" data-object-id="${id}">
            <option value="bed" ${layer === 'bed' ? 'selected' : ''}>Bed</option>
            <option value="texture" ${layer === 'texture' ? 'selected' : ''}>Texture</option>
            <option value="figure" ${layer === 'figure' ? 'selected' : ''}>Figure</option>
          </select>
        </div>
        <div class="card-actions-wrap">
          <button type="button" class="btn-remove-object" data-object-id="${id}" title="Remove sonifier from landscape">🗑️ Remove</button>
        </div>
      </div>

      <div class="spatial-strip">
        <div class="section-label">🔊 Channel Volume & Spatial Field</div>
        <div class="control-row">
          <div class="control-label">
            <span>Component Volume</span>
            <span class="control-val" id="disp-${id}-volume">70%</span>
          </div>
          <input type="range" id="${id}-volume" class="dynamic-slider" data-param="gain" min="0" max="1" step="0.01" value="0.70">
        </div>
        <div class="control-row" style="margin-top: 0.4rem;">
          <div class="control-label">
            <span>Stereo Pan</span>
            <span class="control-val" id="disp-${id}-pan">Center (0.0)</span>
          </div>
          <input type="range" id="${id}-pan" class="dynamic-slider" data-param="pan" min="-1" max="1" step="0.05" value="0.0">
        </div>
        <div class="control-row" style="margin-top: 0.4rem;">
          <div class="control-label">
            <span>Distance / Depth</span>
            <span class="control-val" id="disp-${id}-distance">${formatDistance(defaultDist)}</span>
          </div>
          <input type="range" id="${id}-distance" class="dynamic-slider" data-param="distance" min="0" max="50" step="0.5" value="${defaultDist}">
        </div>
        <div class="control-row" style="margin-top: 0.4rem;">
          <div class="control-label">
            <span>Field Spread (Width)</span>
            <span class="control-val" id="disp-${id}-spread">0.50 (Spatial Arc)</span>
          </div>
          <input type="range" id="${id}-spread" class="dynamic-slider" data-param="spread" min="0.02" max="1.0" step="0.02" value="0.50">
        </div>
      </div>
    </div>

    <!-- Tab 2: Parameters & Feed Mappings -->
    <div class="card-tab-pane tab-params-pane" id="tab-params-${id}">
    </div>
  `

  const volSlider = article.querySelector(`#${id}-volume`)
  const panSlider = article.querySelector(`#${id}-pan`)
  const distSlider = article.querySelector(`#${id}-distance`)
  const spreadSlider = article.querySelector(`#${id}-spread`)
  const volDisp = article.querySelector(`#disp-${id}-volume`)
  const panDisp = article.querySelector(`#disp-${id}-pan`)
  const distDisp = article.querySelector(`#disp-${id}-distance`)
  const spreadDisp = article.querySelector(`#disp-${id}-spread`)

  if (volSlider) {
    volSlider.addEventListener('input', e => {
      const val = parseFloat(e.target.value)
      if (volDisp) volDisp.textContent = `${Math.round(val * 100)}%`
      landscape.setParam(id, 'gain', val)
    })
  }

  if (panSlider) {
    panSlider.addEventListener('input', e => {
      const val = parseFloat(e.target.value)
      if (panDisp) panDisp.textContent = formatPan(val)
      landscape.setParam(id, 'pan', val)
    })
  }

  if (distSlider) {
    distSlider.addEventListener('input', e => {
      const val = parseFloat(e.target.value)
      if (distDisp) distDisp.textContent = formatDistance(val)
      landscape.setParam(id, 'distance', val)
    })
  }

  if (spreadSlider) {
    spreadSlider.addEventListener('input', e => {
      const val = parseFloat(e.target.value)
      if (spreadDisp) spreadDisp.textContent = `${val.toFixed(2)} (Spatial Arc)`
      landscape.setParam(id, 'spread', val)
    })
  }

  const paramsPane = article.querySelector(`#tab-params-${id}`)
  if (paramsPane) {
    renderSonifierParameterEditor(id, paramsPane)
    paramsPane.dataset.rendered = 'true'
  }

  setupCardTabs(article)
  updateTabMappingBadges()

  return article
}

export function openCatalogModal(targetLayer = null) {
  if (targetLayer && catalogLayerSelect) {
    catalogLayerSelect.value = targetLayer
  }
  if (catalogInstanceId) {
    catalogInstanceId.value = `${selectedCatalogType}-${Math.floor(Math.random() * 899 + 100)}`
  }
  if (modalAddSonifier) {
    modalAddSonifier.style.display = 'flex'
  }
}

export function closeCatalogModal() {
  if (modalAddSonifier) {
    modalAddSonifier.style.display = 'none'
  }
}

export async function addSonifierFromCatalog(type, instanceId, targetLayer) {
  const sonifierType = type || selectedCatalogType
  if (!sonifierType || !SONIFIER_CATALOG[sonifierType]) {
    alert(`Unknown sonifier type: ${sonifierType}`)
    return false
  }

  const id = instanceId || `${sonifierType}-${Date.now().toString(36).slice(-4)}`
  if (landscape._objects.has(id)) {
    alert(`A sonifier with ID "${id}" already exists in the landscape. Please use a unique ID.`)
    return false
  }

  const layer = targetLayer || catalogLayerSelect?.value || SONIFIER_CATALOG[sonifierType].defaultLayer || 'bed'

  if (landscape._audioContext) {
    try {
      const Factory = SONIFIER_CATALOG[sonifierType].factory
      const instance = new Factory()
      landscape.addObject(id, instance, { layer, gain: 0.70, pan: 0.0, spread: 0.50 })
    } catch (err) {
      console.warn('[Landscape] Could not instantiate audio node immediately:', err)
    }
  }

  const card = createSonifierCard(id, sonifierType, layer)
  const container = document.getElementById(`cards-${layer}`)
  if (container) {
    container.appendChild(card)
  }

  updatePlayerLayerPills()
  closeCatalogModal()
  return true
}

export function handleLayerChange(objectId, newLayer) {
  if (!objectId || !newLayer) return
  if (landscape._objects.has(objectId)) {
    landscape.setObjectLayer(objectId, newLayer)
  }
  const card = document.getElementById(`card-${objectId}`) || document.querySelector(`article[data-object-id="${objectId}"]`)
  const targetContainer = document.getElementById(`cards-${newLayer}`)
  if (card && targetContainer && card.parentElement !== targetContainer) {
    targetContainer.appendChild(card)
  }
  updatePlayerLayerPills()
}

export function handleObjectRemove(objectId) {
  if (!objectId) return
  if (landscape._objects.has(objectId)) {
    landscape.removeObject(objectId)
  }
  if (objectId === 'chime' && landscape._objects.has('chimes')) {
    landscape.removeObject('chimes')
  } else if (objectId === 'chimes' && landscape._objects.has('chime')) {
    landscape.removeObject('chime')
  }

  landscape._mappings = landscape._mappings.filter(m => {
    const match = m.target && (
      m.target.objectId === objectId ||
      (objectId === 'chimes' && m.target.objectId === 'chime') ||
      (objectId === 'chime' && m.target.objectId === 'chimes')
    )
    if (match && m.scatterAdapter) m.scatterAdapter.cancel()
    return !match
  })

  const card = document.getElementById(`card-${objectId}`) ||
               (objectId === 'chimes' ? document.getElementById('card-chime') : null) ||
               (objectId === 'chime' ? document.getElementById('card-chimes') : null) ||
               document.querySelector(`article[data-object-id="${objectId}"]`) ||
               document.querySelector(`.btn-remove-object[data-object-id="${objectId}"]`)?.closest('article.object-card')

  if (card) {
    card.remove()
  }
  updatePlayerLayerPills()
}

export function getParamSliderBounds(schemaParam) {
  if (schemaParam && schemaParam.range) {
    const [min, max] = schemaParam.range
    const span = max - min
    let step = schemaParam.step
    if (!step) {
      if (span <= 1.5) step = 0.01
      else if (span <= 10) step = 0.1
      else if (span <= 100) step = 0.5
      else if (span <= 500) step = 1
      else step = 5
    }
    return { min, max, step }
  }
  return getOutputRangeBounds(schemaParam)
}

export function renderSonifierParameterEditor(objectId, container) {
  if (!container) return
  container.innerHTML = ''

  const card = document.getElementById(`card-${objectId}`) ||
               (objectId === 'chimes' ? document.getElementById('card-chime') : null) ||
               (objectId === 'chime' ? document.getElementById('card-chimes') : null) ||
               document.querySelector(`article[data-object-id="${objectId}"]`)
  const type = card?.dataset?.type || (objectId === 'chimes' ? 'chime' : objectId)
  const meta = SONIFIER_CATALOG[type] || { name: objectId, icon: '🔊', defaultLayer: 'bed' }
  const objEntry = landscape._objects.get(objectId)

  let schema = []
  if (objEntry?.sonifier && typeof objEntry.sonifier.getParamSchema === 'function') {
    schema = objEntry.sonifier.getParamSchema()
  } else if (SONIFIER_CATALOG[type]?.factory) {
    try {
      const temp = new SONIFIER_CATALOG[type].factory()
      schema = temp.getParamSchema()
    } catch {}
  }

  if (!schema || schema.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem; text-align: center;">No configurable parameters exposed for this sonifier.</div>'
    return
  }

  const availableFeeds = [
    { id: 'traffic_rps', label: 'HTTP Request Rate (0–5000 req/s)', range: [0, 5000], unit: 'req/s', step: 25 },
    { id: 'active_users', label: 'Active WebSocket Sessions (0–1000 conns)', range: [0, 1000], unit: 'conns', step: 10 },
    { id: 'cpu_load', label: 'Cluster CPU Load (0–100 %)', range: [0, 100], unit: '%', step: 1 },
    { id: 'error_spikes', label: 'HTTP 5xx Error Bursts (1–20 errors)', range: [1, 20], unit: 'errors', step: 1 }
  ]

  // Group parameters by param.group
  const groupsMap = new Map()
  for (const param of schema) {
    const groupName = param.group || 'Acoustic Parameters'
    if (!groupsMap.has(groupName)) {
      groupsMap.set(groupName, [])
    }
    groupsMap.get(groupName).push(param)
  }

  for (const [groupName, paramList] of groupsMap.entries()) {
    const groupEl = document.createElement('div')
    groupEl.className = 'param-group'

    const groupHeader = document.createElement('div')
    groupHeader.className = 'param-group-header'
    groupHeader.textContent = groupName
    groupEl.appendChild(groupHeader)

    for (const param of paramList) {
      const pName = param.name
      let existingMapping = landscape._mappings.find(m =>
        m.target && (m.target.objectId === objectId || (objectId === 'chimes' && m.target.objectId === 'chime') || (objectId === 'chime' && m.target.objectId === 'chimes')) &&
        (m.target.param === pName || m.target.event === pName)
      )

      const cardEl = document.createElement('div')
      cardEl.className = 'param-card'
      cardEl.id = `inspector-param-card-${pName}`

      // Check current static value
      let currentVal = param.default !== undefined ? param.default : (param.range ? param.range[0] : 0)
      const cardInput = card?.querySelector(`[id$="-${pName}"]`) || card?.querySelector(`[data-param="${pName}"]`) || card?.querySelector(`#${objectId}-${pName}`)
      if (cardInput && cardInput.value !== undefined) {
        currentVal = param.type === 'number' ? parseFloat(cardInput.value) : cardInput.value
      } else if (objEntry?.sonifier?.getParam) {
        try {
          const liveVal = objEntry.sonifier.getParam(pName)
          if (liveVal !== undefined) currentVal = liveVal
        } catch {}
      }

      const isDiscrete = param.type === 'enum' || Array.isArray(param.options) || Array.isArray(param.values)
      const isBool = param.type === 'boolean'

      if (isDiscrete) {
        cardEl.classList.add('discrete-param-card')
        cardEl.innerHTML = `
          <div class="param-card-header">
            <div class="param-title-group">
              <span class="param-toggle-label" style="cursor: default;">${param.label || pName}</span>
              ${param.unit ? `<span class="param-unit-tag">(${param.unit})</span>` : ''}
            </div>
            <span class="param-readout-badge badge-static" id="disp-inspector-${pName}">${currentVal}</span>
          </div>
          ${param.description ? `<div class="param-desc">${param.description}</div>` : ''}
          <div class="control-row">
            <select class="control-select" id="select-inspector-${pName}">
              ${(param.options || param.values || []).map(opt => {
                const val = typeof opt === 'object' ? opt.value : opt
                const lbl = typeof opt === 'object' ? opt.label : opt
                return `<option value="${val}" ${String(val) === String(currentVal) ? 'selected' : ''}>${lbl}</option>`
              }).join('')}
            </select>
          </div>
        `
        const sel = cardEl.querySelector(`#select-inspector-${pName}`)
        sel?.addEventListener('change', () => {
          const newVal = sel.value
          landscape.setParam(objectId, pName, newVal)
          if (cardInput) cardInput.value = newVal
          const disp = cardEl.querySelector(`#disp-inspector-${pName}`)
          if (disp) disp.textContent = newVal
        })

      } else if (isBool) {
        cardEl.classList.add('boolean-param-card')
        cardEl.innerHTML = `
          <div class="param-card-header">
            <label class="param-toggle-label">
              <input type="checkbox" id="check-inspector-${pName}" ${Boolean(currentVal) ? 'checked' : ''}>
              <span>${param.label || pName}</span>
            </label>
            ${param.unit ? `<span class="param-unit-tag">(${param.unit})</span>` : ''}
          </div>
          ${param.description ? `<div class="param-desc">${param.description}</div>` : ''}
        `
        const chk = cardEl.querySelector(`#check-inspector-${pName}`)
        chk?.addEventListener('change', () => {
          const checked = chk.checked
          landscape.setParam(objectId, pName, checked)
          if (cardInput) cardInput.checked = checked
        })

      } else {
        // Continuous Parameter
        cardEl.classList.add('continuous-param-card')
        const isMapped = Boolean(existingMapping)
        if (isMapped) cardEl.classList.add('sonified')

        const outBounds = getParamSliderBounds(param)
        const boundsMin = outBounds.min
        const boundsMax = outBounds.max
        const boundsStep = outBounds.step

        const renderParamCardBody = (mapped) => {
          cardEl.classList.toggle('sonified', mapped)

          let currentFeedId = existingMapping?.feedId || 'traffic_rps'
          let feedObj = availableFeeds.find(f => f.id === currentFeedId) || availableFeeds[0]
          let currentCurve = existingMapping?.adapterConfig?.curve || param.curve || 'linear'
          let isInverted = Boolean(existingMapping?.adapterConfig?.invert)

          let currentInMode = 'auto'
          if (existingMapping?.adapterConfig?.autoRange) {
            currentInMode = 'adaptive'
          } else if (existingMapping?.adapterConfig?.inputRange) {
            const r = existingMapping.adapterConfig.inputRange
            if (r[0] === feedObj.range[0] && r[1] === feedObj.range[1]) {
              currentInMode = 'auto'
            } else {
              currentInMode = 'custom'
            }
          }

          let currentInMin = existingMapping?.adapterConfig?.inputRange?.[0] ?? feedObj.range[0]
          let currentInMax = existingMapping?.adapterConfig?.inputRange?.[1] ?? feedObj.range[1]
          let currentOutMin = existingMapping?.adapterConfig?.outputRange?.[0] ?? boundsMin
          let currentOutMax = existingMapping?.adapterConfig?.outputRange?.[1] ?? boundsMax

          const getOutputBadgeText = () => {
            const u = param.unit ? ` ${param.unit}` : ''
            return isInverted
              ? `${formatRangeValue(currentOutMax)} ➔ ${formatRangeValue(currentOutMin)}${u}`
              : `${formatRangeValue(currentOutMin)} – ${formatRangeValue(currentOutMax)}${u}`
          }

          const getInputBadgeText = () => {
            const u = feedObj.unit ? ` ${feedObj.unit}` : ''
            if (currentInMode === 'adaptive') {
              return 'Dynamic Window (Auto-Range)'
            }
            if (currentInMode === 'auto') {
              return `${feedObj.range[0]} – ${feedObj.range[1]}${u} (Feed Extents)`
            }
            return `${formatRangeValue(currentInMin)} – ${formatRangeValue(currentInMax)}${u} (Custom)`
          }

          let bodyHtml = `
            <div class="param-card-header">
              <div class="param-title-group">
                <label class="param-toggle-label">
                  <input type="checkbox" class="check-map-to-feed" id="map-toggle-${pName}" ${mapped ? 'checked' : ''}>
                  <span>${param.label || pName}</span>
                </label>
                ${param.unit ? `<span class="param-unit-tag">(${param.unit})</span>` : ''}
              </div>
              <span class="param-readout-badge ${mapped ? 'badge-mapped' : 'badge-static'}" id="readout-${pName}">
                ${mapped ? `${existingMapping?.feedId || 'traffic_rps'} ➔ Mapped` : `${currentVal} ${param.unit || ''}`}
              </span>
            </div>
            ${param.description ? `<div class="param-desc">${param.description}</div>` : ''}
          `

          if (!mapped) {
            bodyHtml += `
              <div class="param-unmapped-row">
                <input type="range" class="control-slider slider-manual" id="slider-manual-${pName}" min="${boundsMin}" max="${boundsMax}" step="${boundsStep}" value="${currentVal}">
                <input type="number" class="control-input input-manual" id="input-manual-${pName}" min="${boundsMin}" max="${boundsMax}" step="${boundsStep}" value="${currentVal}">
              </div>
            `
          } else {
            const isTuningOn = Boolean(existingMapping?.adapterConfig?.tuning)
            const tuningScale = existingMapping?.adapterConfig?.tuning?.scale || 'pentatonic'
            const tuningRoot = existingMapping?.adapterConfig?.tuning?.root || 261.63
            const isScatterOn = Boolean(existingMapping?.adapterConfig?.scatter)
            const scatterStrat = existingMapping?.adapterConfig?.scatter?.strategy || 'poisson'
            const scatterWin = existingMapping?.adapterConfig?.scatter?.windowSeconds || 5.0

            bodyHtml += `
              <div class="param-mapped-controls">
                <div class="mapping-config-grid">
                  <div>
                    <label style="font-size: 0.76rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Mapped Data Feed:</label>
                    <select class="control-select select-feed" id="feed-sel-${pName}">
                      ${availableFeeds.map(f => `<option value="${f.id}" ${f.id === currentFeedId ? 'selected' : ''}>${f.label}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label style="font-size: 0.76rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Transfer Curve & Polarity:</label>
                    <div style="display: flex; gap: 0.4rem; align-items: center;">
                      <select class="control-select select-curve" id="curve-sel-${pName}" style="flex: 1;">
                        <option value="linear" ${currentCurve === 'linear' ? 'selected' : ''}>Linear</option>
                        <option value="exponential" ${currentCurve === 'exponential' ? 'selected' : ''}>Exponential (Perceptual)</option>
                        <option value="logarithmic" ${currentCurve === 'logarithmic' ? 'selected' : ''}>Logarithmic</option>
                      </select>
                      <button type="button" class="btn-invert ${isInverted ? 'inverted' : ''}" id="btn-invert-${pName}" title="Invert polarity">⇄</button>
                    </div>
                  </div>
                </div>

                <!-- Output Range Box with Dual Range Slider -->
                <div class="range-section-box" style="margin-top: 0.5rem;">
                  <div class="range-section-header">
                    <span class="range-section-title">Output Range (${param.unit || 'units'})</span>
                    <span class="badge-range" id="output-range-badge-${pName}">${getOutputBadgeText()}</span>
                  </div>
                  <div id="output-slider-container-${pName}"></div>
                </div>

                <!-- Input Range Box (Feed Extents / Adaptive / Custom Range Slider) -->
                <div class="range-section-box">
                  <div class="range-section-header">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                      <span class="range-section-title">Input Range (Data Feed)</span>
                      <div class="range-mode-segmented" id="input-mode-group-${pName}">
                        <button type="button" class="range-mode-btn ${currentInMode === 'auto' ? 'active' : ''}" data-mode="auto" id="btn-mode-auto-${pName}">Feed Extents</button>
                        <button type="button" class="range-mode-btn ${currentInMode === 'adaptive' ? 'active' : ''}" data-mode="adaptive" id="btn-mode-adaptive-${pName}">Adaptive</button>
                        <button type="button" class="range-mode-btn ${currentInMode === 'custom' ? 'active' : ''}" data-mode="custom" id="btn-mode-custom-${pName}">Custom Range</button>
                      </div>
                    </div>
                    <span class="badge-range badge-feed" id="input-range-badge-${pName}">${getInputBadgeText()}</span>
                  </div>
                  <div id="input-slider-container-${pName}" style="display: ${currentInMode === 'custom' ? 'block' : 'none'}; margin-top: 0.25rem;"></div>
                </div>

                <!-- Decorator Accordions -->
                <div class="param-decorator-accordion">
                  <div class="toggle-row" style="margin-bottom: 0.3rem;">
                    <label style="font-size: 0.8rem; font-weight: 600; color: var(--accent-cyan); display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                      <input type="checkbox" id="check-tuning-${pName}" ${isTuningOn ? 'checked' : ''}>
                      <span>🎵 Continuous Musical Tuning</span>
                    </label>
                  </div>
                  <div id="drawer-tuning-${pName}" style="display: ${isTuningOn ? 'block' : 'none'}; padding-top: 0.4rem;">
                    <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
                      <select class="control-select" id="scale-sel-${pName}" style="flex: 1; min-width: 140px;">
                        <option value="pentatonic" ${tuningScale === 'pentatonic' ? 'selected' : ''}>Minor Pentatonic</option>
                        <option value="major" ${tuningScale === 'major' ? 'selected' : ''}>Major Diatonic</option>
                        <option value="minor" ${tuningScale === 'minor' ? 'selected' : ''}>Natural Minor</option>
                        <option value="dorian" ${tuningScale === 'dorian' ? 'selected' : ''}>Dorian</option>
                        <option value="lydian" ${tuningScale === 'lydian' ? 'selected' : ''}>Lydian</option>
                        <option value="wholetone" ${tuningScale === 'wholetone' ? 'selected' : ''}>Whole Tone</option>
                        <option value="harmonics" ${tuningScale === 'harmonics' ? 'selected' : ''}>Harmonic Series (1-16)</option>
                      </select>
                      <div style="display: flex; align-items: center; gap: 0.3rem;">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Root:</span>
                        <input type="number" class="control-input" id="root-input-${pName}" value="${tuningRoot}" style="width: 75px;" step="0.01">
                        <span style="font-size: 0.72rem; color: var(--text-muted);">Hz</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="param-decorator-accordion">
                  <div class="toggle-row" style="margin-bottom: 0.3rem;">
                    <label style="font-size: 0.8rem; font-weight: 600; color: var(--accent-emerald); display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                      <input type="checkbox" id="check-scatter-${pName}" ${isScatterOn ? 'checked' : ''}>
                      <span>⏳ Temporal Event Scatter</span>
                    </label>
                  </div>
                  <div id="drawer-scatter-${pName}" style="display: ${isScatterOn ? 'block' : 'none'}; padding-top: 0.4rem;">
                    <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
                      <select class="control-select" id="strat-sel-${pName}" style="flex: 1; min-width: 140px;">
                        <option value="poisson" ${scatterStrat === 'poisson' ? 'selected' : ''}>Poisson Process</option>
                        <option value="uniform-jitter" ${scatterStrat === 'uniform-jitter' ? 'selected' : ''}>Uniform Jitter (±35%)</option>
                        <option value="fixed" ${scatterStrat === 'fixed' ? 'selected' : ''}>Fixed Rate</option>
                      </select>
                      <div style="display: flex; align-items: center; gap: 0.3rem;">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Window:</span>
                        <input type="number" class="control-input" id="win-input-${pName}" value="${scatterWin}" style="width: 65px;" step="0.5" min="0.5" max="60">
                        <span style="font-size: 0.72rem; color: var(--text-muted);">s</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `
          }

          cardEl.innerHTML = bodyHtml

          // Attach listeners for this continuous param
          const mapToggle = cardEl.querySelector(`#map-toggle-${pName}`)
          mapToggle?.addEventListener('change', () => {
            const willMap = mapToggle.checked
            if (willMap) {
              const defFeed = 'traffic_rps'
              const fObj = availableFeeds.find(f => f.id === defFeed) || availableFeeds[0]
              landscape.addMapping({
                feedId: defFeed,
                target: { objectId, param: pName },
                adapter: {
                  inputRange: [...fObj.range],
                  outputRange: [boundsMin, boundsMax],
                  curve: param.curve || 'linear'
                }
              })
              existingMapping = landscape._mappings.find(m =>
                m.target && (m.target.objectId === objectId || (objectId === 'chimes' && m.target.objectId === 'chime') || (objectId === 'chime' && m.target.objectId === 'chimes')) &&
                m.target.param === pName
              )
              renderParamCardBody(true)
            } else {
              if (existingMapping) {
                landscape.removeMapping(existingMapping.feedId, objectId, pName)
                existingMapping = null
              }
              renderParamCardBody(false)
            }
          })

          if (!mapped) {
            const sld = cardEl.querySelector(`#slider-manual-${pName}`)
            const inp = cardEl.querySelector(`#input-manual-${pName}`)
            const rBadge = cardEl.querySelector(`#readout-${pName}`)

            const updateManual = (val) => {
              const num = parseFloat(val)
              if (isNaN(num)) return
              sld.value = num
              inp.value = num
              currentVal = num
              if (rBadge) rBadge.textContent = `${num} ${param.unit || ''}`
              landscape.setParam(objectId, pName, num)
              if (cardInput) {
                cardInput.value = num
                const disp = card?.querySelector(`#disp-${pName}`) || card?.querySelector(`#disp-${objectId}-${pName}`)
                if (disp) disp.textContent = `${num} ${param.unit || ''}`
              }
            }

            sld?.addEventListener('input', () => updateManual(sld.value))
            inp?.addEventListener('input', () => updateManual(inp.value))

          } else {
            // Mapped controls listeners
            const feedSel = cardEl.querySelector(`#feed-sel-${pName}`)
            const curveSel = cardEl.querySelector(`#curve-sel-${pName}`)
            const btnInv = cardEl.querySelector(`#btn-invert-${pName}`)
            const outputContainer = cardEl.querySelector(`#output-slider-container-${pName}`)
            const outBadge = cardEl.querySelector(`#output-range-badge-${pName}`)
            const inputContainer = cardEl.querySelector(`#input-slider-container-${pName}`)
            const inBadge = cardEl.querySelector(`#input-range-badge-${pName}`)
            const modeBtns = cardEl.querySelectorAll(`#input-mode-group-${pName} .range-mode-btn`)
            const chkTuning = cardEl.querySelector(`#check-tuning-${pName}`)
            const scaleSel = cardEl.querySelector(`#scale-sel-${pName}`)
            const rootInp = cardEl.querySelector(`#root-input-${pName}`)
            const drawerTuning = cardEl.querySelector(`#drawer-tuning-${pName}`)
            const chkScatter = cardEl.querySelector(`#check-scatter-${pName}`)
            const stratSel = cardEl.querySelector(`#strat-sel-${pName}`)
            const winInp = cardEl.querySelector(`#win-input-${pName}`)
            const drawerScatter = cardEl.querySelector(`#drawer-scatter-${pName}`)

            const applyMappingUpdate = () => {
              const feedId = currentFeedId
              const curve = currentCurve
              const tuningOn = Boolean(chkTuning?.checked)
              const scatterOn = Boolean(chkScatter?.checked)

              const adapterConf = {
                outputRange: [currentOutMin, currentOutMax],
                curve,
                invert: isInverted,
                ...(tuningOn ? { tuning: { enabled: true, scale: scaleSel?.value || 'pentatonic', root: parseFloat(rootInp?.value || 261.63) } } : {}),
                ...(scatterOn ? { scatter: { enabled: true, strategy: stratSel?.value || 'poisson', windowSeconds: parseFloat(winInp?.value || 5.0) } } : {})
              }

              if (currentInMode === 'adaptive') {
                adapterConf.autoRange = { windowSize: 100, padding: 0.05 }
              } else {
                adapterConf.inputRange = [currentInMin, currentInMax]
              }

              const mappingDef = {
                feedId,
                target: { objectId, param: pName },
                adapter: adapterConf
              }

              landscape.addMapping(mappingDef)
              existingMapping = landscape._mappings.find(m =>
                m.target && (m.target.objectId === objectId || (objectId === 'chimes' && m.target.objectId === 'chime') || (objectId === 'chime' && m.target.objectId === 'chimes')) &&
                m.target.param === pName
              )
              const rBadge = cardEl.querySelector(`#readout-${pName}`)
              if (rBadge) rBadge.textContent = `${feedId} ➔ Mapped`

              // Keep legacy test elements synced
              if (pName === currentMappingTarget.param) {
                if (mappingFeedSelect) mappingFeedSelect.value = feedId
                if (mappingCurveSelect) mappingCurveSelect.value = curve
                if (mappingInMin) mappingInMin.value = currentInMin
                if (mappingInMax) mappingInMax.value = currentInMax
                if (mappingOutMin) mappingOutMin.value = currentOutMin
                if (mappingOutMax) mappingOutMax.value = currentOutMax
                if (mappingTuningEnable) mappingTuningEnable.checked = tuningOn
                if (mappingScatterEnable) mappingScatterEnable.checked = scatterOn
              }
            }

            // 1. Output Dual Range Slider
            if (outputContainer) {
              const outDualSlider = createDualRangeSlider(
                param,
                outBounds,
                [currentOutMin, currentOutMax],
                (newRange) => {
                  currentOutMin = newRange[0]
                  currentOutMax = newRange[1]
                  if (outBadge) outBadge.textContent = getOutputBadgeText()
                  applyMappingUpdate()
                }
              )
              outputContainer.appendChild(outDualSlider)
            }

            // 2. Custom Input Dual Range Slider
            const renderCustomInputSlider = () => {
              if (!inputContainer) return
              inputContainer.innerHTML = ''
              const inBounds = {
                min: feedObj.range[0],
                max: feedObj.range[1],
                step: feedObj.step || ((feedObj.range[1] - feedObj.range[0]) > 500 ? 10 : 1)
              }
              const inDualSlider = createDualRangeSlider(
                { name: `input-${pName}` },
                inBounds,
                [currentInMin, currentInMax],
                (newRange) => {
                  currentInMin = newRange[0]
                  currentInMax = newRange[1]
                  if (inBadge) inBadge.textContent = getInputBadgeText()
                  applyMappingUpdate()
                }
              )
              inDualSlider.querySelectorAll('.dual-range-input').forEach(inp => inp.classList.add('feed-input'))
              const prog = inDualSlider.querySelector('.dual-range-progress')
              if (prog) prog.classList.add('feed-progress')
              inputContainer.appendChild(inDualSlider)
            }

            if (currentInMode === 'custom') {
              renderCustomInputSlider()
            }

            // 3. Input Mode Buttons
            modeBtns.forEach(btn => {
              btn.addEventListener('click', () => {
                modeBtns.forEach(b => b.classList.remove('active'))
                btn.classList.add('active')
                currentInMode = btn.dataset.mode
                if (currentInMode === 'auto') {
                  if (inputContainer) inputContainer.style.display = 'none'
                  currentInMin = feedObj.range[0]
                  currentInMax = feedObj.range[1]
                } else if (currentInMode === 'adaptive') {
                  if (inputContainer) inputContainer.style.display = 'none'
                } else if (currentInMode === 'custom') {
                  if (inputContainer) inputContainer.style.display = 'block'
                  renderCustomInputSlider()
                }
                if (inBadge) inBadge.textContent = getInputBadgeText()
                applyMappingUpdate()
              })
            })

            // 4. Feed & Curve & Invert Listeners
            feedSel?.addEventListener('change', () => {
              currentFeedId = feedSel.value
              feedObj = availableFeeds.find(x => x.id === currentFeedId) || availableFeeds[0]
              if (currentInMode === 'auto') {
                currentInMin = feedObj.range[0]
                currentInMax = feedObj.range[1]
              } else if (currentInMode === 'custom') {
                currentInMin = feedObj.range[0]
                currentInMax = feedObj.range[1]
                renderCustomInputSlider()
              }
              if (inBadge) inBadge.textContent = getInputBadgeText()
              applyMappingUpdate()
            })

            curveSel?.addEventListener('change', () => {
              currentCurve = curveSel.value
              applyMappingUpdate()
            })

            btnInv?.addEventListener('click', () => {
              isInverted = !isInverted
              btnInv.classList.toggle('inverted', isInverted)
              if (outBadge) outBadge.textContent = getOutputBadgeText()
              applyMappingUpdate()
            })

            chkTuning?.addEventListener('change', () => {
              if (drawerTuning) drawerTuning.style.display = chkTuning.checked ? 'block' : 'none'
              applyMappingUpdate()
            })
            scaleSel?.addEventListener('change', applyMappingUpdate)
            rootInp?.addEventListener('change', applyMappingUpdate)

            chkScatter?.addEventListener('change', () => {
              if (drawerScatter) drawerScatter.style.display = chkScatter.checked ? 'block' : 'none'
              applyMappingUpdate()
            })
            stratSel?.addEventListener('change', applyMappingUpdate)
            winInp?.addEventListener('change', applyMappingUpdate)
          }
        }

        renderParamCardBody(isMapped)
      }

      groupEl.appendChild(cardEl)
    }

    container.appendChild(groupEl)
  }
}

export function openMappingInspector(objectId, param = 'speed') {
  currentMappingTarget.objectId = objectId
  currentMappingTarget.param = param

  const objEntry = landscape._objects.get(objectId)
  const card = document.getElementById(`card-${objectId}`) ||
               (objectId === 'chimes' ? document.getElementById('card-chime') : null) ||
               (objectId === 'chime' ? document.getElementById('card-chimes') : null) ||
               document.querySelector(`article[data-object-id="${objectId}"]`)
  const type = card?.dataset?.type || (objectId === 'chimes' ? 'chime' : objectId)
  const meta = SONIFIER_CATALOG[type] || { name: objectId, icon: '🔊', defaultLayer: 'bed' }
  const layerSelect = card?.querySelector('.select-change-layer')
  currentMappingTarget.layer = objEntry?.layer || layerSelect?.value || meta.defaultLayer || 'bed'

  if (mappingTargetObject) mappingTargetObject.textContent = objectId
  const mappingTargetNameEl = document.getElementById('mapping-target-name') || mappingTargetName
  if (mappingTargetNameEl) mappingTargetNameEl.textContent = meta.name
  if (mappingTargetParam) mappingTargetParam.textContent = param
  if (mappingTargetLayer) {
    mappingTargetLayer.textContent = `${currentMappingTarget.layer.toUpperCase()} LAYER`
    mappingTargetLayer.className = `badge ${currentMappingTarget.layer}`
  }

  // Populate legacy compatibility controls from first existing mapping or defaults
  const existing = landscape._mappings.find(m =>
    m.target && (m.target.objectId === objectId || (objectId === 'chimes' && m.target.objectId === 'chime') || (objectId === 'chime' && m.target.objectId === 'chimes')) &&
    (m.target.param === param || m.target.event === param)
  )

  if (existing) {
    if (mappingFeedSelect) mappingFeedSelect.value = existing.feedId || 'traffic_rps'
    if (mappingCurveSelect) mappingCurveSelect.value = existing.adapterConfig?.curve || 'linear'
    if (mappingInMin) mappingInMin.value = existing.adapterConfig?.inputRange?.[0] ?? 0
    if (mappingInMax) mappingInMax.value = existing.adapterConfig?.inputRange?.[1] ?? 5000
    if (mappingOutMin) mappingOutMin.value = existing.adapterConfig?.outputRange?.[0] ?? 15
    if (mappingOutMax) mappingOutMax.value = existing.adapterConfig?.outputRange?.[1] ?? 75
    if (mappingTuningEnable) mappingTuningEnable.checked = Boolean(existing.adapterConfig?.tuning)
    if (mappingScatterEnable) mappingScatterEnable.checked = Boolean(existing.adapterConfig?.scatter)
  }

  const container = document.getElementById('mapping-params-container') || mappingParamsContainer
  if (container) {
    renderSonifierParameterEditor(objectId, container)
  }

  if (param && container) {
    setTimeout(() => {
      const targetCard = container.querySelector(`#inspector-param-card-${param}`)
      if (targetCard && typeof targetCard.scrollIntoView === 'function') {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 50)
  }

  if (modalMappingInspector) {
    modalMappingInspector.style.display = 'flex'
  }
}

export function saveCurrentMapping() {
  if (modalMappingInspector) modalMappingInspector.style.display = 'none'
}

export function removeCurrentMapping() {
  const objectId = currentMappingTarget.objectId
  landscape._mappings = landscape._mappings.filter(m => {
    const match = m.target && (
      m.target.objectId === objectId ||
      (objectId === 'chimes' && m.target.objectId === 'chime') ||
      (objectId === 'chime' && m.target.objectId === 'chimes')
    )
    if (match && m.scatterAdapter) m.scatterAdapter.cancel()
    return !match
  })
  const container = document.getElementById('mapping-params-container') || mappingParamsContainer
  if (container) {
    renderSonifierParameterEditor(objectId, container)
  }
}

// Catalog modal event listeners
if (btnOpenCatalog) btnOpenCatalog.addEventListener('click', () => openCatalogModal())
if (btnCloseCatalog) btnCloseCatalog.addEventListener('click', closeCatalogModal)
if (btnCancelCatalog) btnCancelCatalog.addEventListener('click', closeCatalogModal)

if (btnConfirmAddSonifier) {
  btnConfirmAddSonifier.addEventListener('click', () => {
    const id = catalogInstanceId?.value.trim()
    const layer = catalogLayerSelect?.value
    addSonifierFromCatalog(selectedCatalogType, id, layer)
  })
}

// Catalog card selection
document.addEventListener('click', e => {
  const card = e.target.closest('.catalog-card')
  if (card) {
    document.querySelectorAll('.catalog-card').forEach(c => c.classList.remove('selected'))
    card.classList.add('selected')
    selectedCatalogType = card.dataset.sonifierType
    const defLayer = card.dataset.defaultLayer
    if (defLayer && catalogLayerSelect) catalogLayerSelect.value = defLayer
    if (catalogInstanceId) catalogInstanceId.value = `${selectedCatalogType}-${Math.floor(Math.random() * 899 + 100)}`
  }
})

// Mapping Inspector modal listeners
if (btnCloseMapping) btnCloseMapping.addEventListener('click', () => {
  if (modalMappingInspector) modalMappingInspector.style.display = 'none'
})
if (btnMappingSave) btnMappingSave.addEventListener('click', saveCurrentMapping)
if (btnMappingRemove) btnMappingRemove.addEventListener('click', removeCurrentMapping)

if (mappingTuningEnable) {
  mappingTuningEnable.addEventListener('change', e => {
    if (tuningControlsSection) tuningControlsSection.style.display = e.target.checked ? 'block' : 'none'
  })
}

if (mappingScatterEnable) {
  mappingScatterEnable.addEventListener('change', e => {
    if (scatterControlsSection) scatterControlsSection.style.display = e.target.checked ? 'block' : 'none'
  })
}

// Delegated listeners for layer change, param map, remove, and add to layer
document.addEventListener('change', e => {
  if (e.target.matches('.select-change-layer')) {
    handleLayerChange(e.target.dataset.objectId, e.target.value)
  }
})

document.addEventListener('click', e => {
  const btnMap = e.target.closest('.btn-param-map')
  if (btnMap) {
    openMappingInspector(btnMap.dataset.objectId, btnMap.dataset.param || 'speed')
    return
  }

  const btnRemove = e.target.closest('.btn-remove-object')
  if (btnRemove) {
    handleObjectRemove(btnRemove.dataset.objectId)
    return
  }

  const btnAddToLayer = e.target.closest('.btn-add-to-layer')
  if (btnAddToLayer) {
    openCatalogModal(btnAddToLayer.dataset.layer)
    return
  }
})

// Initial call to sync player pills
updatePlayerLayerPills()

// ---------------------------------------------------------------------------
// 2D Soundstage Visualizer Radar with Spatial Extent & Dynamic Layer Coding
// ---------------------------------------------------------------------------

function emitPulse(objectId, color, maxRadius = 45) {
  if (!canvas) return
  const w = canvas.width
  const h = canvas.height
  const pos = getObjectCoordinates(objectId, w, h)

  const panOffset = (Math.random() * 2 - 1) * pos.spread * 24
  const pulseX = pos.x + panOffset
  const pulseY = pos.y + (Math.random() * 2 - 1) * 8

  pulses.push({
    x: pulseX,
    y: pulseY,
    radius: 5,
    maxRadius,
    color,
    alpha: 0.95
  })
}

export function getObjectCoordinates(id, w, h) {
  const dpr = window.devicePixelRatio || 1
  const centerX = w / 2
  const listenerY = h - 28 * dpr

  const card = document.getElementById(`card-${id}`) ||
               (id === 'chimes' ? document.getElementById('card-chime') : null) ||
               (id === 'chime' ? document.getElementById('card-chimes') : null) ||
               document.querySelector(`article[data-object-id="${id}"]`)

  const entry = landscape._objects.get(id) || (id === 'chime' ? landscape._objects.get('chimes') : (id === 'chimes' ? landscape._objects.get('chime') : null))

  let pan = entry?.options?.pan
  if (pan === undefined) {
    const panInput = card?.querySelector(`input[data-param="pan"]`) ||
                     document.getElementById(`${id}-pan`) ||
                     (id === 'chimes' ? document.getElementById('chime-pan') : null)
    pan = panInput ? parseFloat(panInput.value) : 0.0
  }

  let distance = entry?.options?.distance
  if (distance === undefined) {
    const distInput = card?.querySelector(`input[data-param="distance"]`) ||
                      document.getElementById(`${id}-distance`) ||
                      (id === 'chimes' ? document.getElementById('chime-distance') : null)
    distance = distInput ? parseFloat(distInput.value) : (id === 'wind' ? 12 : (id === 'ocean' ? 8 : (id === 'rain' ? 4 : 3)))
  }

  let spread = entry?.options?.spread
  if (spread === undefined) {
    const spreadInput = card?.querySelector(`input[data-param="spread"]`) ||
                        document.getElementById(`${id}-spread`) ||
                        (id === 'chimes' ? document.getElementById('chime-spread') : null)
    spread = spreadInput ? parseFloat(spreadInput.value) : 0.50
  }

  const titleEl = card?.querySelector('.object-title')
  let label = titleEl ? titleEl.textContent.trim().split(' (')[0] : id
  if (id === 'wind' && !label.includes('Wind')) label = '🌬️ Wind'
  if (id === 'rain' && !label.includes('Rain')) label = '🌧️ Rain'
  if (id === 'ocean' && !label.includes('Ocean')) label = '🌊 Ocean'
  if ((id === 'chime' || id === 'chimes') && !label.includes('Chime')) label = '🎐 Chimes'

  const panRangePx = w * 0.40
  const maxDepthPx = (listenerY - 20 * dpr) - 40 * dpr
  const depthNorm = Math.min(1.0, Math.max(0.0, distance / 50.0))

  const x = centerX + pan * panRangePx
  const y = (listenerY - 20 * dpr) - depthNorm * maxDepthPx

  return { x, y, pan, distance, spread, label }
}

export function getActiveSoundObjects() {
  const cards = document.querySelectorAll('.object-card')
  const list = []
  cards.forEach(card => {
    const id = card.dataset.objectId || card.id.replace('card-', '')
    const layerSelect = card.querySelector('.select-change-layer')
    const layer = layerSelect?.value || (landscape._objects.get(id)?.layer) || 'bed'
    const color = layer === 'bed' ? '#38bdf8' : (layer === 'texture' ? '#34d399' : '#fbbf24')
    list.push({ id, layer, color })
  })

  return list
}

export let draggedObjectId = null
export let hoveredObjectId = null

export function renderSoundstage() {
  if (!canvas || !ctx2d) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
  }

  const w = canvas.width
  const h = canvas.height
  ctx2d.clearRect(0, 0, w, h)

  const centerX = w / 2
  const listenerY = h - 28 * dpr
  const panRangePx = w * 0.40
  const maxDepthPx = (listenerY - 20 * dpr) - 40 * dpr

  // 1. Concentric Metric Distance Rings (10m, 20m, 30m, 40m, 50m)
  const distanceMarkers = [10, 20, 30, 40, 50]
  for (const d of distanceMarkers) {
    const depthNorm = d / 50.0
    const ringY = (listenerY - 20 * dpr) - depthNorm * maxDepthPx
    const radius = listenerY - ringY

    ctx2d.beginPath()
    ctx2d.arc(centerX, listenerY, radius, Math.PI, 2 * Math.PI)
    ctx2d.strokeStyle = d === 50 ? 'rgba(56, 189, 248, 0.32)' : 'rgba(56, 189, 248, 0.16)'
    ctx2d.lineWidth = d === 50 ? 1.5 * dpr : 1.0 * dpr
    ctx2d.setLineDash(d === 50 ? [] : [4 * dpr, 4 * dpr])
    ctx2d.stroke()
    ctx2d.setLineDash([])

    // Distance Label along the radar edge
    ctx2d.fillStyle = 'rgba(148, 163, 184, 0.70)'
    ctx2d.font = `600 ${9.5 * dpr}px sans-serif`
    ctx2d.textAlign = 'right'
    ctx2d.fillText(`${d}m`, centerX - radius + 22 * dpr, listenerY - 4 * dpr)
    ctx2d.textAlign = 'left'
    ctx2d.fillText(`${d}m`, centerX + radius - 22 * dpr, listenerY - 4 * dpr)
  }

  // 2. Azimuthal Direction Spokes (Center, ±30°, ±60°, ±90°)
  ctx2d.strokeStyle = 'rgba(56, 189, 248, 0.15)'
  ctx2d.lineWidth = 1 * dpr
  ctx2d.beginPath()
  // 0° center
  ctx2d.moveTo(centerX, listenerY)
  ctx2d.lineTo(centerX, 20 * dpr)
  // Left 90°
  ctx2d.moveTo(centerX, listenerY)
  ctx2d.lineTo(centerX - panRangePx - 10 * dpr, listenerY)
  // Right 90°
  ctx2d.moveTo(centerX, listenerY)
  ctx2d.lineTo(centerX + panRangePx + 10 * dpr, listenerY)
  // 45° diagonals
  ctx2d.moveTo(centerX, listenerY)
  ctx2d.lineTo(centerX - (maxDepthPx * 0.75), listenerY - (maxDepthPx * 0.75))
  ctx2d.moveTo(centerX, listenerY)
  ctx2d.lineTo(centerX + (maxDepthPx * 0.75), listenerY - (maxDepthPx * 0.75))
  ctx2d.stroke()

  // 3. Stage Azimuth Labels
  ctx2d.fillStyle = 'rgba(148, 163, 184, 0.55)'
  ctx2d.font = `500 ${9 * dpr}px sans-serif`
  ctx2d.textAlign = 'center'
  ctx2d.fillText('◀ LEFT', centerX - panRangePx, listenerY + 16 * dpr)
  ctx2d.fillText('CENTER (0°)', centerX, 16 * dpr)
  ctx2d.fillText('RIGHT ▶', centerX + panRangePx, listenerY + 16 * dpr)

  const objects = getActiveSoundObjects()

  if (objects.length === 0) {
    ctx2d.fillStyle = 'rgba(148, 163, 184, 0.45)'
    ctx2d.font = `${12 * dpr}px sans-serif`
    ctx2d.textAlign = 'center'
    ctx2d.fillText('Soundstage Empty • Add sonifiers from catalog below', centerX, h * 0.45)
  }

  // 4. Draw High-Contrast Spatial Spread Cones
  for (const obj of objects) {
    const pos = getObjectCoordinates(obj.id, w, h)
    const dx = pos.x - centerX
    const dy = pos.y - listenerY
    const dist = Math.hypot(dx, dy)
    const baseAngle = Math.atan2(dy, dx)
    const halfSpreadAngle = Math.max(0.06, pos.spread * (Math.PI * 0.44))
    const isDragged = draggedObjectId === obj.id
    const isHovered = hoveredObjectId === obj.id

    ctx2d.save()

    // Conical Gradient Fill
    const grad = ctx2d.createRadialGradient(centerX, listenerY, 8 * dpr, centerX, listenerY, dist + 20 * dpr)
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.0)')
    grad.addColorStop(0.2, hexToRgba(obj.color, isPlaying ? 0.12 : 0.06))
    grad.addColorStop(0.7, hexToRgba(obj.color, isPlaying ? 0.35 : 0.22))
    grad.addColorStop(1.0, hexToRgba(obj.color, isPlaying ? 0.50 : 0.35))

    ctx2d.beginPath()
    ctx2d.moveTo(centerX, listenerY)
    ctx2d.arc(centerX, listenerY, dist + 16 * dpr, baseAngle - halfSpreadAngle, baseAngle + halfSpreadAngle)
    ctx2d.closePath()
    ctx2d.fillStyle = grad
    ctx2d.fill()

    // High contrast boundary rays (listener to outer arc)
    ctx2d.strokeStyle = hexToRgba(obj.color, isDragged ? 0.95 : 0.75)
    ctx2d.lineWidth = (isDragged ? 2.2 : 1.6) * dpr
    ctx2d.beginPath()
    ctx2d.moveTo(centerX, listenerY)
    ctx2d.lineTo(centerX + (dist + 16 * dpr) * Math.cos(baseAngle - halfSpreadAngle),
                 listenerY + (dist + 16 * dpr) * Math.sin(baseAngle - halfSpreadAngle))
    ctx2d.arc(centerX, listenerY, dist + 16 * dpr, baseAngle - halfSpreadAngle, baseAngle + halfSpreadAngle)
    ctx2d.lineTo(centerX, listenerY)
    ctx2d.stroke()

    // Glowing outer arc perimeter
    ctx2d.strokeStyle = hexToRgba(obj.color, 0.95)
    ctx2d.lineWidth = 2.4 * dpr
    ctx2d.shadowColor = obj.color
    ctx2d.shadowBlur = (isPlaying || isDragged ? 10 : 4) * dpr
    ctx2d.beginPath()
    ctx2d.arc(centerX, listenerY, dist + 16 * dpr, baseAngle - halfSpreadAngle, baseAngle + halfSpreadAngle)
    ctx2d.stroke()
    ctx2d.restore()
  }

  // 5. Listener icon
  ctx2d.fillStyle = '#38bdf8'
  ctx2d.beginPath()
  ctx2d.arc(centerX, listenerY, 6.5 * dpr, 0, 2 * Math.PI)
  ctx2d.fill()
  ctx2d.fillStyle = '#94a3b8'
  ctx2d.font = `600 ${11 * dpr}px sans-serif`
  ctx2d.textAlign = 'center'
  ctx2d.fillText('👤 Listener', centerX, listenerY + 18 * dpr)

  // 6. Draw acoustic emission pulses
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i]
    p.radius += 1.4 * dpr
    p.alpha *= 0.93

    ctx2d.strokeStyle = p.color
    ctx2d.globalAlpha = p.alpha
    ctx2d.lineWidth = 1.6 * dpr
    ctx2d.beginPath()
    ctx2d.arc(p.x, p.y, p.radius, 0, 2 * Math.PI)
    ctx2d.stroke()
    ctx2d.globalAlpha = 1.0

    if (p.alpha < 0.02 || p.radius >= p.maxRadius * dpr) {
      pulses.splice(i, 1)
    }
  }

  // 7. Draw Sound Object Nodes & Drag Overlays
  for (const obj of objects) {
    const pos = getObjectCoordinates(obj.id, w, h)
    const isDragged = draggedObjectId === obj.id
    const isHovered = hoveredObjectId === obj.id

    // Crosshairs & HUD when dragged
    if (isDragged) {
      ctx2d.strokeStyle = 'rgba(56, 189, 248, 0.45)'
      ctx2d.lineWidth = 1 * dpr
      ctx2d.setLineDash([3 * dpr, 3 * dpr])
      ctx2d.beginPath()
      // Vertical line to horizon & listener
      ctx2d.moveTo(pos.x, 20 * dpr)
      ctx2d.lineTo(pos.x, listenerY)
      // Horizontal line across stage
      ctx2d.moveTo(centerX - panRangePx, pos.y)
      ctx2d.lineTo(centerX + panRangePx, pos.y)
      ctx2d.stroke()
      ctx2d.setLineDash([])

      // Drag HUD Tooltip
      const hudText = `${pos.label}: Pan ${formatPan(pos.pan)} • Dist ${formatDistance(pos.distance)}`
      ctx2d.font = `600 ${10.5 * dpr}px sans-serif`
      const textWidth = ctx2d.measureText(hudText).width
      const pad = 7 * dpr
      const hudX = Math.max(pad + textWidth / 2, Math.min(w - pad - textWidth / 2, pos.x))
      const hudY = Math.max(28 * dpr, pos.y - 24 * dpr)

      ctx2d.fillStyle = 'rgba(15, 23, 42, 0.92)'
      ctx2d.strokeStyle = obj.color
      ctx2d.lineWidth = 1.5 * dpr
      ctx2d.beginPath()
      if (typeof ctx2d.roundRect === 'function') {
        ctx2d.roundRect(hudX - textWidth / 2 - pad, hudY - 14 * dpr, textWidth + pad * 2, 22 * dpr, 4 * dpr)
      } else {
        ctx2d.rect(hudX - textWidth / 2 - pad, hudY - 14 * dpr, textWidth + pad * 2, 22 * dpr)
      }
      ctx2d.fill()
      ctx2d.stroke()

      ctx2d.fillStyle = '#ffffff'
      ctx2d.textAlign = 'center'
      ctx2d.fillText(hudText, hudX, hudY + 1 * dpr)
    }

    // Outer Halo if hovered or dragged
    if (isHovered || isDragged) {
      ctx2d.strokeStyle = hexToRgba(obj.color, 0.6)
      ctx2d.lineWidth = 2 * dpr
      ctx2d.beginPath()
      ctx2d.arc(pos.x, pos.y, (isDragged ? 14 : 12) * dpr, 0, 2 * Math.PI)
      ctx2d.stroke()
    }

    // Node Disc
    ctx2d.shadowColor = obj.color
    ctx2d.shadowBlur = (isPlaying || isDragged ? 14 : 4) * dpr
    ctx2d.fillStyle = obj.color
    ctx2d.beginPath()
    ctx2d.arc(pos.x, pos.y, (isDragged ? 9 : 7.5) * dpr, 0, 2 * Math.PI)
    ctx2d.fill()
    ctx2d.shadowBlur = 0

    // Inner highlight point
    ctx2d.fillStyle = '#ffffff'
    ctx2d.beginPath()
    ctx2d.arc(pos.x, pos.y, 2.5 * dpr, 0, 2 * Math.PI)
    ctx2d.fill()

    // Node Label with Pill Backdrop for High Contrast
    if (!isDragged) {
      ctx2d.font = `600 ${11 * dpr}px sans-serif`
      const lblWidth = ctx2d.measureText(pos.label).width
      const pX = pos.x
      const pY = pos.y - 14 * dpr

      ctx2d.fillStyle = 'rgba(15, 23, 42, 0.78)'
      ctx2d.beginPath()
      if (typeof ctx2d.roundRect === 'function') {
        ctx2d.roundRect(pX - lblWidth / 2 - 4 * dpr, pY - 10 * dpr, lblWidth + 8 * dpr, 14 * dpr, 3 * dpr)
      } else {
        ctx2d.rect(pX - lblWidth / 2 - 4 * dpr, pY - 10 * dpr, lblWidth + 8 * dpr, 14 * dpr)
      }
      ctx2d.fill()

      ctx2d.fillStyle = '#f8fafc'
      ctx2d.textAlign = 'center'
      ctx2d.fillText(pos.label, pX, pY)
    }
  }

  // Micro-pulses for active sound components
  if (isPlaying) {
    if (landscape._objects.has('wind') && Math.random() < 0.03 && parseFloat(windVolSlider?.value || 0) > 0.05) {
      emitPulse('wind', '#38bdf8', 35)
    }
    if (landscape._objects.has('rain') && Math.random() < 0.06 && parseFloat(rainVolSlider?.value || 0) > 0.05) {
      emitPulse('rain', '#34d399', 26)
    }
    if (landscape._objects.has('ocean') && Math.random() < 0.02 && parseFloat(oceanVolSlider?.value || 0) > 0.05) {
      emitPulse('ocean', '#38bdf8', 40)
    }
  }

  animFrameId = requestAnimationFrame(renderSoundstage)
}

export function initDistanceSliders(root = document) {
  const windD = root.querySelector('#wind-distance')
  const windDisp = root.querySelector('#disp-wind-distance')
  if (windD) {
    windD.addEventListener('input', e => {
      const val = parseFloat(e.target.value)
      if (windDisp) windDisp.textContent = formatDistance(val)
      landscape.setParam('wind', 'distance', val)
    })
  }

  const oceanD = root.querySelector('#ocean-distance')
  const oceanDisp = root.querySelector('#disp-ocean-distance')
  if (oceanD) {
    oceanD.addEventListener('input', e => {
      const val = parseFloat(e.target.value)
      if (oceanDisp) oceanDisp.textContent = formatDistance(val)
      landscape.setParam('ocean', 'distance', val)
    })
  }

  const rainD = root.querySelector('#rain-distance')
  const rainDisp = root.querySelector('#disp-rain-distance')
  if (rainD) {
    rainD.addEventListener('input', e => {
      const val = parseFloat(e.target.value)
      if (rainDisp) rainDisp.textContent = formatDistance(val)
      landscape.setParam('rain', 'distance', val)
    })
  }

  const chimeD = root.querySelector('#chime-distance')
  const chimeDisp = root.querySelector('#disp-chime-distance')
  if (chimeD) {
    chimeD.addEventListener('input', e => {
      const val = parseFloat(e.target.value)
      if (chimeDisp) chimeDisp.textContent = formatDistance(val)
      landscape.setParam('chimes', 'distance', val)
    })
  }
}

export function initSoundstageCanvas(cvs = canvas) {
  if (!cvs) return

  cvs.addEventListener('pointerdown', (e) => {
    const rect = cvs.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const clickX = (e.clientX - rect.left) * dpr
    const clickY = (e.clientY - rect.top) * dpr

    const w = cvs.width
    const h = cvs.height
    const objects = getActiveSoundObjects()

    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i]
      const pos = getObjectCoordinates(obj.id, w, h)
      if (Math.hypot(clickX - pos.x, clickY - pos.y) <= 24 * dpr) {
        draggedObjectId = obj.id
        if (typeof cvs.setPointerCapture === 'function') {
          cvs.setPointerCapture(e.pointerId)
        }
        cvs.classList.add('cursor-grabbing')
        cvs.classList.remove('cursor-grab')
        e.preventDefault()
        break
      }
    }
  })

  cvs.addEventListener('pointermove', (e) => {
    const rect = cvs.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const curX = (e.clientX - rect.left) * dpr
    const curY = (e.clientY - rect.top) * dpr

    const w = cvs.width
    const h = cvs.height
    const centerX = w / 2
    const listenerY = h - 28 * dpr
    const panRangePx = w * 0.40
    const maxDepthPx = (listenerY - 20 * dpr) - 40 * dpr

    if (draggedObjectId) {
      let pan = (curX - centerX) / panRangePx
      pan = Math.max(-1.0, Math.min(1.0, Math.round(pan * 20) / 20))

      let normDist = ((listenerY - 20 * dpr) - curY) / maxDepthPx
      normDist = Math.max(0.0, Math.min(1.0, normDist))
      const distance = Math.round(normDist * 50 * 10) / 10

      landscape.setParam(draggedObjectId, 'pan', pan)
      landscape.setParam(draggedObjectId, 'distance', distance)
      updateCardSpatialControls(draggedObjectId, pan, distance)
      return
    }

    // Hover detection
    const objects = getActiveSoundObjects()
    let found = null
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i]
      const pos = getObjectCoordinates(obj.id, w, h)
      if (Math.hypot(curX - pos.x, curY - pos.y) <= 22 * dpr) {
        found = obj.id
        break
      }
    }
    hoveredObjectId = found
    if (found) {
      cvs.classList.add('cursor-grab')
    } else {
      cvs.classList.remove('cursor-grab')
    }
  })

  const handlePointerUp = (e) => {
    if (draggedObjectId) {
      if (typeof cvs.releasePointerCapture === 'function' && cvs.hasPointerCapture && cvs.hasPointerCapture(e.pointerId)) {
        cvs.releasePointerCapture(e.pointerId)
      }
      draggedObjectId = null
      cvs.classList.remove('cursor-grabbing')
      if (hoveredObjectId) {
        cvs.classList.add('cursor-grab')
      }
    }
  }

  cvs.addEventListener('pointerup', handlePointerUp)
  cvs.addEventListener('pointercancel', handlePointerUp)
}

if (canvas) {
  initSoundstageCanvas(canvas)
  animFrameId = requestAnimationFrame(renderSoundstage)
}

initDistanceSliders(document)
setupCardTabs(document)
updateTabMappingBadges()
