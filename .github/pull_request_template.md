## Description
<!-- Provide a summary of the changes and motivation behind them. -->

Closes #<!-- Issue Number -->

## Changes Made
- 

## Verification & Best Practices Checklist

- [ ] **TDD & Unit Tests**: All unit tests pass (`npm test`) and new tests were added for changes.
- [ ] **Pre-commit Hook**: Git hook verified (`npm test` via husky succeeded without `--no-verify`).
- [ ] **Parameter Smoothing**: Time-varying audio parameters use `setTargetAtTime` or `linearRampToValueAtTime` (10–50ms) to avoid clicks and zipper noise.
- [ ] **Teardown Integrity**: Sonifier gain is ramped to 0 before node disconnection in `destroy()`.
- [ ] **Browser Compatibility**: Core and plugin code remains compatible with vanilla browser environments.
- [ ] **Interactive Testing**: Changes verified locally via the demo (`npm run dev`).
