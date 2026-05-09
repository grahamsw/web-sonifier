# Specification - Fix MalletSonifier Silent

## Overview
The `MalletSonifier` is silent when selected in the demo. This is because it requires an explicit `start()` call to begin its strike-scheduling loop, but the `Runtime` (and current `init()` implementation) does not call it.

## Functional Requirements
- Call `this.start()` at the end of `MalletSonifier.init()`.
- Ensure other sonifiers that might require explicit starting (like those with internal loops) are also handled.

## Acceptance Criteria
- `MalletSonifier` produces periodic strike sounds immediately after being created and initialized.
- Unit tests verify that the scheduling loop starts automatically.
