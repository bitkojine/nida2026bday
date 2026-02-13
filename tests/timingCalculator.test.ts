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
