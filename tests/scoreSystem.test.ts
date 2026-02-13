import { describe, expect, it } from 'vitest';
import { applyJudgement, scoreForJudgement } from '../src/core/scoreSystem';
import { DEFAULT_RULES, INITIAL_SCORE_STATE } from '../src/core/types';

describe('ScoreSystem', () => {
  it('awards perfect and good points', () => {
    expect(scoreForJudgement('TOBULA', DEFAULT_RULES)).toBe(100);
    expect(scoreForJudgement('GERAI', DEFAULT_RULES)).toBe(50);
    expect(scoreForJudgement('PRALEISTA', DEFAULT_RULES)).toBe(0);
  });

  it('increments streak on non-miss', () => {
    const first = applyJudgement('GERAI', INITIAL_SCORE_STATE, DEFAULT_RULES);
    const second = applyJudgement('TOBULA', first, DEFAULT_RULES);
    expect(second.streak).toBe(2);
  });

  it('resets streak on miss', () => {
    const warmed = applyJudgement('TOBULA', INITIAL_SCORE_STATE, DEFAULT_RULES);
    const missed = applyJudgement('PRALEISTA', warmed, DEFAULT_RULES);
    expect(missed.streak).toBe(0);
    expect(missed.hypeActive).toBe(false);
  });

  it('activates hype at threshold and doubles points', () => {
    const rules = { ...DEFAULT_RULES, serijaIkiHype: 2 };
    const first = applyJudgement('TOBULA', INITIAL_SCORE_STATE, rules);
    const second = applyJudgement('TOBULA', first, rules);

    expect(second.hypeActive).toBe(true);
    expect(second.score).toBe(300);
  });
});
