const apiBase =
  process.env.VITE_REAL_COMPILER_API_URL ??
  process.env.REAL_COMPILER_API_URL ??
  'https://nida2026bday-real-compiler.onrender.com';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        const isRetryable = response.status >= 500 && response.status <= 599;
        if (isRetryable && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
          continue;
        }
        throw new Error(`HTTP ${response.status} from ${url}`);
      }
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error(`Nepavyko gauti atsako iš ${url}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

async function main(): Promise<void> {
  const base = trimTrailingSlash(apiBase);
  const healthRaw = await fetchJson(`${base}/health`);
  const health = asRecord(healthRaw);
  assert(health.ok === true, 'Backend /health turi grąžinti ok=true');
  assert(typeof health.compiler === 'string', 'Backend /health turi grąžinti compiler tekstą');

  const validSource = `public class DanceRules { public int X = 1; }`;
  const invalidSource = `public class DanceRules { public int X = ; }`;

  const validRaw = await fetchJson(`${base}/api/csharp/compile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source: validSource }),
  });
  const valid = asRecord(validRaw);
  assert(valid.valid === true, 'Roslyn API turi priimti validų C# kodą');
  assert(Array.isArray(valid.diagnostics), 'Roslyn API turi grąžinti diagnostics masyvą');

  const invalidRaw = await fetchJson(`${base}/api/csharp/compile`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source: invalidSource }),
  });
  const invalid = asRecord(invalidRaw);
  assert(invalid.valid === false, 'Roslyn API turi atmesti neteisingą C# kodą');
  const diagnostics = Array.isArray(invalid.diagnostics) ? invalid.diagnostics : [];
  assert(diagnostics.length > 0, 'Roslyn API turi grąžinti bent vieną klaidą invalid kodui');

  console.log(
    `Real compiler backend OK: ${base} (health + valid compile + invalid compile rejected).`,
  );
}

void main();
