# Specification - Expose Additional Sonifier Parameters

## Problem
The current sonifiers have internal parameters that are either not exposed in their schema (Purr) or exposed in the schema but not present in the demo UI (Liquid, Mallet). This limits the expressiveness of the sonifiers for users.

## Requirements
- **LiquidSonifier**:
  - Ensure `viscosity` is available in the UI.
- **PurrSonifier**:
  - Add `jitter`, `rumble`, and `breath` to `getParamSchema()`.
  - Update `_updateNodes()` to use these new parameters instead of deriving them solely from `arousal` and `intensity`.
  - Add these controls to the UI.
- **MalletSonifier**:
  - Add `hardness`, `boxSize` (labeled "Size"), `resonance`, and `force` controls to the UI.
- **General**:
  - The demo UI configuration dialog should be updated to include these new parameters.
  - Parameters should be persistent in `localStorage`.

## Success Criteria
- [ ] `LiquidSonifier` viscosity can be adjusted in the demo UI.
- [ ] `PurrSonifier` jitter, rumble, and breath can be adjusted in the demo UI.
- [ ] `MalletSonifier` hardness, size, resonance, and force can be adjusted in the demo UI.
- [ ] Changes are reflected in the audio output immediately (or upon saving).
- [ ] Settings persist across page reloads.
