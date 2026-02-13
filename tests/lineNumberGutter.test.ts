import { describe, expect, it } from 'vitest';
import { buildWrappedLineNumbers } from '../src/ui/lineNumberGutter';

describe('lineNumberGutter', () => {
  it('returns one row per source line when wrapping does not occur', () => {
    const source = ['abc', 'def', 'ghi'].join('\n');
    expect(buildWrappedLineNumbers(source, 20)).toBe(['1', '2', '3'].join('\n'));
  });

  it('adds continuation markers for wrapped visual rows', () => {
    const source = ['0123456789', 'x'].join('\n');
    expect(buildWrappedLineNumbers(source, 4)).toBe(['1', '↳', '↳', '2'].join('\n'));
  });

  it('treats tabs as width-2 to match editor wrap behavior', () => {
    const source = '\t\tab';
    expect(buildWrappedLineNumbers(source, 3)).toBe(['1', '↳'].join('\n'));
  });
});
