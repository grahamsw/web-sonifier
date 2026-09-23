import { Landscape } from '@web-sonifier/core'
import { WindSonifier } from '@web-sonifier/wind'
import { ChimeSonifier } from '@web-sonifier/chime'
import { BubbleSonifier } from '@web-sonifier/bubble'

// ---------------------------------------------------------------------------
// State & Instances
// ---------------------------------------------------------------------------

export const landscape = new Landscape()

let windInstance = null
let chimeInstance = null
let bubbleInstance = null
let isPlaying = false

// Soundstage visualizer animation frame
let animFrameId = null
const pulses = [] // Array<{ x, y, radius, maxRadius, color, alpha }>

// ---------------------------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------------------------

const btnPlay = document.getElementById('btn-play')
const btnStop = document.getElementById('btn-stop')
const statusEl = document.getElementById('landscape-status')

const masterVolSlider = document.getElementById('master-volume')
const masterVolDisp = document.getElementById('val-master-vol')
const reverbDecaySlider = document.getElementById('reverb-decay')
const reverbDecayDisp = document.getElementById('val-reverb-decay')
const reverbWetSlider = document.getElementById('reverb-wet')
const reverbWetDisp = document.getElementById('val-reverb-wet')
const spaceWarmthSlider = document.getElementById('space-warmth')
const spaceWarmthDisp = document.getElementById('val-space-warmth')

// Wind Elements
const windSpeedSlider = document.getElementById('wind-speed')
const windSpeedDisp = document.getElementById('disp-wind-speed')
const windTurbulenceSlider = document.getElementById('wind-turbulence')
const windTurbulenceDisp = document.getElementById('disp-wind-turbulence')
const windCavitySlider = document.getElementById('wind-cavity')
const windCavityDisp = document.getElementById('disp-wind-cavity')
const windPanSlider = document.getElementById('wind-pan')
const windPanDisp = document.getElementById('disp-wind-pan')
const windGainSlider = document.getElementById('wind-gain')
const windReverbSlider = document.getElementById('wind-reverb')
const windMixDisp = document.getElementById('disp-wind-mix')

// Chime Elements
const chimeCoupledCheck = document.getElementById('chime-wind-coupled')
const btnStrikeChime = document.getElementById('btn-strike-chime')
const chimeMaterialSelect = document.getElementById('chime-material')
const chimePitchSlider = document.getElementById('chime-pitch')
const chimePitchDisp = document.getElementById('disp-chime-pitch')
const chimeDampingSlider = document.getElementById('chime-damping')
const chimeDampingDisp = document.getElementById('disp-chime-damping')
const chimePanSlider = document.getElementById('chime-pan')
const chimePanDisp = document.getElementById('disp-chime-pan')
const chimeGainSlider = document.getElementById('chime-gain')
const chimeReverbSlider = document.getElementById('chime-reverb')
const chimeMixDisp = document.getElementById('disp-chime-mix')

// Bubble Elements
const bubbleRateSlider = document.getElementById('bubble-rate')
const bubbleRateDisp = document.getElementById('disp-bubble-rate')
const btnTriggerBubble = document.getElementById('btn-trigger-bubble')
const bubbleRadiusSlider = document.getElementById('bubble-radius')
const bubbleRadiusDisp = document.getElementById('disp-bubble-radius')
const bubbleDepthSlider = document.getElementById('bubble-depth')
const bubbleDepthDisp = document.getElementById('disp-bubble-depth')
const bubbleViscositySlider = document.getElementById('bubble-viscosity')
const bubbleViscosityDisp = document.getElementById('disp-bubble-viscosity')
const bubblePanSlider = document.getElementById('bubble-pan')
const bubblePanDisp = document.getElementById('disp-bubble-pan')
const bubbleGainSlider = document.getElementById('bubble-gain')
const bubbleReverbSlider = document.getElementById('bubble-reverb')
const bubbleMixDisp = document.getElementById('disp-bubble-mix')

// Presets Buttons
const presetAlpineBtn = document.getElementById('preset-alpine')
const presetCoastalBtn = document.getElementById('preset-coastal')
const presetCavernBtn = document.getElementById('preset-cavern')

