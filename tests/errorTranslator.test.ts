import { describe, expect, it } from 'vitest';
import { translateCompilerError } from '../src/core/errorTranslator';

describe('ErrorTranslator', () => {
  it('translates expected syntax errors', () => {
    expect(translateCompilerError('expected ;')).toContain('trūksta simbolio');
  });

  it('translates identifier errors', () => {
    expect(translateCompilerError('identifier not found')).toContain('pavadinimas');
  });

  it('falls back to generic for unknown errors', () => {
    expect(translateCompilerError('super-random')).toContain('super-random');
  });

  it('handles empty messages', () => {
    expect(translateCompilerError('   ')).toContain('Nepavyko');
  });
});
