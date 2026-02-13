import { describe, expect, it } from 'vitest';
import { RhythmEngine } from '../src/core/rhythmEngine';
import { DEFAULT_RULES } from '../src/core/types';

describe('RhythmEngine', () => {
  it('generates upcoming beats deterministically', () => {
    const engine = new RhythmEngine(120, 0);
    engine.update(0);

    const upcoming = engine.getUpcoming(0, 1);
    expect(upcoming.length).toBeGreaterThan(1);
    expect(upcoming[0]).toBe(0);
  });

  it('judges near hit as TOBULA and consumes beat', () => {
    const engine = new RhythmEngine(120, 0);
    engine.update(0.1);

    expect(engine.registerHit(0.02, DEFAULT_RULES)).toBe('TOBULA');
    expect(engine.registerHit(0.02, DEFAULT_RULES)).toBe('PRALEISTA');
  });

  it('classifies too-early and too-late lane misses', () => {
    const engine = new RhythmEngine(120, 0);
    engine.update(0.1);

    const early = engine.evaluateLaneHit(-0.2, DEFAULT_RULES, 0);
    expect(early.judgement).toBe('PRALEISTA');
    expect(early.timing).toBe('early');

    const late = engine.evaluateLaneHit(0.3, DEFAULT_RULES, 0);
    expect(late.judgement).toBe('PRALEISTA');
    expect(late.timing).toBe('late');
  });
});
