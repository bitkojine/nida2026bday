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
});
