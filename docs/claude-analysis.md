# Auditory Scene Analysis & the Web Sonifier Landscape Framework

*A critical analysis of the current composition architecture, grounded in Bregman's ASA principles, with proposals for a more powerful and perceptually principled framework.*

---

## 1. What You've Built — and What's Working

Before diving into what's missing, it's worth recognizing what's already strong here. The project has several things that many sonification frameworks never achieve:

### The Physical Modeling Foundation is Excellent
The sonifier catalog — Minnaert bubbles, Euler-Bernoulli chime modes, Strouhal vortex shedding, tri-band ocean surf — creates sounds with **genuine physical intuition**. This is crucial for Bregman. His research shows that the auditory system evolved to parse *real-world acoustic events*: dripping water, wind through trees, metal striking metal. By grounding your synthesis in physics rather than abstract oscillators, you're giving the listener's perceptual system something it already knows how to decompose. A listener doesn't need training to hear "that's rain" vs "that's wind" — their auditory cortex already has schemas for these.

### The Dual Temporal Paradigm is the Right Model
The distinction between continuous state sonification (Pmono) and discrete event sonification (Pbind) maps directly onto Bregman's two fundamental temporal grouping mechanisms:
- **Sequential grouping** (stream segregation over time) — your continuous sonifiers
- **Simultaneous grouping** (spectral fusion at a moment) — your event transients

The `EventScatterAdapter` is a genuinely clever piece of infrastructure. De-quantizing batched telemetry into Poisson-distributed strike events is exactly what you need to avoid the "machine-gun burst" that violates temporal proximity expectations.

### The Shared Reverb Space is Doing Real Perceptual Work
The single convolution reverb with per-object send levels creates what Bregman calls **"common fate in reverberation"** — objects sharing a reverb tail are perceived as existing in the same acoustic environment. This is one of the strongest primitive grouping cues for spatial integration, and you've implemented it cleanly.

---

## 2. Where the Framework Falls Short — Through Bregman's Lens

Now, here's where it gets interesting. Bregman's ASA identifies several primitive grouping/segregation principles that your current `Landscape` class doesn't address at all. The framework gives you a *mixer*, but not a *scene composer*.

### 2.1 No Spectral Band Management → Masking Catastrophe

> **Bregman's Principle**: Sounds occupying overlapping frequency regions undergo *spectral masking* — the louder one renders the quieter one inaudible. Effective auditory scenes require **spectral separation** between concurrent streams.

**The Problem**: Your `Landscape` has zero awareness of the spectral content of its children. Nothing prevents a site author from composing a landscape where ocean surf (broadband noise centered at 480 Hz), wind (broadband noise with Strouhal tones), and rain wash (broadband noise at 1200 Hz) all compete in overlapping frequency bands. The result is perceptual "mush" — the listener cannot segregate the streams because the auditory system cannot find spectral edges between them.

Look at the current presets: Rain on Tin Roof has rain at 1450 Hz + wind + ocean. The wind's Strouhal bands, the rain wash, and the ocean surf all share substantial broadband energy. The only separation comes from gain differences and the fact that the physics models have somewhat different spectral profiles by accident rather than by design.

**What's Missing**: The framework has no concept of **spectral real estate** — no way to declare "this sonifier occupies 200-800 Hz" or "these two sonifiers need at least a 2-octave gap to remain perceptually distinct." In SuperCollider, you'd handle this with careful filter design and EQ on each synth's output. Here, there's no mechanism for it.

### 2.2 No Figure/Ground Hierarchy → Flat Attention Field

> **Bregman's Principle**: Auditory scenes have *figure/ground* organization. A "figure" stream captures focal attention (the voice you're listening to, the alarm you're monitoring). "Ground" streams provide context and ambient status (the café noise, the baseline hum).

**The Problem**: All four objects in your landscape demo are structural peers. They all have the same channel strip, the same UI card layout, the same relationship to the master bus. There is no concept of *layers* with different perceptual roles.

In a well-designed sonification, you'd want something like:

