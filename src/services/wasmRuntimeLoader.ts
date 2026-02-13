let wasmReady = false;

async function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-src="${src}"]`);
    if (existing) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
}

export async function ensureDotnetRuntime(): Promise<boolean> {
  if (wasmReady) {
    return true;
  }

  const candidates = [
    './dotnet/dotnet.js',
    'https://cdn.jsdelivr.net/npm/dotnet-runtime@8.0.0/dotnet.js',
  ];

  for (const candidate of candidates) {
    const ok = await loadScript(candidate);
    if (ok) {
      wasmReady = true;
      return true;
    }
  }

  return false;
}