// Soundstage Canvas
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
      gain: parseFloat(windGainSlider?.value || 0.7),
      pan: parseFloat(windPanSlider?.value || 0.0),
      reverbSend: parseFloat(windReverbSlider?.value || 0.2)
    })
  }

  if (!chimeInstance) {
    chimeInstance = new ChimeSonifier()
    landscape.addObject('chimes', chimeInstance, {
      gain: parseFloat(chimeGainSlider?.value || 0.75),
      pan: parseFloat(chimePanSlider?.value || 0.35),
      reverbSend: parseFloat(chimeReverbSlider?.value || 0.45)
    })
  }

  if (!bubbleInstance) {
    bubbleInstance = new BubbleSonifier()
    landscape.addObject('bubbles', bubbleInstance, {
      gain: parseFloat(bubbleGainSlider?.value || 0.65),
      pan: parseFloat(bubblePanSlider?.value || -0.40),
      reverbSend: parseFloat(bubbleReverbSlider?.value || 0.30)
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
  emitPulse('chimes', '#818cf8')
  emitPulse('bubbles', '#10b981')
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

  // Space
  const decay = parseFloat(reverbDecaySlider?.value || 2.5)
  const wet = parseFloat(reverbWetSlider?.value || 0.28)
  const warmth = parseFloat(spaceWarmthSlider?.value || 0.65)
  landscape.setSpace({ decay, wet, warmth })

  // Master Vol
  const masterVol = parseFloat(masterVolSlider?.value || 0.8)
  landscape.setMasterVolume(masterVol)

  // Wind
  const speed = parseFloat(windSpeedSlider?.value || 35)
  const turbulence = parseFloat(windTurbulenceSlider?.value || 0.45)
  const cavity = parseFloat(windCavitySlider?.value || 0.3)
  const windPan = parseFloat(windPanSlider?.value || 0.0)
  const windGain = parseFloat(windGainSlider?.value || 0.7)
  const windRev = parseFloat(windReverbSlider?.value || 0.2)

  landscape.setParam('wind', 'speed', speed)
  landscape.setParam('wind', 'turbulence', turbulence)
  landscape.setParam('wind', 'cavity', cavity)
  landscape.setParam('wind', 'pan', windPan)
  landscape.setParam('wind', 'gain', windGain)
  landscape.setParam('wind', 'reverbSend', windRev)

  // Chimes
  const chimePitch = parseFloat(chimePitchSlider?.value || 587)
  const chimeDamping = parseFloat(chimeDampingSlider?.value || 0.25)
  const chimeMat = chimeMaterialSelect?.value || 'aluminum'
  const chimePan = parseFloat(chimePanSlider?.value || 0.35)
  const chimeGain = parseFloat(chimeGainSlider?.value || 0.75)
  const chimeRev = parseFloat(chimeReverbSlider?.value || 0.45)
  const chimeWindCoupled = chimeCoupledCheck ? chimeCoupledCheck.checked : true

  landscape.setParam('chimes', 'pitch', chimePitch)
  landscape.setParam('chimes', 'damping', chimeDamping)
  landscape.setParam('chimes', 'material', chimeMat)
  landscape.setParam('chimes', 'pan', chimePan)
  landscape.setParam('chimes', 'gain', chimeGain)
  landscape.setParam('chimes', 'reverbSend', chimeRev)
  landscape.setParam('chimes', 'windSpeed', chimeWindCoupled ? speed * 0.8 : 0)

  // Bubbles
  const bubbleRate = parseFloat(bubbleRateSlider?.value || 6)
  const bubbleRad = parseFloat(bubbleRadiusSlider?.value || 0.004)
  const bubbleDepth = parseFloat(bubbleDepthSlider?.value || 0.12)
  const bubbleVisc = parseFloat(bubbleViscositySlider?.value || 0.35)
  const bubblePan = parseFloat(bubblePanSlider?.value || -0.40)
  const bubbleGain = parseFloat(bubbleGainSlider?.value || 0.65)
  const bubbleRev = parseFloat(bubbleReverbSlider?.value || 0.30)

  landscape.setParam('bubbles', 'rate', bubbleRate)
  landscape.setParam('bubbles', 'radius', bubbleRad)
  landscape.setParam('bubbles', 'depth', bubbleDepth)
  landscape.setParam('bubbles', 'viscosity', bubbleVisc)
  landscape.setParam('bubbles', 'pan', bubblePan)
  landscape.setParam('bubbles', 'gain', bubbleGain)
  landscape.setParam('bubbles', 'reverbSend', bubbleRev)
}

// ---------------------------------------------------------------------------
// Event Listeners & Sliders
// ---------------------------------------------------------------------------

if (btnPlay) btnPlay.addEventListener('click', playLandscape)
if (btnStop) btnStop.addEventListener('click', stopLandscape)

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

// Wind Sliders
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

if (windPanSlider) {
  windPanSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (windPanDisp) windPanDisp.textContent = formatPan(v)
    landscape.setParam('wind', 'pan', v)
  })
}

