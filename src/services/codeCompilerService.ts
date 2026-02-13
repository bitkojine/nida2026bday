import { translateCompilerError } from '../core/errorTranslator';
import { DEFAULT_RULES, type CompileResult, type DanceRules } from '../core/types';
import { ensureDotnetRuntime } from './wasmRuntimeLoader';

function clampRules(rules: DanceRules): DanceRules {
  const allowedWeather = new Set(['SAULETA', 'LIETINGA', 'SNIEGAS']);
  const colorPattern = /^#[0-9a-f]{6}$/i;
  const arklioSpalva = colorPattern.test(rules.arklioSpalva)
    ? rules.arklioSpalva
    : DEFAULT_RULES.arklioSpalva;
  const karciuSpalva = colorPattern.test(rules.karciuSpalva)
    ? rules.karciuSpalva
    : DEFAULT_RULES.karciuSpalva;
  const oroEfektas = allowedWeather.has(rules.oroEfektas)
    ? rules.oroEfektas
    : DEFAULT_RULES.oroEfektas;

  return {
    tobulasLangas: Math.min(0.2, Math.max(0.01, rules.tobulasLangas)),
    gerasLangas: Math.min(0.4, Math.max(0.02, rules.gerasLangas)),
    tobuliTaskai: Math.min(1000, Math.max(10, Math.round(rules.tobuliTaskai))),
    geriTaskai: Math.min(700, Math.max(5, Math.round(rules.geriTaskai))),
    serijaIkiHype: Math.min(50, Math.max(2, Math.round(rules.serijaIkiHype))),
    arklioSpalva,
    karciuSpalva,
    suKepure: rules.suKepure,
    oroEfektas,
  };
}

function parseField(source: string, field: keyof DanceRules): number | null {
  const regex = new RegExp(`public\\s+(?:float|int)\\s+${field}\\s*=\\s*([0-9.]+)f?\\s*;`, 'i');
  const match = source.match(regex);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function parseStringField(source: string, field: keyof DanceRules): string | null {
  const regex = new RegExp(`public\\s+string\\s+${field}\\s*=\\s*"([^"]+)"\\s*;`, 'i');
  const match = source.match(regex);
  if (!match) {
    return null;
  }

  return match[1];
}

function parseBoolField(source: string, field: keyof DanceRules): boolean | null {
  const regex = new RegExp(`public\\s+bool\\s+${field}\\s*=\\s*(true|false)\\s*;`, 'i');
  const match = source.match(regex);
  if (!match) {
    return null;
  }

  return match[1].toLowerCase() === 'true';
}

function hasBalancedBraces(source: string): boolean {
  let balance = 0;
  for (const char of source) {
    if (char === '{') {
      balance += 1;
    }

    if (char === '}') {
      balance -= 1;
      if (balance < 0) {
        return false;
      }
    }
  }

  return balance === 0;
}

export class CodeCompilerService {
  private lastValidRules: DanceRules = DEFAULT_RULES;

  private runtimeMode: 'wasm' | 'fallback' = 'fallback';

  async init(): Promise<void> {
    const wasmReady = await ensureDotnetRuntime();
    this.runtimeMode = wasmReady ? 'wasm' : 'fallback';
  }

  compile(source: string): CompileResult {
    if (!source.includes('class DanceRules')) {
      return {
        success: false,
        rules: this.lastValidRules,
        errors: [translateCompilerError('identifier class DanceRules not found')],
        mode: this.runtimeMode,
      };
    }

    if (!hasBalancedBraces(source)) {
      return {
        success: false,
        rules: this.lastValidRules,
        errors: [translateCompilerError('brace mismatch expected }')],
        mode: this.runtimeMode,
      };
    }

    const draft: DanceRules = {
      tobulasLangas: parseField(source, 'tobulasLangas') ?? DEFAULT_RULES.tobulasLangas,
      gerasLangas: parseField(source, 'gerasLangas') ?? DEFAULT_RULES.gerasLangas,
      tobuliTaskai: parseField(source, 'tobuliTaskai') ?? DEFAULT_RULES.tobuliTaskai,
      geriTaskai: parseField(source, 'geriTaskai') ?? DEFAULT_RULES.geriTaskai,
      serijaIkiHype: parseField(source, 'serijaIkiHype') ?? DEFAULT_RULES.serijaIkiHype,
      arklioSpalva: parseStringField(source, 'arklioSpalva') ?? DEFAULT_RULES.arklioSpalva,
      karciuSpalva: parseStringField(source, 'karciuSpalva') ?? DEFAULT_RULES.karciuSpalva,
      suKepure: parseBoolField(source, 'suKepure') ?? DEFAULT_RULES.suKepure,
      oroEfektas: parseStringField(source, 'oroEfektas') ?? DEFAULT_RULES.oroEfektas,
    };

    const safe = clampRules(draft);
    if (safe.gerasLangas < safe.tobulasLangas) {
      return {
        success: false,
        rules: this.lastValidRules,
        errors: ['Geras langas negali būti mažesnis už tobulą langą.'],
        mode: this.runtimeMode,
      };
    }

    this.lastValidRules = safe;

    return {
      success: true,
      rules: safe,
      errors: [],
      mode: this.runtimeMode,
    };
  }
}
