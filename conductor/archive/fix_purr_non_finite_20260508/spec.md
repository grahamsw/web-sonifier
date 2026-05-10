# Specification - Fix PurrSonifier Non-Finite Value

## Overview
The `PurrSonifier` throws a `TypeError: Failed to execute 'setValueAtTime' on 'AudioParam': The provided float value is non-finite` during initialization. This is because `init()` calls `_updateNodes(true)` before default parameter values have been applied.

## Functional Requirements
- Ensure `PurrSonifier` correctly initializes all parameters before audio nodes are updated.
- Apply the same safeguard to `LiquidSonifier` for consistency.
- Verify that `init()` no longer throws non-finite value errors.

## Acceptance Criteria
- `PurrSonifier` and `LiquidSonifier` initialize without errors in the demo and tests.
- Unit tests verify that `init()` results in finite values being set on audio parameters.
