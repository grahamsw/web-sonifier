# Implementation Plan - UI and Sonifier Configuration Improvements

## Phase 1: Real-time Settings Updates
- [x] Task: Update the Settings dialog to apply parameter changes immediately to the active sonifier [be1bf1a]
    - [x] Write Tests (Red Phase) [be1bf1a]
    - [x] Implement live update logic in `demo/main.js` (Green Phase) [be1bf1a]
    - [x] Verify smooth parameter transitions [be1bf1a]
- [x] Task: Ensure all changes are persisted to `localStorage` on every change [be1bf1a]
    - [x] Write Tests (Red Phase) [be1bf1a]
    - [x] Update `saveSettings` logic in `demo/main.js` (Green Phase) [be1bf1a]
- [x] Task: Implement 'Revert on Cancel' logic [91f4f5a]
    - [x] Create settings backup on dialog open [91f4f5a]
    - [x] Restore backup and update audio on 'Cancel' [91f4f5a]
- [x] Task: Conductor - User Manual Verification 'Real-time Settings Updates' (Protocol in workflow.md) [91f4f5a]

## Phase 2: Independent Sonifier Settings & Hot-Switching
- [x] Task: Refactor `demo/main.js` to enable \"Settings\" button even when not playing [91f4f5a]
- [x] Task: Implement seamless hot-switching in the sonifier dropdown [91f4f5a]
    - [x] Write Tests (Red Phase) [91f4f5a]
    - [x] Update `sonifierSelectEl` event listener to stop current and start new with its own settings (Green Phase) [91f4f5a]
    - [x] Ensure `applySettings` loads the correct configuration for the target sonifier type [91f4f5a]
- [ ] Task: Conductor - User Manual Verification 'Independent Sonifier Settings & Hot-Switching' (Protocol in workflow.md)

## Phase 3: Full Parameter Exposure
- [ ] Task: Dynamically generate UI controls for ALL parameters in the sonifier's schema
    - [ ] Write Tests (Red Phase)
    - [ ] Implement dynamic control generation in `demo/main.js` (Green Phase)
    - [ ] Update Settings dialog to show/hide relevant controls based on selected sonifier
- [ ] Task: Conductor - User Manual Verification 'Full Parameter Exposure' (Protocol in workflow.md)

## Phase 4: Final Validation & Cleanup
- [ ] Task: Verify all acceptance criteria from `spec.md`
- [ ] Task: Run full test suite and check code coverage
- [ ] Task: Conductor - User Manual Verification 'Final Validation & Cleanup' (Protocol in workflow.md)
