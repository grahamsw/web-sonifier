/**
 * SettingsFormBuilder
 *
 * Dynamically builds form elements in a container based on a sonifier's
 * parameter schema and the site author's UI configuration ("facet").
 */
export class SettingsFormBuilder {
  /**
   * Generates form controls inside a target container.
   *
   * @param {HTMLElement} container - The element to render the inputs into.
   * @param {SonifierBase} sonifier - The active sonifier instance to inspect.
   * @param {Object} uiConfig - The site author's UI configuration for this sonifier.
   * @param {Object} currentSettings - The current settings object for the sonifier.
   * @param {Function} onChange - Callback triggered when a control changes: (paramName, value).
   */
  static build(container, sonifier, uiConfig, currentSettings, onChange) {
    container.innerHTML = ''
    if (!uiConfig || !uiConfig.groups) return

    const schema = sonifier.getParamSchema()

    for (const group of uiConfig.groups) {
      const groupEl = document.createElement('div')
      groupEl.className = 'setting-group'

      if (group.title) {
        const titleEl = document.createElement('h3')
        titleEl.textContent = group.title
        groupEl.appendChild(titleEl)
      }

      for (const [paramName, config] of Object.entries(group.params || {})) {
        const schemaEntry = schema.find(p => p.name === paramName)
        if (!schemaEntry) {
          console.warn(`[web-sonify UI] Parameter "${paramName}" not found in sonifier schema.`)
          continue
        }

        const currentValue = currentSettings[paramName] !== undefined 
          ? currentSettings[paramName] 
          : (schemaEntry.default !== undefined ? schemaEntry.default : '')

        const rowEl = document.createElement('div')
        rowEl.className = 'setting-row'
        rowEl.id = `row-${paramName}`

        const labelEl = document.createElement('label')
        labelEl.textContent = config.label || schemaEntry.label || paramName
        rowEl.appendChild(labelEl)

        const controlContainer = document.createElement('div')
        controlContainer.className = 'dialog-range-row'
        controlContainer.style.flex = '1'
        controlContainer.style.display = 'flex'
        controlContainer.style.alignItems = 'center'
        controlContainer.style.gap = '0.5rem'

        let inputEl
        let valueLabelEl

        const controlType = config.control || 
          (schemaEntry.type === 'enum' ? 'select' : schemaEntry.type === 'boolean' ? 'checkbox' : 'slider')

        if (controlType === 'select') {
          inputEl = document.createElement('select')
          inputEl.id = `input-${paramName}`
          inputEl.style.flex = '1'
          
          const options = config.values || schemaEntry.values || []
          for (const val of options) {
            const optEl = document.createElement('option')
            optEl.value = val
            optEl.textContent = val
            if (val === currentValue) {
              optEl.selected = true
            }
            inputEl.appendChild(optEl)
          }
        } else if (controlType === 'checkbox') {
          inputEl = document.createElement('input')
          inputEl.type = 'checkbox'
          inputEl.id = `input-${paramName}`
          inputEl.checked = Boolean(currentValue)
        } else {
          // slider or number
          inputEl = document.createElement('input')
          inputEl.id = `input-${paramName}`
          inputEl.type = controlType === 'slider' ? 'range' : 'number'
          inputEl.style.flex = '1'

          // Determine bounds and step
          const min = config.min !== undefined ? config.min : (schemaEntry.range ? schemaEntry.range[0] : 0)
          const max = config.max !== undefined ? config.max : (schemaEntry.range ? schemaEntry.range[1] : 100)
          const step = config.step !== undefined ? config.step : (schemaEntry.type === 'number' && schemaEntry.range ? (max - min) / 100 : 0.01)

          inputEl.min = min
          inputEl.max = max
          inputEl.step = step
          inputEl.value = currentValue

          if (controlType === 'slider') {
            valueLabelEl = document.createElement('span')
            valueLabelEl.className = 'slider-value'
            valueLabelEl.id = `value-display-${paramName}`
            valueLabelEl.style.minWidth = '2.5rem'
            valueLabelEl.style.textAlign = 'right'
            valueLabelEl.style.fontSize = '0.85rem'
            valueLabelEl.style.color = '#ccc'
            
            // Format readout based on step decimal places
            const decimalPlaces = step.toString().includes('.') ? step.toString().split('.')[1].length : 0
            valueLabelEl.textContent = Number(currentValue).toFixed(decimalPlaces)
          }
        }

        // Event listener to notify parent logic on change
        inputEl.addEventListener('input', () => {
          let value
          if (controlType === 'checkbox') {
            value = inputEl.checked
          } else if (schemaEntry.type === 'number') {
            value = parseFloat(inputEl.value)
            if (isNaN(value)) value = schemaEntry.default !== undefined ? schemaEntry.default : 0
          } else {
            value = inputEl.value
          }

          if (valueLabelEl) {
            const step = parseFloat(inputEl.step) || 0.01
            const decimalPlaces = step.toString().includes('.') ? step.toString().split('.')[1].length : 0
            valueLabelEl.textContent = Number(value).toFixed(decimalPlaces)
          }

          onChange(paramName, value)
        })

        controlContainer.appendChild(inputEl)
        if (valueLabelEl) {
          controlContainer.appendChild(valueLabelEl)
        }
        rowEl.appendChild(controlContainer)
        groupEl.appendChild(rowEl)
      }

      container.appendChild(groupEl)
    }
  }
}
