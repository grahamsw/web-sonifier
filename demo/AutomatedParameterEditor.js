/**
 * AutomatedParameterEditor
 *
 * Automatically inspects any SonifierBase parameter schema and generates:
 * 1. Semantic visual groups (group headers)
 * 2. Discrete controls for integers, enums, and closed option lists (never sliders, not sonifiable)
 * 3. Boolean toggles
 * 4. Continuous controls (single slider when manual, or dual range slider + feed selector + invert toggle when sonified)
 */

import { Adapter } from '@web-sonifier/core'

export function isDiscreteParam(param) {
  return (
    param.type === 'enum' ||
    param.type === 'integer' ||
    Array.isArray(param.values) ||
    Array.isArray(param.options)
  )
}

export function isBooleanParam(param) {
  return param.type === 'boolean'
}

export function getOutputRangeBounds(schemaParam) {
  if (!schemaParam || !schemaParam.range) {
    return { min: 0, max: 1000, step: 1 }
  }
  const [sMin, sMax] = schemaParam.range
  const span = sMax - sMin
  const headTail = span * 0.25
  let trackMin = sMin >= 0 ? Math.max(0, sMin - headTail) : (sMin - headTail)
  let trackMax = sMax + headTail

  if ((schemaParam.name === 'frequency' || schemaParam.name === 'pitch') && sMin >= 20) {
    trackMin = Math.max(20, Math.floor(trackMin))
    trackMax = Math.max(2500, Math.ceil(trackMax / 100) * 100)
  } else if (sMax <= 1 && sMin >= 0) {
    trackMin = 0
    trackMax = 1.0
  } else if (trackMax >= 100) {
    trackMin = Math.floor(trackMin)
    trackMax = Math.ceil(trackMax / 10) * 10
  }

  let step = schemaParam.step
  if (!step) {
    const totalSpan = trackMax - trackMin
    if (totalSpan <= 1.5) step = 0.01
    else if (totalSpan <= 10) step = 0.1
    else if (totalSpan <= 100) step = 0.5
    else if (totalSpan <= 500) step = 1
    else step = 5
  }

  return { min: trackMin, max: trackMax, step }
}

export function formatRangeValue(val) {
  if (typeof val !== 'number' || isNaN(val)) return String(val)
  if (Number.isInteger(val)) return String(val)
  const absVal = Math.abs(val)
  if (absVal >= 100) return val.toFixed(0)
  if (absVal >= 10) return val.toFixed(1)
  return val.toFixed(2)
}

