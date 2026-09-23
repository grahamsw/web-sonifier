import { Landscape } from '@web-sonifier/core'
import { WindSonifier } from '@web-sonifier/wind'
import { RainSonifier } from '@web-sonifier/rain'
import { OceanSonifier } from '@web-sonifier/ocean'
import { ChimeSonifier } from '@web-sonifier/chime'

// ---------------------------------------------------------------------------
// State & Instances
// ---------------------------------------------------------------------------

export const landscape = new Landscape()

let windInstance = null
let rainInstance = null
let oceanInstance = null
let chimeInstance = null
let isPlaying = false

// Visualizer state
let animFrameId = null
const pulses = []

// ---------------------------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------------------------

const btnPlay = document.getElementById('btn-play')
const btnStop = document.getElementById('btn-stop')
const statusEl = document.getElementById('landscape-status')

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
// Transport & Setup
// ---------------------------------------------------------------------------

export async function playLandscape() {
  await landscape.start()

  if (!windInstance) {
    windInstance = new WindSonifier()
    landscape.addObject('wind', windInstance, {
      gain: parseFloat(windVolSlider?.value || 0.70),
      pan: parseFloat(windPanSlider?.value || 0.0),
      reverbSend: 0.25
    })
  }

  if (!rainInstance) {
    rainInstance = new RainSonifier()
    landscape.addObject('rain', rainInstance, {
      gain: parseFloat(rainVolSlider?.value || 0.65),
      pan: parseFloat(rainPanSlider?.value || -0.30),
      reverbSend: 0.35
    })
  }

  if (!oceanInstance) {
    oceanInstance = new OceanSonifier()
    landscape.addObject('ocean', oceanInstance, {
      gain: parseFloat(oceanVolSlider?.value || 0.55),
      pan: parseFloat(oceanPanSlider?.value || 0.25),
      reverbSend: 0.30
    })
  }

  if (!chimeInstance) {
    chimeInstance = new ChimeSonifier()
    landscape.addObject('chimes', chimeInstance, {
      gain: parseFloat(chimeVolSlider?.value || 0.75),
      pan: parseFloat(chimePanSlider?.value || 0.45),
      reverbSend: 0.45
    })
  }

  syncAllParams()

  isPlaying = true
  if (statusEl) {
    statusEl.textContent = 'Active Landscape'
    statusEl.classList.add('active')
  }
  if (btnPlay) btnPlay.disabled = true
  if (btnStop) btnStop.disabled = false

  emitPulse('wind', '#38bdf8')
  emitPulse('rain', '#60a5fa')
  emitPulse('ocean', '#06b6d4')
  emitPulse('chimes', '#818cf8')
}

export async function stopLandscape() {
  await landscape.stop()
  isPlaying = false

  if (statusEl) {
    statusEl.textContent = 'Stopped'
    statusEl.classList.remove('active')
  }
  if (btnPlay) btnPlay.disabled = false
  if (btnStop) btnStop.disabled = true
}

