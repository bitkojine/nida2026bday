import type { CompileResult, DanceRules } from '../core/types';

type MaybePromise<T> = T | Promise<T>;

export interface CompileServiceLike {
  compile(source: string): CompileResult;
}

export interface CompileRequestOptions {
  signal?: AbortSignal;
}

export interface AsyncCompileServiceLike {
  compile(source: string, options?: CompileRequestOptions): MaybePromise<CompileResult>;
}

export interface CompileFeedbackSinks {
  setRules(next: DanceRules): void;
  setCompileValidity?(isValid: boolean, result: CompileResult): void;
}

export function applyCompileResult(
  source: string,
  compiler: CompileServiceLike,
  sinks: CompileFeedbackSinks,
): void {
  const result = compiler.compile(source);
  sinks.setCompileValidity?.(result.success, result);
  if (result.success) {
    sinks.setRules(result.rules);
  }
}

export function wireFallbackCompiler(
  textarea: HTMLTextAreaElement,
  initialCode: string,
  compiler: CompileServiceLike,
  sinks: CompileFeedbackSinks,
): void {
  textarea.value = initialCode;

  const runCompile = (): void => {
    applyCompileResult(textarea.value, compiler, sinks);
  };

  textarea.addEventListener('input', runCompile);
  runCompile();
}

export function createLatestCompileApplier(
  compiler: AsyncCompileServiceLike,
  sinks: CompileFeedbackSinks,
): {
  apply(source: string): Promise<CompileResult | null>;
} {
  let latestToken = 0;
  let activeController: AbortController | null = null;

  const isAbortError = (error: unknown): boolean => {
    if (error instanceof DOMException) {
      return error.name === 'AbortError';
    }
    return error instanceof Error && error.name === 'AbortError';
  };

  return {
    async apply(source: string): Promise<CompileResult | null> {
      const token = ++latestToken;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;

      let result: CompileResult;
      try {
        result = await compiler.compile(source, { signal: controller.signal });
      } catch (error) {
        if (isAbortError(error)) {
          return null;
        }
        throw error;
      } finally {
        if (activeController === controller) {
          activeController = null;
        }
      }

      if (token !== latestToken || controller.signal.aborted) {
        return result;
      }

      sinks.setCompileValidity?.(result.success, result);
      if (result.success) {
        sinks.setRules(result.rules);
      }
      return result;
    },
  };
}
