import { describe, expect, it, vi } from 'vitest';
import type { CompileResult, DanceRules } from '../src/core/types';
import { DEFAULT_RULES } from '../src/core/types';
import { createLatestCompileApplier } from '../src/ui/compileFeedback';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function okResult(rules: DanceRules = DEFAULT_RULES): CompileResult {
  return {
    success: true,
    rules,
    errors: [],
    mode: 'fallback',
    syntaxEngine: 'none',
  };
}

function failResult(message = 'bad code'): CompileResult {
  return {
    success: false,
    rules: DEFAULT_RULES,
    errors: [message],
    mode: 'fallback',
    syntaxEngine: 'none',
  };
}

describe('createLatestCompileApplier', () => {
  it('applies only the latest compile result when older request resolves later', async () => {
    const slow = createDeferred<CompileResult>();
    const fast = createDeferred<CompileResult>();

    const compiler = {
      compile: vi.fn((source: string) => {
        return source === 'slow' ? slow.promise : fast.promise;
      }),
    };

    const setRules = vi.fn();
    const setCompileValidity = vi.fn();
    const applier = createLatestCompileApplier(compiler, { setRules, setCompileValidity });

    const slowRun = applier.apply('slow');
    const fastRun = applier.apply('fast');

    fast.resolve(okResult({ ...DEFAULT_RULES, tobuliTaskai: 222 }));
    await fastRun;

    expect(setCompileValidity).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ success: true }),
    );
    expect(setRules).toHaveBeenCalledWith(expect.objectContaining({ tobuliTaskai: 222 }));

    slow.resolve(okResult({ ...DEFAULT_RULES, tobuliTaskai: 111 }));
    await slowRun;

    expect(setRules).toHaveBeenCalledTimes(1);
    expect(setCompileValidity).toHaveBeenCalledTimes(1);
  });

  it('keeps latest invalid compile state when stale older success resolves afterwards', async () => {
    const slow = createDeferred<CompileResult>();
    const fast = createDeferred<CompileResult>();

    const compiler = {
      compile: vi.fn((source: string) => {
        return source === 'slow-success' ? slow.promise : fast.promise;
      }),
    };

    const setRules = vi.fn();
    const setCompileValidity = vi.fn();
    const applier = createLatestCompileApplier(compiler, { setRules, setCompileValidity });

    const slowRun = applier.apply('slow-success');
    const fastRun = applier.apply('fast-fail');

    fast.resolve(failResult('syntax error'));
    await fastRun;
    expect(setCompileValidity).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ success: false }),
    );

    slow.resolve(okResult({ ...DEFAULT_RULES, tobuliTaskai: 333 }));
    await slowRun;

    expect(setRules).not.toHaveBeenCalled();
    expect(setCompileValidity).toHaveBeenCalledTimes(1);
  });

  it('cancels previous in-flight compile request when a newer one starts', async () => {
    const compiler = {
      compile: vi.fn((source: string, options?: { signal?: AbortSignal }) => {
        if (source === 'slow') {
          return new Promise<CompileResult>((resolve, reject) => {
            options?.signal?.addEventListener('abort', () => {
              const abortError = new Error('Aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
            setTimeout(() => resolve(okResult({ ...DEFAULT_RULES, tobuliTaskai: 101 })), 20);
          });
        }
        return Promise.resolve(okResult({ ...DEFAULT_RULES, tobuliTaskai: 202 }));
      }),
    };

    const setRules = vi.fn();
    const setCompileValidity = vi.fn();
    const applier = createLatestCompileApplier(compiler, { setRules, setCompileValidity });

    const slowRun = applier.apply('slow');
    const fastRun = applier.apply('fast');

    await expect(slowRun).resolves.toBeNull();
    await expect(fastRun).resolves.toEqual(expect.objectContaining({ success: true }));
    expect(setRules).toHaveBeenCalledTimes(1);
    expect(setRules).toHaveBeenLastCalledWith(expect.objectContaining({ tobuliTaskai: 202 }));
    expect(setCompileValidity).toHaveBeenCalledTimes(1);
  });
});
