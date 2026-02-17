import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkWithRealCompiler } from '../src/services/realCompilerService';

const originalFetch = globalThis.fetch;

describe('realCompilerService', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns unavailable when API url is not configured', async () => {
    vi.unstubAllEnvs();
    const result = await checkWithRealCompiler('public class DanceRules {}');
    expect(result).toMatchObject({ kind: 'unavailable' });
    expect(result.details).toEqual(
      expect.objectContaining({
        endpoint: '',
        requestMethod: 'POST',
        responseStatus: null,
      }),
    );
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
});