| Layer | Role | Perceptual Behavior | Example |
|:--|:--|:--|:--|
| **Ground/Bed** | Ambient context, overall system health | Should be unobtrusive, slowly changing, low cognitive load | Ocean wash, wind drone |
| **Texture/Weather** | Status indicators, aggregate trends | Mid-salience, responds to continuous data feeds | Rain intensity, engine RPM |
| **Figure/Event** | Discrete alerts, significant occurrences | High salience, punctuates the bed, draws attention | Chime strike, bubble pop, Geiger click |
| **Alert/Alarm** | Critical events requiring action | Violates all ambient norms — different timbre, spatial position, rhythm | Friction/scrape, dissonant bell |

Your architecture doc ([procedural_and_event_sonification.md](file:///Users/graha/Documents/web-sonifier/docs/architecture/procedural_and_event_sonification.md#L62-L93)) actually describes this perfectly in its "Multi-Sonifier Soundscapes" mermaid diagram — "Ambient Bed," "Event Layer," "Alert Layer" — but the `Landscape` class has no implementation of these layer semantics. The framework says "all objects are equal" when perceptually they should not be.

### 2.3 No Inter-Object Communication → Missed Common Fate

> **Bregman's Principle**: Components that change together in time (amplitude, frequency, spatial position) are perceived as belonging to the **same source**. This is *common fate* — one of the strongest primitive grouping cues.

**The Problem**: Sonifiers are isolated command receivers. They cannot emit events, and they cannot listen to each other. The *only* cross-sonifier coupling in the entire codebase is the manually hardcoded wind→chime link in [demo/landscapes/main.js](file:///Users/graha/Documents/web-sonifier/demo/landscapes/main.js#L380-L384):

```js
if (chimeCoupledCheck && chimeCoupledCheck.checked) {
  landscape.setParam('chimes', 'windSpeed', v * 0.8)
}
```

This is a beautiful example of common fate in action — wind speed drives chime strike rate, so the listener perceives them as causally connected. But it's done with duct tape. A framework for composable soundscapes needs a principled way to declare these causal/correlative relationships:

- Wind speed → chime excitation rate (causal)
- Wind speed → rain droplet trajectory scatter (correlative)  
- Ocean swell crest → foam spray burst (temporal synchrony)
- CPU spike → drone pitch shift AND geiger rate increase (common fate through shared data)

### 2.4 Spread Is Visual-Only → No Actual Source Width

> **Bregman's Principle**: Spatial separation is one of the most powerful segregation cues. Sounds from different locations are more easily parsed as separate streams.

**The Problem**: The `spread` parameter is stored in metadata and rendered beautifully on the 2D radar canvas, but it has **zero effect on the audio output**. The `StereoPannerNode` only provides mono point-source panning. A wind source with `spread: 0.80` and a chime with `spread: 0.08` look different on the visualizer but sound identically point-source.

This is a significant missed opportunity. In a real acoustic environment, ambient sounds like wind and rain are *diffuse* — they arrive from many directions simultaneously. Point sources like a single chime tube are *localized*. This perceptual difference is what lets the auditory system separate them even when they share spectral energy. Without actual spread processing, you're leaving one of Bregman's most powerful primitive cues on the table.

### 2.5 No Side-Chain Dynamics → No Emergent Clarity

> **Bregman's Principle**: In natural environments, loud events temporarily suppress ambient sounds through acoustic masking. This creates natural "windows" where transient events are more audible.

**The Problem**: When a chime strikes in your landscape, it fights for headroom with the wind, rain, and ocean at their current static levels. In a real acoustic scene, the chime's onset energy would naturally dominate because of the **onset asynchrony** cue — but in your summed digital mix, everything adds linearly, and the transient can be lost in the noise floor.

Professional audio uses side-chain compression and ducking to solve this: when the chime strikes, briefly reduce the ambient bed level by 3-6 dB. This mimics the natural masking hierarchy and creates "breathing room" for events. Your framework has no mechanism for this.

### 2.6 No Onset Asynchrony Management

> **Bregman's Principle**: Components beginning within ~30ms are fused into a single percept. Components with staggered onsets are segregated.

**The Problem**: When multiple event sonifiers fire simultaneously (e.g., a chime strike and a bubble pop arriving from two data feeds at the same moment), the listener may fuse them into a single confusing percept. There's no mechanism to detect onset collisions and stagger them by 40-80ms to ensure perceptual segregation.

---

## 3. Proposals: Toward a Principled Composition Framework

Here's where I want to move beyond critique and into concrete architectural suggestions. The goal: a framework that makes it **easy to assemble effective, beautiful sonifications by default** — where Bregman's principles are baked into the infrastructure, not left as an exercise for the site author.

### 3.1 Introduce a Layer/Role System

Instead of a flat `addObject()`, introduce the concept of typed **layers** that encode their perceptual role:

```
Landscape
├── BedLayer (ground — always-on ambient context)
│   ├── wind (continuous, wide spread, low reverb send)
│   └── ocean (continuous, wide spread, long reverb tail)
├── TextureLayer (weather — aggregate data indicators)  
│   └── rain (hybrid, medium spread, mid reverb)
├── EventLayer (figure — discrete data events)
│   ├── chimes (event-driven, point source, high reverb)
│   └── bubbles (event-driven, point source, medium reverb)
└── AlertLayer (alarm — anomaly/threshold breaches)
    └── friction (event-driven, center pan, dry, loud)
```

Each layer type would carry **default spatial and dynamic behaviors**:

| Layer | Default Spread | Default Reverb Send | Default Gain Ceiling | Dynamic Behavior |
|:--|:--|:--|:--|:--|
| Bed | 0.6-1.0 (diffuse) | 0.3-0.5 (immersive) | 0.5 | Ducks when EventLayer fires |
| Texture | 0.3-0.7 (medium) | 0.2-0.4 | 0.65 | Responds to continuous data |
| Event | 0.02-0.15 (point) | 0.3-0.5 (sparkle) | 0.8 | Triggers discrete strikes |
| Alert | 0.0-0.05 (sharp point) | 0.0-0.1 (dry, immediate) | 1.0 | Ducks everything else |

This gives site authors a principled starting point. They can still override everything, but the defaults encode decades of psychoacoustic research.

### 3.2 Build a Signal Bus / Event Emitter Between Objects

This is perhaps the most impactful single change. Allow sonifiers to **emit named events** and allow the Landscape to **wire connections** between them declaratively:

**Concept: Landscape Couplings**

```
// Declarative wiring — "wind drives chime excitation"
landscape.couple('wind', 'speed', 'chimes', 'windSpeed', { 
  scale: 0.8,        // attenuation factor
  curve: 'linear'
})

// Threshold coupling — "when CPU > 90%, trigger alert"
landscape.coupleThreshold('cpu-adapter', 0.9, 'alert', 'strike', {
  velocity: 1.0 
})

// Common-fate grouping — "these move together"
landscape.group('weather', ['wind', 'rain'], {
  commonFateParams: ['intensity']  // when one intensifies, both do
})
```

**Concept: Sonifier Output Events**

Extend `SonifierBase` so that sonifiers can emit lifecycle/acoustic events that other sonifiers or the Landscape can react to:

- `onWaveCrest` (ocean) → could trigger foam burst in a separate spray sonifier
- `onStrike` (chime) → could duck the ambient bed for 200ms
- `onDropletImpact` (rain) → could trigger micro-bubbles in a coupled puddle sonifier
- `onGustPeak` (wind) → could trigger a chime clatter burst

This is the equivalent of SuperCollider's `SendTrig` and `OSCFunc` — the ability for synths to communicate through the server. Without it, you can only build static mixes, not living acoustic ecologies.

### 3.3 Implement Spectral Slot Allocation

Add a **spectral awareness layer** to the Landscape that helps prevent masking:

**Concept: Spectral Profiles**

Each sonifier declares its approximate spectral footprint:

```
getSpectralProfile() {
  return {
    primary: { low: 200, high: 2000 },    // main energy band
    harmonics: { low: 2000, high: 8000 },  // overtone shimmer
    transient: { low: 1000, high: 6000 }   // attack click energy
  }
}
```

The Landscape can then:
1. **Warn** when two objects have overlapping primary bands
2. **Auto-EQ** by inserting complementary bandpass/notch filters on each channel strip to carve spectral space (scooping 800 Hz from rain so the chime's fundamental rings through)
3. **Suggest** frequency ranges when the site author adds a new object

This is the sonification equivalent of orchestration — making sure the oboe and clarinet aren't both playing in the same register at the same dynamic.

### 3.4 Implement Actual Spatial Spread Processing

Replace the visual-only spread parameter with real audio processing. There are several approaches viable in Web Audio:

**Option A: Multi-Panner Decorrelation (simplest)**
For each object, create 2-4 `StereoPannerNode`s at offsets within the spread arc, each fed a slightly delayed or filtered copy of the signal. This creates a perceptual "width" through decorrelation.

**Option B: Mid-Side Processing**
Split each object's output into mid (center) and side (width) components. The spread parameter controls the side gain relative to mid. Narrow spread = mostly mid = point source. Wide spread = boosted side = enveloping.

**Option C: HRTF-based `PannerNode`**  
The Web Audio `PannerNode` (as opposed to `StereoPannerNode`) supports `coneInnerAngle` and `coneOuterAngle` which can simulate source radiation patterns. Combined with the `panningModel: 'HRTF'` option, this provides actual spatial width cues based on interaural time and level differences.

This would transform spread from a cosmetic visualizer feature into a genuine segregation tool.

### 3.5 Add Dynamic Gain Management (Side-Chain Ducking)

Implement automatic level management between layers:

**Concept: Layer Ducking**

When an EventLayer sonifier fires a trigger:
1. Detect the onset (the `trigger()` call)
2. Briefly attenuate BedLayer and TextureLayer gains by a configurable amount (e.g., -4 dB)
3. Ramp back up over 100-300ms using `setTargetAtTime`

This creates the natural "parting of the waters" effect that lets transient events cut through ambient beds. It's the same technique used in radio broadcasting (voice ducking music), film sound design (dialog ducking ambience), and — crucially — it mimics how the biological auditory system's efferent feedback loop works (the olivocochlear reflex suppresses ambient neural response during sharp transients).

**Concept: Loudness Normalization**

The Landscape should monitor the total output level and apply gentle limiting or auto-gain to prevent the mix from clipping when many layers are active. As you add more objects, the headroom shrinks — without management, the sum clips or the site author has to manually rebalance everything.

### 3.6 Onset Collision Avoidance

When multiple event-layer sonifiers attempt to fire within the same 30ms window, automatically stagger their onsets by 40-80ms to ensure perceptual segregation. This is the temporal equivalent of spectral band allocation — making sure events don't fuse into one confusing percept.

The `EventScatterAdapter` already has the right idea for temporal distribution within a single stream. Extend that concept across streams: the Landscape maintains a short-term "onset calendar" and nudges colliding events apart.

### 3.7 Preset System: Scene Recipes, Not Just Parameter Snapshots

Your current preset system (Rain on Tin Roof, Pacific Coast, etc.) is essentially a bag of slider values. That's fine for the demo, but the framework should support **semantic scene recipes** — presets that describe *compositional intent* rather than raw parameter values:

**Concept: Scene Descriptors**

```
{
  name: 'Server Room Monitor',
  layers: {
    bed: { 
      sonifier: 'drone', 
      dataBinding: 'overall-cpu-load',
      role: 'system health baseline'
    },
    texture: { 
      sonifier: 'rain', 
      dataBinding: 'request-rate',
      role: 'traffic density indicator'
    },
    event: { 
      sonifier: 'chime', 
      dataBinding: 'deployment-events',
      role: 'deployment notification'
    },
    alert: { 
      sonifier: 'geiger', 
      dataBinding: 'error-rate',
      role: 'error rate anomaly detector'
    }
  },
  couplings: [
    { from: 'bed.frequency', to: 'texture.pitch', scale: 0.5 }
  ],
  spectralStrategy: 'auto-separate'
}
```

This moves the framework from "here's a mixer, good luck" to "here's a composition language for building sonification environments."

---

## 4. The SuperCollider Parallel: Patterns as First-Class Citizens

You mention Pmono and Pbind explicitly, and this is where I think the deepest insight lies. In SuperCollider, the **Pattern** system is what makes composition powerful:

- `Pbind` defines a recipe for a stream of discrete events with parameterized properties
- `Pmono` defines a recipe for a continuous modulation of a persistent synth
- `Ppar` runs multiple patterns in parallel
- `Pseq`, `Prand`, `Pxrand` control temporal sequencing
- `Pkey` lets one stream reference values from another

Your current architecture has the synth engines (the `SynthDef` equivalents), but it's missing the **Pattern layer** — the compositional grammar that describes *how* data flows through time into sound.

### What a Pattern Layer Could Look Like

Instead of the site author manually calling `landscape.setParam()` in response to data events, they would declare **data-to-sound bindings** using pattern-like abstractions:

- **ContinuousBinding** (≈ Pmono): "Map this data feed to this parameter on this sonifier, continuously, using this adapter curve"
- **EventBinding** (≈ Pbind): "When this data event fires, trigger this sonifier's strike method, with velocity mapped from the event magnitude"
- **ThresholdBinding**: "When this metric crosses this threshold, switch from bed-layer to alert-layer behavior"
- **CorrelationBinding** (≈ Pkey): "This sonifier's pitch tracks that sonifier's intensity, creating common-fate grouping"

This is the missing abstraction layer between your excellent low-level synthesis engines and the high-level goal of "composable, diverse, effective sonifications."

---

## 5. On Beauty

You asked about beauty specifically. Here's what I think makes sonification beautiful rather than merely functional:

1. **Physical coherence**: Sounds that obey recognizable physics feel "right." Your Farnell-based models already do this. A Minnaert bubble chirp is more beautiful than a sine wave ping because it carries the physics of water.

2. **Spectral complementarity**: Sounds that occupy different spectral niches create rich textures without muddiness. Think of an orchestral score — each instrument has its register. Your framework should make this easy.

3. **Temporal breath**: Sonifications that have rhythm, pause, and flow — not constant drone — feel alive. The ocean's swell cycle is a perfect example. The `EventScatterAdapter`'s Poisson distribution creates organic timing. More of this temporal intelligence across the whole system.

4. **Causal narrative**: When the listener can hear *why* a sound changed — because the wind picked up and the chimes responded — the sonification tells a story. Your wind→chime coupling is beautiful precisely because it's causally coherent. The framework should make these narrative connections easy to build.

5. **Restraint**: The best sonifications use silence and subtlety. A framework that makes it easy to set up ducking, dynamic range management, and gain envelopes helps site authors avoid the "everything loud all the time" trap that causes auditory fatigue.

---

## 6. Summary of Recommended Framework Evolution

| Priority | Enhancement | Bregman Principle Addressed | Effort |
|:--|:--|:--|:--|
| 🔴 High | Layer/Role system (Bed, Texture, Event, Alert) | Figure/Ground separation | Medium |
| 🔴 High | Inter-object coupling bus | Common Fate | Medium |
| 🔴 High | Sonifier output events (`onStrike`, `onCrest`, etc.) | Onset synchrony, causal grouping | Medium |
| 🟡 Medium | Spectral profile declarations + auto-EQ | Spectral segregation, masking avoidance | Large |
| 🟡 Medium | Actual spatial spread processing | Spatial segregation | Medium |
| 🟡 Medium | Side-chain ducking between layers | Natural masking hierarchy | Small |
| 🟢 Nice | Onset collision avoidance | Onset asynchrony for segregation | Small |
| 🟢 Nice | Semantic scene recipes (composition language) | Schema-based grouping | Large |
| 🟢 Nice | Pattern-layer data bindings | Compositional grammar (SC Patterns analog) | Large |

> [!IMPORTANT]
> The single highest-leverage change is the **Layer/Role system + inter-object coupling bus**. Together, these would transform `Landscape` from a flat mixer into a true auditory scene composer — where the framework itself encodes perceptual science, and site authors get effective, beautiful sonifications by composing from well-separated roles rather than wrestling with raw parameter values.

---

*Analysis grounded in: Bregman, A.S. (1990). Auditory Scene Analysis: The Perceptual Organization of Sound. MIT Press. Farnell, A. (2010). Designing Sound. MIT Press. Hermann, T., Hunt, A., & Neuhoff, J.G. (2011). The Sonification Handbook. Logos Verlag.*
