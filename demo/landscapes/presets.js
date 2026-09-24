/**
 * Bundled Scene Document Presets for Sonification Landscapes
 * Provides declarative scene descriptions conforming to Landscape Scene Document schema v1.
 */

export const rainOnTinRoof = {
  version: 1,
  name: "Rain on Tin Roof",
  space: {
    decay: 2.8,
    wet: 0.32,
    warmth: 0.65
  },
  masterVolume: 0.85,
  layers: {
    bed: { gain: 1.0 },
    texture: { gain: 1.0 },
    figure: {
      gain: 1.0,
      ducking: { targets: ["bed", "texture"], depth: 0.35, attack: 0.015, release: 0.25 }
    }
  },
  objects: {
    rain: {
      type: "rain",
      layer: "texture",
      gain: 0.85,
      pan: 0.0,
      distance: 4,
      spread: 0.95,
      reverbSend: 0.25,
      params: {
        intensity: 160,
        surface: "roof",
        pitch: 1450,
        dropletSize: 1.1
      }
    },
    wind: {
      type: "wind",
      layer: "bed",
      gain: 0.35,
      pan: -0.20,
      distance: 12,
      spread: 0.70,
      reverbSend: 0.20,
      params: {
        speed: 18,
        turbulence: 0.30,
        cavityResonance: 0.30
      }
    },
    chimes: {
      type: "chime",
      layer: "figure",
      gain: 0.65,
      pan: 0.45,
      distance: 3,
      spread: 0.08,
      reverbSend: 0.45,
      params: {
        material: "aluminum",
        pitch: 587,
        damping: 0.22,
        windSpeed: 14.4
      }
    },
    ocean: {
      type: "ocean",
      layer: "bed",
      gain: 0.0,
      pan: 0.25,
      distance: 20,
      spread: 0.50,
      reverbSend: 0.35,
      params: {
        intensity: 0,
        swellPeriod: 8.5,
        foam: 0.55,
        pitch: 480
      }
    }
  },
  couplings: [
    {
      sourceId: "wind",
      sourceParam: "speed",
      targetId: "chimes",
      targetParam: "windSpeed",
      scale: 0.8
    }
  ]
}

export const pacificCoast = {
  version: 1,
  name: "Pacific Coast",
  space: {
    decay: 3.4,
    wet: 0.30,
    warmth: 0.50
  },
  masterVolume: 0.85,
  layers: {
    bed: { gain: 1.0 },
    texture: { gain: 1.0 },
    figure: {
      gain: 1.0,
      ducking: { targets: ["bed", "texture"], depth: 0.35, attack: 0.015, release: 0.25 }
    }
  },
  objects: {
    ocean: {
      type: "ocean",
      layer: "bed",
      gain: 0.88,
      pan: -0.35,
      distance: 14,
      spread: 0.55,
      reverbSend: 0.35,
      params: {
        intensity: 75,
        swellPeriod: 9.0,
        foam: 0.60,
        pitch: 450
      }
    },
    wind: {
      type: "wind",
      layer: "bed",
      gain: 0.60,
      pan: 0.10,
      distance: 10,
      spread: 0.75,
      reverbSend: 0.20,
      params: {
        speed: 34,
        turbulence: 0.40,
        cavityResonance: 0.30
      }
    },
    chimes: {
      type: "chime",
      layer: "figure",
      gain: 0.45,
      pan: 0.60,
      distance: 4,
      spread: 0.08,
      reverbSend: 0.45,
      params: {
        material: "bronze",
        pitch: 523,
        damping: 0.35,
        windSpeed: 27.2
      }
    },
    rain: {
      type: "rain",
      layer: "texture",
      gain: 0.0,
      pan: 0.0,
      distance: 8,
      spread: 0.95,
      reverbSend: 0.25,
      params: {
        intensity: 0,
        surface: "puddle",
        pitch: 1400,
        dropletSize: 1.0
      }
    }
  },
  couplings: [
    {
      sourceId: "wind",
      sourceParam: "speed",
      targetId: "chimes",
      targetParam: "windSpeed",
      scale: 0.8
    }
  ]
}