function updateWindMix() {
  const g = parseFloat(windGainSlider?.value || 0.7)
  const r = parseFloat(windReverbSlider?.value || 0.2)
  if (windMixDisp) windMixDisp.textContent = `Vol ${Math.round(g * 100)}% • Rev ${Math.round(r * 100)}%`
  landscape.setParam('wind', 'gain', g)
  landscape.setParam('wind', 'reverbSend', r)
}
if (windGainSlider) windGainSlider.addEventListener('input', updateWindMix)
if (windReverbSlider) windReverbSlider.addEventListener('input', updateWindMix)

// Chime Controls
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

if (chimePanSlider) {
  chimePanSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (chimePanDisp) chimePanDisp.textContent = formatPan(v)
    landscape.setParam('chimes', 'pan', v)
  })
}

function updateChimeMix() {
  const g = parseFloat(chimeGainSlider?.value || 0.75)
  const r = parseFloat(chimeReverbSlider?.value || 0.45)
  if (chimeMixDisp) chimeMixDisp.textContent = `Vol ${Math.round(g * 100)}% • Rev ${Math.round(r * 100)}%`
  landscape.setParam('chimes', 'gain', g)
  landscape.setParam('chimes', 'reverbSend', r)
}
if (chimeGainSlider) chimeGainSlider.addEventListener('input', updateChimeMix)
if (chimeReverbSlider) chimeReverbSlider.addEventListener('input', updateChimeMix)

// Bubble Controls
if (bubbleRateSlider) {
  bubbleRateSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (bubbleRateDisp) bubbleRateDisp.textContent = `${v} drops/s`
    landscape.setParam('bubbles', 'rate', v)
    if (v > 0) emitPulse('bubbles', '#10b981')
  })
}

if (btnTriggerBubble) {
  btnTriggerBubble.addEventListener('click', async () => {
    if (!isPlaying) await playLandscape()
    landscape.trigger('bubbles', 'triggerBubble', { energy: 0.9 })
    emitPulse('bubbles', '#10b981', 50)
  })
}

if (bubbleRadiusSlider) {
  bubbleRadiusSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (bubbleRadiusDisp) bubbleRadiusDisp.textContent = `${(v * 1000).toFixed(1)} mm`
    landscape.setParam('bubbles', 'radius', v)
  })
}

if (bubbleDepthSlider) {
  bubbleDepthSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (bubbleDepthDisp) bubbleDepthDisp.textContent = `${v.toFixed(2)} m`
    landscape.setParam('bubbles', 'depth', v)
  })
}

if (bubbleViscositySlider) {
  bubbleViscositySlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (bubbleViscosityDisp) bubbleViscosityDisp.textContent = v.toFixed(2)
    landscape.setParam('bubbles', 'viscosity', v)
  })
}

if (bubblePanSlider) {
  bubblePanSlider.addEventListener('input', e => {
    const v = parseFloat(e.target.value)
    if (bubblePanDisp) bubblePanDisp.textContent = formatPan(v)
    landscape.setParam('bubbles', 'pan', v)
  })
}

function updateBubbleMix() {
  const g = parseFloat(bubbleGainSlider?.value || 0.65)
  const r = parseFloat(bubbleReverbSlider?.value || 0.30)
  if (bubbleMixDisp) bubbleMixDisp.textContent = `Vol ${Math.round(g * 100)}% • Rev ${Math.round(r * 100)}%`
  landscape.setParam('bubbles', 'gain', g)
  landscape.setParam('bubbles', 'reverbSend', r)
}
if (bubbleGainSlider) bubbleGainSlider.addEventListener('input', updateBubbleMix)
if (bubbleReverbSlider) bubbleReverbSlider.addEventListener('input', updateBubbleMix)

