import { translateCompilerError } from '../core/errorTranslator';
import {
  DEFAULT_RULES,
  type CompileResult,
  type DanceRules,
  type HorseHat,
  type HorseWeather,
} from '../core/types';
import { ensureDotnetRuntime } from './wasmRuntimeLoader';

function clampRules(rules: DanceRules): DanceRules {
  const allowedWeather = new Set<HorseWeather>(['SAULETA', 'LIETINGA', 'SNIEGAS', 'ZAIBAS']);
  const allowedHats = new Set<HorseHat>(['KLASIKINE', 'KAUBOJAUS', 'KARUNA', 'RAGANOS']);
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
  const kepuresTipas = allowedHats.has(rules.kepuresTipas)
    ? rules.kepuresTipas
    : DEFAULT_RULES.kepuresTipas;

  return {
    tobulasLangas: Math.min(0.2, Math.max(0.01, rules.tobulasLangas)),
    gerasLangas: Math.min(0.4, Math.max(0.02, rules.gerasLangas)),
    tobuliTaskai: Math.min(1000, Math.max(10, Math.round(rules.tobuliTaskai))),
    geriTaskai: Math.min(700, Math.max(5, Math.round(rules.geriTaskai))),
    serijaIkiHype: Math.min(50, Math.max(2, Math.round(rules.serijaIkiHype))),
    arklioSpalva,
    karciuSpalva,
    suKepure: rules.suKepure,
    kepuresTipas,
    oroEfektas,
  };
}

function parseWeatherField(source: string, field: keyof DanceRules): HorseWeather | null {
  const value = parseStringField(source, field);
  if (value === 'SAULETA' || value === 'LIETINGA' || value === 'SNIEGAS' || value === 'ZAIBAS') {
    return value;
  }

  return null;
}

function parseHatField(source: string, field: keyof DanceRules): HorseHat | null {
  const value = parseStringField(source, field);
  if (value === 'KLASIKINE' || value === 'KAUBOJAUS' || value === 'KARUNA' || value === 'RAGANOS') {
    return value;
  }

  return null;
}

function parseField(source: string, field: keyof DanceRules): number | null {
  const regex = new RegExp(`public\\s+(?:float|int)\\s+${field}\\s*=\\s*([0-9.]+)f?\\s*;`, 'i');
  const match = source.match(regex);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function parseNumericByFieldNames(source: string, ...fields: string[]): number | null {
  for (const field of fields) {
    const regex = new RegExp(`public\\s+(?:float|int)\\s+${field}\\s*=\\s*([0-9.]+)f?\\s*;`, 'i');
    const match = source.match(regex);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
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
      serijaIkiHype:
        parseNumericByFieldNames(source, 'serijaIkiUzsivedimo', 'serijaIkiHype') ??
        DEFAULT_RULES.serijaIkiHype,
      arklioSpalva: parseStringField(source, 'arklioSpalva') ?? DEFAULT_RULES.arklioSpalva,
      karciuSpalva: parseStringField(source, 'karciuSpalva') ?? DEFAULT_RULES.karciuSpalva,
      suKepure: parseBoolField(source, 'suKepure') ?? DEFAULT_RULES.suKepure,
      kepuresTipas: parseHatField(source, 'kepuresTipas') ?? DEFAULT_RULES.kepuresTipas,
      oroEfektas: parseWeatherField(source, 'oroEfektas') ?? DEFAULT_RULES.oroEfektas,
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