export const mountainStorm = {
  version: 1,
  name: "Mountain Storm",
  space: {
    decay: 4.5,
    wet: 0.40,
    warmth: 0.70
  },
  masterVolume: 0.85,
  layers: {
    bed: { gain: 1.0 },
    texture: { gain: 1.0 },
    figure: {
      gain: 1.0,
      ducking: { targets: ["bed", "texture"], depth: 0.35, attack: 0.015, release: 0.25 }
    }
  },
  objects: {
    rain: {
      type: "rain",
      layer: "texture",
      gain: 0.92,
      pan: 0.0,
      distance: 3,
      spread: 1.0,
      reverbSend: 0.30,
      params: {
        intensity: 320,
        surface: "puddle",
        pitch: 1200,
        dropletSize: 1.3
      }
    },
    wind: {
      type: "wind",
      layer: "bed",
      gain: 0.85,
      pan: 0.0,
      distance: 6,
      spread: 0.85,
      reverbSend: 0.25,
      params: {
        speed: 68,
        turbulence: 0.75,
        cavityResonance: 0.60
      }
    },
    ocean: {
      type: "ocean",
      layer: "bed",
      gain: 0.50,
      pan: -0.40,
      distance: 18,
      spread: 0.60,
      reverbSend: 0.40,
      params: {
        intensity: 80,
        swellPeriod: 6.0,
        foam: 0.65,
        pitch: 450
      }
    },
    chimes: {
      type: "chime",
      layer: "figure",
      gain: 0.80,
      pan: 0.45,
      distance: 3,
      spread: 0.08,
      reverbSend: 0.45,
      params: {
        material: "steel",
        pitch: 659,
        damping: 0.18,
        windSpeed: 54.4
      }
    }
  },
  couplings: [
    {
      sourceId: "wind",
      sourceParam: "speed",
      targetId: "chimes",
      targetParam: "windSpeed",
      scale: 0.8
    }
  ]
}

export const alpineMeadow = {
  version: 1,
  name: "Alpine Meadow",
  space: {
    decay: 4.2,
    wet: 0.35,
    warmth: 0.75
  },
  masterVolume: 0.85,
  layers: {
    bed: { gain: 1.0 },
    texture: { gain: 1.0 },
    figure: {
      gain: 1.0,
      ducking: { targets: ["bed", "texture"], depth: 0.35, attack: 0.015, release: 0.25 }
    }
  },
  objects: {
    wind: {
      type: "wind",
      layer: "bed",
      gain: 0.75,
      pan: 0.0,
      distance: 8,
      spread: 0.80,
      reverbSend: 0.25,
      params: {
        speed: 45,
        turbulence: 0.60,
        cavityResonance: 0.45
      }
    },
    chimes: {
      type: "chime",
      layer: "figure",
      gain: 0.85,
      pan: 0.35,
      distance: 2,
      spread: 0.08,
      reverbSend: 0.40,
      params: {
        material: "aluminum",
        pitch: 659,
        damping: 0.20,
        windSpeed: 36.0
      }
    },
    rain: {
      type: "rain",
      layer: "texture",
      gain: 0.45,
      pan: -0.20,
      distance: 5,
      spread: 0.70,
      reverbSend: 0.25,
      params: {
        intensity: 45,
        surface: "foliage",
        pitch: 1050,
        dropletSize: 0.8
      }
    },
    ocean: {
      type: "ocean",
      layer: "bed",
      gain: 0.0,
      pan: 0.25,
      distance: 20,
      spread: 0.50,
      reverbSend: 0.35,
      params: {
        intensity: 0,
        swellPeriod: 8.5,
        foam: 0.55,
        pitch: 480
      }
    }
  },
  couplings: [
    {
      sourceId: "wind",
      sourceParam: "speed",
      targetId: "chimes",
      targetParam: "windSpeed",
      scale: 0.8
    }
  ]
}

export const PRESET_SCENES = {
  rain: rainOnTinRoof,
  pacific: pacificCoast,
  storm: mountainStorm,
  alpine: alpineMeadow
}
