---
name: New Sonifier Proposal
about: Propose a new sonifier synthesizer plugin or sound generator
title: 'feat(sonifier): '
labels: ['sonifier', 'enhancement']
---

## Sound Metaphor & Auditory Goal
<!-- Describe what the sonifier sounds like, its acoustic character, and what data scenarios it is best suited for (e.g. discrete events, continuous drift, threshold alerts). -->

## Primary Data Mapping
- **Mapped Parameter Name**: <!-- e.g. frequency, strikeRate, rate, cutoff -->
- **Typical Input Range**: <!-- e.g. 0 to 100 -->
- **Default Output Range**: <!-- e.g. 100 to 1000 Hz, 1 to 50 clicks/sec -->
- **Default Mapping Curve**: <!-- linear, exponential, or logarithmic -->

## Secondary Parameters & Controls
<!-- List other adjustable parameters, e.g. resonance, detune, harmonics, damping, volume -->

## Web Audio Node Graph & Synthesis Strategy
<!-- Describe the Web Audio architecture: Oscillators, AudioWorkletProcessor, filters, buffers, gain stages -->

## Parameter Smoothing Strategy (Temporal Integrity)
- [ ] Uses Web Audio automation methods (`setTargetAtTime` or `linearRampToValueAtTime`)
- [ ] Ramp duration designed within responsive 10–50ms window to eliminate zipper noise without lagging spikes

## Teardown & De-clicking Plan
- [ ] Explicit gain ramp to 0 in `destroy()` before disconnecting nodes or stopping sources

## Proposed Package Location
- [ ] Monorepo package: `packages/<name>`
- [ ] Standalone repository / external library
