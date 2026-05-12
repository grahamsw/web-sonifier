# Implementation Plan: LiquidSonifier Physical Volume Parameter

## Phase 1: Verification & Testing
- [ ] Task: Create reproduction/baseline test for `LiquidSonifier`
    - [ ] Create `packages/liquid/test/LiquidSonifier.params.test.js`
    - [ ] Verify `volume` controls gain.
    - [ ] Verify `resonatorVolume` is currently missing from schema.
- [ ] Task: Write failing test for `resonatorVolume`
    - [ ] Add test case to check for `resonatorVolume` in `getParamSchema()`.
    - [ ] Add test case to verify `resonatorVolume` updates the AudioWorklet node.

## Phase 2: Implementation
- [ ] Task: Update `LiquidSonifier` Schema
    - [ ] Add `resonatorVolume` to `getParamSchema()` in `packages/liquid/src/LiquidSonifier.js`.
- [ ] Task: Update `LiquidSonifier` Parameter Mapping
    - [ ] Update `_updateNodes()` to pass the `resonatorVolume` value to the worklet's `volume` parameter instead of a hardcoded `1.0`.
- [ ] Task: Verify TDD Cycle
    - [ ] Run tests and ensure they pass.

## Phase 3: Finalization
- [ ] Task: Conductor - User Manual Verification 'Physical Volume Parameter' (Protocol in workflow.md)