export function createDualRangeSlider(param, bounds, currentRange, onRangeChange) {
  const wrapper = document.createElement('div')
  wrapper.className = 'dual-range-wrapper'
  wrapper.id = `dual-slider-${param.name}`

  const track = document.createElement('div')
  track.className = 'dual-range-track'

  const progress = document.createElement('div')
  progress.className = 'dual-range-progress'
  progress.id = `progress-${param.name}`
  track.appendChild(progress)
  wrapper.appendChild(track)

  const sliderMin = document.createElement('input')
  sliderMin.type = 'range'
  sliderMin.className = 'dual-range-input slider-min'
  sliderMin.id = `range-slider-min-${param.name}`
  sliderMin.min = bounds.min
  sliderMin.max = bounds.max
  sliderMin.step = bounds.step
  sliderMin.value = currentRange[0]
  sliderMin.style.zIndex = '3'

  const sliderMax = document.createElement('input')
  sliderMax.type = 'range'
  sliderMax.className = 'dual-range-input slider-max'
  sliderMax.id = `range-slider-max-${param.name}`
  sliderMax.min = bounds.min
  sliderMax.max = bounds.max
  sliderMax.step = bounds.step
  sliderMax.value = currentRange[1]
  sliderMax.style.zIndex = '3'

  wrapper.appendChild(sliderMin)
  wrapper.appendChild(sliderMax)

  const boundsSpan = bounds.max - bounds.min

  const updateProgress = (minVal, maxVal) => {
    if (boundsSpan <= 0) return
    const leftPercent = Math.max(0, Math.min(100, ((minVal - bounds.min) / boundsSpan) * 100))
    const rightPercent = Math.max(0, Math.min(100, ((maxVal - bounds.min) / boundsSpan) * 100))
    progress.style.left = `${leftPercent}%`
    progress.style.width = `${Math.max(0, rightPercent - leftPercent)}%`
  }

  updateProgress(currentRange[0], currentRange[1])

  const handleInput = (source) => {
    let minVal = parseFloat(sliderMin.value)
    let maxVal = parseFloat(sliderMax.value)

    if (source === 'min') {
      if (minVal > maxVal) {
        minVal = maxVal
        sliderMin.value = minVal
      }
      sliderMin.style.zIndex = '4'
      sliderMax.style.zIndex = '3'
    } else {
      if (maxVal < minVal) {
        maxVal = minVal
        sliderMax.value = maxVal
      }
      sliderMax.style.zIndex = '4'
      sliderMin.style.zIndex = '3'
    }

    updateProgress(minVal, maxVal)
    onRangeChange([minVal, maxVal])
  }

  sliderMin.addEventListener('input', () => handleInput('min'))
  sliderMax.addEventListener('input', () => handleInput('max'))

  let isDraggingMiddle = false
  let dragStartX = 0
  let dragStartMin = 0
  let dragStartMax = 0
  let dragSpan = 0

  progress.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    if (e.button !== 0 && e.button !== undefined) return
    isDraggingMiddle = true
    dragStartX = e.clientX
    dragStartMin = parseFloat(sliderMin.value)
    dragStartMax = parseFloat(sliderMax.value)
    dragSpan = dragStartMax - dragStartMin

    if (typeof progress.setPointerCapture === 'function' && e.pointerId) {
      try {
        progress.setPointerCapture(e.pointerId)
      } catch {}
    }
  })

  progress.addEventListener('pointermove', (e) => {
    if (!isDraggingMiddle) return
    const rect = wrapper.getBoundingClientRect()
    const trackWidth = rect.width > 0 ? rect.width : 200
    const deltaX = e.clientX - dragStartX
    const deltaValue = (deltaX / trackWidth) * boundsSpan

    let newMin = dragStartMin + deltaValue
    let newMax = newMin + dragSpan

    if (newMin < bounds.min) {
      newMin = bounds.min
      newMax = newMin + dragSpan
    } else if (newMax > bounds.max) {
      newMax = bounds.max
      newMin = newMax - dragSpan
    }

    if (bounds.step) {
      newMin = Math.round((newMin - bounds.min) / bounds.step) * bounds.step + bounds.min
      newMax = newMin + dragSpan
    }

    sliderMin.value = newMin
    sliderMax.value = newMax
    updateProgress(newMin, newMax)
    onRangeChange([newMin, newMax])
  })

  const endDrag = (e) => {
    if (isDraggingMiddle) {
      isDraggingMiddle = false
      if (typeof progress.releasePointerCapture === 'function' && e && e.pointerId) {
        try {
          progress.releasePointerCapture(e.pointerId)
        } catch {}
      }
    }
  }

  progress.addEventListener('pointerup', endDrag)
  progress.addEventListener('pointercancel', endDrag)

  return wrapper
}

export function createSingleSlider(param, bounds, currentValue, onValueChange) {
  const wrapper = document.createElement('div')
  wrapper.className = 'single-slider-wrapper'
  wrapper.id = `single-control-${param.name}`

  const slider = document.createElement('input')
  slider.type = 'range'
  slider.id = `single-slider-${param.name}`
  slider.min = bounds.min
  slider.max = bounds.max
  slider.step = bounds.step
  slider.value = currentValue

  const numberInput = document.createElement('input')
  numberInput.type = 'number'
  numberInput.id = `single-input-${param.name}`
  numberInput.min = bounds.min
  numberInput.max = bounds.max
  numberInput.step = bounds.step
  numberInput.value = currentValue

  const update = (val) => {
    let num = parseFloat(val)
    if (isNaN(num)) return
    num = Math.max(bounds.min, Math.min(bounds.max, num))
    slider.value = num
    numberInput.value = num
    onValueChange(num)
  }

  slider.addEventListener('input', () => update(slider.value))
  numberInput.addEventListener('input', () => update(numberInput.value))

  wrapper.appendChild(slider)
  wrapper.appendChild(numberInput)
  return wrapper
}

