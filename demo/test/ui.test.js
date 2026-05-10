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
  })
}))

vi.mock('@web-sonify/tone', () => ({ ToneSonifier: vi.fn() }))
vi.mock('@web-sonify/geiger', () => ({ GeigerSonifier: vi.fn() }))
vi.mock('@web-sonify/purr', () => ({ PurrSonifier: vi.fn() }))
vi.mock('@web-sonify/liquid', () => ({ LiquidSonifier: vi.fn() }))
vi.mock('@web-sonify/mallet', () => ({ MalletSonifier: vi.fn() }))

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
})
