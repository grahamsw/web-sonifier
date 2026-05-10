# Specification - Port Sonifiers

## Overview
Port the 'purr', 'liquid', and 'mallet' sonifiers from the existing `grahamsw/purr` repository (specifically the `vue-purr` component) to the `web-sonifier` monorepo as new sonifier plugins. These sonifiers will be implemented as standard classes extending `SonifierBase`.

## Functional Requirements
- **PurrSonifier**: A low-frequency, "purring" synthesis engine.
- **LiquidSonifier**: A fluid, water-like texture synthesis engine.
- **MalletSonifier**: A physical modeling engine for struck instruments.
- Each sonifier must inherit from `SonifierBase`.
- Parameters from the original source should be mapped to the `web-sonifier` parameter interface, simplifying where necessary for general use.
- Audio transitions must be smoothed using Web Audio automation (e.g., `setTargetAtTime`).

## Non-Functional Requirements
- **Audio Quality**: No audible clicks or pops during parameter changes or destruction.
- **Performance**: Efficient synthesis suitable for real-time browser execution.
- **Testing**: >80% code coverage for each new sonifier.

## Acceptance Criteria
- Three new packages or modules: `@web-sonify/purr`, `@web-sonify/liquid`, and `@web-sonify/mallet` (or equivalent structure).
- Sonifiers successfully produce sound in a test environment and the demo site.
- All unit tests pass.
