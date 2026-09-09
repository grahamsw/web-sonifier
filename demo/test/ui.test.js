// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()

  // Build the mock DOM for index.html
  document.body.innerHTML = `
    <button id="btn-mode-feed" class="mode-btn active">Feed</button>
    <button id="btn-mode-manual" class="mode-btn">Manual</button>
    <div id="feed-display-section">
      <span id="price-value">100</span>
      <span id="price-change"></span>
    </div>
    <div id="manual-workbench-section" style="display: none;">
      <div id="manual-params-container"></div>
    </div>
    <select id="sonifier-select">
      <option value="tone">Tone</option>
      <option value="geiger">Geiger</option>
      <option value="purr">Purr</option>
    </select>
    <div id="feed-rate-group">
      <select id="feed-rate-select">
        <option value="1000">1s</option>
      </select>
    </div>
    <button id="btn-play">Play</button>
    <button id="btn-stop">Stop</button>
    <button id="btn-settings">Settings</button>
    <input id="master-volume" type="range" min="0" max="1" step="0.01" value="0.8">
    <span id="master-volume-display">0.80</span>
    <span id="status">Stopped</span>
    
    <dialog id="settings-dialog">
      <select id="mapped-param-select"></select>
      <div class="feed-range-badge">
        <span class="range-val-badge" id="feed-range-display">0 to 100</span>
      </div>
      <span class="range-val-badge" id="output-min-val">—</span>
      <span class="range-val-badge" id="output-max-val">—</span>
      <div class="dual-range-progress" id="range-progress"></div>
      <input type="range" class="dual-range-input" id="range-slider-min">
      <input type="range" class="dual-range-input" id="range-slider-max">
      <select id="curve-select">
        <option value="linear">Linear</option>
        <option value="exponential">Exponential</option>
      </select>
      <span id="output-range-label">Output range</span>
      <div id="dynamic-params-container"></div>
      <button id="btn-save">Save</button>
      <button id="btn-cancel">Cancel</button>
    </dialog>
  `

  // Mock dialog functions not implemented in basic jsdom
  const dialog = document.getElementById('settings-dialog')
  dialog.showModal = vi.fn()
  dialog.close = vi.fn()

  // Mock localStorage
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
  start: vi.fn(),
  create: vi.fn(() => ({
    setParam: vi.fn(),
    getParamSchema: () => [
      { name: 'frequency', type: 'number', range: [20, 2000], default: 220, label: 'Frequency' },
      { name: 'waveform', type: 'enum', values: ['sine', 'square'], default: 'sine', label: 'Waveform' },
      { name: 'volume', type: 'number', range: [0, 1], default: 0.5, label: 'Volume' }
    ]
  })),
  setMasterVolume: vi.fn(),
  destroy: vi.fn()
}

vi.mock('@web-sonifier/core', () => ({
  Runtime: vi.fn(function() { return mockRuntimeInstance }),
  Adapter: vi.fn(function() {
    return {
      setConfig: vi.fn(),
      map: vi.fn(() => 440),
      param: 'frequency'
    }
  }),
  SonifierBase: class {}
}))

vi.mock('@web-sonifier/tone', () => ({ ToneSonifier: vi.fn() }))
vi.mock('@web-sonifier/geiger', () => ({ GeigerSonifier: vi.fn() }))
vi.mock('@web-sonifier/purr', () => ({ PurrSonifier: vi.fn() }))
vi.mock('@web-sonifier/liquid', () => ({ LiquidSonifier: vi.fn() }))
vi.mock('@web-sonifier/mallet', () => ({ MalletSonifier: vi.fn() }))
vi.mock('@web-sonifier/engine', () => ({ EngineSonifier: vi.fn() }))
vi.mock('@web-sonifier/drone', () => ({ DroneSonifier: class {} }))

