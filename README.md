# web-sonify

A browser-native sonification framework. Makes it easy to turn a stream of data into sound on a web page, without requiring the site author to understand Web Audio.

Sonification is underused as a monitoring and data-presentation tool. This library aims to lower the barrier for site authors and make it possible for sonifier authors to contribute high-quality plugins.

---

## Core idea

Three concerns are kept strictly separate:

1. **Data plumbing** — the site author's responsibility. They decide when and how to push data values into the system.
2. **Mapping** — the `Adapter` class translates raw data values (e.g. a price) into a value the sonifier understands (e.g. a frequency in Hz).
3. **Sound synthesis** — the sonifier plugin. Receives clean, ready-to-use parameter values and produces sound. Knows nothing about data sources or mapping.

The site author wires these together. The sonifier plugin is a black box that just responds to `setParam()`.

---

## Demo

The repository includes a simple vanilla JS demo in the `demo/` folder.

You can serve this locally using any static web server (e.g. `npx serve demo`).

**Deploying to Firebase:**
This repository is pre-configured for Firebase Hosting. To deploy the demo:
1. Make sure you have the Firebase CLI installed (`npm install -g firebase-tools`).
2. Log in using `firebase login`.
3. Run `firebase deploy --only hosting`.

---

## Architecture

### `Runtime` (`@web-sonify/core`)

The top-level object. One per page. Manages:
- The `AudioContext` and a master gain node (all sonifiers route through this)
- A plugin registry (name → class)
- Sonifier instance lifecycle (create, destroy)
- Master volume

`runtime.start()` must be called from a user gesture (browser autoplay policy). It is safe to call multiple times.

All sonifiers connect their output to the master gain node, which connects to `audioContext.destination`. This gives master volume control over everything for free.

### `SonifierBase` (`@web-sonify/core`)

Base class for all plugins. Plugin authors extend this and implement four methods:

| Method | Responsibility |
|---|---|
| `getParamSchema()` | Declare parameters (name, type, range, default, group, label, description) |
| `init(audioContext, outputNode)` | Build the Web Audio graph, connect to `outputNode` |
| `onParam(name, value)` | Respond to a validated, cooked parameter value |
| `destroy()` | Stop and disconnect all audio nodes |

The base class owns `setParam(name, value)` — plugin authors must **not** override it. It validates the value against the schema, stores it, then calls `onParam()`. This means `onParam()` always receives a clean, in-range value.

`applyDefaults()` is called automatically by `Runtime.create()` after `init()`, so the audio graph is always fully initialised before any values flow through it.

### `Adapter` (`@web-sonify/core`)

A stateful mapping function. Knows nothing about sonifiers. The site author creates one per data stream → parameter mapping.

```js
const pitchAdapter = new Adapter({
  param:       'frequency',
  inputRange:  [85, 115],     // raw data range
  outputRange: [110, 440],    // sonifier param range
  curve:       'exponential'  // 'linear' | 'exponential' | 'logarithmic'
})

tone.setParam('frequency', pitchAdapter.map(currentPrice))
```

The adapter can also auto-range — deriving the input range dynamically from a rolling window of recent values:

```js
const pitchAdapter = new Adapter({
  param:       'frequency',
  outputRange: [110, 440],
  curve:       'exponential',
  autoRange:   { windowSize: 50, padding: 0.05 }
})
```

(Auto range adjustment is needed when the range of data values varies over time and sticking to the same mapping would result in out of range values. For example, traffic may vary between 0 and 100 at 1AM on Sunday, but between 5000 and 10000 at noon on Monday. If the useful parameter range is between 50 and 500 one mapping may not cover both ranges.)

`adapter.seed(values[])` primes the window with historical data before the live feed starts.

`adapter.map(value)` is the only method the site author calls day-to-day. It updates the rolling window as a side effect if autoRange is enabled.

The mapping pipeline inside `map()` is: normalise to 0..1 → apply curve → scale to outputRange. Out-of-range input values are clamped, not extrapolated.

---

## Parameter schema

