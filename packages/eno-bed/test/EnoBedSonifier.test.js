import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EnoBedSonifier } from '../src/EnoBedSonifier.js';

describe('EnoBedSonifier', () => {
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

  it('has correct param schema', () => {
    const sonifier = new EnoBedSonifier();
    const schema = sonifier.getParamSchema();
    expect(schema.length).toBe(6);
    expect(schema.map(p => p.name)).toEqual(['pitch', 'warmth', 'detune', 'drift', 'driftRate', 'volume']);
    expect(schema.find(p => p.name === 'pitch').range).toEqual([60, 880]);
  });

  it('init stores correct initial values and allows setting defaults', () => {
    const sonifier = new EnoBedSonifier();
    sonifier.init(ctx, output);
    // Mimic applyDefaults functionality by triggering onParam with default schema values
    const schema = sonifier.getParamSchema();
    schema.forEach(p => sonifier.onParam(p.name, p.default));
    
    // Check that lfo frequency was set to default 0.08 via setDriftRate
    const oscs = mockNodes.filter(n => n.frequency !== undefined && typeof n.start === 'function');
    const lfo = oscs[0];
    expect(lfo.frequency.value).toBe(0.08);
  });

  it('setParam dispatches to model', () => {
    const sonifier = new EnoBedSonifier();
    sonifier.init(ctx, output);
    
    sonifier.onParam('pitch', 220);
    const oscs = mockNodes.filter(n => n.frequency !== undefined && typeof n.start === 'function');
    
    // oscs[0] is the LFO, pad oscs are oscs[1] to oscs[4]
    expect(oscs.length).toBe(5);
    expect(oscs[1].frequency.value).toBe(220);
    expect(oscs[2].frequency.value).toBe(220);
    expect(oscs[3].frequency.value).toBe(220);
    expect(oscs[4].frequency.value).toBe(220);
  });

  it('destroy() nullifies model reference', () => {
    const sonifier = new EnoBedSonifier();
    sonifier.init(ctx, output);
    expect(sonifier._padModel).not.toBeNull();
    sonifier.destroy();
    expect(sonifier._padModel).toBeNull();
  });
});
