# Specification: Drone Sonifier

## Overview
Implement a new sonifier package `packages/drone-sonifier` that replicates a specific SuperCollider drone synth using the Web Audio API's `AudioWorklet`.

## Functional Requirements
- **New Package:** Create `packages/drone-sonifier` as an npm workspace.
- **AudioWorklet Processor:** Implement `DroneResonatorProcessor.js` to replicate the logic of the SC `tone` SynthDef (including `Blip` impulse generation, `LFNoise1` modulations, and `Splay` stereo spreading).
- **Sonifier Class:** Implement `DroneSonifier.js` extending `SonifierBase` to manage the audio graph and parameter smoothing.
- **Parameters:** Expose `freq`, `nharm`, `detune`, `pan`, and `amp` as adjustable parameters.
- **Data Mapping:** Map incoming data to the `freq` parameter with a default range of 20 to 200 Hz.
- **Demo Integration:** Add the Drone Sonifier to the `demo/` application, including a UI configuration card for real-time parameter adjustment.

## Non-Functional Requirements
- **Smoothing:** Use Web Audio automation for parameter changes to ensure click-free operation.
- **Resource Management:** Ensure proper cleanup of the `AudioWorkletNode` and other resources in the `destroy()` method.
- **Test Coverage:** Maintain >80% unit test coverage for the new package.

## Acceptance Criteria
- [ ] `DroneSonifier` successfully registers with the core `Runtime`.
- [ ] The sonifier produces a drone sound consistent with the SuperCollider source definition.
- [ ] The `freq` parameter responds dynamically to incoming data streams.
- [ ] The demo UI allows editing all sonifier parameters.
- [ ] All unit tests in `packages/drone-sonifier/test/` pass.

## Out of Scope
- Porting other synths from the `.scd` file (if any).
- Implementation using Tone.js (standard Web Audio API requested).
