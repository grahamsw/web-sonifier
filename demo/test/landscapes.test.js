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

    // 2. Rain
    expect(document.getElementById('card-rain')).not.toBeNull()
    expect(document.getElementById('rain-volume')).not.toBeNull()
    expect(document.getElementById('rain-intensity')).not.toBeNull()
    expect(document.getElementById('rain-surface')).not.toBeNull()
    expect(document.getElementById('rain-pitch')).not.toBeNull()
    expect(document.getElementById('rain-pan')).not.toBeNull()

    // 3. Ocean
    expect(document.getElementById('card-ocean')).not.toBeNull()
    expect(document.getElementById('ocean-volume')).not.toBeNull()
    expect(document.getElementById('ocean-intensity')).not.toBeNull()
    expect(document.getElementById('ocean-period')).not.toBeNull()
    expect(document.getElementById('ocean-foam')).not.toBeNull()
    expect(document.getElementById('ocean-pan')).not.toBeNull()

    // 4. Chimes
    expect(document.getElementById('card-chime')).not.toBeNull()
    expect(document.getElementById('chime-volume')).not.toBeNull()
    expect(document.getElementById('chime-wind-coupled')).not.toBeNull()
    expect(document.getElementById('btn-strike-chime')).not.toBeNull()
    expect(document.getElementById('chime-pitch')).not.toBeNull()
    expect(document.getElementById('chime-pan')).not.toBeNull()
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
})
