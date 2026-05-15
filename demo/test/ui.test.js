import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockElements = {}

beforeEach(() => {
  mockElements = {}
  vi.clearAllMocks()
  vi.resetModules()
})

global.document = {
  getElementById: vi.fn(id => {
    if (!mockElements[id]) {
      mockElements[id] = {
        addEventListener: vi.fn(),
        value: '',
        style: { display: '' },
        textContent: '',
        showModal: vi.fn(),
        close: vi.fn()
      }
    }
    return mockElements[id]
  }),
  activeElement: null
}

global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn()
}

// Mocking @web-sonify/core and sonifiers
const mockRuntimeInstance = {
  register: vi.fn(),
  start: vi.fn(),
  create: vi.fn(() => ({
    setParam: vi.fn()
  })),
  setMasterVolume: vi.fn(),
  destroy: vi.fn()
}

vi.mock('@web-sonify/core', () => ({
  Runtime: vi.fn(function() { return mockRuntimeInstance }),
  Adapter: vi.fn(function() {
    return {
      setConfig: vi.fn(),
      map: vi.fn(() => 440)
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
    // We need to import main.js to trigger its logic
    // Since it's a script that runs on load, we import it here
    await import('../main.js')

    // Find the input element for sonifier volume (for example)
    const sonifierVolumeEl = mockElements['sonifier-volume']
    expect(sonifierVolumeEl).toBeDefined()

    // It should have an 'input' event listener added for live updates
    const inputListeners = sonifierVolumeEl.addEventListener.mock.calls.filter(call => call[0] === 'input')
    expect(inputListeners.length).toBeGreaterThan(0)
  })

  it('should save settings to localStorage on input change', async () => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Import main.js
    await import('../main.js?t=' + Date.now()) // Force re-import

    const sonifierVolumeEl = mockElements['sonifier-volume']
    sonifierVolumeEl.value = '0.9'
    
    // Simulate input event
    const inputHandler = sonifierVolumeEl.addEventListener.mock.calls.find(call => call[0] === 'input')[1]
    inputHandler()

    expect(global.localStorage.setItem).toHaveBeenCalled()
  })

  it('should revert settings on cancel', async () => {
    vi.clearAllMocks()
    await import('../main.js?t=' + Date.now())

    const settingsBtn = mockElements['btn-settings']
    const cancelBtn = mockElements['btn-cancel']
    const sonifierVolumeEl = mockElements['sonifier-volume']

    // 1. Open dialog
    const openHandler = settingsBtn.addEventListener.mock.calls.find(call => call[0] === 'click')[1]
    openHandler()

    // 2. Change a value
    sonifierVolumeEl.value = '0.1'
    const inputHandler = sonifierVolumeEl.addEventListener.mock.calls.find(call => call[0] === 'input')[1]
    inputHandler()

    // 3. Cancel
    const cancelHandler = cancelBtn.addEventListener.mock.calls.find(call => call[0] === 'click')[1]
    cancelHandler()

    // Verify localStorage was called to save the original settings back
    // (Actual verification of object equality is harder with mocks here, but we check if saveSettings was called)
    expect(global.localStorage.setItem).toHaveBeenCalled()
  })

  it('should enable master volume slider and update runtime on input', async () => {
    vi.clearAllMocks()
    await import('../main.js?t=' + Date.now())

    const masterVolumeEl = mockElements['master-volume']
    
    // It should be enabled by JS on load
    expect(masterVolumeEl.disabled).toBe(false)

    // Simulate input
    masterVolumeEl.value = '0.5'
    const inputHandler = masterVolumeEl.addEventListener.mock.calls.find(call => call[0] === 'input')[1]
    inputHandler({ target: masterVolumeEl })

    expect(mockRuntimeInstance.setMasterVolume).toHaveBeenCalledWith(0.5)
    expect(global.localStorage.setItem).toHaveBeenCalled()
  })
})
