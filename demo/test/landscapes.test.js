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

  it('contains all 3 physical sound object cards with exciters and spatial strips', () => {
    // Wind
    expect(document.getElementById('card-wind')).not.toBeNull()
    expect(document.getElementById('wind-speed')).not.toBeNull()
    expect(document.getElementById('wind-turbulence')).not.toBeNull()
    expect(document.getElementById('wind-pan')).not.toBeNull()

    // Chimes
    expect(document.getElementById('card-chime')).not.toBeNull()
    expect(document.getElementById('chime-wind-coupled')).not.toBeNull()
    expect(document.getElementById('btn-strike-chime')).not.toBeNull()
    expect(document.getElementById('chime-pitch')).not.toBeNull()
    expect(document.getElementById('chime-pan')).not.toBeNull()

    // Bubbles
    expect(document.getElementById('card-bubble')).not.toBeNull()
    expect(document.getElementById('bubble-rate')).not.toBeNull()
    expect(document.getElementById('btn-trigger-bubble')).not.toBeNull()
    expect(document.getElementById('bubble-radius')).not.toBeNull()
    expect(document.getElementById('bubble-pan')).not.toBeNull()
  })

  it('defines the 3 atmospheric presets', () => {
    expect(document.getElementById('preset-alpine')).not.toBeNull()
    expect(document.getElementById('preset-coastal')).not.toBeNull()
    expect(document.getElementById('preset-cavern')).not.toBeNull()
  })

  it('has valid importmap in index.html for browser es modules', () => {
    const importmapEl = document.querySelector('script[type="importmap"]')
    expect(importmapEl).not.toBeNull()
    const parsed = JSON.parse(importmapEl.textContent)
    expect(parsed.imports['@web-sonifier/core']).toBe('/packages/core/src/index.js')
    expect(parsed.imports['@web-sonifier/wind']).toBe('/packages/wind/src/index.js')
    expect(parsed.imports['@web-sonifier/chime']).toBe('/packages/chime/src/index.js')
    expect(parsed.imports['@web-sonifier/bubble']).toBe('/packages/bubble/src/index.js')
  })
})
