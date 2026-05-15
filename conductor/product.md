# Product Definition

**Web Sonifier** is a monorepo library and application for real-time data sonification in the browser. It allows developers to map incoming data streams to audio output using pluggable audio engines (like Tone.js) and a core runtime registry.

## Core Goals
- Provide a clear, robust interface for registering and managing sonifier instances.
- Ensure audio context lifecycle is handled correctly (user gesture initialization).
- Provide a demo site to showcase the sonification capabilities.

## Built-in Sonifiers
- **Tone:** Simple continuous oscillator.
- **Geiger:** Clicks proportional to data rate.
- **Drone:** Rich, multi-harmonic synth based on SuperCollider logic.