function formatPan(val) {
  if (Math.abs(val) < 0.04) return 'Center (0.0)'
  if (val < 0) return `Left (${val.toFixed(2)})`
  return `Right (+${val.toFixed(2)})`
}

// ---------------------------------------------------------------------------
// Atmospheric Presets
// ---------------------------------------------------------------------------

function clearActivePresetButtons() {
  presetAlpineBtn?.classList.remove('active')
  presetCoastalBtn?.classList.remove('active')
  presetCavernBtn?.classList.remove('active')
}

export function applyPreset(name) {
  clearActivePresetButtons()

  if (name === 'alpine') {
    presetAlpineBtn?.classList.add('active')
    setSlider(reverbDecaySlider, 3.8, reverbDecayDisp, '3.8s')
    setSlider(reverbWetSlider, 0.35, reverbWetDisp, '35%')
    setSlider(spaceWarmthSlider, 0.75, spaceWarmthDisp, '75%')

    setSlider(windSpeedSlider, 48, windSpeedDisp, '48 km/h')
    setSlider(windTurbulenceSlider, 0.65, windTurbulenceDisp, '0.65')
    setSlider(windCavitySlider, 0.40, windCavityDisp, '0.40')
    setSlider(windPanSlider, 0.0, windPanDisp, 'Center (0.0)')

    if (chimeMaterialSelect) chimeMaterialSelect.value = 'aluminum'
    setSlider(chimePitchSlider, 659, chimePitchDisp, '659 Hz')
    setSlider(chimeDampingSlider, 0.20, chimeDampingDisp, '0.20')
    setSlider(chimePanSlider, 0.45, chimePanDisp, 'Right (+0.45)')
    if (chimeCoupledCheck) chimeCoupledCheck.checked = true

    setSlider(bubbleRateSlider, 0.0, bubbleRateDisp, '0 drops/s')
    setSlider(bubbleRadiusSlider, 0.003, bubbleRadiusDisp, '3.0 mm')
    setSlider(bubblePanSlider, -0.45, bubblePanDisp, 'Left (-0.45)')
  } else if (name === 'coastal') {
    presetCoastalBtn?.classList.add('active')
    setSlider(reverbDecaySlider, 2.4, reverbDecayDisp, '2.4s')
    setSlider(reverbWetSlider, 0.25, reverbWetDisp, '25%')
    setSlider(spaceWarmthSlider, 0.50, spaceWarmthDisp, '50%')

    setSlider(windSpeedSlider, 22, windSpeedDisp, '22 km/h')
    setSlider(windTurbulenceSlider, 0.30, windTurbulenceDisp, '0.30')
    setSlider(windCavitySlider, 0.15, windCavityDisp, '0.15')
    setSlider(windPanSlider, 0.0, windPanDisp, 'Center (0.0)')

    if (chimeMaterialSelect) chimeMaterialSelect.value = 'bronze'
    setSlider(chimePitchSlider, 587, chimePitchDisp, '587 Hz')
    setSlider(chimeDampingSlider, 0.35, chimeDampingDisp, '0.35')
    setSlider(chimePanSlider, 0.30, chimePanDisp, 'Right (+0.30)')
    if (chimeCoupledCheck) chimeCoupledCheck.checked = true

    setSlider(bubbleRateSlider, 9.0, bubbleRateDisp, '9 drops/s')
    setSlider(bubbleRadiusSlider, 0.005, bubbleRadiusDisp, '5.0 mm')
    setSlider(bubbleDepthSlider, 0.18, bubbleDepthDisp, '0.18 m')
    setSlider(bubblePanSlider, -0.40, bubblePanDisp, 'Left (-0.40)')
  } else if (name === 'cavern') {
    presetCavernBtn?.classList.add('active')
    setSlider(reverbDecaySlider, 5.5, reverbDecayDisp, '5.5s')
    setSlider(reverbWetSlider, 0.48, reverbWetDisp, '48%')
    setSlider(spaceWarmthSlider, 0.85, spaceWarmthDisp, '85%')

    setSlider(windSpeedSlider, 12, windSpeedDisp, '12 km/h')
    setSlider(windTurbulenceSlider, 0.20, windTurbulenceDisp, '0.20')
    setSlider(windCavitySlider, 0.85, windCavityDisp, '0.85')
    setSlider(windPanSlider, 0.0, windPanDisp, 'Center (0.0)')

    if (chimeMaterialSelect) chimeMaterialSelect.value = 'steel'
    setSlider(chimePitchSlider, 440, chimePitchDisp, '440 Hz')
    setSlider(chimeDampingSlider, 0.15, chimeDampingDisp, '0.15')
    setSlider(chimePanSlider, 0.55, chimePanDisp, 'Right (+0.55)')
    if (chimeCoupledCheck) chimeCoupledCheck.checked = false

    setSlider(bubbleRateSlider, 14.0, bubbleRateDisp, '14 drops/s')
    setSlider(bubbleRadiusSlider, 0.008, bubbleRadiusDisp, '8.0 mm')
    setSlider(bubbleDepthSlider, 0.45, bubbleDepthDisp, '0.45 m')
    setSlider(bubbleViscositySlider, 0.55, bubbleViscosityDisp, '0.55')
    setSlider(bubblePanSlider, -0.50, bubblePanDisp, 'Left (-0.50)')
  }

  updateWindMix()
  updateChimeMix()
  updateBubbleMix()
  syncAllParams()
}

