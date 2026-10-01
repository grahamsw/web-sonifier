// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Landscapes Studio UI & Integration', () => {
  let htmlContent

  beforeEach(() => {
    vi.clearAllMocks()
    const indexPath = path.resolve(__dirname, '../landscapes/index.html')
    htmlContent = fs.readFileSync(indexPath, 'utf-8')
    document.body.innerHTML = htmlContent
  })

  it('renders global navigation with active landscapes link and clean paths', () => {
    const navLinks = document.querySelectorAll('.site-nav-link')
    expect(navLinks.length).toBeGreaterThanOrEqual(4)

    const activeLink = document.querySelector('.site-nav-link.active')
    expect(activeLink).not.toBeNull()
    expect(activeLink.getAttribute('href')).toBe('/demo/landscapes/')
    expect(activeLink.textContent).toContain('Landscapes')
  })

  it('contains master transport bar and space parameters', () => {
    const btnPlay = document.getElementById('btn-play')
    const btnStop = document.getElementById('btn-stop')
    const status = document.getElementById('landscape-status')

    expect(btnPlay).not.toBeNull()
    expect(btnStop).not.toBeNull()
    expect(btnStop.disabled).toBe(true)
    expect(status.textContent).toBe('Stopped')

    // Space controls
    expect(document.getElementById('reverb-decay')).not.toBeNull()
    expect(document.getElementById('reverb-wet')).not.toBeNull()
    expect(document.getElementById('space-warmth')).not.toBeNull()
    expect(document.getElementById('master-volume')).not.toBeNull()
  })

  it('contains soundstage canvas radar', () => {
    const canvas = document.getElementById('soundstage-canvas')
    expect(canvas).not.toBeNull()
  })

  it('contains all 4 natural sound components with dedicated volume sliders and exciters', () => {
    // 1. Wind
    expect(document.getElementById('card-wind')).not.toBeNull()
    expect(document.getElementById('wind-volume')).not.toBeNull()
    expect(document.getElementById('wind-speed')).not.toBeNull()
    expect(document.getElementById('wind-turbulence')).not.toBeNull()
    expect(document.getElementById('wind-pan')).not.toBeNull()
    expect(document.getElementById('wind-spread')).not.toBeNull()

    // 2. Rain
    expect(document.getElementById('card-rain')).not.toBeNull()
    expect(document.getElementById('rain-volume')).not.toBeNull()
    expect(document.getElementById('rain-intensity')).not.toBeNull()
    expect(document.getElementById('rain-surface')).not.toBeNull()
    expect(document.getElementById('rain-pitch')).not.toBeNull()
    expect(document.getElementById('rain-pan')).not.toBeNull()
    expect(document.getElementById('rain-spread')).not.toBeNull()

    // 3. Ocean
    expect(document.getElementById('card-ocean')).not.toBeNull()
    expect(document.getElementById('ocean-volume')).not.toBeNull()
    expect(document.getElementById('ocean-intensity')).not.toBeNull()
    expect(document.getElementById('ocean-period')).not.toBeNull()
    expect(document.getElementById('ocean-foam')).not.toBeNull()
    expect(document.getElementById('ocean-pan')).not.toBeNull()
    expect(document.getElementById('ocean-spread')).not.toBeNull()

    // 4. Chimes
    expect(document.getElementById('card-chime')).not.toBeNull()
    expect(document.getElementById('chime-volume')).not.toBeNull()
    expect(document.getElementById('chime-wind-coupled')).not.toBeNull()
    expect(document.getElementById('btn-strike-chime')).not.toBeNull()
    expect(document.getElementById('chime-pitch')).not.toBeNull()
    expect(document.getElementById('chime-pan')).not.toBeNull()
    expect(document.getElementById('chime-spread')).not.toBeNull()
  })

  it('defines the 4 natural atmospheric presets', () => {
    expect(document.getElementById('preset-rain')).not.toBeNull()
    expect(document.getElementById('preset-pacific')).not.toBeNull()
    expect(document.getElementById('preset-storm')).not.toBeNull()
    expect(document.getElementById('preset-alpine')).not.toBeNull()
  })

  it('has valid importmap in index.html for browser es modules', () => {
    const importmapEl = document.querySelector('script[type="importmap"]')
    expect(importmapEl).not.toBeNull()
    const parsed = JSON.parse(importmapEl.textContent)
    expect(parsed.imports['@web-sonifier/core']).toBe('/packages/core/src/index.js')
    expect(parsed.imports['@web-sonifier/wind']).toBe('/packages/wind/src/index.js')
    expect(parsed.imports['@web-sonifier/rain']).toBe('/packages/rain/src/index.js')
    expect(parsed.imports['@web-sonifier/ocean']).toBe('/packages/ocean/src/index.js')
    expect(parsed.imports['@web-sonifier/chime']).toBe('/packages/chime/src/index.js')
  })

  it('contains scene tools toolbar buttons for export, load, and player toggle', () => {
    const btnExport = document.getElementById('btn-export-scene')
    const btnLoad = document.getElementById('btn-load-scene')
    const btnToggle = document.getElementById('btn-toggle-mode')

    expect(btnExport).not.toBeNull()
    expect(btnLoad).not.toBeNull()
    expect(btnToggle).not.toBeNull()
    expect(btnToggle.textContent).toContain('Mode: Studio')
  })

  it('contains player mode card with minimal distraction-free controls', () => {
    const playerView = document.getElementById('player-view')
    const btnPlayerPlay = document.getElementById('btn-player-play')
    const btnPlayerStop = document.getElementById('btn-player-stop')
    const playerVolume = document.getElementById('player-volume')
    const playerTitle = document.getElementById('player-scene-title')

    expect(playerView).not.toBeNull()
    expect(playerView.style.display).toBe('none')
    expect(btnPlayerPlay).not.toBeNull()
    expect(btnPlayerStop).not.toBeNull()
    expect(btnPlayerStop.disabled).toBe(true)
    expect(playerVolume).not.toBeNull()
    expect(playerTitle).not.toBeNull()
  })

  it('contains scene document JSON modal and action controls', () => {
    const modal = document.getElementById('scene-modal')
    const textarea = document.getElementById('scene-json-textarea')
    const btnClose = document.getElementById('btn-close-modal')
    const btnCopy = document.getElementById('btn-modal-copy')
    const btnApply = document.getElementById('btn-modal-apply')

    expect(modal).not.toBeNull()
    expect(modal.style.display).toBe('none')
    expect(textarea).not.toBeNull()
    expect(btnClose).not.toBeNull()
    expect(btnCopy).not.toBeNull()
    expect(btnApply).not.toBeNull()
  })

  it('contains live data feed simulator bar with telemetry sliders and streaming toggle', () => {
    const simBar = document.getElementById('feed-simulator-bar')
    expect(simBar).not.toBeNull()

    const trafficSlider = document.getElementById('sim-feed-traffic')
    const usersSlider = document.getElementById('sim-feed-users')
    const cpuSlider = document.getElementById('sim-feed-cpu')
    const btnSpike = document.getElementById('btn-trigger-spike')
    const btnStream = document.getElementById('btn-stream-toggle')

    expect(trafficSlider).not.toBeNull()
    expect(usersSlider).not.toBeNull()
    expect(cpuSlider).not.toBeNull()
    expect(btnSpike).not.toBeNull()
    expect(btnStream).not.toBeNull()
    expect(btnStream.textContent).toContain('Stream')
  })

  it('contains distinct export modal with document tabs, copy, and download buttons', () => {
    const modal = document.getElementById('modal-export')
    expect(modal).not.toBeNull()
    expect(modal.style.display).toBe('none')

    const tabs = document.querySelectorAll('.spec-tab')
    expect(tabs.length).toBe(4)
    const tabTypes = Array.from(tabs).map(t => t.getAttribute('data-export-type'))
    expect(tabTypes).toEqual(['bundle', 'landscape', 'feeds', 'mappings'])

    const textarea = document.getElementById('export-json-textarea')
    expect(textarea).not.toBeNull()
    expect(textarea.readOnly).toBe(true)

    const btnCopy = document.getElementById('btn-export-copy')
    const btnDownload = document.getElementById('btn-export-download')
    const btnClose = document.getElementById('btn-close-export')
    expect(btnCopy).not.toBeNull()
    expect(btnDownload).not.toBeNull()
    expect(btnClose).not.toBeNull()
  })

  it('contains distinct load modal with drag-and-drop zone, file input, and apply button', () => {
    const modal = document.getElementById('modal-load')
    expect(modal).not.toBeNull()
    expect(modal.style.display).toBe('none')

    const dropZone = document.getElementById('load-drop-zone')
    const fileInput = document.getElementById('load-file-input')
    const btnBrowse = document.getElementById('btn-browse-file')
    const statusBadge = document.getElementById('load-file-status')
    const textarea = document.getElementById('load-json-textarea')
    const btnApply = document.getElementById('btn-load-apply')
    const btnClose = document.getElementById('btn-close-load')

    expect(dropZone).not.toBeNull()
    expect(fileInput).not.toBeNull()
    expect(btnBrowse).not.toBeNull()
    expect(statusBadge).not.toBeNull()
    expect(textarea).not.toBeNull()
    expect(btnApply).not.toBeNull()
    expect(btnClose).not.toBeNull()
  })

  it('verifies sample web-traffic.feed.json and coastal/storm-traffic.mappings.json files on disk', () => {
    const feedFile = path.resolve(__dirname, '../landscapes/feeds/web-traffic.feed.json')
    const coastalMappingFile = path.resolve(__dirname, '../landscapes/mappings/coastal-traffic.mappings.json')
    const stormMappingFile = path.resolve(__dirname, '../landscapes/mappings/storm-traffic.mappings.json')

    expect(fs.existsSync(feedFile)).toBe(true)
    expect(fs.existsSync(coastalMappingFile)).toBe(true)
    expect(fs.existsSync(stormMappingFile)).toBe(true)

    const feedDoc = JSON.parse(fs.readFileSync(feedFile, 'utf-8'))
    expect(feedDoc.version).toBe(1)
    expect(feedDoc.feeds.traffic_rps).toBeDefined()
    expect(feedDoc.feeds.active_users).toBeDefined()
    expect(feedDoc.feeds.error_spikes).toBeDefined()
    expect(feedDoc.feeds.error_spikes.type).toBe('event')

    const coastalDoc = JSON.parse(fs.readFileSync(coastalMappingFile, 'utf-8'))
    expect(coastalDoc.version).toBe(1)
    expect(Array.isArray(coastalDoc.mappings)).toBe(true)
    expect(coastalDoc.mappings.length).toBeGreaterThanOrEqual(3)

    const stormDoc = JSON.parse(fs.readFileSync(stormMappingFile, 'utf-8'))
    expect(stormDoc.version).toBe(1)
    expect(Array.isArray(stormDoc.mappings)).toBe(true)
    expect(stormDoc.mappings.length).toBeGreaterThanOrEqual(3)
  })

  it('verifies all 4 scene JSON preset files on disk conform to SceneDescriptor schema v1', () => {
    const scenesDir = path.resolve(__dirname, '../landscapes/scenes')
    const sceneFiles = [
      'rain-on-tin-roof.json',
      'pacific-coast.json',
      'mountain-storm.json',
      'alpine-meadow.json'
    ]

    for (const filename of sceneFiles) {
      const fullPath = path.join(scenesDir, filename)
      expect(fs.existsSync(fullPath)).toBe(true)

      const content = fs.readFileSync(fullPath, 'utf-8')
      const scene = JSON.parse(content)

      expect(scene.version).toBe(1)
      expect(typeof scene.name).toBe('string')
      expect(scene.space).toBeDefined()
      expect(typeof scene.space.decay).toBe('number')
      expect(typeof scene.space.wet).toBe('number')
      expect(typeof scene.space.warmth).toBe('number')
      expect(typeof scene.masterVolume).toBe('number')

      expect(scene.layers).toBeDefined()
      expect(scene.layers.bed).toBeDefined()
      expect(scene.layers.texture).toBeDefined()
      expect(scene.layers.figure).toBeDefined()

      expect(scene.objects).toBeDefined()
      expect(Object.keys(scene.objects).length).toBe(4)
      for (const [id, obj] of Object.entries(scene.objects)) {
        expect(obj.type).toBeDefined()
        expect(obj.layer).toBeDefined()
        expect(typeof obj.gain).toBe('number')
        expect(typeof obj.pan).toBe('number')
        expect(typeof obj.spread).toBe('number')
      }

      expect(Array.isArray(scene.couplings)).toBe(true)
    }
  })

  it('syncs sliders from scene descriptor without reference error on chimes parameters', async () => {
    const { syncSlidersFromScene } = await import('../landscapes/main.js')
    const scene = {
      version: 1,
      name: 'Custom Applied Scene',
      masterVolume: 0.7,
      space: { decay: 3.0, wet: 0.25, warmth: 0.6 },
      objects: {
        chimes: {
          type: 'chime',
          layer: 'figure',
          gain: 0.8,
          pan: 0.3,
          spread: 0.1,
          params: { pitch: 659, damping: 0.2, material: 'bronze' }
        }
      }
    }

    expect(() => syncSlidersFromScene(scene)).not.toThrow()
    const chimePitchInput = document.getElementById('chime-pitch')
    const chimePitchDisp = document.getElementById('disp-chime-pitch')
    expect(chimePitchInput.value).toBe('659')
    expect(chimePitchDisp.textContent).toBe('659 Hz')
    expect(document.getElementById('player-scene-title').textContent).toBe('Custom Applied Scene')
  })

  it('renders 3 layer swimlanes (Bed, Texture, Figure) with appropriate cards', () => {
    const swimlaneBed = document.getElementById('swimlane-bed')
    const swimlaneTexture = document.getElementById('swimlane-texture')
    const swimlaneFigure = document.getElementById('swimlane-figure')

    expect(swimlaneBed).not.toBeNull()
    expect(swimlaneTexture).not.toBeNull()
    expect(swimlaneFigure).not.toBeNull()

    const cardsBed = document.getElementById('cards-bed')
    const cardsTexture = document.getElementById('cards-texture')
    const cardsFigure = document.getElementById('cards-figure')

    expect(cardsBed.querySelector('#card-wind')).not.toBeNull()
    expect(cardsBed.querySelector('#card-ocean')).not.toBeNull()
    expect(cardsTexture.querySelector('#card-rain')).not.toBeNull()
    expect(cardsFigure.querySelector('#card-chime')).not.toBeNull()
  })

  it('contains sonifier catalog modal with all 12 monorepo plugins', () => {
    const modal = document.getElementById('modal-add-sonifier')
    expect(modal).not.toBeNull()
    expect(modal.style.display).toBe('none')

    const catalogCards = document.querySelectorAll('.catalog-card')
    expect(catalogCards.length).toBe(12)

    const catalogTypes = Array.from(catalogCards).map(c => c.dataset.sonifierType)
    expect(catalogTypes).toContain('wind')
    expect(catalogTypes).toContain('rain')
    expect(catalogTypes).toContain('ocean')
    expect(catalogTypes).toContain('chime')
    expect(catalogTypes).toContain('bubble')
    expect(catalogTypes).toContain('eno-bed')
    expect(catalogTypes).toContain('eno-texture')
    expect(catalogTypes).toContain('eno-figure')
    expect(catalogTypes).toContain('mallet')
    expect(catalogTypes).toContain('purr')
    expect(catalogTypes).toContain('vosc')
    expect(catalogTypes).toContain('engine')
  })

  it('contains mapping inspector modal with continuous tuning and temporal scatter controls', () => {
    const modal = document.getElementById('modal-mapping-inspector')
    expect(modal).not.toBeNull()
    expect(modal.style.display).toBe('none')

    expect(document.getElementById('mapping-target-object')).not.toBeNull()
    expect(document.getElementById('mapping-target-param')).not.toBeNull()
    expect(document.getElementById('mapping-feed-select')).not.toBeNull()
    expect(document.getElementById('mapping-curve-select')).not.toBeNull()
    expect(document.getElementById('mapping-in-min')).not.toBeNull()
    expect(document.getElementById('mapping-in-max')).not.toBeNull()
    expect(document.getElementById('mapping-out-min')).not.toBeNull()
    expect(document.getElementById('mapping-out-max')).not.toBeNull()

    // Tuning controls
    expect(document.getElementById('mapping-tuning-enable')).not.toBeNull()
    expect(document.getElementById('mapping-tuning-scale')).not.toBeNull()
    expect(document.getElementById('mapping-tuning-root')).not.toBeNull()

    // Scatter controls
    expect(document.getElementById('mapping-scatter-enable')).not.toBeNull()
    expect(document.getElementById('mapping-scatter-strategy')).not.toBeNull()
    expect(document.getElementById('mapping-scatter-window')).not.toBeNull()

    // Action buttons
    expect(document.getElementById('btn-mapping-save')).not.toBeNull()
    expect(document.getElementById('btn-mapping-remove')).not.toBeNull()
  })

  it('moves cards dynamically between swimlanes via handleLayerChange', async () => {
    const { handleLayerChange } = await import('../landscapes/main.js')

    const windCard = document.getElementById('card-wind')
    const cardsBed = document.getElementById('cards-bed')
    const cardsFigure = document.getElementById('cards-figure')

    expect(cardsBed.contains(windCard)).toBe(true)

    handleLayerChange('wind', 'figure')
    expect(cardsFigure.contains(windCard)).toBe(true)
    expect(cardsBed.contains(windCard)).toBe(false)

    // Move it back
    handleLayerChange('wind', 'bed')
    expect(cardsBed.contains(windCard)).toBe(true)
  })

  it('dynamically adds and removes sonifiers via catalog helpers', async () => {
    const { addSonifierFromCatalog, handleObjectRemove } = await import('../landscapes/main.js')

    const cardsTexture = document.getElementById('cards-texture')
    const added = await addSonifierFromCatalog('bubble', 'test-bubble-42', 'texture')
    expect(added).toBe(true)

    const newCard = document.getElementById('card-test-bubble-42')
    expect(newCard).not.toBeNull()
    expect(cardsTexture.contains(newCard)).toBe(true)

    // Remove it
    handleObjectRemove('test-bubble-42')
    expect(document.getElementById('card-test-bubble-42')).toBeNull()
  })

  it('updates player layer pills based on current scene objects', async () => {
    const { updatePlayerLayerPills } = await import('../landscapes/main.js')

    updatePlayerLayerPills()
    const pills = document.getElementById('player-layer-pills')
    expect(pills).not.toBeNull()
    expect(pills.textContent).toContain('Bed')
    expect(pills.textContent).toContain('Texture')
    expect(pills.textContent).toContain('Figure')
  })

  it('renders prominent removal UI affordances (header ✕ and toolbar 🗑️ Remove) on cards', async () => {
    const { createSonifierCard } = await import('../landscapes/main.js')

    const cardIds = ['card-wind', 'card-ocean', 'card-rain', 'card-chime']
    for (const cid of cardIds) {
      const card = document.getElementById(cid)
      expect(card).not.toBeNull()

      const headerBtn = card.querySelector('.btn-remove-header')
      expect(headerBtn).not.toBeNull()
      expect(headerBtn.textContent).toContain('✕')

      const toolbarBtn = card.querySelector('.card-actions-wrap .btn-remove-object')
      expect(toolbarBtn).not.toBeNull()
      expect(toolbarBtn.textContent).toContain('Remove')
    }

    // Dynamic card
    const dynamicCard = createSonifierCard('dyn-1', 'bubble', 'texture')
    const dynHeaderBtn = dynamicCard.querySelector('.btn-remove-header')
    expect(dynHeaderBtn).not.toBeNull()
    const dynToolbarBtn = dynamicCard.querySelector('.card-actions-wrap .btn-remove-object')
    expect(dynToolbarBtn).not.toBeNull()
    expect(dynToolbarBtn.textContent).toContain('Remove')
  })

  it('removes default sonifiers and reflects removals in getCurrentSceneDescriptor', async () => {
    const { handleObjectRemove, getCurrentSceneDescriptor, addSonifierFromCatalog } = await import('../landscapes/main.js')

    // Initial descriptor has all 4 default objects
    const initDesc = getCurrentSceneDescriptor()
    expect(initDesc.objects.wind).toBeDefined()
    expect(initDesc.objects.chimes).toBeDefined()
    expect(initDesc.objects.rain).toBeDefined()
    expect(initDesc.objects.ocean).toBeDefined()

    // Remove chimes
    handleObjectRemove('chimes')
    expect(document.getElementById('card-chime')).toBeNull()

    const descAfterChimes = getCurrentSceneDescriptor()
    expect(descAfterChimes.objects.chimes).toBeUndefined()
    expect(descAfterChimes.objects.wind).toBeDefined()

    // Remove wind
    handleObjectRemove('wind')
    expect(document.getElementById('card-wind')).toBeNull()

    const descAfterWind = getCurrentSceneDescriptor()
    expect(descAfterWind.objects.wind).toBeUndefined()
    expect(descAfterWind.objects.chimes).toBeUndefined()
    expect(descAfterWind.objects.rain).toBeDefined()
    expect(descAfterWind.objects.ocean).toBeDefined()

    // Add dynamic sonifier from catalog and verify it appears in descriptor
    await addSonifierFromCatalog('bubble', 'stream-bubbles', 'texture')
    const descWithDynamic = getCurrentSceneDescriptor()
    expect(descWithDynamic.objects['stream-bubbles']).toBeDefined()
    expect(descWithDynamic.objects['stream-bubbles'].type).toBe('bubble')
    expect(descWithDynamic.objects['stream-bubbles'].layer).toBe('texture')
  })

  it('renders all schema parameters in mapping inspector with feed toggles, manual sliders, and decorators', async () => {
    const { openMappingInspector, renderSonifierParameterEditor, landscape } = await import('../landscapes/main.js')

    if (!landscape._mappings.some(m => m.target?.objectId === 'wind' && m.target?.param === 'speed')) {
      landscape.addMapping({
        feedId: 'traffic_rps',
        target: { objectId: 'wind', param: 'speed' },
        adapter: { inputRange: [0, 5000], outputRange: [15, 75], curve: 'exponential' }
      })
    }

    openMappingInspector('wind', 'speed')

    const container = document.getElementById('mapping-params-container')
    expect(container).not.toBeNull()

    // Wind has speed, turbulence, cavity, volume in its schema
    const speedCard = container.querySelector('#inspector-param-card-speed')
    const turbCard = container.querySelector('#inspector-param-card-turbulence')
    const cavityCard = container.querySelector('#inspector-param-card-cavity')
    expect(speedCard).not.toBeNull()
    expect(turbCard).not.toBeNull()
    expect(cavityCard).not.toBeNull()

    // Speed was mapped initially in default landscape mappings
    const speedToggle = speedCard.querySelector('#map-toggle-speed')
    expect(speedToggle).not.toBeNull()
    expect(speedToggle.checked).toBe(true)
    expect(speedCard.classList.contains('sonified')).toBe(true)

    // Verify decorator controls on mapped parameter
    const speedTuningCheck = speedCard.querySelector('#check-tuning-speed')
    expect(speedTuningCheck).not.toBeNull()
    const speedScatterCheck = speedCard.querySelector('#check-scatter-speed')
    expect(speedScatterCheck).not.toBeNull()

    // Verify dual range slider on mapped speed parameter
    const dualSlider = speedCard.querySelector('#dual-slider-speed')
    expect(dualSlider).not.toBeNull()
    const minThumb = speedCard.querySelector('#range-slider-min-speed')
    const maxThumb = speedCard.querySelector('#range-slider-max-speed')
    expect(minThumb).not.toBeNull()
    expect(maxThumb).not.toBeNull()
    const outBadge = speedCard.querySelector('#output-range-badge-speed')
    expect(outBadge.textContent).toContain('15')
    expect(outBadge.textContent).toContain('75')

    // Adjust dual range slider thumbs
    maxThumb.value = '80'
    maxThumb.dispatchEvent(new Event('input'))
    minThumb.value = '20'
    minThumb.dispatchEvent(new Event('input'))
    expect(outBadge.textContent).toContain('20')
    expect(outBadge.textContent).toContain('80')

    const windMapping = landscape._mappings.find(m => m.target?.objectId === 'wind' && m.target?.param === 'speed')
    expect(windMapping.adapterConfig.outputRange).toEqual([20, 80])

    // Verify Invert Polarity button toggles range badge
    const btnInvert = speedCard.querySelector('#btn-invert-speed')
    btnInvert.click()
    expect(outBadge.textContent).toContain('80 ➔ 20')
    const windMappingInverted = landscape._mappings.find(m => m.target?.objectId === 'wind' && m.target?.param === 'speed')
    expect(windMappingInverted.adapterConfig.invert).toBe(true)

    // Verify Input Range Modes: Feed Extents, Adaptive, Custom
    const btnModeAdaptive = speedCard.querySelector('#btn-mode-adaptive-speed')
    const btnModeCustom = speedCard.querySelector('#btn-mode-custom-speed')
    const btnModeAuto = speedCard.querySelector('#btn-mode-auto-speed')
    const inBadge = speedCard.querySelector('#input-range-badge-speed')
    const customInContainer = speedCard.querySelector('#input-slider-container-speed')

    expect(btnModeAuto.classList.contains('active')).toBe(true)
    expect(inBadge.textContent).toContain('Feed Extents')
    expect(customInContainer.style.display).toBe('none')

    // Switch to Adaptive mode
    btnModeAdaptive.click()
    expect(btnModeAdaptive.classList.contains('active')).toBe(true)
    expect(inBadge.textContent).toContain('Auto-Range')
    const windMappingAdaptive = landscape._mappings.find(m => m.target?.objectId === 'wind' && m.target?.param === 'speed')
    expect(windMappingAdaptive.adapterConfig.autoRange).toBeDefined()

    // Switch to Custom Range mode
    btnModeCustom.click()
    expect(btnModeCustom.classList.contains('active')).toBe(true)
    expect(customInContainer.style.display).toBe('block')
    const inDualSlider = customInContainer.querySelector('#dual-slider-input-speed')
    expect(inDualSlider).not.toBeNull()
    const inMinThumb = customInContainer.querySelector('#range-slider-min-input-speed')
    const inMaxThumb = customInContainer.querySelector('#range-slider-max-input-speed')
    expect(inMinThumb).not.toBeNull()
    expect(inMaxThumb).not.toBeNull()

    inMinThumb.value = '500'
    inMinThumb.dispatchEvent(new Event('input'))
    const windMappingCustom = landscape._mappings.find(m => m.target?.objectId === 'wind' && m.target?.param === 'speed')
    expect(windMappingCustom.adapterConfig.inputRange[0]).toBe(500)
    expect(inBadge.textContent).toContain('Custom')

    // Turbulence is unmapped: verify manual slider is available
    const turbToggle = turbCard.querySelector('#map-toggle-turbulence')
    expect(turbToggle).not.toBeNull()
    expect(turbToggle.checked).toBe(false)
    const turbSlider = turbCard.querySelector('#slider-manual-turbulence')
    expect(turbSlider).not.toBeNull()

    // Adjusting manual slider
    turbSlider.value = '0.85'
    turbSlider.dispatchEvent(new Event('input'))
    const readout = turbCard.querySelector('#readout-turbulence')
    expect(readout.textContent).toContain('0.85')

    // Test with Chimes (has discrete material and continuous pitch)
    openMappingInspector('chimes', 'pitch')
    const matCard = container.querySelector('#inspector-param-card-material')
    expect(matCard).not.toBeNull()
    expect(matCard.classList.contains('discrete-param-card')).toBe(true)
    const matSelect = matCard.querySelector('#select-inspector-material')
    expect(matSelect).not.toBeNull()
  })

  it('returns empty array in getActiveSoundObjects when all sonifiers are removed and does not resurrect default objects', async () => {
    const { handleObjectRemove, getActiveSoundObjects } = await import('../landscapes/main.js')

    // Remove all 4 initial cards
    handleObjectRemove('wind')
    handleObjectRemove('rain')
    handleObjectRemove('ocean')
    handleObjectRemove('chimes')

    const active = getActiveSoundObjects()
    expect(active).toEqual([])
    expect(document.querySelectorAll('.object-card').length).toBe(0)
  })

  it('renders two-tab navigation on all sonifier cards and allows tab switching between Spatial and Parameters', async () => {
    const { setupCardTabs } = await import('../landscapes/main.js')
    setupCardTabs(document)

    const windCard = document.getElementById('card-wind')
    expect(windCard).not.toBeNull()

    const tabBtns = windCard.querySelectorAll('.card-tab-btn')
    expect(tabBtns.length).toBe(2)
    const [btnSpatial, btnParams] = tabBtns

    const spatialPane = windCard.querySelector('.tab-spatial-pane')
    const paramsPane = windCard.querySelector('.tab-params-pane')
    expect(spatialPane).not.toBeNull()
    expect(paramsPane).not.toBeNull()

    // Initially spatial is active
    expect(spatialPane.classList.contains('active')).toBe(true)
    expect(paramsPane.classList.contains('active')).toBe(false)
    expect(btnSpatial.classList.contains('active')).toBe(true)

    // Switch to parameters tab
    btnParams.click()
    expect(paramsPane.classList.contains('active')).toBe(true)
    expect(spatialPane.classList.contains('active')).toBe(false)
    expect(btnParams.classList.contains('active')).toBe(true)

    // Switch back to spatial tab
    btnSpatial.click()
    expect(spatialPane.classList.contains('active')).toBe(true)
    expect(paramsPane.classList.contains('active')).toBe(false)
    expect(btnSpatial.classList.contains('active')).toBe(true)
  })

  it('provides distance / depth sliders with acoustic physics readouts (meters, dB attenuation, reverb send)', async () => {
    const { formatDistance, initDistanceSliders, landscape } = await import('../landscapes/main.js')
    initDistanceSliders(document)

    const windDist = document.getElementById('wind-distance')
    const windDistDisp = document.getElementById('disp-wind-distance')
    expect(windDist).not.toBeNull()
    expect(windDistDisp).not.toBeNull()

    // Test formatDistance
    const formatted = formatDistance(12)
    expect(formatted).toContain('12.0m')
    expect(formatted).toContain('dB')
    expect(formatted).toContain('wet')

    // Modulating distance slider
    windDist.value = '20'
    windDist.dispatchEvent(new Event('input'))
    expect(windDistDisp.textContent).toContain('20.0m')

    const oceanDist = document.getElementById('ocean-distance')
    const rainDist = document.getElementById('rain-distance')
    const chimeDist = document.getElementById('chime-distance')
    expect(oceanDist).not.toBeNull()
    expect(rainDist).not.toBeNull()
    expect(chimeDist).not.toBeNull()
  })

  it('calculates 2D soundstage coordinates from azimuth pan and metric distance', async () => {
    const { getObjectCoordinates } = await import('../landscapes/main.js')

    const pos = getObjectCoordinates('wind', 800, 320)
    expect(pos.x).toBeDefined()
    expect(pos.y).toBeDefined()
    expect(pos.label).toContain('Wind')
    expect(pos.pan).toBeDefined()
    expect(pos.distance).toBeDefined()
    expect(pos.spread).toBeDefined()

    // Center X should be near 400 when pan is 0
    expect(Math.abs(pos.x - 400)).toBeLessThan(10)
    // Distance should place it in upper half of canvas
    expect(pos.y).toBeLessThan(320)
  })

  it('interactively drags soundstage nodes via pointer events and synchronizes with card sliders and landscape engine', async () => {
    const { getObjectCoordinates, updateCardSpatialControls, initSoundstageCanvas, landscape } = await import('../landscapes/main.js')

    const canvas = document.getElementById('soundstage-canvas')
    expect(canvas).not.toBeNull()

    // Mock canvas methods for jsdom
    if (!canvas.setPointerCapture) canvas.setPointerCapture = vi.fn()
    if (!canvas.releasePointerCapture) canvas.releasePointerCapture = vi.fn()
    if (!canvas.hasPointerCapture) canvas.hasPointerCapture = vi.fn(() => true)
    canvas.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 0, width: 800, height: 320 }))
    canvas.width = 800
    canvas.height = 320

    initSoundstageCanvas(canvas)

    const posBefore = getObjectCoordinates('wind', 800, 320)

    // Simulate pointerdown on wind node
    const downEvent = new MouseEvent('pointerdown', { clientX: posBefore.x, clientY: posBefore.y, bubbles: true })
    downEvent.pointerId = 1
    canvas.dispatchEvent(downEvent)

    // Simulate pointermove dragging to the left and deeper into space
    const moveEvent = new MouseEvent('pointermove', { clientX: 250, clientY: 80, bubbles: true })
    moveEvent.pointerId = 1
    canvas.dispatchEvent(moveEvent)

    // Sliders should update
    const panSlider = document.getElementById('wind-pan')
    const distSlider = document.getElementById('wind-distance')
    expect(parseFloat(panSlider.value)).toBeLessThan(0)
    expect(parseFloat(distSlider.value)).toBeGreaterThan(20)

    // Simulate pointerup
    const upEvent = new MouseEvent('pointerup', { clientX: 250, clientY: 80, bubbles: true })
    upEvent.pointerId = 1
    canvas.dispatchEvent(upEvent)
  })

  it('creates two-tab card for dynamically added sonifiers with distance control', async () => {
    const { createSonifierCard } = await import('../landscapes/main.js')

    const card = createSonifierCard('synth-pad', 'eno-bed', 'bed')
    expect(card).not.toBeNull()

    const tabBtns = card.querySelectorAll('.card-tab-btn')
    expect(tabBtns.length).toBe(2)

    const distSlider = card.querySelector('#synth-pad-distance')
    expect(distSlider).not.toBeNull()
    expect(card.querySelector('#disp-synth-pad-distance').textContent).toContain('m')

    const spatialPane = card.querySelector('.tab-spatial-pane')
    const paramsPane = card.querySelector('.tab-params-pane')
    expect(spatialPane).not.toBeNull()
    expect(paramsPane).not.toBeNull()

    // Test tab switching on dynamic card
    tabBtns[1].click()
    expect(paramsPane.classList.contains('active')).toBe(true)
    expect(spatialPane.classList.contains('active')).toBe(false)
  })

  it('updates card tab mapping badge counts accurately when mappings exist', async () => {
    const { updateTabMappingBadges, landscape } = await import('../landscapes/main.js')

    updateTabMappingBadges()

    const windBadge = document.getElementById('tab-badge-wind')
    expect(windBadge).not.toBeNull()
    // Wind has traffic_rps mapped in default mappings
    const windCount = landscape._mappings.filter(m => m.target?.objectId === 'wind').length
    expect(windBadge.textContent).toBe(String(windCount))
    if (windCount > 0) {
      expect(windBadge.classList.contains('has-mappings')).toBe(true)
    }
  })
})