Each entry in `getParamSchema()` is an object:

```js
{
  name:        'frequency',   // required — used as the key in setParam()
  type:        'number',      // required — 'number' | 'enum' | 'boolean'
  range:       [20, 2000],    // numbers only — [min, max], used for validation & clamping
  values:      [...],         // enums only — list of valid string values
  default:     220,           // applied automatically by applyDefaults()
  group:       'tone',        // optional — for grouping params in a settings UI
  label:       'Frequency',   // optional — human-readable name for UI display
  description: '...'          // optional — tooltip text
}
```

`volume` is a conventional parameter name that all sonifiers should include as a `number` in `[0, 1]`. It controls the gain of that individual sonifier, independent of master volume. There is no special treatment of `volume` in the core — it is just another param. Not strictly necessary, but it allows site authors to use more than one sonifier.

---

## Two kinds of param setting

```js
// Via adapter — for data streams. Raw value goes through mapping pipeline.
tone.setParam('frequency', pitchAdapter.map(rawValue))

// Direct — for UI controls. Value goes straight to onParam() after validation.
tone.setParam('volume', 0.7)
```

The site author decides which to use. The sonifier never knows the difference.

---

## Plugin authoring

A minimal plugin:

```js
import { SonifierBase } from '@web-sonify/core'

export class MySonifier extends SonifierBase {

  getParamSchema() {
    return [
      { name: 'frequency', type: 'number', range: [20, 2000], default: 220,
        group: 'tone', label: 'Frequency' },
      { name: 'volume', type: 'number', range: [0, 1], default: 0.5,
        group: 'tone', label: 'Volume' }
    ]
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._gain = audioContext.createGain()
    this._osc  = audioContext.createOscillator()
    this._osc.connect(this._gain)
    this._gain.connect(outputNode)
    this._osc.start()
  }

  onParam(name, value) {
    if (!this._osc) return
    switch (name) {
      case 'frequency':
        this._osc.frequency.setTargetAtTime(value, this._ctx.currentTime, 0.01)
        break
      case 'volume':
        this._gain.gain.setTargetAtTime(value, this._ctx.currentTime, 0.01)
        break
    }
  }

  destroy() {
    this._osc.stop()
    this._osc.disconnect()
    this._gain.disconnect()
    this._osc = null
    this._gain = null
  }
}
```

Use `setTargetAtTime` rather than direct assignment for continuous parameters (frequency, gain) to avoid audible clicks on value changes.

---

## Site author usage

```js
import { Runtime, Adapter } from '@web-sonify/core'
import { ToneSonifier }     from '@web-sonify/tone'

// 1. Create runtime (before user gesture)
const runtime = new Runtime()
runtime.register('tone', ToneSonifier)

// 2. On user gesture (Play button etc.)
runtime.start()
const tone = runtime.create('tone')

// 3. Create adapter(s)
const pitchAdapter = new Adapter({
  param:       'frequency',
  inputRange:  [85, 115],
  outputRange: [110, 440],
  curve:       'exponential'
})

// 4. On data arrival (site author's responsibility)
function onDataUpdate(rawValue) {
  tone.setParam('frequency', pitchAdapter.map(rawValue))
}

// 5. UI controls
masterVolumeSlider.addEventListener('input', e => {
  runtime.setMasterVolume(e.target.value)
})

// 6. Teardown
runtime.destroy('tone')         // destroy one instance
await runtime.destroyAll()      // destroy everything, close AudioContext
```

### Multiple sonifiers simultaneously

```js
const tone1 = runtime.create('tone', 'price')
const tone2 = runtime.create('tone', 'volatility')
// instanceId (second arg) distinguishes them in the runtime's registry
```

### Using without a bundler

The library uses plain ES modules. In a vanilla HTML page, use an import map to resolve package names:

```html
<script type="importmap">
{
  "imports": {
    "@web-sonify/core": "./packages/core/src/index.js",
    "@web-sonify/tone": "./packages/tone/src/ToneSonifier.js"
  }
}
</script>
<script type="module" src="main.js"></script>
```

