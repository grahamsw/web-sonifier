# Implementation Plan: Geiger Counter Sonifier

## Overview
We will create a new package `@web-sonify/geiger` that implements a Geiger counter sonifier using vanilla Web Audio API. The sonifier will use a lookahead scheduler to trigger short noise bursts at randomized intervals controlled by a `rate` parameter.

## Implementation Steps

- [x] **Step 1: Setup Workspace Package**
  - Create `packages/geiger/package.json` specifying `@web-sonify/geiger` and a peer dependency on `@web-sonify/core`.
  - Create `packages/geiger/src/index.js` exporting the class.
  - Link the new package via the root monorepo setup (done automatically by npm workspaces, just need to run `npm install`).

- [x] **Step 2: Implement Synthesis Engine (AudioBuffer)**
  - Create `packages/geiger/src/GeigerSonifier.js` extending `SonifierBase`.
  - In `init()`, generate a short, decaying white noise `AudioBuffer` (e.g., 5-10ms long) to serve as the "click".

- [x] **Step 3: Implement Lookahead Scheduler**
  - Implement a `setTimeout`-based lookahead loop in the class.
  - The loop checks the current `rate` parameter.
  - Calculate randomized time deltas using a Poisson process approximation or simple uniform randomization based on `rate`.
  - Schedule `AudioBufferSourceNode` playback in the future using `audioContext.currentTime`.
  - Handle cleanup in `destroy()` (clear timeout).

- [x] **Step 4: Parameters Schema**
  - Define `getParamSchema()` with `rate` (range 0 to ~1000) and `volume` (range 0 to 1).

- [x] **Step 5: Demo Integration**
  - Add the `@web-sonify/geiger` sonifier to the demo app (`demo/index.html` and `demo/main.js`).
  - Add a slider to control the `rate` parameter to test the Geiger effect interactively.