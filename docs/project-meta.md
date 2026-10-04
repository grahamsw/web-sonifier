# Project Meta

## Design Decisions

- **Why a Base Class?** JavaScript lacks interfaces. A base class provides a concrete location for validation logic and shared storage while enforcing the implementation of key lifecycle methods.
- **Why Separate Adapter and Sonifier?** Mapping is a data problem; synthesis is an audio problem. Decoupling them allows sonifiers to be "pure" synthesis engines that can be tested with static values.
- **Vanilla First:** The core library and plugins avoid dependencies (like Tone.js) where possible to remain lightweight and compatible with standard browser environments.

## Project Structure
```
web-sonifier/
├── packages/
│   ├── core/           # Runtime, Adapter, SonifierBase, Transforms, Quantizer, Landscape
│   ├── tone/           # Continuous FM oscillator plugin
│   ├── geiger/         # Poisson point process / Geiger counter plugin
│   ├── purr/           # Procedural purr / biomorphic texture plugin
│   ├── liquid/         # Multi-droplet bubble and fluid physics plugin
│   ├── mallet/         # Modal percussion / mallet physics plugin
│   ├── engine/         # Granular cylinder engine / RPM plugin
│   ├── chime/          # Modal chime resonance plugin
│   ├── bubble/         # Minnaert air bubble cavitation physics plugin
│   ├── rain/           # Farnell procedural acoustic raindrop physics plugin
│   ├── ocean/          # Deep wave surge and shore surf physics plugin
│   ├── wind/           # Procedural aeroacoustic wind turbulence plugin
│   ├── drone-sonifier/ # Ambient multi-layer drone generator
│   ├── eno-bed/        # Brian Eno ambient background harmonic bed
│   ├── eno-figure/     # Generative melodic motif / lead figure plugin
│   ├── eno-texture/    # Organic tape warmth, drift, and flutter plugin
│   ├── metal-machine/  # Lou Reed industrial feedback matrix plugin
│   ├── mmm2/           # Multi-loop drone ecology with cross-modulation
│   └── mmm-lab/        # Full Karplus-Strong string lab with speaker cone knocking
├── demo/               # Visual landscape studio, parameter mapping inspector & labs
└── docs/               # Architecture guides, API reference, and workflow specifications
```

## Contributing & Developer Workflows

- See [Issue-Driven Worktree & Pull Request Workflow](worktree-workflow.md) for branch and worktree setup instructions.

## Roadmap

- [ ] **TypeScript Definitions:** Layering types on top of the JS source.
- [x] **Settings Serialization:** Helpers for saving and loading full landscape scenes and mappings.
- [x] **UI Component Library:** Dynamic schema-driven settings forms and parameter cards.
- [ ] **CDN Distribution:** Example usage via unpkg or JSDelivr.

---

[Back to README](../README.md)