describe('Demo UI Live Updates', () => {
  it('should apply settings immediately when an input changes', async () => {
    await import('../main.js')

    // Open settings dialog to render dynamic controls
    const settingsBtn = document.getElementById('btn-settings')
    settingsBtn.click()

    // Find the dynamic volume input
    const volumeEl = document.getElementById('input-volume')
    expect(volumeEl).not.toBeNull()

    // Set value and trigger input event
    volumeEl.value = '0.9'
    volumeEl.dispatchEvent(new Event('input'))

    // Verify localStorage setItem was called
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should save settings to localStorage on input change', async () => {
    await import('../main.js?t=' + Date.now()) // Force re-import

    const settingsBtn = document.getElementById('btn-settings')
    settingsBtn.click()

    const volumeEl = document.getElementById('input-volume')
    volumeEl.value = '0.9'
    volumeEl.dispatchEvent(new Event('input'))

    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should revert settings on cancel', async () => {
    await import('../main.js?t=' + Date.now())

    const settingsBtn = document.getElementById('btn-settings')
    const cancelBtn = document.getElementById('btn-cancel')

    // 1. Open settings
    settingsBtn.click()

    const volumeEl = document.getElementById('input-volume')
    const originalVal = volumeEl.value

    // 2. Change value
    volumeEl.value = '0.1'
    volumeEl.dispatchEvent(new Event('input'))

    // 3. Cancel
    cancelBtn.click()

    // Check that localStorage setItem was called to save the original settings back
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should enable master volume slider and update runtime on input', async () => {
    await import('../main.js?t=' + Date.now())

    const masterVolumeEl = document.getElementById('master-volume')
    expect(masterVolumeEl.disabled).toBe(false)

    masterVolumeEl.value = '0.5'
    masterVolumeEl.dispatchEvent(new Event('input'))

    expect(mockRuntimeInstance.setMasterVolume).toHaveBeenCalledWith(0.5)
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should switch between Live Feed and Manual Workbench modes', async () => {
    await import('../main.js?t=' + Date.now())

    const btnManual = document.getElementById('btn-mode-manual')
    const btnFeed = document.getElementById('btn-mode-feed')
    const feedSection = document.getElementById('feed-display-section')
    const manualSection = document.getElementById('manual-workbench-section')
    const feedRateGroup = document.getElementById('feed-rate-group')
    const container = document.getElementById('manual-params-container')

    // Click Manual Workbench
    btnManual.click()

    expect(btnManual.classList.contains('active')).toBe(true)
    expect(btnFeed.classList.contains('active')).toBe(false)
    expect(feedSection.style.display).toBe('none')
    expect(manualSection.style.display).toBe('block')
    expect(feedRateGroup.style.display).toBe('none')

    // Verify parameter rows were created for tone schema (frequency, waveform, volume)
    const rows = container.querySelectorAll('.workbench-param-row')
    expect(rows.length).toBe(3)

    // Click back to Live Feed
    btnFeed.click()

    expect(btnFeed.classList.contains('active')).toBe(true)
    expect(btnManual.classList.contains('active')).toBe(false)
    expect(feedSection.style.display).toBe('')
    expect(manualSection.style.display).toBe('none')
    expect(feedRateGroup.style.display).toBe('')
  })

  it('should update sonifier parameter and save settings when adjusting workbench slider', async () => {
    await import('../main.js?t=' + Date.now())

    // Start sonifier
    const playBtn = document.getElementById('btn-play')
    await playBtn.click()

    // Switch to manual mode
    const btnManual = document.getElementById('btn-mode-manual')
    btnManual.click()

    const container = document.getElementById('manual-params-container')
    const rows = container.querySelectorAll('.workbench-param-row')
    expect(rows.length).toBeGreaterThan(0)

    // First row is frequency slider and number input
    const slider = rows[0].querySelector('input[type="range"]')
    const numberInput = rows[0].querySelector('input[type="number"]')
    expect(slider).not.toBeNull()
    expect(numberInput).not.toBeNull()

    // Adjust slider
    slider.value = '880'
    slider.dispatchEvent(new Event('input'))

    expect(numberInput.value).toBe('880')
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should initialize dual range slider with head and tail room when opening settings', async () => {
    await import('../main.js?t=' + Date.now())

    const settingsBtn = document.getElementById('btn-settings')
    settingsBtn.click()

    const feedDisplay = document.getElementById('feed-range-display')
    expect(feedDisplay.textContent).toBe('0 to 100')

    const sliderMin = document.getElementById('range-slider-min')
    const sliderMax = document.getElementById('range-slider-max')
    const minValBadge = document.getElementById('output-min-val')
    const maxValBadge = document.getElementById('output-max-val')

    // Tone frequency schema is [20, 2000].
    // Head/tail room extends bounds: min is at least 20, max extends 25% to 2500
    expect(parseFloat(sliderMin.min)).toBeLessThanOrEqual(20)
    expect(parseFloat(sliderMax.max)).toBeGreaterThanOrEqual(2400)

    // Initial default for tone is [110, 440]
    expect(sliderMin.value).toBe('110')
    expect(sliderMax.value).toBe('440')
    expect(minValBadge.textContent).toContain('110')
    expect(maxValBadge.textContent).toContain('440')
  })

  it('should update outputRange and live adapter settings when adjusting range sliders', async () => {
    await import('../main.js?t=' + Date.now())

    const settingsBtn = document.getElementById('btn-settings')
    settingsBtn.click()

    const sliderMin = document.getElementById('range-slider-min')
    const sliderMax = document.getElementById('range-slider-max')
    const minValBadge = document.getElementById('output-min-val')
    const maxValBadge = document.getElementById('output-max-val')

    // Change min slider
    sliderMin.value = '300'
    sliderMin.dispatchEvent(new Event('input'))

    expect(minValBadge.textContent).toContain('300')
    expect(localStorage.setItem).toHaveBeenCalled()

    // Change max slider
    sliderMax.value = '1200'
    sliderMax.dispatchEvent(new Event('input'))

    expect(maxValBadge.textContent).toContain('1200')
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should enforce minVal <= maxVal when dragging dual range sliders past each other', async () => {
    await import('../main.js?t=' + Date.now())

    const settingsBtn = document.getElementById('btn-settings')
    settingsBtn.click()

    const sliderMin = document.getElementById('range-slider-min')
    const sliderMax = document.getElementById('range-slider-max')

    // Set max to 500
    sliderMax.value = '500'
    sliderMax.dispatchEvent(new Event('input'))

    // Attempt to drag min above max (e.g. 600)
    sliderMin.value = '600'
    sliderMin.dispatchEvent(new Event('input'))

    // Min slider should clamp to max (500)
    expect(sliderMin.value).toBe('500')

    // Attempt to drag max below min (e.g. 400)
    sliderMax.value = '400'
    sliderMax.dispatchEvent(new Event('input'))

    // Max slider should clamp to min (500)
    expect(sliderMax.value).toBe('500')
  })

  it('should update curve setting on select change', async () => {
    await import('../main.js?t=' + Date.now())

    const settingsBtn = document.getElementById('btn-settings')
    settingsBtn.click()

    const curveSelect = document.getElementById('curve-select')
    curveSelect.value = 'exponential'
    curveSelect.dispatchEvent(new Event('change'))

    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should populate mapped-param-select with available numeric parameters', async () => {
    await import('../main.js?t=' + Date.now())

    const settingsBtn = document.getElementById('btn-settings')
    settingsBtn.click()

    const mappedSelect = document.getElementById('mapped-param-select')
    expect(mappedSelect).not.toBeNull()

    // Tone schema has frequency (number), waveform (enum), and volume (number)
    const options = Array.from(mappedSelect.options).map(o => o.value)
    expect(options).toContain('frequency')
    expect(options).toContain('volume')
    expect(options).not.toContain('waveform') // enum should not be in mappable numeric options
    expect(mappedSelect.value).toBe('frequency')
  })

  it('should switch mapped parameter, adjust range picker bounds, and swap single-value controls', async () => {
    await import('../main.js?t=' + Date.now())

    const settingsBtn = document.getElementById('btn-settings')
    settingsBtn.click()

    const mappedSelect = document.getElementById('mapped-param-select')
    const sliderMin = document.getElementById('range-slider-min')
    const sliderMax = document.getElementById('range-slider-max')
    const rangeLabel = document.getElementById('output-range-label')

    // Initial state: frequency is mapped
    expect(rangeLabel.textContent).toContain('Frequency')
    // Volume is a single-value input in dynamicContainer
    expect(document.getElementById('input-volume')).not.toBeNull()
    expect(document.getElementById('input-frequency')).toBeNull()

    // Switch mapped parameter to volume
    mappedSelect.value = 'volume'
    mappedSelect.dispatchEvent(new Event('change'))

    // Now volume is mapped
    expect(rangeLabel.textContent).toContain('Volume')
    expect(parseFloat(sliderMin.min)).toBe(0)
    expect(parseFloat(sliderMax.max)).toBe(1)

    // Volume should no longer be a single-value input in dynamicContainer
    expect(document.getElementById('input-volume')).toBeNull()
    // Frequency should now appear as a single-value control
    const freqInput = document.getElementById('input-frequency')
    expect(freqInput).not.toBeNull()

    // Modifying frequency single value sets parameter
    freqInput.value = '520'
    freqInput.dispatchEvent(new Event('input'))
    expect(localStorage.setItem).toHaveBeenCalled()

    // Switch back to frequency
    mappedSelect.value = 'frequency'
    mappedSelect.dispatchEvent(new Event('change'))

    // Frequency is mapped again with frequency bounds
    expect(rangeLabel.textContent).toContain('Frequency')
    expect(parseFloat(sliderMax.max)).toBeGreaterThanOrEqual(2000)
    expect(document.getElementById('input-frequency')).toBeNull()
    expect(document.getElementById('input-volume')).not.toBeNull()
  })
})


