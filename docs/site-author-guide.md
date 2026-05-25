# Site Author Guide

This guide explains how to use the Web Sonifier library to add sound to your web application.

## 1. Setup

The library uses plain ES modules. You can use an import map to resolve package names if you aren't using a bundler:

```html
<script type="importmap">
{
  "imports": {
    "@web-sonifier/core": "./packages/core/src/index.js",
    "@web-sonifier/tone": "./packages/tone/src/ToneSonifier.js",
    "@web-sonifier/engine": "./packages/engine/src/EngineSonifier.js"
  }
}
</script>
<script type="module" src="main.js"></script>
```

## 2. Basic Usage

### Initialise the Runtime
Create the runtime at page load. Note that you must call `runtime.start()` inside a user gesture (like a click) to comply with browser autoplay policies.

```js
import { Runtime } from '@web-sonifier/core'
import { ToneSonifier } from '@web-sonifier/tone'

const runtime = new Runtime()
runtime.register('tone', ToneSonifier)

// Inside a "Play" button handler:
await runtime.start()
const tone = runtime.create('tone')
```

### Map Data to Parameters
Use the `Adapter` to map your data stream to sonifier parameters.

```js
import { Adapter } from '@web-sonifier/core'

const pitchAdapter = new Adapter({
  param:       'frequency',
  inputRange:  [85, 115],
  outputRange: [110, 440],
  curve:       'exponential'
})

// When new data arrives:
function onDataUpdate(rawValue) {
  tone.setParam('frequency', pitchAdapter.map(rawValue))
}
```

## 3. Advanced Features

### Auto-Ranging
If your data range is unknown or changes over time (e.g., stock prices over a week vs. an hour), use `autoRange`:

```js
const adapter = new Adapter({
  param: 'frequency',
  outputRange: [110, 440],
  autoRange: { windowSize: 50, padding: 0.05 }
})
```

### Multiple Instances
You can create multiple instances of the same sonifier by providing a unique `instanceId`:

```js
const priceTone = runtime.create('tone', 'price-stream')
const volumeTone = runtime.create('tone', 'volume-stream')
```

## 4. Teardown
Clean up instances or the entire runtime when they are no longer needed.

```js
runtime.destroy('price-stream')
await runtime.destroyAll() // Closes AudioContext
```

---

[Back to README](../README.md)
