// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()

  // Build the mock DOM matching index.html
  document.body.innerHTML = `
    <div class="card">
      <div class="transport-bar">
        <button class="btn-play" id="btn-play">▶ Play</button>
        <button class="btn-stop" id="btn-stop" disabled>■ Stop</button>
        <div class="status-badge" id="status">Stopped</div>
      </div>

      <div class="volume-row">
        <label for="master-volume">Master volume</label>
        <input type="range" id="master-volume" min="0" max="1" step="0.01" value="0.8">
        <span class="vol-value" id="master-volume-display">0.80</span>
      </div>

      <div class="sonifier-row">
        <div class="sonifier-select-group">
          <select id="sonifier-select">
            <option value="tone">Tone</option>
            <option value="geiger">Geiger</option>
            <option value="purr">Purr</option>
          </select>
          <button id="btn-open-load-custom">+ External</button>
        </div>

        <div class="feed-rate-group" id="feed-rate-group">
          <select id="feed-rate-select">
            <option value="1000">1s</option>
          </select>
        </div>
      </div>

      <div class="parameters-container" id="parameters-panel"></div>
    </div>

    <dialog id="custom-sonifier-dialog">
      <input type="text" id="custom-url-input">
      <input type="text" id="custom-name-input">
      <input type="text" id="custom-export-input">
      <input type="text" id="custom-mapped-param-input">
      <div id="custom-load-error"></div>
      <button id="btn-custom-load">Load</button>
      <button id="btn-custom-cancel">Cancel</button>
    </dialog>
  `

  const dialog = document.getElementById('custom-sonifier-dialog')
  dialog.showModal = vi.fn()
  dialog.close = vi.fn()

  const mockLocalStorage = {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn()
  }
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  })
  global.localStorage = mockLocalStorage
})

const mockRuntimeInstance = {
  register: vi.fn(),
  start: vi.fn().mockResolvedValue(),
  create: vi.fn((type) => {
    if (type === 'geiger') {
      return {
        setParam: vi.fn(),
        getParamSchema: () => [
          { name: 'rate', type: 'number', range: [1, 50], default: 10, label: 'Click Rate' },
          { name: 'volume', type: 'number', range: [0, 1], default: 0.7, label: 'Volume' }
        ]
      }
    }
    return {
      setParam: vi.fn(),
      getParamSchema: () => [
        { name: 'frequency', type: 'number', range: [20, 2000], default: 220, label: 'Frequency' },
        { name: 'waveform', type: 'enum', values: ['sine', 'square'], default: 'sine', label: 'Waveform' },
        { name: 'volume', type: 'number', range: [0, 1], default: 0.5, label: 'Volume' }
      ]
    }
  }),
  setMasterVolume: vi.fn(),
  destroy: vi.fn()
}

class MockAdapter {
  constructor(config) {
    this.param = config.param
    this.inputRange = config.inputRange
    this.outputRange = config.outputRange
    this.curve = config.curve
    this.setConfig = vi.fn((c) => Object.assign(this, c))
    this.map = vi.fn((val) => {
      // Linear interpolation for testing
      const [inMin, inMax] = this.inputRange || [0, 100]
      const [outMin, outMax] = this.outputRange || [0, 1]
      const t = (val - inMin) / (inMax - inMin)
      return outMin + t * (outMax - outMin)
    })
  }
}

vi.mock('@web-sonifier/core', () => ({
  Runtime: vi.fn(function() { return mockRuntimeInstance }),
  Adapter: vi.fn(function(config) { return new MockAdapter(config) }),
  SonifierBase: class {}
}))

vi.mock('@web-sonifier/tone', () => ({ ToneSonifier: vi.fn() }))
vi.mock('@web-sonifier/geiger', () => ({ GeigerSonifier: vi.fn() }))
vi.mock('@web-sonifier/purr', () => ({ PurrSonifier: vi.fn() }))
vi.mock('@web-sonifier/liquid', () => ({ LiquidSonifier: vi.fn() }))
vi.mock('@web-sonifier/mallet', () => ({ MalletSonifier: vi.fn() }))
vi.mock('@web-sonifier/engine', () => ({ EngineSonifier: vi.fn() }))
vi.mock('@web-sonifier/drone', () => ({ DroneSonifier: class {} }))
vi.mock('@web-sonifier/vosc', () => ({ VoscSonifier: class {} }))
vi.mock('@web-sonifier/rain', () => ({ RainSonifier: class {} }))
vi.mock('@web-sonifier/ocean', () => ({ OceanSonifier: class {} }))

