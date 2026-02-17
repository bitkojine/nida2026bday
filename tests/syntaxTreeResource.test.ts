import { describe, expect, it, vi } from 'vitest';
import { withParsedSyntaxTree } from '../src/services/syntaxTreeResource';

describe('syntaxTreeResource', () => {
  it('returns parsed=false when parser returns null', () => {
    const parser = {
      parse: vi.fn(() => null),
    };
    const result = withParsedSyntaxTree(parser, 'source', () => null);
    expect(result).toEqual({ parsed: false });
  });

  it('always deletes tree when callback succeeds', () => {
    const deleteSpy = vi.fn();
    const parser = {
      parse: vi.fn(() => ({ delete: deleteSpy })),
    };
    const result = withParsedSyntaxTree(parser, 'source', () => 42);

    expect(result).toEqual({ parsed: true, value: 42 });
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('always deletes tree when callback throws', () => {
    const deleteSpy = vi.fn();
    const parser = {
      parse: vi.fn(() => ({ delete: deleteSpy })),
    };

    expect(() =>
      withParsedSyntaxTree(parser, 'source', () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});
