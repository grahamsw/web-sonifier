# Project Meta

## Design Decisions

- **Why a Base Class?** JavaScript lacks interfaces. A base class provides a concrete location for validation logic and shared storage while enforcing the implementation of key lifecycle methods.
- **Why Separate Adapter and Sonifier?** Mapping is a data problem; synthesis is an audio problem. Decoupling them allows sonifiers to be "pure" synthesis engines that can be tested with static values.
- **Vanilla First:** The core library and plugins avoid dependencies (like Tone.js) where possible to remain lightweight and compatible with standard browser environments.

## Project Structure
```
web-sonifier/
├── packages/
│   ├── core/      # The Runtime, Adapter, and SonifierBase
│   ├── tone/      # Continuous oscillator plugin
│   └── geiger/    # Randomized "click" plugin
├── demo/          # Vanilla JS demonstration app
└── docs/          # Detailed documentation
```

## Roadmap

- [ ] **TypeScript Definitions:** Layering types on top of the JS source.
- [ ] **Settings Serialization:** Helpers for saving full configurations.
- [ ] **UI Component Library:** Auto-generated settings panels for plugins.
- [ ] **CDN Distribution:** Example usage via unpkg or JSDelivr.

---

[Back to README](../README.md)