export function createDiscreteParamCard(param, currentVal, onChange) {
  const card = document.createElement('div')
  card.className = 'param-card discrete-param-card'
  card.id = `param-card-${param.name}`

  const header = document.createElement('div')
  header.className = 'param-header'

  const titleGroup = document.createElement('div')
  titleGroup.className = 'param-title-group'

  const label = document.createElement('span')
  label.className = 'param-toggle-label'
  label.style.cursor = 'default'
  label.textContent = param.label || param.name

  if (param.unit) {
    const unitSpan = document.createElement('span')
    unitSpan.className = 'param-unit-tag'
    unitSpan.textContent = `(${param.unit})`
    label.appendChild(unitSpan)
  }

  titleGroup.appendChild(label)
  header.appendChild(titleGroup)
  card.appendChild(header)

  const enumRow = document.createElement('div')
  enumRow.className = 'enum-control-row'

  const select = document.createElement('select')
  select.id = `select-${param.name}`

  let optionList = []
  if (Array.isArray(param.options)) {
    optionList = param.options.map(opt => {
      if (typeof opt === 'object' && opt !== null && 'value' in opt) {
        return { value: opt.value, label: opt.label || String(opt.value) }
      }
      return { value: opt, label: String(opt) }
    })
  } else if (Array.isArray(param.values)) {
    optionList = param.values.map(val => ({ value: val, label: String(val) }))
  } else if (param.type === 'integer' && Array.isArray(param.range)) {
    const [min, max] = param.range
    const step = param.step || 1
    for (let i = min; i <= max; i += step) {
      optionList.push({ value: i, label: String(i) })
    }
  }

  for (const opt of optionList) {
    const optEl = document.createElement('option')
    optEl.value = opt.value
    optEl.textContent = opt.label
    if (String(currentVal) === String(opt.value)) {
      optEl.selected = true
    }
    select.appendChild(optEl)
  }

  select.addEventListener('change', () => {
    let raw = select.value
    let parsed = raw
    if (param.type === 'integer') {
      parsed = parseInt(raw, 10)
    } else if (typeof optionList[0]?.value === 'number') {
      parsed = Number(raw)
    }
    onChange(parsed)
  })

  enumRow.appendChild(select)
  card.appendChild(enumRow)

  if (param.description) {
    const descEl = document.createElement('div')
    descEl.className = 'discrete-desc'
    descEl.textContent = param.description
    card.appendChild(descEl)
  }

  return card
}

export function createBooleanParamCard(param, currentVal, onChange) {
  const card = document.createElement('div')
  card.className = 'param-card boolean-param-card'
  card.id = `param-card-${param.name}`

  const header = document.createElement('div')
  header.className = 'param-header'

  const label = document.createElement('label')
  label.className = 'param-toggle-label'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.id = `checkbox-${param.name}`
  checkbox.checked = Boolean(currentVal)

  const textSpan = document.createElement('span')
  textSpan.textContent = param.label || param.name

  checkbox.addEventListener('change', () => {
    onChange(checkbox.checked)
  })

  label.appendChild(checkbox)
  label.appendChild(textSpan)
  header.appendChild(label)
  card.appendChild(header)

  if (param.description) {
    const desc = document.createElement('div')
    desc.className = 'discrete-desc'
    desc.textContent = param.description
    card.appendChild(desc)
  }

  return card
}

