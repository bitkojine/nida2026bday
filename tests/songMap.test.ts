import { describe, expect, it } from 'vitest';
import { DEFAULT_SONG_MAP } from '../src/core/songMap';

describe('DEFAULT_SONG_MAP', () => {
  it('uses all lanes for varied gameplay', () => {
    const lanes = new Set(DEFAULT_SONG_MAP.map((step) => step.lane));
    expect(lanes).toEqual(new Set([0, 1, 2, 3]));
  });

  it('contains multiple hold notes including long holds', () => {
    const holds = DEFAULT_SONG_MAP.filter((step) => (step.holdBeats ?? 0) > 0);
    expect(holds.length).toBeGreaterThanOrEqual(3);
    expect(holds.some((step) => (step.holdBeats ?? 0) >= 2.5)).toBe(true);
  });

  it('mixes note spacing to feel less repetitive', () => {
    const spacing = new Set(DEFAULT_SONG_MAP.map((step) => step.spacingBeats ?? 1));
    expect(spacing.has(1)).toBe(true);
    expect(spacing.has(2)).toBe(true);
    expect(spacing.has(4)).toBe(true);
  });

  it('starts with the recognizable Happy Birthday opening melody contour', () => {
    const firstSix = DEFAULT_SONG_MAP.slice(0, 6).map((step) => step.toneHz);
    expect(firstSix).toEqual([392, 392, 440, 392, 523.25, 493.88]);
  });
});
