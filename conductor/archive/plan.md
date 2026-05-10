# Implementation Plan - Expose Additional Sonifier Parameters

## Phase 1: Sonifier Schema Updates
- [x] Update `PurrSonifier.js` to include `jitter`, `rumble`, and `breath` in `getParamSchema()`.
- [x] Update `PurrSonifier.js` `_updateNodes()` to use these parameters.

## Phase 2: Demo UI Updates (HTML)
- [x] Add input fields for the new parameters in `demo/index.html`.
- [x] Use conditional display (like `row-waveform`) for sonifier-specific parameters.

## Phase 3: Demo UI Updates (JS)
- [x] Update `defaultSettings` in `demo/main.js` to include new parameters.
- [x] Update `loadSettings` to handle migration/defaults for new parameters.
- [x] Update `applySettings` to push new parameters to active sonifiers.
- [x] Update the settings dialog open logic (in `btnSettings` listener) to show/hide relevant rows and populate values.
- [x] Update the "Save" logic to read values from the new fields.

## Phase 4: Validation
- [x] Verify audio behavior changes when parameters are adjusted.
- [x] Verify persistence.
- [x] Run existing tests to ensure no regressions.