export function syncAllParams() {
  if (!isPlaying) return

  // Master Space
  const decay = parseFloat(reverbDecaySlider?.value || 2.5)
  const wet = parseFloat(reverbWetSlider?.value || 0.28)
  const warmth = parseFloat(spaceWarmthSlider?.value || 0.65)
  landscape.setSpace({ decay, wet, warmth })

  // Master Volume
  const masterVol = parseFloat(masterVolSlider?.value || 0.8)
  landscape.setMasterVolume(masterVol)

  // 1. Wind
  const windGain = parseFloat(windVolSlider?.value || 0.70)
  const windPan = parseFloat(windPanSlider?.value || 0.0)
  const windSpeed = parseFloat(windSpeedSlider?.value || 35)
  const windTurb = parseFloat(windTurbulenceSlider?.value || 0.45)
  const windCav = parseFloat(windCavitySlider?.value || 0.30)

  landscape.setParam('wind', 'gain', windGain)
  landscape.setParam('wind', 'pan', windPan)
  landscape.setParam('wind', 'speed', windSpeed)
  landscape.setParam('wind', 'turbulence', windTurb)
  landscape.setParam('wind', 'cavity', windCav)

  // 2. Rain
  const rainGain = parseFloat(rainVolSlider?.value || 0.65)
  const rainPan = parseFloat(rainPanSlider?.value || -0.30)
  const rainInt = parseFloat(rainIntensitySlider?.value || 120)
  const rainSurf = rainSurfaceSelect?.value || 'puddle'
  const rainPitch = parseFloat(rainPitchSlider?.value || 1400)
  const rainSize = parseFloat(rainSizeSlider?.value || 1.0)

  landscape.setParam('rain', 'gain', rainGain)
  landscape.setParam('rain', 'pan', rainPan)
  landscape.setParam('rain', 'intensity', rainInt)
  landscape.setParam('rain', 'surface', rainSurf)
  landscape.setParam('rain', 'pitch', rainPitch)
  landscape.setParam('rain', 'dropletSize', rainSize)

  // 3. Ocean
  const oceanGain = parseFloat(oceanVolSlider?.value || 0.55)
  const oceanPan = parseFloat(oceanPanSlider?.value || 0.25)
  const oceanInt = parseFloat(oceanIntensitySlider?.value || 60)
  const oceanPer = parseFloat(oceanPeriodSlider?.value || 8.5)
  const oceanFoam = parseFloat(oceanFoamSlider?.value || 0.55)
  const oceanPitch = parseFloat(oceanPitchSlider?.value || 480)

  landscape.setParam('ocean', 'gain', oceanGain)
  landscape.setParam('ocean', 'pan', oceanPan)
  landscape.setParam('ocean', 'intensity', oceanInt)
  landscape.setParam('ocean', 'swellPeriod', oceanPer)
  landscape.setParam('ocean', 'foam', oceanFoam)
  landscape.setParam('ocean', 'pitch', oceanPitch)

  // 4. Chimes
  const chimeGain = parseFloat(chimeVolSlider?.value || 0.75)
  const chimePan = parseFloat(chimePanSlider?.value || 0.45)
  const chimeCoupled = chimeCoupledCheck ? chimeCoupledCheck.checked : true
  const chimeMat = chimeMaterialSelect?.value || 'aluminum'
  const chimePitch = parseFloat(chimePitchSlider?.value || 587)
  const chimeDamp = parseFloat(chimeDampingSlider?.value || 0.25)

  landscape.setParam('chimes', 'gain', chimeGain)
  landscape.setParam('chimes', 'pan', chimePan)
  landscape.setParam('chimes', 'material', chimeMat)
  landscape.setParam('chimes', 'pitch', chimePitch)
  landscape.setParam('chimes', 'damping', chimeDamp)
  landscape.setParam('chimes', 'windSpeed', chimeCoupled ? windSpeed * 0.8 : 0)
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

if (windSpeedSlider) {
  windSpeedSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (windSpeedDisp) windSpeedDisp.textContent = `${v} km/h`
    landscape.setParam('wind', 'speed', v)
    if (chimeCoupledCheck && chimeCoupledCheck.checked) {
      landscape.setParam('chimes', 'windSpeed', v * 0.8)
    }
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
    landscape.setParam('wind', 'cavity', v)
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

if (chimeCoupledCheck) {
  chimeCoupledCheck.addEventListener('change', e => {
    const coupled = e.target.checked
    const speed = parseFloat(windSpeedSlider?.value || 35)
    landscape.setParam('chimes', 'windSpeed', coupled ? speed * 0.8 : 0)
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

function formatPan(val) {
  if (Math.abs(val) < 0.04) return 'Center (0.0)'
  if (val < 0) return `Left (${val.toFixed(2)})`
  return `Right (+${val.toFixed(2)})`
}

// ---------------------------------------------------------------------------
// Atmospheric Presets
// ---------------------------------------------------------------------------

function clearActivePresetButtons() {
  presetRainBtn?.classList.remove('active')
  presetPacificBtn?.classList.remove('active')
  presetStormBtn?.classList.remove('active')
  presetAlpineBtn?.classList.remove('active')
}

export function applyPreset(name) {
  clearActivePresetButtons()

  if (name === 'rain') {
    presetRainBtn?.classList.add('active')
    setSlider(reverbDecaySlider, 2.6, reverbDecayDisp, '2.6s')
    setSlider(reverbWetSlider, 0.32, reverbWetDisp, '32%')
    setSlider(spaceWarmthSlider, 0.65, spaceWarmthDisp, '65%')

    // Rain focus
    setSlider(rainVolSlider, 0.80, rainVolDisp, '80%')
    setSlider(rainIntensitySlider, 140, rainIntensityDisp, '140 drops/s')
    if (rainSurfaceSelect) rainSurfaceSelect.value = 'puddle'
    setSlider(rainPitchSlider, 1300, rainPitchDisp, '1300 Hz')
    setSlider(rainPanSlider, -0.30, rainPanDisp, 'Left (-0.30)')

    // Gentle wind
    setSlider(windVolSlider, 0.40, windVolDisp, '40%')
    setSlider(windSpeedSlider, 18, windSpeedDisp, '18 km/h')
    setSlider(windTurbulenceSlider, 0.30, windTurbulenceDisp, '0.30')
    setSlider(windPanSlider, 0.0, windPanDisp, 'Center (0.0)')

    // Soft singing chimes
    setSlider(chimeVolSlider, 0.65, chimeVolDisp, '65%')
    if (chimeMaterialSelect) chimeMaterialSelect.value = 'aluminum'
    setSlider(chimePitchSlider, 587, chimePitchDisp, '587 Hz')
    setSlider(chimeDampingSlider, 0.22, chimeDampingDisp, '0.22')
    setSlider(chimePanSlider, 0.40, chimePanDisp, 'Right (+0.40)')
    if (chimeCoupledCheck) chimeCoupledCheck.checked = true

    // Ocean muted
    setSlider(oceanVolSlider, 0.0, oceanVolDisp, '0%')

  } else if (name === 'pacific') {
    presetPacificBtn?.classList.add('active')
    setSlider(reverbDecaySlider, 3.2, reverbDecayDisp, '3.2s')
    setSlider(reverbWetSlider, 0.30, reverbWetDisp, '30%')
    setSlider(spaceWarmthSlider, 0.50, spaceWarmthDisp, '50%')

    // Ocean focus
    setSlider(oceanVolSlider, 0.85, oceanVolDisp, '85%')
    setSlider(oceanIntensitySlider, 75, oceanIntensityDisp, '75%')
    setSlider(oceanPeriodSlider, 9.0, oceanPeriodDisp, '9.0s')
    setSlider(oceanFoamSlider, 0.60, oceanFoamDisp, '0.60')
    setSlider(oceanPitchSlider, 450, oceanPitchDisp, '450 Hz')
    setSlider(oceanPanSlider, 0.20, oceanPanDisp, 'Right (+0.20)')

    // Coastal breeze
    setSlider(windVolSlider, 0.60, windVolDisp, '60%')
    setSlider(windSpeedSlider, 32, windSpeedDisp, '32 km/h')
    setSlider(windTurbulenceSlider, 0.40, windTurbulenceDisp, '0.40')
    setSlider(windPanSlider, -0.20, windPanDisp, 'Left (-0.20)')

    // Distant chimes
    setSlider(chimeVolSlider, 0.45, chimeVolDisp, '45%')
    if (chimeMaterialSelect) chimeMaterialSelect.value = 'bronze'
    setSlider(chimePitchSlider, 523, chimePitchDisp, '523 Hz')
    setSlider(chimeDampingSlider, 0.35, chimeDampingDisp, '0.35')
    setSlider(chimePanSlider, 0.55, chimePanDisp, 'Right (+0.55)')

    // Light sea mist rain
    setSlider(rainVolSlider, 0.25, rainVolDisp, '25%')
    setSlider(rainIntensitySlider, 40, rainIntensityDisp, '40 drops/s')

  } else if (name === 'storm') {
    presetStormBtn?.classList.add('active')
    setSlider(reverbDecaySlider, 4.5, reverbDecayDisp, '4.5s')
    setSlider(reverbWetSlider, 0.40, reverbWetDisp, '40%')
    setSlider(spaceWarmthSlider, 0.70, spaceWarmthDisp, '70%')

    // Torrential rain
    setSlider(rainVolSlider, 0.90, rainVolDisp, '90%')
    setSlider(rainIntensitySlider, 320, rainIntensityDisp, '320 drops/s')
    if (rainSurfaceSelect) rainSurfaceSelect.value = 'roof'
    setSlider(rainPitchSlider, 1600, rainPitchDisp, '1600 Hz')
    setSlider(rainPanSlider, -0.40, rainPanDisp, 'Left (-0.40)')

    // Howling gale
    setSlider(windVolSlider, 0.85, windVolDisp, '85%')
    setSlider(windSpeedSlider, 68, windSpeedDisp, '68 km/h')
    setSlider(windTurbulenceSlider, 0.75, windTurbulenceDisp, '0.75')
    setSlider(windCavitySlider, 0.60, windCavityDisp, '0.60')
    setSlider(windPanSlider, 0.0, windPanDisp, 'Center (0.0)')

    // Distant turbulent surf
    setSlider(oceanVolSlider, 0.50, oceanVolDisp, '50%')
    setSlider(oceanIntensitySlider, 80, oceanIntensityDisp, '80%')
    setSlider(oceanPeriodSlider, 6.0, oceanPeriodDisp, '6.0s')

    // Clattering chimes
    setSlider(chimeVolSlider, 0.80, chimeVolDisp, '80%')
    if (chimeMaterialSelect) chimeMaterialSelect.value = 'steel'
    setSlider(chimePitchSlider, 659, chimePitchDisp, '659 Hz')
    setSlider(chimeDampingSlider, 0.18, chimeDampingDisp, '0.18')
    setSlider(chimePanSlider, 0.45, chimePanDisp, 'Right (+0.45)')

  } else if (name === 'alpine') {
    presetAlpineBtn?.classList.add('active')
    setSlider(reverbDecaySlider, 4.2, reverbDecayDisp, '4.2s')
    setSlider(reverbWetSlider, 0.35, reverbWetDisp, '35%')
    setSlider(spaceWarmthSlider, 0.75, spaceWarmthDisp, '75%')

    // Mountain wind
    setSlider(windVolSlider, 0.75, windVolDisp, '75%')
    setSlider(windSpeedSlider, 45, windSpeedDisp, '45 km/h')
    setSlider(windTurbulenceSlider, 0.60, windTurbulenceDisp, '0.60')
    setSlider(windCavitySlider, 0.45, windCavityDisp, '0.45')
    setSlider(windPanSlider, 0.0, windPanDisp, 'Center (0.0)')

    // High ringing aluminum chimes
    setSlider(chimeVolSlider, 0.85, chimeVolDisp, '85%')
    if (chimeMaterialSelect) chimeMaterialSelect.value = 'aluminum'
    setSlider(chimePitchSlider, 659, chimePitchDisp, '659 Hz')
    setSlider(chimeDampingSlider, 0.20, chimeDampingDisp, '0.20')
    setSlider(chimePanSlider, 0.40, chimePanDisp, 'Right (+0.40)')

    // Soft alpine drizzle
    setSlider(rainVolSlider, 0.35, rainVolDisp, '35%')
    setSlider(rainIntensitySlider, 35, rainIntensityDisp, '35 drops/s')
    if (rainSurfaceSelect) rainSurfaceSelect.value = 'foliage'

    // Ocean off
    setSlider(oceanVolSlider, 0.0, oceanVolDisp, '0%')
  }

  syncAllParams()
}

function setSlider(el, val, dispEl, dispText) {
  if (!el) return
  el.value = val
  if (dispEl && dispText) dispEl.textContent = dispText
}

if (presetRainBtn) presetRainBtn.addEventListener('click', () => applyPreset('rain'))
if (presetPacificBtn) presetPacificBtn.addEventListener('click', () => applyPreset('pacific'))
if (presetStormBtn) presetStormBtn.addEventListener('click', () => applyPreset('storm'))
if (presetAlpineBtn) presetAlpineBtn.addEventListener('click', () => applyPreset('alpine'))

// ---------------------------------------------------------------------------
// 2D Soundstage Visualizer Radar
// ---------------------------------------------------------------------------

function emitPulse(objectId, color, maxRadius = 45) {
  if (!canvas) return
  const w = canvas.width
  const h = canvas.height
  const pos = getObjectCoordinates(objectId, w, h)
  pulses.push({
    x: pos.x,
    y: pos.y,
    radius: 8,
    maxRadius,
    color,
    alpha: 0.9
  })
}

function getObjectCoordinates(id, w, h) {
  const centerX = w / 2
  if (id === 'wind') {
    const pan = parseFloat(windPanSlider?.value || 0.0)
    return { x: centerX + pan * (w * 0.4), y: h * 0.28, label: '🌬️ Wind' }
  }
  if (id === 'rain') {
    const pan = parseFloat(rainPanSlider?.value || -0.30)
    return { x: centerX + pan * (w * 0.4), y: h * 0.42, label: '🌧️ Rain' }
  }
  if (id === 'ocean') {
    const pan = parseFloat(oceanPanSlider?.value || 0.25)
    return { x: centerX + pan * (w * 0.4), y: h * 0.44, label: '🌊 Ocean' }
  }
  if (id === 'chimes') {
    const pan = parseFloat(chimePanSlider?.value || 0.45)
    return { x: centerX + pan * (w * 0.4), y: h * 0.52, label: '🎐 Chimes' }
  }
  return { x: centerX, y: h * 0.5, label: id }
}

function renderSoundstage() {
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

  // Background radar grid lines
  ctx2d.strokeStyle = 'rgba(56, 189, 248, 0.08)'
  ctx2d.lineWidth = 1
  const centerX = w / 2
  const listenerY = h - 25 * dpr

  for (let r = 50 * dpr; r <= Math.max(w, h); r += 50 * dpr) {
    ctx2d.beginPath()
    ctx2d.arc(centerX, listenerY, r, Math.PI, 2 * Math.PI)
    ctx2d.stroke()
  }

  // Radial azimuth spokes (-45°, 0°, +45°)
  ctx2d.beginPath()
  ctx2d.moveTo(centerX, listenerY)
  ctx2d.lineTo(centerX - 140 * dpr, 20 * dpr)
  ctx2d.moveTo(centerX, listenerY)
  ctx2d.lineTo(centerX, 15 * dpr)
  ctx2d.moveTo(centerX, listenerY)
  ctx2d.lineTo(centerX + 140 * dpr, 20 * dpr)
  ctx2d.stroke()

  // Listener icon
  ctx2d.fillStyle = '#38bdf8'
  ctx2d.beginPath()
  ctx2d.arc(centerX, listenerY, 6 * dpr, 0, 2 * Math.PI)
  ctx2d.fill()
  ctx2d.fillStyle = '#94a3b8'
  ctx2d.font = `${11 * dpr}px sans-serif`
  ctx2d.textAlign = 'center'
  ctx2d.fillText('👤 Listener', centerX, listenerY + 18 * dpr)

  // Draw acoustic emission pulses
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i]
    p.radius += 1.2 * dpr
    p.alpha *= 0.94

    ctx2d.strokeStyle = p.color
    ctx2d.globalAlpha = p.alpha
    ctx2d.lineWidth = 1.5 * dpr
    ctx2d.beginPath()
    ctx2d.arc(p.x, p.y, p.radius, 0, 2 * Math.PI)
    ctx2d.stroke()
    ctx2d.globalAlpha = 1.0

    if (p.alpha < 0.02 || p.radius >= p.maxRadius * dpr) {
      pulses.splice(i, 1)
    }
  }

  // Draw the 4 Sound Objects
  const objects = [
    { id: 'wind', color: '#38bdf8' },
    { id: 'rain', color: '#60a5fa' },
    { id: 'ocean', color: '#06b6d4' },
    { id: 'chimes', color: '#818cf8' }
  ]

  for (const obj of objects) {
    const pos = getObjectCoordinates(obj.id, w, h)

    ctx2d.shadowColor = obj.color
    ctx2d.shadowBlur = isPlaying ? 10 * dpr : 2 * dpr
    ctx2d.fillStyle = obj.color
    ctx2d.beginPath()
    ctx2d.arc(pos.x, pos.y, 7 * dpr, 0, 2 * Math.PI)
    ctx2d.fill()
    ctx2d.shadowBlur = 0

    ctx2d.fillStyle = '#f8fafc'
    ctx2d.font = `600 ${11 * dpr}px sans-serif`
    ctx2d.textAlign = 'center'
    ctx2d.fillText(pos.label, pos.x, pos.y - 12 * dpr)
  }

  // Micro-pulses for active sound components
  if (isPlaying) {
    if (Math.random() < 0.03 && parseFloat(windVolSlider?.value || 0) > 0.05) {
      emitPulse('wind', '#38bdf8', 35)
    }
    if (Math.random() < 0.05 && parseFloat(rainVolSlider?.value || 0) > 0.05) {
      emitPulse('rain', '#60a5fa', 32)
    }
    if (Math.random() < 0.02 && parseFloat(oceanVolSlider?.value || 0) > 0.05) {
      emitPulse('ocean', '#06b6d4', 40)
    }
  }

  animFrameId = requestAnimationFrame(renderSoundstage)
}

if (canvas) {
  animFrameId = requestAnimationFrame(renderSoundstage)
}
