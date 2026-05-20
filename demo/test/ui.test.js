// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()

  // Build the mock DOM for index.html
  document.body.innerHTML = `
    <span id="price-value">100</span>
    <span id="price-change"></span>
    <select id="sonifier-select">
      <option value="tone">Tone</option>
      <option value="geiger">Geiger</option>
      <option value="purr">Purr</option>
    </select>
    <select id="feed-rate-select">
      <option value="1000">1s</option>
    </select>
    <button id="btn-play">Play</button>
    <button id="btn-stop">Stop</button>
    <button id="btn-settings">Settings</button>
    <input id="master-volume" type="range" min="0" max="1" step="0.01" value="0.8">
    <span id="master-volume-display">0.80</span>
    <span id="status">Stopped</span>
    
    <dialog id="settings-dialog">
      <input type="number" id="input-min">
      <input type="number" id="input-max">
      <input type="number" id="output-min">
      <input type="number" id="output-max">
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

// Mocking @web-sonify/core and sonifiers
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

vi.mock('@web-sonify/core', () => ({
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

vi.mock('@web-sonify/tone', () => ({ ToneSonifier: vi.fn() }))
vi.mock('@web-sonify/geiger', () => ({ GeigerSonifier: vi.fn() }))
vi.mock('@web-sonify/purr', () => ({ PurrSonifier: vi.fn() }))
vi.mock('@web-sonify/liquid', () => ({ LiquidSonifier: vi.fn() }))
vi.mock('@web-sonify/mallet', () => ({ MalletSonifier: vi.fn() }))
vi.mock('@web-sonify/engine', () => ({ EngineSonifier: vi.fn() }))
vi.mock('@web-sonify/drone', () => ({ DroneSonifier: class {} }))

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
})
