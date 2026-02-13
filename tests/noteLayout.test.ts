import { describe, expect, it } from 'vitest';
import {
  computeNoteYPercent,
  HIT_LINE_PERCENT,
  NOTE_BOTTOM_PERCENT,
  NOTE_TOP_PERCENT,
} from '../src/core/noteLayout';

describe('noteLayout', () => {
  it('places exact beat on hit line', () => {
    const y = computeNoteYPercent(0, 2, 0.25);
    expect(y).toBe(HIT_LINE_PERCENT);
  });

  it('places far future note near top', () => {
    const y = computeNoteYPercent(2, 2, 0.25);
    expect(y).toBe(NOTE_TOP_PERCENT);
  });

  it('places late note near bottom', () => {
    const y = computeNoteYPercent(-0.25, 2, 0.25);
    expect(y).toBe(NOTE_BOTTOM_PERCENT);
  });
});
