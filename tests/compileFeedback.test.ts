import { describe, expect, it, vi } from 'vitest';
import type { CompileResult, DanceRules } from '../src/core/types';
import { DEFAULT_RULES } from '../src/core/types';
import { applyCompileResult, wireFallbackCompiler } from '../src/ui/compileFeedback';

function okResult(rules: DanceRules = DEFAULT_RULES): CompileResult {
  return {
    success: true,
    rules,
    errors: [],
    mode: 'fallback',
  };
}

describe('compileFeedback', () => {
  it('updates rules immediately for successful compile', () => {
    const compiler = {
      compile: vi.fn(() => okResult()),
    };
    const setRules = vi.fn();

    applyCompileResult('code', compiler, { setRules });

    expect(compiler.compile).toHaveBeenCalledWith('code');
    expect(setRules).toHaveBeenCalledTimes(1);
  });

  it('keeps previous rules on compiler failure', () => {
    const compiler = {
      compile: vi.fn(
        (): CompileResult => ({
          success: false,
          rules: DEFAULT_RULES,
          errors: ['Blogas kodas'],
          mode: 'fallback',
        }),
      ),
    };
    const setRules = vi.fn();

    applyCompileResult('bad', compiler, { setRules });

    expect(setRules).not.toHaveBeenCalled();
  });

  it('runs compile immediately in fallback editor setup', () => {
    const textarea = document.createElement('textarea');
    const compiler = {
      compile: vi.fn(() => okResult({ ...DEFAULT_RULES, tobuliTaskai: 111 })),
    };
    const setRules = vi.fn();

    wireFallbackCompiler(textarea, 'initial code', compiler, { setRules });

    expect(textarea.value).toBe('initial code');
    expect(compiler.compile).toHaveBeenCalledTimes(1);
    expect(compiler.compile).toHaveBeenCalledWith('initial code');
    expect(setRules).toHaveBeenCalledTimes(1);
  });
});
