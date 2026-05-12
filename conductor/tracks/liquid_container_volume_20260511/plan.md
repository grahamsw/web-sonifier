# Implementation Plan: LiquidSonifier Physical Volume Parameter

## Phase 1: Verification & Testing
- [x] Task: Create reproduction/baseline test for `LiquidSonifier`
    - [x] Create `packages/liquid/test/LiquidSonifier.params.test.js`
    - [x] Verify `volume` controls gain.
    - [x] Verify `resonatorVolume` is currently missing from schema.
- [x] Task: Write failing test for `resonatorVolume`
    - [x] Add test case to check for `resonatorVolume` in `getParamSchema()`.
    - [x] Add test case to verify `resonatorVolume` updates the AudioWorklet node.

## Phase 2: Implementation
- [x] Task: Update `LiquidSonifier` Schema [412f8cb]
    - [x] Add `resonatorVolume` to `getParamSchema()` in `packages/liquid/src/LiquidSonifier.js`.
- [x] Task: Update `LiquidSonifier` Parameter Mapping [412f8cb]
    - [x] Update `_updateNodes()` to pass the `resonatorVolume` value to the worklet's `volume` parameter instead of a hardcoded `1.0`.
- [x] Task: Verify TDD Cycle [412f8cb]
    - [x] Run tests and ensure they pass.


## Phase 3: Finalization [checkpoint: 3812921]
- [x] Task: Conductor - User Manual Verification 'Physical Volume Parameter' (Protocol in workflow.md) [3812921]

## Phase 4: Review Fixes
- [x] Task: Apply review suggestions f3303f0
