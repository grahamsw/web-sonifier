# Core Concepts

Web Sonifier is built on the principle of keeping data, mapping, and sound synthesis strictly separate.

## The Mental Model

Three concerns are managed by different parts of the system:

1.  **Data Plumbing** (Site Author): Deciding when and how to push raw data values into the system.
2.  **Mapping** (The `Adapter`): Translating raw data values (e.g., a stock price) into "cooked" values a sonifier understands (e.g., a frequency in Hz).
3.  **Sound Synthesis** (The `Sonifier`): Receiving clean, ready-to-use parameter values and producing sound. The sonifier knows nothing about the original data source.

## System Architecture

### Runtime (`@web-sonify/core`)
The top-level orchestrator. One per page. It manages the `AudioContext`, a master gain node, and the lifecycle of all sonifier instances.

### Sonifier (`@web-sonify/plugins`)
A black box that implements `SonifierBase`. It exposes a parameter schema and responds to `setParam()` calls. All sonifiers route their output through the `Runtime`'s master gain node.

### Adapter (`@web-sonify/core`)
A stateful mapping function that handles the "translation" layer. It supports linear, exponential, and logarithmic curves, as well as dynamic auto-ranging.

---

[Back to README](../README.md)
