export interface RealCompilerSuccessResult {
  kind: 'ok';
  valid: boolean;
  diagnostics: string[];
  compiler: string;
}

export interface RealCompilerUnavailableResult {
  kind: 'unavailable';
  reason: string;
}

export interface RealCompilerErrorResult {
  kind: 'error';
  reason: string;
}

export interface RealCompilerAbortedResult {
  kind: 'aborted';
}

export type RealCompilerCheckResult =
  | RealCompilerSuccessResult
  | RealCompilerUnavailableResult
  | RealCompilerErrorResult
  | RealCompilerAbortedResult;

interface RealCompilerApiPayload {
  valid: boolean;
  diagnostics?: unknown;
  compiler?: unknown;
}

function readRealCompilerApiUrl(): string {
  const value = import.meta.env.VITE_REAL_COMPILER_API_URL;
  return typeof value === 'string' ? value.trim() : '';
}

function parseDiagnostics(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter((line) => line.trim().length > 0);
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }
  return error instanceof Error && error.name === 'AbortError';
}

export async function checkWithRealCompiler(
  source: string,
  options?: { signal?: AbortSignal },
): Promise<RealCompilerCheckResult> {
  const apiUrl = readRealCompilerApiUrl();
  if (!apiUrl) {
    return {
      kind: 'unavailable',
      reason: 'nenurodytas VITE_REAL_COMPILER_API_URL adresas.',
    };
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/csharp/compile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ source }),
      signal: options?.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return { kind: 'aborted' };
    }
    return {
      kind: 'error',
      reason: 'nepavyko pasiekti kompiliatoriaus API.',
    };
  }

  let payload: RealCompilerApiPayload | null = null;
  try {
    payload = (await response.json()) as RealCompilerApiPayload;
  } catch {
    payload = null;
  }

  if (!response.ok || payload === null || typeof payload.valid !== 'boolean') {
    return {
      kind: 'error',
      reason: 'kompiliatoriaus API grąžino netinkamą atsakymą.',
    };
  }

  return {
    kind: 'ok',
    valid: payload.valid,
    diagnostics: parseDiagnostics(payload.diagnostics),
    compiler: typeof payload.compiler === 'string' ? payload.compiler : 'Roslyn',
  };
}