function setSlider(el, val, dispEl, dispText) {
  if (!el) return
  el.value = val
  if (dispEl && dispText) dispEl.textContent = dispText
}

if (presetAlpineBtn) presetAlpineBtn.addEventListener('click', () => applyPreset('alpine'))
if (presetCoastalBtn) presetCoastalBtn.addEventListener('click', () => applyPreset('coastal'))
if (presetCavernBtn) presetCavernBtn.addEventListener('click', () => applyPreset('cavern'))

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
    return { x: centerX + pan * (w * 0.4), y: h * 0.32, label: '🌬️ Wind' }
  }
  if (id === 'chimes') {
    const pan = parseFloat(chimePanSlider?.value || 0.35)
    return { x: centerX + pan * (w * 0.4), y: h * 0.45, label: '🎐 Chimes' }
  }
  if (id === 'bubbles') {
    const pan = parseFloat(bubblePanSlider?.value || -0.40)
    return { x: centerX + pan * (w * 0.4), y: h * 0.48, label: '🫧 Bubbles' }
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

  // Draw the 3 Sound Objects
  const objects = [
    { id: 'wind', color: '#38bdf8' },
    { id: 'chimes', color: '#818cf8' },
    { id: 'bubbles', color: '#10b981' }
  ]

  for (const obj of objects) {
    const pos = getObjectCoordinates(obj.id, w, h)

    // Glowing dot
    ctx2d.shadowColor = obj.color
    ctx2d.shadowBlur = isPlaying ? 10 * dpr : 2 * dpr
    ctx2d.fillStyle = obj.color
    ctx2d.beginPath()
    ctx2d.arc(pos.x, pos.y, 7 * dpr, 0, 2 * Math.PI)
    ctx2d.fill()
    ctx2d.shadowBlur = 0

    // Label
    ctx2d.fillStyle = '#f8fafc'
    ctx2d.font = `600 ${11 * dpr}px sans-serif`
    ctx2d.textAlign = 'center'
    ctx2d.fillText(pos.label, pos.x, pos.y - 12 * dpr)
  }

  // Continuous gentle bubbling / wind micro-pulses when active
  if (isPlaying && Math.random() < 0.05) {
    const bubbleRate = parseFloat(bubbleRateSlider?.value || 0)
    if (bubbleRate > 0) emitPulse('bubbles', '#10b981', 30)
  }
  if (isPlaying && Math.random() < 0.03) {
    emitPulse('wind', '#38bdf8', 35)
  }

  animFrameId = requestAnimationFrame(renderSoundstage)
}

if (canvas) {
  animFrameId = requestAnimationFrame(renderSoundstage)
}