export function createContinuousParamCard(param, bounds, s, sonifierType, feeds, callbacks) {
  const card = document.createElement('div')
  card.className = 'param-card continuous-param-card'
  card.id = `param-card-${param.name}`

  const isSonified = Array.isArray(s.sonifiedParams) && s.sonifiedParams.includes(param.name)
  if (isSonified) {
    card.classList.add('sonified')
  }

  const header = document.createElement('div')
  header.className = 'param-header'

  const titleGroup = document.createElement('div')
  titleGroup.className = 'param-title-group'

  const toggleLabel = document.createElement('label')
  toggleLabel.className = 'param-toggle-label'

  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.id = `checkbox-${param.name}`
  checkbox.checked = isSonified

  const labelSpan = document.createElement('span')
  labelSpan.textContent = param.label || param.name

  if (param.unit) {
    const unitSpan = document.createElement('span')
    unitSpan.className = 'param-unit-tag'
    unitSpan.textContent = `(${param.unit})`
    labelSpan.appendChild(unitSpan)
  }

  toggleLabel.appendChild(checkbox)
  toggleLabel.appendChild(labelSpan)
  titleGroup.appendChild(toggleLabel)

  const feedLinkContainer = document.createElement('div')
  feedLinkContainer.className = 'param-feed-link-container'
  titleGroup.appendChild(feedLinkContainer)

  header.appendChild(titleGroup)

  const readouts = document.createElement('div')
  readouts.className = 'param-readouts'
  header.appendChild(readouts)
  card.appendChild(header)

  const controlContainer = document.createElement('div')
  controlContainer.className = 'param-control-container'
  card.appendChild(controlContainer)

  const renderBody = (sonified) => {
    feedLinkContainer.innerHTML = ''
    readouts.innerHTML = ''
    controlContainer.innerHTML = ''

    if (sonified) {
      card.classList.add('sonified')

      if (!s.paramFeeds) s.paramFeeds = {}
      let linkedFeedId = s.paramFeeds[param.name]
      if (!linkedFeedId || !feeds.has(linkedFeedId)) {
        linkedFeedId = feeds.has('A') ? 'A' : (Array.from(feeds.keys())[0] || 'A')
        s.paramFeeds[param.name] = linkedFeedId
      }

      if (!s.paramInverts) s.paramInverts = {}
      if (s.paramInverts[param.name] === undefined && param.invert !== undefined) {
        s.paramInverts[param.name] = Boolean(param.invert)
      }
      let isInverted = Boolean(s.paramInverts[param.name])

      const linkedFeed = feeds.get(linkedFeedId)
      const currentFeedVal = linkedFeed ? linkedFeed.value : 50

      // Feed link selector
      const feedLinkWrap = document.createElement('div')
      feedLinkWrap.className = 'param-feed-link'
      const feedSelect = document.createElement('select')
      feedSelect.id = `param-feed-select-${param.name}`
      for (const feed of feeds.values()) {
        const opt = document.createElement('option')
        opt.value = feed.id
        opt.textContent = `Feed ${feed.id}`
        if (feed.id === linkedFeedId) opt.selected = true
        feedSelect.appendChild(opt)
      }

      feedSelect.addEventListener('change', () => {
        const newFeedId = feedSelect.value
        s.paramFeeds[param.name] = newFeedId
        callbacks.onFeedLinkChange(param.name, newFeedId)

        const badge = document.getElementById(`feed-badge-${param.name}`)
        if (badge) {
          badge.className = `param-feed-badge feed-theme-${newFeedId}`
          const lSpan = badge.querySelector('.feed-label')
          if (lSpan) lSpan.textContent = `${newFeedId}:`
        }
      })
      feedLinkWrap.appendChild(feedSelect)

      // Invert button
      const btnInvert = document.createElement('button')
      btnInvert.type = 'button'
      btnInvert.className = `btn-invert${isInverted ? ' inverted' : ''}`
      btnInvert.id = `btn-invert-${param.name}`
      btnInvert.textContent = '⇄'
      btnInvert.title = 'Invert mapping polarity (higher data = lower parameter)'
      feedLinkWrap.appendChild(btnInvert)

      // Curve selector dropdown beside invert button
      const curveSelect = document.createElement('select')
      curveSelect.className = 'param-curve-select'
      curveSelect.id = `curve-select-${param.name}`
      curveSelect.title = 'Mapping transfer curve'

      const CURVE_OPTIONS = [
        { value: 'linear', label: 'Linear' },
        { value: 'exponential', label: 'Exponential' },
        { value: 'logarithmic', label: 'Logarithmic' }
      ]

      if (!s.paramCurves) s.paramCurves = {}
      const currentCurve = s.paramCurves[param.name] || param.curve || 'linear'
      s.paramCurves[param.name] = currentCurve

      for (const opt of CURVE_OPTIONS) {
        const optEl = document.createElement('option')
        optEl.value = opt.value
        optEl.textContent = opt.label
        if (opt.value === currentCurve) optEl.selected = true
        curveSelect.appendChild(optEl)
      }
      feedLinkWrap.appendChild(curveSelect)
      feedLinkContainer.appendChild(feedLinkWrap)

      // Feed readout badge
      const feedBadge = document.createElement('div')
      feedBadge.className = `param-feed-badge feed-theme-${linkedFeedId}`
      feedBadge.id = `feed-badge-${param.name}`
      feedBadge.innerHTML = `<span class="feed-label">${linkedFeedId}:</span><span class="feed-val" id="feed-val-${param.name}">${currentFeedVal.toFixed(1)}</span>`
      readouts.appendChild(feedBadge)

      // Output Range
      if (!s.paramRanges) s.paramRanges = {}
      if (!s.paramRanges[param.name]) {
        s.paramRanges[param.name] = [param.range ? param.range[0] : bounds.min, param.range ? param.range[1] : bounds.max]
      }
      const [curMin, curMax] = s.paramRanges[param.name]

      const adapter = new Adapter({
        param: param.name,
        inputRange: [0, 100],
        outputRange: [curMin, curMax],
        curve: currentCurve,
        invert: isInverted
      })

      btnInvert.addEventListener('click', () => {
        isInverted = !isInverted
        s.paramInverts[param.name] = isInverted
        btnInvert.classList.toggle('inverted', isInverted)
        adapter.setConfig({ invert: isInverted })
        callbacks.onInvertToggle(param.name, isInverted)
        updateRangeReadout()
        const curFeed = feeds.get(s.paramFeeds[param.name] || 'A')
        const curVal = curFeed ? curFeed.value : 50
        const newMapped = adapter.map(curVal)
        const mappedEl = document.getElementById(`mapped-val-${param.name}`)
        if (mappedEl) {
          mappedEl.textContent = `${formatRangeValue(newMapped)}${param.unit ? ' ' + param.unit : ''}`
        }
      })

      curveSelect.addEventListener('change', () => {
        const newCurve = curveSelect.value
        s.paramCurves[param.name] = newCurve
        adapter.setConfig({ curve: newCurve })
        if (callbacks.onCurveChange) {
          callbacks.onCurveChange(param.name, newCurve)
        }
        const curFeed = feeds.get(s.paramFeeds[param.name] || 'A')
        const curVal = curFeed ? curFeed.value : 50
        const newMapped = adapter.map(curVal)
        const mappedEl = document.getElementById(`mapped-val-${param.name}`)
        if (mappedEl) {
          mappedEl.textContent = `${formatRangeValue(newMapped)}${param.unit ? ' ' + param.unit : ''}`
        }
      })

      const mappedVal = adapter.map(currentFeedVal)

      // Mapped readout badge
      const mappedBadge = document.createElement('div')
      mappedBadge.className = 'param-mapped-badge'
      mappedBadge.id = `mapped-badge-${param.name}`
      mappedBadge.innerHTML = `<span class="mapped-label">Mapped:</span><span class="mapped-val" id="mapped-val-${param.name}">${formatRangeValue(mappedVal)}${param.unit ? ' ' + param.unit : ''}</span>`
      readouts.appendChild(mappedBadge)

      // Range readout badge
      const rangeBadge = document.createElement('div')
      rangeBadge.className = 'param-range-badge badge-range'
      rangeBadge.id = `range-badge-${param.name}`

      const updateRangeReadout = () => {
        const [rMin, rMax] = s.paramRanges[param.name]
        const inv = s.paramInverts?.[param.name]
        if (inv) {
          rangeBadge.textContent = `${formatRangeValue(rMax)} ➔ ${formatRangeValue(rMin)}`
        } else {
          rangeBadge.textContent = `${formatRangeValue(rMin)} – ${formatRangeValue(rMax)}`
        }
      }
      updateRangeReadout()
      readouts.appendChild(rangeBadge)

      // Dual range slider
      const dualSlider = createDualRangeSlider(param, bounds, [curMin, curMax], (newRange) => {
        s.paramRanges[param.name] = newRange
        updateRangeReadout()
        callbacks.onRangeChange(param.name, newRange)
      })
      controlContainer.appendChild(dualSlider)

    } else {
      card.classList.remove('sonified')
      const currentVal = s[param.name] !== undefined ? s[param.name] : (param.default !== undefined ? param.default : bounds.min)
      s[param.name] = currentVal

      const valueBadge = document.createElement('div')
      valueBadge.className = 'badge-static'
      valueBadge.id = `value-badge-${param.name}`
      valueBadge.textContent = `${formatRangeValue(currentVal)}${param.unit ? ' ' + param.unit : ''}`
      readouts.appendChild(valueBadge)

      const singleSlider = createSingleSlider(param, bounds, currentVal, (newVal) => {
        s[param.name] = newVal
        valueBadge.textContent = `${formatRangeValue(newVal)}${param.unit ? ' ' + param.unit : ''}`
        callbacks.onParamChange(param.name, newVal)
      })
      controlContainer.appendChild(singleSlider)
    }
  }

  renderBody(checkbox.checked)

  checkbox.addEventListener('change', () => {
    const checked = checkbox.checked
    if (!Array.isArray(s.sonifiedParams)) s.sonifiedParams = []
    if (checked) {
      if (!s.sonifiedParams.includes(param.name)) {
        s.sonifiedParams.push(param.name)
      }
    } else {
      s.sonifiedParams = s.sonifiedParams.filter(p => p !== param.name)
    }
    renderBody(checked)
    callbacks.onSonifyToggle(param.name, checked)
  })

  return card
}

