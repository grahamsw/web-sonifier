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
})
