import { describe, expect, it } from 'vitest';
import { DEDICATION_TEXT, shouldShowDedication } from '../src/core/dedicationBanner';

describe('DedicationBanner', () => {
  it('contains required emotional dedication meaning', () => {
    expect(DEDICATION_TEXT).toContain('Nidai');
    expect(DEDICATION_TEXT).toContain('Roberto');
    expect(DEDICATION_TEXT).toContain('gimtadieniu');
  });

  it('is visible on splash and start only', () => {
    expect(shouldShowDedication('splash')).toBe(false);
    expect(shouldShowDedication('start')).toBe(false);
    expect(shouldShowDedication('play')).toBe(true);
  });
});