---

## Project structure

```
web-sonify/
├── packages/
│   ├── core/                    # Runtime, SonifierBase, Adapter
│   │   ├── src/
│   │   │   ├── Runtime.js
│   │   │   ├── SonifierBase.js
│   │   │   ├── Adapter.js
│   │   │   └── index.js
│   │   └── package.json         # name: @web-sonify/core
│   │
│   └── tone/                    # First plugin — continuous tone
│       ├── src/
│       │   └── ToneSonifier.js
│       └── package.json         # name: @web-sonify/tone
│
├── demo/
│   ├── index.html               # Vanilla HTML, no bundler
│   └── main.js                  # Mocked price feed + settings dialog
│
└── package.json                 # npm workspaces root
```

### Running the demo

```bash
cd web-sonify
python3 -m http.server 8000
# open http://localhost:8000/demo
```

No build step. No npm install. The demo is plain ES modules served statically.

---

## What exists vs what is still to do

### Done
- `Runtime` — AudioContext, master gain, registry, lifecycle
- `SonifierBase` — plugin interface, validation, clamping, defaults
- `Adapter` — fixed range, auto-range (rolling window), curves (linear/exponential/logarithmic)
- `ToneSonifier` — oscillator with frequency, volume, waveform params
- Demo page — mocked feed, adapter, settings dialog, localStorage persistence

### Not yet done (roughly in priority order)

**Core**
- TypeScript definitions (`.d.ts`) — the JS is the source of truth; types sit on top
- `Adapter` curve refinement — the exponential curve (`t²`) is a placeholder; true perceptual frequency mapping should use `outputMin * (outputMax/outputMin) ** t`
- `Adapter` smoothing — optionally smooth rapid value changes before they reach the sonifier, to avoid jittery sound
- Settings serialisation helpers — utilities for save/restore of full sonifier + adapter config to localStorage or a server

**Plugins**
- `PulseSonifier` — geiger-counter style discrete pulses whose rate changes with data. Complements `ToneSonifier` for discrete/alarm-style sonification.
- Plugin metadata — a `getMeta()` method returning name, description, author, version for display in a plugin picker UI

**UI helpers**
- Auto-generated settings dialog — given `getParamSchema()` and an `Adapter` config, generate a settings form automatically. The demo hand-builds this; it should be a utility.
- Volume widget — a reusable component for master volume + per-sonifier volume

**Ecosystem**
- Plugin authoring guide
- npm publish workflow for `@web-sonify/core` and plugin packages
- CDN / unpkg usage example

---

## Key design decisions (and why)

**Why is the plugin a base class rather than an interface?** JavaScript has no interfaces. A base class gives runtime enforcement (unimplemented methods throw), a place for shared logic (validation, defaults), and works in plain JS. TypeScript definitions can be layered on top later.

**Why does `setParam` live on the base class and `onParam` on the subclass?** The base class needs to own validation and storage. The subclass should never bypass this. This is the JavaScript equivalent of a C++ pure virtual method behind a non-virtual public method.

**Why does `Adapter` not know about the sonifier?** Mapping is infrastructure. A sonifier should only ever receive clean, in-range values — it shouldn't need to know whether those came from a live data feed, a UI slider, or a test harness. Keeping them separate also means an `Adapter` can be reused, tested, and reasoned about independently.

**Why is master volume on the `Runtime` and not a param on each sonifier?** Both exist. The runtime's master gain node sits downstream of all sonifiers and provides a single fader that affects everything. Each sonifier also has its own `volume` param for controlling relative levels between sonifiers. Standard mixer topology.

**Why does `runtime.start()` exist separately from `new Runtime()`?** The Web Audio `AudioContext` must be created from a user gesture or browsers will block/warn. Separating construction from start means the site author can set up the runtime at page load and call `start()` safely inside a button handler.

**Why is `instanceId` separate from the plugin type name in `runtime.create()`?** To allow multiple instances of the same plugin type (e.g. two `ToneSonifier` instances sonifying different data streams simultaneously).
