# Specification - Fix PurrSonifier Startup Noise

## Overview
The `PurrSonifier` and `LiquidSonifier` produce a loud burst or "pop" when first initialized. This is due to internal `_updateNodes()` calls using default fallbacks (e.g., 0.5 volume) before the `Runtime` has a chance to smoothly ramp up parameters via `applyDefaults()`.

## Functional Requirements
- Change the fallback for `volume` in `_updateNodes()` to `0` for both `PurrSonifier` and `LiquidSonifier`.
- Change the fallback for `intensity` in `PurrSonifier._updateNodes()` to `0`.
- Explicitly initialize all internal gain nodes to `0` in `PurrSonifier.init()`.

## Acceptance Criteria
- No loud noise or "pop" when starting the Purr or Liquid sonifiers in the demo.
- Sonifiers still ramp up to their intended default volumes after initialization.
