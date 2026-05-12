# API Reference

## `@web-sonify/core`

### `Runtime`
- `start()`: Initialises the AudioContext (must be from user gesture).
- `register(name, class)`: Registers a plugin.
- `create(name, instanceId?)`: Instantiates a sonifier.
- `destroy(instanceId)`: Tears down an instance.
- `setMasterVolume(0..1)`: Sets global gain.

### `Adapter`
- `constructor(config)`:
  - `param`: Parameter name.
  - `outputRange`: `[min, max]`.
  - `inputRange?`: Fixed range.
  - `autoRange?`: `{ windowSize, padding }`.
  - `curve?`: `'linear' | 'exponential' | 'logarithmic'`.
- `map(value)`: Returns mapped value and updates window.
- `seed(values[])`: Primes the auto-range window.

### `SonifierBase`
- `setParam(name, value)`: Validates and stores the value, then calls `onParam`.
- `getParam(name)`: Retrieves the current stored value.

## Included Sonifiers

### `LiquidSonifier` (`@web-sonify/liquid`)
A physical modeling liquid resonator.
- **Parameters**:
  - `frequency`: Excitation frequency (10-100).
  - `viscosity`: Thickness of the liquid (0-1).
  - `resonatorVolume`: Physical size of the container (0-1).
  - `volume`: Output amplitude/gain (0-1).

## Parameter Schema Object
```js
{
  name: string,      // Key for setParam()
  type: 'number' | 'enum' | 'boolean',
  range?: [min, max], // For numbers
  values?: string[],  // For enums
  default: any,
  label?: string,
  description?: string
}
```

---

[Back to README](../README.md)
