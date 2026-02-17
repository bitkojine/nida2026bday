import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkWithRealCompiler } from '../src/services/realCompilerService';

const originalFetch = globalThis.fetch;

describe('realCompilerService', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses default API URL when env var is not configured', async () => {
    vi.unstubAllEnvs();
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          valid: true,
          diagnostics: [],
          compiler: 'Roslyn C#',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const result = await checkWithRealCompiler('public class DanceRules {}');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://nida2026bday-real-compiler.onrender.com/api/csharp/compile',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result).toMatchObject({
      kind: 'ok',
      valid: true,
      compiler: 'Roslyn C#',
    });
  });

  it('calls API and returns successful compiler response', async () => {
    vi.stubEnv('VITE_REAL_COMPILER_API_URL', 'https://compiler.example');
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          valid: false,
          diagnostics: ['CS1002 (2,10): ; expected'],
          compiler: 'Roslyn C#',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const result = await checkWithRealCompiler('code');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://compiler.example/api/csharp/compile',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'ok',
        valid: false,
        diagnostics: ['CS1002 (2,10): ; expected'],
        compiler: 'Roslyn C#',
        details: expect.objectContaining({
          endpoint: 'https://compiler.example/api/csharp/compile',
          responseStatus: 200,
        }),
      }),
    );
  });

  it('returns error when API is unreachable', async () => {
    vi.stubEnv('VITE_REAL_COMPILER_API_URL', 'https://compiler.example');
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('network failed');
    }) as unknown as typeof fetch;

    const result = await checkWithRealCompiler('code');
    expect(result).toMatchObject({ kind: 'error' });
    expect(result.details).toEqual(
      expect.objectContaining({
        endpoint: 'https://compiler.example/api/csharp/compile',
        responseStatus: null,
      }),
    );
  });

  it('times out real compiler request and returns explicit timeout error', async () => {
    vi.stubEnv('VITE_REAL_COMPILER_API_URL', 'https://compiler.example');
    globalThis.fetch = vi.fn((_, init) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => {
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      });
    }) as unknown as typeof fetch;

    const result = await checkWithRealCompiler('code', { timeoutMs: 30 });
    expect(result).toMatchObject({
      kind: 'error',
      reason: expect.stringContaining('viršytas tikrinimo laikas'),
      details: expect.objectContaining({
        endpoint: 'https://compiler.example/api/csharp/compile',
        responseStatus: null,
      }),
    });
  });
});
