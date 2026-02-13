import type { CompileResult, DanceRules } from '../core/types';

export interface CompileServiceLike {
  compile(source: string): CompileResult;
}

export interface CompileFeedbackSinks {
  setRules(next: DanceRules): void;
  setStatus(next: string): void;
}

export function applyCompileResult(
  source: string,
  compiler: CompileServiceLike,
  sinks: CompileFeedbackSinks,
): void {
  const result = compiler.compile(source);
  if (result.success) {
    const runtimeLabel = result.mode === 'fallback' ? 'SUDERINAMAS REŽIMAS' : '.NET WASM';
    sinks.setRules(result.rules);
    sinks.setStatus(`Paruošta (${runtimeLabel})`);
    return;
  }

  sinks.setStatus(result.errors[0] ?? 'Klaida');
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