describe('Unified Single-Panel Demo UI', () => {
  it('should render parameter cards in #parameters-panel on load', async () => {
    await import('../main.js?t=' + Date.now())

    const panel = document.getElementById('parameters-panel')
    expect(panel).not.toBeNull()

    // Tone schema has frequency, waveform, and volume
    const freqCard = document.getElementById('param-card-frequency')
    const waveCard = document.getElementById('param-card-waveform')
    const volCard = document.getElementById('param-card-volume')

    expect(freqCard).not.toBeNull()
    expect(waveCard).not.toBeNull()
    expect(volCard).not.toBeNull()

    // Frequency is sonified by default
    const freqCheckbox = document.getElementById('checkbox-frequency')
    expect(freqCheckbox.checked).toBe(true)
    expect(freqCard.classList.contains('sonified')).toBe(true)
    expect(document.getElementById('feed-badge-frequency')).not.toBeNull()
    expect(document.getElementById('range-badge-frequency')).not.toBeNull()
    expect(document.getElementById('dual-slider-frequency')).not.toBeNull()

    // Waveform is an enum card with select
    expect(document.getElementById('select-waveform')).not.toBeNull()

    // Volume is unsonified (single slider) by default
    const volCheckbox = document.getElementById('checkbox-volume')
    expect(volCheckbox.checked).toBe(false)
    expect(volCard.classList.contains('sonified')).toBe(false)
    expect(document.getElementById('value-badge-volume')).not.toBeNull()
    expect(document.getElementById('single-slider-volume')).not.toBeNull()
    expect(document.getElementById('single-input-volume')).not.toBeNull()
  })

  it('should update parameter value when adjusting single slider', async () => {
    await import('../main.js?t=' + Date.now())

    const volSlider = document.getElementById('single-slider-volume')
    const volInput = document.getElementById('single-input-volume')
    const volBadge = document.getElementById('value-badge-volume')

    volSlider.value = '0.75'
    volSlider.dispatchEvent(new Event('input'))

    expect(volInput.value).toBe('0.75')
    expect(volBadge.textContent).toBe('0.75')
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should toggle between single slider and dual range slider via checkbox', async () => {
    await import('../main.js?t=' + Date.now())

    const volCard = document.getElementById('param-card-volume')
    const volCheckbox = document.getElementById('checkbox-volume')

    // 1. Check volume to sonify it
    volCheckbox.checked = true
    volCheckbox.dispatchEvent(new Event('change'))

    expect(volCard.classList.contains('sonified')).toBe(true)
    expect(document.getElementById('feed-badge-volume')).not.toBeNull()
    expect(document.getElementById('range-badge-volume')).not.toBeNull()
    expect(document.getElementById('dual-slider-volume')).not.toBeNull()
    expect(document.getElementById('single-slider-volume')).toBeNull()

    // 2. Uncheck volume to revert to single value slider
    volCheckbox.checked = false
    volCheckbox.dispatchEvent(new Event('change'))

    expect(volCard.classList.contains('sonified')).toBe(false)
    expect(document.getElementById('feed-badge-volume')).toBeNull()
    expect(document.getElementById('range-badge-volume')).toBeNull()
    expect(document.getElementById('dual-slider-volume')).toBeNull()
    expect(document.getElementById('single-slider-volume')).not.toBeNull()
    expect(document.getElementById('value-badge-volume')).not.toBeNull()
  })

  it('should update output range and adapter when dragging dual slider thumbs', async () => {
    await import('../main.js?t=' + Date.now())

    const minSlider = document.getElementById('range-slider-min-frequency')
    const maxSlider = document.getElementById('range-slider-max-frequency')
    const rangeBadge = document.getElementById('range-badge-frequency')

    // Adjust min
    minSlider.value = '250'
    minSlider.dispatchEvent(new Event('input'))

    expect(rangeBadge.textContent).toContain('250')
    expect(localStorage.setItem).toHaveBeenCalled()

    // Adjust max
    maxSlider.value = '1500'
    maxSlider.dispatchEvent(new Event('input'))

    expect(rangeBadge.textContent).toContain('1500')
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should clamp min and max when dragging thumbs past each other', async () => {
    await import('../main.js?t=' + Date.now())

    const minSlider = document.getElementById('range-slider-min-frequency')
    const maxSlider = document.getElementById('range-slider-max-frequency')

    maxSlider.value = '500'
    maxSlider.dispatchEvent(new Event('input'))

    // Attempt to drag min above max (600)
    minSlider.value = '600'
    minSlider.dispatchEvent(new Event('input'))

    expect(minSlider.value).toBe('500')

    // Attempt to drag max below min (400)
    maxSlider.value = '400'
    maxSlider.dispatchEvent(new Event('input'))

    expect(maxSlider.value).toBe('500')
  })

  it('should shift both min and max together and strictly preserve span on middle-drag', async () => {
    await import('../main.js?t=' + Date.now())

    const minSlider = document.getElementById('range-slider-min-frequency')
    const maxSlider = document.getElementById('range-slider-max-frequency')
    const progress = document.getElementById('progress-frequency')
    const rangeBadge = document.getElementById('range-badge-frequency')

    // Set known initial range
    minSlider.value = '200'
    minSlider.dispatchEvent(new Event('input'))
    maxSlider.value = '600'
    maxSlider.dispatchEvent(new Event('input'))

    const initialMin = parseFloat(minSlider.value)
    const initialMax = parseFloat(maxSlider.value)
    const initialSpan = initialMax - initialMin
    expect(initialSpan).toBe(400)

    // Simulate middle-drag pointerdown
    const downEvent = new Event('pointerdown', { bubbles: true, cancelable: true })
    downEvent.clientX = 100
    downEvent.button = 0
    progress.dispatchEvent(downEvent)

    // Simulate middle-drag pointermove to the right by +40px
    const moveEvent = new Event('pointermove', { bubbles: true, cancelable: true })
    moveEvent.clientX = 140
    progress.dispatchEvent(moveEvent)

    const newMin = parseFloat(minSlider.value)
    const newMax = parseFloat(maxSlider.value)
    const newSpan = newMax - newMin

    // Verify both ends moved up
    expect(newMin).toBeGreaterThan(initialMin)
    expect(newMax).toBeGreaterThan(initialMax)

    // Span must be strictly preserved!
    expect(newSpan).toBe(initialSpan)
    expect(rangeBadge.textContent).toBe(`${newMin.toFixed(0)} – ${newMax.toFixed(0)}`)

    // End drag
    const upEvent = new Event('pointerup', { bubbles: true, cancelable: true })
    progress.dispatchEvent(upEvent)
  })

  it('should support multiple parameters sonified simultaneously when running', async () => {
    const main = await import('../main.js?t=' + Date.now())

    // Check volume so both frequency and volume are sonified
    const volCheckbox = document.getElementById('checkbox-volume')
    volCheckbox.checked = true
    volCheckbox.dispatchEvent(new Event('change'))

    // Play
    const btnPlay = document.getElementById('btn-play')
    await btnPlay.click()

    expect(main.activeAdapters.size).toBe(2)
    expect(main.activeAdapters.has('frequency')).toBe(true)
    expect(main.activeAdapters.has('volume')).toBe(true)

    // Trigger feed update
    const statusEl = document.getElementById('status')
    expect(statusEl.textContent).toBe('Sonifying…')
    expect(statusEl.classList.contains('active')).toBe(true)

    // Verify feed badge elements exist and can receive live numbers
    const feedValFreq = document.getElementById('feed-val-frequency')
    const feedValVol = document.getElementById('feed-val-volume')
    expect(feedValFreq).not.toBeNull()
    expect(feedValVol).not.toBeNull()

    // Stop
    const btnStop = document.getElementById('btn-stop')
    btnStop.click()

    expect(main.activeAdapters.size).toBe(0)
    expect(statusEl.textContent).toBe('Stopped')
    expect(statusEl.classList.contains('active')).toBe(false)
  })

  it('should handle zero parameters sonified gracefully', async () => {
    const main = await import('../main.js?t=' + Date.now())

    // Uncheck frequency
    const freqCheckbox = document.getElementById('checkbox-frequency')
    freqCheckbox.checked = false
    freqCheckbox.dispatchEvent(new Event('change'))

    // Play
    const btnPlay = document.getElementById('btn-play')
    await btnPlay.click()

    expect(main.activeAdapters.size).toBe(0)
    expect(mockRuntimeInstance.start).toHaveBeenCalled()

    const btnStop = document.getElementById('btn-stop')
    btnStop.click()
  })

  it('should adjust master volume and update runtime', async () => {
    await import('../main.js?t=' + Date.now())

    const masterVol = document.getElementById('master-volume')
    const masterDisp = document.getElementById('master-volume-display')

    masterVol.value = '0.45'
    masterVol.dispatchEvent(new Event('input'))

    expect(mockRuntimeInstance.setMasterVolume).toHaveBeenCalledWith(0.45)
    expect(masterDisp.textContent).toBe('0.45')
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should clamp strictly at track bounds while preserving span on extreme middle-drag', async () => {
    await import('../main.js?t=' + Date.now())

    const minSlider = document.getElementById('range-slider-min-frequency')
    const maxSlider = document.getElementById('range-slider-max-frequency')
    const progress = document.getElementById('progress-frequency')

    // Initial setup: range 500 to 900 (span = 400). Set max first so min does not clamp to old max (440).
    maxSlider.value = '900'
    maxSlider.dispatchEvent(new Event('input'))
    minSlider.value = '500'
    minSlider.dispatchEvent(new Event('input'))

    const boundsMin = parseFloat(minSlider.min)
    const boundsMax = parseFloat(maxSlider.max)
    const span = 400

    // 1. Extreme drag to the left (negative delta)
    const downLeft = new Event('pointerdown', { bubbles: true, cancelable: true })
    downLeft.clientX = 100
    downLeft.button = 0
    progress.dispatchEvent(downLeft)

    const moveLeft = new Event('pointermove', { bubbles: true, cancelable: true })
    moveLeft.clientX = -500 // huge left movement
    progress.dispatchEvent(moveLeft)

    expect(parseFloat(minSlider.value)).toBe(boundsMin)
    expect(parseFloat(maxSlider.value)).toBe(boundsMin + span)
    expect(parseFloat(maxSlider.value) - parseFloat(minSlider.value)).toBe(span)

    const upLeft = new Event('pointerup', { bubbles: true, cancelable: true })
    progress.dispatchEvent(upLeft)

    // 2. Extreme drag to the right (positive delta)
    const downRight = new Event('pointerdown', { bubbles: true, cancelable: true })
    downRight.clientX = 100
    downRight.button = 0
    progress.dispatchEvent(downRight)

    const moveRight = new Event('pointermove', { bubbles: true, cancelable: true })
    moveRight.clientX = 800 // huge right movement
    progress.dispatchEvent(moveRight)

    expect(parseFloat(maxSlider.value)).toBe(boundsMax)
    expect(parseFloat(minSlider.value)).toBe(boundsMax - span)
    expect(parseFloat(maxSlider.value) - parseFloat(minSlider.value)).toBe(span)

    const upRight = new Event('pointerup', { bubbles: true, cancelable: true })
    progress.dispatchEvent(upRight)
  })

  it('should re-render parameters panel when switching sonifiers', async () => {
    await import('../main.js?t=' + Date.now())

    const sonifierSelect = document.getElementById('sonifier-select')
    sonifierSelect.value = 'geiger'
    sonifierSelect.dispatchEvent(new Event('change'))

    // Geiger has rate and volume in its UI config
    expect(document.getElementById('param-card-frequency')).toBeNull()
  })
})