export function renderAutomatedEditor({ container, schema, settings, sonifierType, feeds, callbacks }) {
  if (!container) return
  container.innerHTML = ''

  if (!schema || schema.length === 0) {
    container.innerHTML = '<div style="color: #777; font-size: 0.85rem; padding: 1rem; text-align: center;">No parameters available for this sonifier.</div>'
    return
  }

  const s = settings[sonifierType] || {}
  if (!s.paramRanges) s.paramRanges = {}
  if (!s.paramFeeds) s.paramFeeds = {}
  if (!s.paramInverts) s.paramInverts = {}
  if (!Array.isArray(s.sonifiedParams)) s.sonifiedParams = []

  // Group parameters by param.group
  const groupsMap = new Map()
  for (const param of schema) {
    const groupName = param.group || 'General'
    if (!groupsMap.has(groupName)) {
      groupsMap.set(groupName, [])
    }
    groupsMap.get(groupName).push(param)
  }

  const showGroupHeaders = groupsMap.size > 1

  for (const [groupName, paramList] of groupsMap.entries()) {
    const groupEl = document.createElement('div')
    groupEl.className = 'param-group'

    if (showGroupHeaders) {
      const groupHeader = document.createElement('div')
      groupHeader.className = 'param-group-header'
      groupHeader.textContent = groupName
      groupEl.appendChild(groupHeader)
    }

    for (const param of paramList) {
      let cardEl
      if (isDiscreteParam(param)) {
        const curVal = s[param.name] !== undefined ? s[param.name] : param.default
        s[param.name] = curVal
        cardEl = createDiscreteParamCard(param, curVal, (newVal) => {
          s[param.name] = newVal
          callbacks.onParamChange(param.name, newVal)
        })
      } else if (isBooleanParam(param)) {
        const curVal = s[param.name] !== undefined ? s[param.name] : param.default
        s[param.name] = curVal
        cardEl = createBooleanParamCard(param, curVal, (newVal) => {
          s[param.name] = newVal
          callbacks.onParamChange(param.name, newVal)
        })
      } else {
        const bounds = getOutputRangeBounds(param)
        cardEl = createContinuousParamCard(param, bounds, s, sonifierType, feeds, callbacks)
      }
      groupEl.appendChild(cardEl)
    }

    container.appendChild(groupEl)
  }
}
