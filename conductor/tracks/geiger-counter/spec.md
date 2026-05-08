# Specification: Geiger Counter Sonifier

## Objective
Create a new sonifier plugin, `GeigerSonifier`, that simulates a Geiger counter. It will emit random "clicks" where the frequency of clicks is driven by a data-mapped parameter.

## Requirements
1. **New Package:** Create a new workspace package `@web-sonify/geiger` (e.g., `packages/geiger`).
2. **Vanilla Web Audio API:** Do not use Tone.js or any external audio libraries. Rely entirely on the native Web Audio API.
3. **Synthesis:** The "click" sound should be generated programmatically during initialization (e.g., a short burst of white noise or an impulse response stored in an `AudioBuffer`), removing the need for external asset loading.
4. **Parameters:**
   - `rate`: A numeric parameter dictating the average number of clicks per second.
   - `volume`: Standard volume control (0 to 1).
5. **Scheduling:** Implement a lookahead scheduling loop (using `setTimeout` and `AudioContext.currentTime`) to schedule clicks with randomized intervals based on the current `rate`.

## Architecture
- `GeigerSonifier` extends `SonifierBase` from `@web-sonify/core`.
- Lives in `packages/geiger/src/GeigerSonifier.js`.
- Exports via `packages/geiger/src/index.js` and `packages/geiger/package.json`.