import { describe, expect, it } from 'vitest';
import { buildBeatCoachState } from '../src/core/rhythmCoach';

describe('rhythmCoach', () => {
  it('shows waiting state when no next beat', () => {
    const state = buildBeatCoachState(1, null);
    expect(state.label).toContain('Laukiama');
    expect(state.progress).toBe(0);
    expect(state.urgent).toBe(false);
  });

  it('shows urgent now state near beat', () => {
    const state = buildBeatCoachState(1, 1.04);
    expect(state.label).toBe('DABAR!');
    expect(state.urgent).toBe(true);
  });

  it('shows countdown and valid progress before beat', () => {
    const state = buildBeatCoachState(1, 1.5, 2);
    expect(state.label).toContain('Kitas ritmas');
    expect(state.progress).toBeGreaterThan(0);
    expect(state.progress).toBeLessThanOrEqual(1);
  });
});
