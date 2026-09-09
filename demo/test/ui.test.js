// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  if (typeof window !== 'undefined' && window.location) {
    window.location.hash = ''
  }

  // Build the mock DOM matching index.html with dual panels
  document.body.innerHTML = `
    <div class="app-layout">
      <!-- Left: Data Feeds Panel -->
      <div class="panel feeds-panel">
        <div class="panel-header">
          <h2>Data Feeds</h2>
          <button type="button" id="btn-add-feed" class="btn-add-feed">+ Add Feed</button>
        </div>
        <div class="feeds-container" id="feeds-container"></div>
      </div>

      <!-- Right: Sonifier Console Panel -->
      <div class="panel sonifier-panel">
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
        </div>

        <div class="parameters-container" id="parameters-panel"></div>
      </div>
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

// Mocking @web-sonifier/core and sonifiers
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
      const [inMin, inMax] = this.inputRange || [0, 100]
      const [outMin, outMax] = this.outputRange || [0, 1]
      const t = (val - inMin) / (inMax - inMin)
      return outMin + t * (outMax - outMin)
    })
  }
}

const toneSchema = [
  { name: 'frequency', type: 'number', range: [20, 2000], default: 220, label: 'Frequency' },
  { name: 'waveform', type: 'enum', values: ['sine', 'square'], default: 'sine', label: 'Waveform' },
  { name: 'volume', type: 'number', range: [0, 1], default: 0.5, label: 'Volume' }
]

const geigerSchema = [
  { name: 'rate', type: 'number', range: [1, 50], default: 10, label: 'Click Rate' },
  { name: 'volume', type: 'number', range: [0, 1], default: 0.7, label: 'Volume' }
]

class MockToneSonifier {
  getParamSchema() { return toneSchema }
}
class MockGeigerSonifier {
  getParamSchema() { return geigerSchema }
}

vi.mock('@web-sonifier/core', () => ({
  Runtime: vi.fn(function() { return mockRuntimeInstance }),
  Adapter: vi.fn(function(config) { return new MockAdapter(config) }),
  SonifierBase: class {}
}))

vi.mock('@web-sonifier/tone', () => ({ ToneSonifier: MockToneSonifier }))
vi.mock('@web-sonifier/geiger', () => ({ GeigerSonifier: MockGeigerSonifier }))
vi.mock('@web-sonifier/purr', () => ({ PurrSonifier: class { getParamSchema() { return [] } } }))
vi.mock('@web-sonifier/liquid', () => ({ LiquidSonifier: class { getParamSchema() { return [] } } }))
vi.mock('@web-sonifier/mallet', () => ({ MalletSonifier: class { getParamSchema() { return [] } } }))
vi.mock('@web-sonifier/engine', () => ({ EngineSonifier: class { getParamSchema() { return [] } } }))
vi.mock('@web-sonifier/drone', () => ({ DroneSonifier: class { getParamSchema() { return [] } } }))
vi.mock('@web-sonifier/vosc', () => ({ VoscSonifier: class { getParamSchema() { return [] } } }))
vi.mock('@web-sonifier/rain', () => ({ RainSonifier: class { getParamSchema() { return [] } } }))
vi.mock('@web-sonifier/ocean', () => ({ OceanSonifier: class { getParamSchema() { return [] } } }))

describe('Multi-Feed Panel & Parameter Linking', () => {
  it('should render Feed A and Feed B cards on load with rate and step size controls', async () => {
    const main = await import('../main.js?t=' + Date.now())

    const feedsContainer = document.getElementById('feeds-container')
    expect(feedsContainer).not.toBeNull()

    const cardA = document.getElementById('feed-card-A')
    const cardB = document.getElementById('feed-card-B')
    expect(cardA).not.toBeNull()
    expect(cardB).not.toBeNull()

    // Values, meters, and rate selectors
    expect(document.getElementById('feed-val-large-A')).not.toBeNull()
    expect(document.getElementById('feed-meter-bar-A')).not.toBeNull()
    expect(document.getElementById('feed-rate-select-A')).not.toBeNull()
    expect(document.getElementById('feed-step-slider-A')).not.toBeNull()
    expect(document.getElementById('feed-step-input-A')).not.toBeNull()

    expect(main.feeds.has('A')).toBe(true)
    expect(main.feeds.has('B')).toBe(true)
  })

  it('should allow adding new feeds and removing them', async () => {
    const main = await import('../main.js?t=' + Date.now())

    const btnAddFeed = document.getElementById('btn-add-feed')
    btnAddFeed.click()

    // Feed C should now exist
    expect(main.feeds.has('C')).toBe(true)
    expect(document.getElementById('feed-card-C')).not.toBeNull()

    // Feed C should have a delete button
    const deleteBtnC = document.getElementById('feed-card-C').querySelector('.feed-delete-btn')
    expect(deleteBtnC).not.toBeNull()

    // Delete Feed C
    deleteBtnC.click()
    expect(main.feeds.has('C')).toBe(false)
    expect(document.getElementById('feed-card-C')).toBeNull()
  })

  it('should update feed rate and step size on user input', async () => {
    const main = await import('../main.js?t=' + Date.now())

    const feedA = main.feeds.get('A')
    expect(feedA).toBeDefined()

    // Adjust rate
    const rateSelectA = document.getElementById('feed-rate-select-A')
    rateSelectA.value = '500'
    rateSelectA.dispatchEvent(new Event('change'))

    expect(feedA.rateMs).toBe(500)
    expect(localStorage.setItem).toHaveBeenCalled()

    // Adjust step size
    const stepSliderA = document.getElementById('feed-step-slider-A')
    const stepInputA = document.getElementById('feed-step-input-A')

    stepSliderA.value = '15'
    stepSliderA.dispatchEvent(new Event('input'))

    expect(stepInputA.value).toBe('15')
    expect(feedA.stepSize).toBe(15)
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should display feed link selector, feed value, and mapped value on sonified parameter cards', async () => {
    await import('../main.js?t=' + Date.now())

    const freqCard = document.getElementById('param-card-frequency')
    expect(freqCard.classList.contains('sonified')).toBe(true)

    // Feed selector
    const feedSelect = document.getElementById('param-feed-select-frequency')
    expect(feedSelect).not.toBeNull()
    expect(feedSelect.value).toBe('A')

    // Readout badges
    const feedBadge = document.getElementById('feed-badge-frequency')
    const mappedBadge = document.getElementById('mapped-badge-frequency')
    const rangeBadge = document.getElementById('range-badge-frequency')

    expect(feedBadge).not.toBeNull()
    expect(mappedBadge).not.toBeNull()
    expect(rangeBadge).not.toBeNull()

    expect(document.getElementById('feed-val-frequency')).not.toBeNull()
    expect(document.getElementById('mapped-val-frequency')).not.toBeNull()
  })

  it('should link parameters to different feeds and modulate them independently on feed ticks', async () => {
    const main = await import('../main.js?t=' + Date.now())

    // 1. Sonify volume as well
    const volCheckbox = document.getElementById('checkbox-volume')
    volCheckbox.checked = true
    volCheckbox.dispatchEvent(new Event('change'))

    // Frequency is linked to A by default
    // Link Volume to Feed B
    const volFeedSelect = document.getElementById('param-feed-select-volume')
    expect(volFeedSelect).not.toBeNull()
    volFeedSelect.value = 'B'
    volFeedSelect.dispatchEvent(new Event('change'))

    // Start playing
    const btnPlay = document.getElementById('btn-play')
    await btnPlay.click()

    const sonifier = main.activeSonifier
    expect(sonifier).not.toBeNull()

    // 2. Set known values for feeds and manually trigger tick/updates
    const feedA = main.feeds.get('A')
    const feedB = main.feeds.get('B')

    feedA.value = 25
    main.handleFeedUpdate(feedA)

    // Frequency mapped badge should update to reflect 25% across [110, 440]
    // (110 + 0.25 * (440 - 110) = 192.5 -> 193 or 192.5)
    expect(document.getElementById('feed-val-frequency').textContent).toBe('25.0')
    expect(sonifier.setParam).toHaveBeenCalledWith('frequency', expect.any(Number))

    // Volume should NOT be affected by Feed A
    const volCallsBefore = sonifier.setParam.mock.calls.filter(c => c[0] === 'volume').length

    feedB.value = 80
    main.handleFeedUpdate(feedB)

    // Volume mapped badge should update to reflect 80% across [0.1, 0.9]
    expect(document.getElementById('feed-val-volume').textContent).toBe('80.0')
    const volCallsAfter = sonifier.setParam.mock.calls.filter(c => c[0] === 'volume').length
    expect(volCallsAfter).toBeGreaterThan(volCallsBefore)

    const btnStop = document.getElementById('btn-stop')
    btnStop.click()
  })

  it('should toggle between single slider and dual range slider via checkbox', async () => {
    await import('../main.js?t=' + Date.now())

    const volCard = document.getElementById('param-card-volume')
    const volCheckbox = document.getElementById('checkbox-volume')

    // Check volume
    volCheckbox.checked = true
    volCheckbox.dispatchEvent(new Event('change'))

    expect(volCard.classList.contains('sonified')).toBe(true)
    expect(document.getElementById('feed-badge-volume')).not.toBeNull()
    expect(document.getElementById('mapped-badge-volume')).not.toBeNull()
    expect(document.getElementById('dual-slider-volume')).not.toBeNull()
    expect(document.getElementById('single-slider-volume')).toBeNull()

    // Uncheck volume
    volCheckbox.checked = false
    volCheckbox.dispatchEvent(new Event('change'))

    expect(volCard.classList.contains('sonified')).toBe(false)
    expect(document.getElementById('feed-badge-volume')).toBeNull()
    expect(document.getElementById('mapped-badge-volume')).toBeNull()
    expect(document.getElementById('dual-slider-volume')).toBeNull()
    expect(document.getElementById('single-slider-volume')).not.toBeNull()
    expect(document.getElementById('value-badge-volume')).not.toBeNull()
  })

  it('should shift both min and max together and strictly preserve span on middle-drag', async () => {
    await import('../main.js?t=' + Date.now())

    const minSlider = document.getElementById('range-slider-min-frequency')
    const maxSlider = document.getElementById('range-slider-max-frequency')
    const progress = document.getElementById('progress-frequency')
    const rangeBadge = document.getElementById('range-badge-frequency')

    // Initial setup: range 500 to 900 (span = 400). Set max first so min does not clamp to old max (440).
    maxSlider.value = '900'
    maxSlider.dispatchEvent(new Event('input'))
    minSlider.value = '500'
    minSlider.dispatchEvent(new Event('input'))

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

    expect(newMin).toBeGreaterThan(initialMin)
    expect(newMax).toBeGreaterThan(initialMax)
    expect(newSpan).toBe(initialSpan)
    expect(rangeBadge.textContent).toBe(`${newMin.toFixed(0)} – ${newMax.toFixed(0)}`)

    const upEvent = new Event('pointerup', { bubbles: true, cancelable: true })
    progress.dispatchEvent(upEvent)
  })

  it('should clamp strictly at track bounds while preserving span on extreme middle-drag', async () => {
    await import('../main.js?t=' + Date.now())

    const minSlider = document.getElementById('range-slider-min-frequency')
    const maxSlider = document.getElementById('range-slider-max-frequency')
    const progress = document.getElementById('progress-frequency')

    maxSlider.value = '900'
    maxSlider.dispatchEvent(new Event('input'))
    minSlider.value = '500'
    minSlider.dispatchEvent(new Event('input'))

    const boundsMin = parseFloat(minSlider.min)
    const boundsMax = parseFloat(maxSlider.max)
    const span = 400

    // Extreme drag to the left
    const downLeft = new Event('pointerdown', { bubbles: true, cancelable: true })
    downLeft.clientX = 100
    downLeft.button = 0
    progress.dispatchEvent(downLeft)

    const moveLeft = new Event('pointermove', { bubbles: true, cancelable: true })
    moveLeft.clientX = -500
    progress.dispatchEvent(moveLeft)

    expect(parseFloat(minSlider.value)).toBe(boundsMin)
    expect(parseFloat(maxSlider.value)).toBe(boundsMin + span)
    expect(parseFloat(maxSlider.value) - parseFloat(minSlider.value)).toBe(span)

    const upLeft = new Event('pointerup', { bubbles: true, cancelable: true })
    progress.dispatchEvent(upLeft)

    // Extreme drag to the right
    const downRight = new Event('pointerdown', { bubbles: true, cancelable: true })
    downRight.clientX = 100
    downRight.button = 0
    progress.dispatchEvent(downRight)

    const moveRight = new Event('pointermove', { bubbles: true, cancelable: true })
    moveRight.clientX = 800
    progress.dispatchEvent(moveRight)

    expect(parseFloat(maxSlider.value)).toBe(boundsMax)
    expect(parseFloat(minSlider.value)).toBe(boundsMax - span)
    expect(parseFloat(maxSlider.value) - parseFloat(minSlider.value)).toBe(span)

    const upRight = new Event('pointerup', { bubbles: true, cancelable: true })
    progress.dispatchEvent(upRight)
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

  it('should re-render parameters panel when switching sonifiers', async () => {
    await import('../main.js?t=' + Date.now())

    const sonifierSelect = document.getElementById('sonifier-select')
    sonifierSelect.value = 'geiger'
    sonifierSelect.dispatchEvent(new Event('change'))

    expect(document.getElementById('param-card-frequency')).toBeNull()
  })

  it('should render parameter cards immediately on load before Play is clicked', async () => {
    const main = await import('../main.js?t=' + Date.now())

    // activeSonifier is null because Play was never clicked
    expect(main.activeSonifier).toBeNull()

    // Tone parameters should already be rendered
    const freqCard = document.getElementById('param-card-frequency')
    const volCard = document.getElementById('param-card-volume')
    const waveCard = document.getElementById('param-card-waveform')
    expect(freqCard).not.toBeNull()
    expect(volCard).not.toBeNull()
    expect(waveCard).not.toBeNull()
  })

  it('should immediately render new parameter cards when switching sonifier before Play is clicked', async () => {
    const main = await import('../main.js?t=' + Date.now())

    expect(main.activeSonifier).toBeNull()

    const sonifierSelect = document.getElementById('sonifier-select')
    sonifierSelect.value = 'geiger'
    sonifierSelect.dispatchEvent(new Event('change'))

    // Frequency should be gone; Geiger's rate and volume should be rendered
    expect(document.getElementById('param-card-frequency')).toBeNull()
    expect(document.getElementById('param-card-rate')).not.toBeNull()
    expect(document.getElementById('param-card-volume')).not.toBeNull()
  })

  it('should serialize state into URL hash on parameter and feed adjustments', async () => {
    await import('../main.js?t=' + Date.now())

    // Update volume slider
    const masterVol = document.getElementById('master-volume')
    masterVol.value = '0.65'
    masterVol.dispatchEvent(new Event('input'))

    expect(window.location.hash).toContain('sonifier=tone')
    expect(window.location.hash).toContain('vol=0.65')
    expect(window.location.hash).toContain('feeds=')
  })

  it('should parse and restore state from URL hash on initialization', async () => {
    // Set URL hash prior to loading module
    window.location.hash = '#sonifier=geiger&vol=0.42&feeds=A:500:12,B:4000:3&rate=B:5-45&volume=0.35'

    const main = await import('../main.js?t=' + Date.now())

    expect(main.settings.sonifierType).toBe('geiger')
    expect(main.settings.masterVolume).toBe(0.42)
    expect(main.settings.geiger.sonifiedParams).toContain('rate')
    expect(main.settings.geiger.paramFeeds.rate).toBe('B')
    expect(main.settings.geiger.paramRanges.rate).toEqual([5, 45])
    expect(main.settings.geiger.volume).toBe(0.35)

    const feedA = main.feeds.get('A')
    const feedB = main.feeds.get('B')
    expect(feedA.rateMs).toBe(500)
    expect(feedA.stepSize).toBe(12)
    expect(feedB.rateMs).toBe(4000)
    expect(feedB.stepSize).toBe(3)

    // DOM should reflect restored state
    expect(document.getElementById('sonifier-select').value).toBe('geiger')
    expect(document.getElementById('master-volume-display').textContent).toBe('0.42')
    expect(document.getElementById('param-card-rate')).not.toBeNull()
  })
})
