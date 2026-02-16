import type { CompileResult, DanceRules } from '../core/types';

export interface CompileServiceLike {
  compile(source: string): CompileResult;
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
