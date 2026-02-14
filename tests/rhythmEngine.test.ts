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
    const earlyEngine = new RhythmEngine(120, 0, [0]);
    earlyEngine.update(0.1);

    const early = earlyEngine.evaluateLaneHit(-0.2, DEFAULT_RULES, 0);
    expect(early.judgement).toBe('PRALEISTA');
    expect(early.timing).toBe('early');

    const lateEngine = new RhythmEngine(120, 0, [0]);
    lateEngine.update(0.1);
    const late = lateEngine.evaluateLaneHit(0.2, DEFAULT_RULES, 0);
    expect(late.judgement).toBe('PRALEISTA');
    expect(late.timing).toBe('late');
  });

  it('consumes a note after an early miss so it cannot be replayed', () => {
    const engine = new RhythmEngine(120, 0, [0]);
    engine.update(0.1);

    const early = engine.evaluateLaneHit(-0.2, DEFAULT_RULES, 0);
    expect(early.judgement).toBe('PRALEISTA');
    expect(early.timing).toBe('early');

    const retry = engine.evaluateLaneHit(0, DEFAULT_RULES, 0);
    expect(retry.judgement).toBe('PRALEISTA');
  });

  it('exposes hold note metadata and returns hold evaluation on hit', () => {
    const engine = new RhythmEngine(120, 0, [
      { lane: 0, spacingBeats: 1, holdBeats: 2.5 },
      { lane: 1, spacingBeats: 1, holdBeats: 0 },
    ]);
    engine.update(0);

    const holds = engine.getBeatsInRange(0, 3).filter((beat) => beat.holdDurationSec > 0);
    expect(holds.length).toBeGreaterThan(0);

    const hold = holds[0];
    const evaluation = engine.evaluateLaneHit(hold.timeSec, DEFAULT_RULES, 0);
    expect(evaluation.judgement).toBe('TOBULA');
    expect(evaluation.noteType).toBe('hold');
    expect(evaluation.holdEndSec).toBeGreaterThan(hold.timeSec);
  });

  it('can include matched beats for song scheduling when requested', () => {
    const engine = new RhythmEngine(120, 0, [0]);
    engine.update(0.1);

    const beat = engine.getBeatsInRange(-0.1, 1)[0];
    expect(beat).toBeDefined();
    if (!beat) {
      return;
    }

    const evalResult = engine.evaluateLaneHit(beat.timeSec, DEFAULT_RULES, beat.lane);
    expect(evalResult.judgement).toBe('TOBULA');

    const unmatched = engine.getBeatsInRange(-0.1, 1);
    expect(unmatched.some((candidate) => candidate.id === beat.id)).toBe(false);

    const withMatched = engine.getBeatsInRange(-0.1, 1, true);
    expect(withMatched.some((candidate) => candidate.id === beat.id)).toBe(true);
  });
});
