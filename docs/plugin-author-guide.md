# Plugin Author Guide

This guide is for developers who want to create new sonification plugins.

## The `SonifierBase` Interface

All plugins must extend `SonifierBase` and implement four key methods:

| Method | Responsibility |
|---|---|
| `getParamSchema()` | Declare parameters (name, type, range, default, labels). |
| `init(ctx, output)` | Build the Web Audio graph and connect it to the provided `output` node. |
| `onParam(name, value)`| Respond to a validated parameter change. |
| `destroy()` | Clean up resources, stop oscillators, and disconnect nodes. |

## Implementation Example

```js
import { SonifierBase } from '@web-sonify/core'

export class MySonifier extends SonifierBase {
  getParamSchema() {
    return [
      { name: 'frequency', type: 'number', range: [20, 2000], default: 440 },
      { name: 'volume', type: 'number', range: [0, 1], default: 0.5 }
    ]
  }

  init(audioContext, outputNode) {
    this._ctx = audioContext
    this._gain = audioContext.createGain()
    this._osc = audioContext.createOscillator()
    this._osc.connect(this._gain)
    this._gain.connect(outputNode)
    this._osc.start()
  }

  onParam(name, value) {
    const now = this._ctx.currentTime
    if (name === 'frequency') {
      this._osc.frequency.setTargetAtTime(value, now, 0.05)
    } else if (name === 'volume') {
      this._gain.gain.setTargetAtTime(value, now, 0.05)
    }
  }

  destroy() {
    // Teardown logic
    this._osc.stop()
    this._osc.disconnect()
    this._gain.disconnect()
  }
}
```

## Best Practices

### 1. Parameter Smoothing
Always use Web Audio automation (e.g., `setTargetAtTime` or `linearRampToValueAtTime`) in `onParam`. Direct assignment causes audible "zipper noise" or clicks. A ramp time of 20–50ms is usually ideal.

### 2. Teardown Integrity
Avoid loud pops when a sonifier is destroyed. If possible, ramp the gain to zero before stopping oscillators or disconnecting nodes in the `destroy()` method.

### 3. Audio Graph Ownership
The `Runtime` provides the `outputNode`. Your plugin is responsible for everything "upstream" of that node. Do not connect your internal nodes directly to `audioContext.destination`.

---

[Back to README](../README.md)
