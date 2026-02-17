import { describe, expect, it } from 'vitest';
import { calculateJudgement, sanitizeWindows } from '../src/core/timingCalculator';
import { DEFAULT_RULES } from '../src/core/types';

describe('TimingCalculator', () => {
  it('returns TOBULA inside perfect window', () => {
    expect(calculateJudgement(0.03, DEFAULT_RULES)).toBe('TOBULA');
    expect(calculateJudgement(-0.05, DEFAULT_RULES)).toBe('TOBULA');
  });

  it('returns GERAI inside good window but outside perfect', () => {
    expect(calculateJudgement(0.1, DEFAULT_RULES)).toBe('GERAI');
  });

  it('returns PRALEISTA outside good window', () => {
    expect(calculateJudgement(0.2, DEFAULT_RULES)).toBe('PRALEISTA');
  });

  it('is symmetric for early/late offsets of same magnitude', () => {
    const offsets = [0, 0.01, 0.03, 0.07, 0.11, 0.2];
    for (const offset of offsets) {
      expect(calculateJudgement(offset, DEFAULT_RULES)).toBe(
        calculateJudgement(-offset, DEFAULT_RULES),
      );
    }
  });

  it('is monotonic when timing windows are widened', () => {
    const narrow = { ...DEFAULT_RULES, tobulasLangas: 0.04, gerasLangas: 0.09 };
    const wide = { ...DEFAULT_RULES, tobulasLangas: 0.07, gerasLangas: 0.14 };
    const rank: Record<'TOBULA' | 'GERAI' | 'PRALEISTA', number> = {
      PRALEISTA: 0,
      GERAI: 1,
      TOBULA: 2,
    };

    const offsets = [0, 0.02, 0.05, 0.08, 0.11, 0.18];
    for (const offset of offsets) {
      const narrowJudgement = calculateJudgement(offset, narrow);
      const wideJudgement = calculateJudgement(offset, wide);
      expect(rank[wideJudgement]).toBeGreaterThanOrEqual(rank[narrowJudgement]);
    }
  });

  it('sanitizes invalid windows', () => {
    const sanitized = sanitizeWindows({
      ...DEFAULT_RULES,
      tobulasLangas: -1,
      gerasLangas: 0.001,
    });

    expect(sanitized.tobulasLangas).toBe(0.01);
    expect(sanitized.gerasLangas).toBe(0.01);
  });
});
