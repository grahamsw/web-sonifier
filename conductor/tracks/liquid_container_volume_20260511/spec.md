# Specification: LiquidSonifier Physical Volume Parameter

## Overview
This track adds a `resonatorVolume` parameter to the `LiquidSonifier`. This parameter represents the physical size/volume of the liquid container being modeled, distinct from the output amplitude (loudness).

## Functional Requirements
- **Sonifier Schema**: Add `resonatorVolume` to the `LiquidSonifier` parameter schema.
- **Parameter Mapping**: Map the `resonatorVolume` parameter from the Sonifier to the AudioWorklet's internal `volume` parameter.
- **Loudness Control**: Ensure the existing `volume` parameter in the Sonifier continues to control the master output gain (amplitude).
- **Audio Integrity**: Maintain smooth transitions for the new parameter to prevent clicks.

## Technical Details
- **Parameter Name**: `resonatorVolume`
- **Range**: `[0, 1]`
- **Default**: `0.5`
- **Worklet Mapping**: The Sonifier will pass this value to the `volume` parameter of the `LiquidResonatorProcessor`. The processor already uses this to calculate `volMod = 0.5 + svol * 1.5`.

## Acceptance Criteria
- `LiquidSonifier` schema includes `resonatorVolume`.
- Changing `resonatorVolume` audibly changes the resonance characteristics (pitch/timbre shift associated with size) without affecting the peak output level more than the physical model dictates.
- Changing `volume` still controls the loudness.
- No audible clicks during parameter ramps.

## Out of Scope
- Adding other physical parameters not requested.
- Refactoring the core `SonifierBase`.
