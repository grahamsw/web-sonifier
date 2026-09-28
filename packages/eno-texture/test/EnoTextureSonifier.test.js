import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnoTextureSonifier } from '../src/EnoTextureSonifier.js';

describe('EnoTextureSonifier (SonifierBase Plugin)', () => {
  let ctx, output, mockNodes;

  beforeEach(() => {
    vi.useFakeTimers();
    mockNodes = [];

    const createParam = (initial = 0) => ({
      value: initial,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(function(v) { this.value = v; }),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn()
    });

    const createMockGain = () => {
      const node = { gain: createParam(1), connect: vi.fn(), disconnect: vi.fn() };
      mockNodes.push(node);
      return node;
    };

    const createMockFilter = () => {
      const node = { type: 'lowpass', frequency: createParam(350), Q: createParam(1), connect: vi.fn(), disconnect: vi.fn() };
      mockNodes.push(node);
      return node;
    };

    const createMockOscillator = () => {
      const node = {
        type: 'sine',
        frequency: createParam(440),
        detune: createParam(0),
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      };
      mockNodes.push(node);
      return node;
    };

    output = createMockGain();

    ctx = {
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createGain: vi.fn(createMockGain),
      createBiquadFilter: vi.fn(createMockFilter),
      createOscillator: vi.fn(createMockOscillator)
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Schema has expected param names with correct types', () => {
    const sonifier = new EnoTextureSonifier();
    const schema = sonifier.getParamSchema();
    
    expect(schema.length).toBe(6);
    
    const pitch = schema.find(p => p.name === 'pitch');
    expect(pitch.type).toBe('number');
    expect(pitch.range).toEqual([100, 2000]);
    
    const shimmer = schema.find(p => p.name === 'shimmer');
    expect(shimmer.type).toBe('number');
    
    const density = schema.find(p => p.name === 'density');
    expect(density.type).toBe('number');
  });

  it('Init + applyDefaults stores correct values', () => {
    const sonifier = new EnoTextureSonifier();
    sonifier.init(ctx, output);
    sonifier.applyDefaults();
    
    expect(sonifier._cloudModel.pitch).toBeCloseTo(261.63);
    expect(sonifier._cloudModel.shimmer).toBeCloseTo(0.6);
    expect(sonifier._cloudModel.brightness).toBeCloseTo(0.5);
    expect(sonifier._cloudModel.density).toBeCloseTo(0.5);
    expect(sonifier._cloudModel.evolution).toBeCloseTo(0.4);
    
    expect(sonifier._cloudModel._outputGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.35, 0, 0.05);
  });

  it('setParam dispatches to model', () => {
    const sonifier = new EnoTextureSonifier();
    sonifier.init(ctx, output);
    sonifier.applyDefaults();

    sonifier.setParam('pitch', 440);
    expect(sonifier._cloudModel.pitch).toBe(440);
    
    sonifier.setParam('density', 0.8);
    expect(sonifier._cloudModel.density).toBe(0.8);
  });

  it('destroy() nullifies model reference and clears timer', () => {
    const sonifier = new EnoTextureSonifier();
    sonifier.init(ctx, output);
    
    expect(sonifier._cloudModel._timer).not.toBeNull();
    
    const model = sonifier._cloudModel;
    sonifier.destroy();
    
    expect(sonifier._cloudModel).toBeNull();
    expect(model._timer).toBeNull();
  });
});
