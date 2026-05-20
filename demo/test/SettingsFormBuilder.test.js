// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { SettingsFormBuilder } from '../SettingsFormBuilder.js'

describe('SettingsFormBuilder', () => {
  const mockSonifier = {
    getParamSchema: () => [
      { name: 'cutoff', type: 'number', range: [20, 20000], default: 1000, label: 'Cutoff' },
      { name: 'type', type: 'enum', values: ['lowpass', 'highpass'], default: 'lowpass' },
      { name: 'bypass', type: 'boolean', default: false }
    ]
  }

  const mockUiConfig = {
    groups: [
      {
        title: 'Filter controls',
        params: {
          cutoff: { control: 'slider', step: 10 },
          type: { control: 'select' },
          bypass: { control: 'checkbox' }
        }
      }
    ]
  }

  it('renders elements based on schema and UI config', () => {
    const container = document.createElement('div')
    const settings = { cutoff: 500, type: 'highpass', bypass: true }
    const onChange = vi.fn()

    SettingsFormBuilder.build(container, mockSonifier, mockUiConfig, settings, onChange)

    // Check title
    const title = container.querySelector('h3')
    expect(title).not.toBeNull()
    expect(title.textContent).toBe('Filter controls')

    // Check slider
    const cutoffInput = container.querySelector('#input-cutoff')
    expect(cutoffInput).not.toBeNull()
    expect(cutoffInput.type).toBe('range')
    expect(cutoffInput.min).toBe('20')
    expect(cutoffInput.max).toBe('20000')
    expect(cutoffInput.step).toBe('10')
    expect(cutoffInput.value).toBe('500')

    const valueDisplay = container.querySelector('#value-display-cutoff')
    expect(valueDisplay).not.toBeNull()
    expect(valueDisplay.textContent).toBe('500')

    // Check select dropdown
    const typeSelect = container.querySelector('#input-type')
    expect(typeSelect).not.toBeNull()
    expect(typeSelect.tagName.toLowerCase()).toBe('select')
    expect(typeSelect.value).toBe('highpass')

    // Check checkbox
    const bypassCheckbox = container.querySelector('#input-bypass')
    expect(bypassCheckbox).not.toBeNull()
    expect(bypassCheckbox.type).toBe('checkbox')
    expect(bypassCheckbox.checked).toBe(true)
  })

  it('triggers onChange callback when inputs change', () => {
    const container = document.createElement('div')
    const settings = { cutoff: 500, type: 'highpass', bypass: true }
    const onChange = vi.fn()

    SettingsFormBuilder.build(container, mockSonifier, mockUiConfig, settings, onChange)

    const cutoffInput = container.querySelector('#input-cutoff')
    cutoffInput.value = '1200'
    cutoffInput.dispatchEvent(new Event('input'))

    expect(onChange).toHaveBeenCalledWith('cutoff', 1200)

    const bypassCheckbox = container.querySelector('#input-bypass')
    bypassCheckbox.checked = false
    bypassCheckbox.dispatchEvent(new Event('input'))

    expect(onChange).toHaveBeenCalledWith('bypass', false)
  })
})
