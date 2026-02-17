export interface RealCompilerDebugDetails {
  endpoint: string;
  requestMethod: 'POST';
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseStatus: number | null;
  responseBody: string | null;
  checkedAtIso: string;
}

export interface RealCompilerSuccessResult {
  kind: 'ok';
  valid: boolean;
  diagnostics: string[];
  compiler: string;
  details: RealCompilerDebugDetails;
}

export interface RealCompilerUnavailableResult {
  kind: 'unavailable';
  reason: string;
  details: RealCompilerDebugDetails;
}

export interface RealCompilerErrorResult {
  kind: 'error';
  reason: string;
  details: RealCompilerDebugDetails;
}

export interface RealCompilerAbortedResult {
  kind: 'aborted';
  details: RealCompilerDebugDetails;
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

const DEFAULT_REAL_COMPILER_API_URL = 'https://nida2026bday-real-compiler.onrender.com';
const REAL_COMPILER_TIMEOUT_MS = 6000;

function readRealCompilerApiUrl(): string {
  const value = import.meta.env.VITE_REAL_COMPILER_API_URL;
  const configured = typeof value === 'string' ? value.trim() : '';
  if (configured.length > 0) {
    return configured;
  }
  return DEFAULT_REAL_COMPILER_API_URL;
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
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<RealCompilerCheckResult> {
  const apiUrl = readRealCompilerApiUrl();
  const endpoint = `${apiUrl.replace(/\/$/, '')}/api/csharp/compile`;
  const requestBody = JSON.stringify({ source });
  const baseDetails: RealCompilerDebugDetails = {
    endpoint,
    requestMethod: 'POST',
    requestHeaders: { 'content-type': 'application/json' },
    requestBody,
    responseStatus: null,
    responseBody: null,
    checkedAtIso: new Date().toISOString(),
  };
  if (!apiUrl) {
    return {
      kind: 'unavailable',
      reason: 'nėra kompiliatoriaus API adreso.',
      details: {
        ...baseDetails,
        endpoint: '',
      },
    };
  }

  let response: Response;
  const timeoutMs = Math.max(500, Math.floor(options?.timeoutMs ?? REAL_COMPILER_TIMEOUT_MS));
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = options?.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  if (options?.signal?.aborted) {
    return { kind: 'aborted', details: baseDetails };
  }

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: requestBody,
      signal: requestSignal,
    });
  } catch (error) {
    if (timeoutSignal.aborted && !(options?.signal?.aborted ?? false)) {
      return {
        kind: 'error',
        reason: `viršytas tikrinimo laikas (${timeoutMs} ms).`,
        details: baseDetails,
      };
    }
    if (isAbortError(error)) {
      return { kind: 'aborted', details: baseDetails };
    }
    return {
      kind: 'error',
      reason: 'nepavyko pasiekti kompiliatoriaus API.',
      details: baseDetails,
    };
  }

  const responseText = await response.text().catch(() => '');
  const details: RealCompilerDebugDetails = {
    ...baseDetails,
    responseStatus: response.status,
    responseBody: responseText,
  };

  let payload: RealCompilerApiPayload | null = null;
  try {
    payload = JSON.parse(responseText) as RealCompilerApiPayload;
  } catch {
    payload = null;
  }

  if (!response.ok || payload === null || typeof payload.valid !== 'boolean') {
    return {
      kind: 'error',
      reason: 'kompiliatoriaus API grąžino netinkamą atsakymą.',
      details,
    };
  }

  return {
    kind: 'ok',
    valid: payload.valid,
    diagnostics: parseDiagnostics(payload.diagnostics),
    compiler: typeof payload.compiler === 'string' ? payload.compiler : 'Roslyn',
    details,
  };
}
