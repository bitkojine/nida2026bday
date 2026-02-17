import { translateCompilerError } from '../core/errorTranslator';
import { Language, Parser, type Node as SyntaxNode } from 'web-tree-sitter';
import csharpGrammarWasmUrl from 'tree-sitter-c-sharp/tree-sitter-c_sharp.wasm?url';
import { withParsedSyntaxTree } from './syntaxTreeResource';
import {
  DEFAULT_RULES,
  HORSE_COLOR_NAMES,
  HORSE_HATS,
  HORSE_WEATHERS,
  type CompileResult,
  type DanceRules,
  type HorseColorName,
  type HorseHat,
  type HorseWeather,
} from '../core/types';
import { ensureDotnetRuntime } from './wasmRuntimeLoader';

type ParseStatus<T> =
  | { kind: 'missing' }
  | { kind: 'ok'; value: T }
  | { kind: 'invalid'; message: string };

function validateEnumDefinition(
  source: string,
  enumName: string,
  requiredMembers: readonly string[],
): string | null {
  const enumBlockRegex = new RegExp(`public\\s+enum\\s+${enumName}\\s*\\{([\\s\\S]*?)\\}`, 'i');
  const enumMatch = source.match(enumBlockRegex);
  if (!enumMatch) {
    return `Nerastas enum ${enumName} aprašas arba sugadintas "public enum ${enumName}" raktinis žodis.`;
  }

  const rawBody = enumMatch[1].replace(/\/\/.*$/gm, '').trim();
  if (!rawBody) {
    return `Enum ${enumName} neturi narių.`;
  }
  if (rawBody.includes(';')) {
    return `Enum ${enumName} nariai turi būti atskirti kableliais, ne kabliataškiais.`;
  }

  const memberSegments = rawBody
    .split(',')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (memberSegments.length === 0) {
    return `Enum ${enumName} nariai neaptikti.`;
  }

  const members: string[] = [];
  for (const segment of memberSegments) {
    const identifiers = segment.match(/[A-Za-z_]\w*/g) ?? [];
    if (identifiers.length !== 1) {
      return `Enum ${enumName} narių sintaksė neteisinga (tikėtina trūksta kablelio arba yra nereikalingas tekstas).`;
    }
    members.push(identifiers[0]);
  }

  const memberSet = new Set(members);
  if (memberSet.size !== members.length) {
    return `Enum ${enumName} turi pasikartojančių narių.`;
  }

  for (const member of requiredMembers) {
    if (!memberSet.has(member)) {
      return `Enum ${enumName} trūksta privalomo nario "${member}".`;
    }
  }

  return null;
}

function clampRules(rules: DanceRules): DanceRules {
  const allowedColors = new Set<HorseColorName>(HORSE_COLOR_NAMES);
  const allowedWeather = new Set<HorseWeather>(HORSE_WEATHERS);
  const allowedHats = new Set<HorseHat>(HORSE_HATS);
  const arklioSpalva = allowedColors.has(rules.arklioSpalva)
    ? rules.arklioSpalva
    : DEFAULT_RULES.arklioSpalva;
  const karciuSpalva = allowedColors.has(rules.karciuSpalva)
    ? rules.karciuSpalva
    : DEFAULT_RULES.karciuSpalva;
  const akiuSpalva = allowedColors.has(rules.akiuSpalva)
    ? rules.akiuSpalva
    : DEFAULT_RULES.akiuSpalva;
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
    akiuSpalva,
    arklioSpalva,
    karciuSpalva,
    suKepure: rules.suKepure,
    kepuresTipas,
    oroEfektas,
  };
}

function parseNumericFieldStrict(source: string, field: string): ParseStatus<number> {
  const strictRegex = new RegExp(
    `public\\s+(?:float|int)\\s+${field}\\s*=\\s*([-+]?(?:\\d+\\.?\\d*|\\.\\d+))f?\\s*;`,
    'i',
  );
  const strictMatch = source.match(strictRegex);
  if (strictMatch) {
    const parsed = Number(strictMatch[1]);
    if (Number.isFinite(parsed)) {
      return { kind: 'ok', value: parsed };
    }
  }

  const looseRegex = new RegExp(`public\\s+(?:float|int)\\s+${field}\\s*=`, 'i');
  if (looseRegex.test(source)) {
    return {
      kind: 'invalid',
      message: `Lauko ${field} reikšmė turi būti skaičius ir sakinys turi baigtis kabliataškiu.`,
    };
  }

  return { kind: 'missing' };
}

function parseBoolFieldStrict(source: string, field: string): ParseStatus<boolean> {
  const strictRegex = new RegExp(`public\\s+bool\\s+${field}\\s*=\\s*(true|false)\\s*;`, 'i');
  const strictMatch = source.match(strictRegex);
  if (strictMatch) {
    return { kind: 'ok', value: strictMatch[1].toLowerCase() === 'true' };
  }

  const looseRegex = new RegExp(`public\\s+bool\\s+${field}\\s*=`, 'i');
  if (looseRegex.test(source)) {
    return {
      kind: 'invalid',
      message: `Lauko ${field} reikšmė turi būti true arba false ir sakinys turi baigtis kabliataškiu.`,
    };
  }

  return { kind: 'missing' };
}

function parseEnumFieldStrict(
  source: string,
  field: string,
  validValues: readonly string[],
): ParseStatus<string> {
  const strictRegex = new RegExp(
    `public\\s+[A-Za-z_]\\w*\\s+${field}\\s*=\\s*(?:[A-Za-z_]\\w*\\.)?([A-Za-z_]\\w*)\\s*;`,
    'i',
  );
  const strictMatch = source.match(strictRegex);
  if (strictMatch) {
    const value = strictMatch[1];
    if (validValues.includes(value)) {
      return { kind: 'ok', value };
    }
    return {
      kind: 'invalid',
      message: `Lauko ${field} reikšmė "${value}" neleistina.`,
    };
  }

  const looseRegex = new RegExp(`public\\s+[A-Za-z_]\\w*\\s+${field}\\s*=`, 'i');
  if (looseRegex.test(source)) {
    return {
      kind: 'invalid',
      message: `Lauko ${field} reikšmė turi būti galiojantis enum narys ir sakinys turi baigtis kabliataškiu.`,
    };
  }

  return { kind: 'missing' };
}

function parseEyeColorMethodStrict(source: string): ParseStatus<HorseColorName> {
  const hasMethod = /public\s+[A-Za-z_]\w*\s+AkiuSpalva\s*\(\s*\)/i.test(source);
  const enumValue = parseEnumMethodReturnByNames(source, 'AkiuSpalva');
  if (enumValue) {
    if (HORSE_COLOR_NAMES.includes(enumValue as HorseColorName)) {
      return { kind: 'ok', value: enumValue as HorseColorName };
    }
    return { kind: 'ok', value: DEFAULT_RULES.akiuSpalva };
  }

  if (hasMethod) {
    return {
      kind: 'invalid',
      message: 'Metodo AkiuSpalva struktūra neteisinga arba trūksta return sakinio.',
    };
  }

  return { kind: 'missing' };
}

function parseEnumMethodReturnByNames(source: string, ...methods: string[]): string | null {
  for (const method of methods) {
    const methodRegex = new RegExp(
      `public\\s+[A-Za-z_]\\w*\\s+${method}\\s*\\(\\s*\\)\\s*\\{[\\s\\S]*?return\\s+(?:[A-Za-z_]\\w*\\.)?([A-Za-z_]\\w*)\\s*;[\\s\\S]*?\\}`,
      'i',
    );
    const match = source.match(methodRegex);
    if (match) {
      return match[1];
    }
  }

  return null;
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

  private syntaxParser: Parser | null = null;

  private syntaxParserInitAttempted = false;

  private syntaxParserReady = false;

  private async initRealSyntaxCompiler(): Promise<boolean> {
    if (this.syntaxParserReady) {
      return true;
    }
    if (this.syntaxParserInitAttempted) {
      return false;
    }

    this.syntaxParserInitAttempted = true;
    try {
      await Parser.init();
      const language = await Language.load(csharpGrammarWasmUrl);
      const parser = new Parser();
      parser.setLanguage(language);
      this.syntaxParser = parser;
      this.syntaxParserReady = true;
      return true;
    } catch {
      this.syntaxParser = null;
      this.syntaxParserReady = false;
      return false;
    }
  }

  private findFirstSyntaxErrorNode(root: SyntaxNode): SyntaxNode | null {
    const stack: SyntaxNode[] = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (!node) {
        continue;
      }
      if (node.isError || node.isMissing) {
        return node;
      }
      for (let i = node.childCount - 1; i >= 0; i -= 1) {
        const child = node.child(i);
        if (child) {
          stack.push(child);
        }
      }
    }
    return null;
  }

  private validateSyntaxWithRealCompiler(source: string): string | null {
    if (!this.syntaxParser) {
      return null;
    }

    const syntaxResult = withParsedSyntaxTree(this.syntaxParser, source, (tree) => {
      const root = tree.rootNode;
      if (!root.hasError) {
        return null;
      }

      const firstError = this.findFirstSyntaxErrorNode(root);
      if (!firstError) {
        return 'C# kompiliatorius aptiko sintaksės klaidą.';
      }

      const line = firstError.startPosition.row + 1;
      const column = firstError.startPosition.column + 1;
      return `C# kompiliatorius aptiko sintaksės klaidą (${line}:${column}).`;
    });
    if (!syntaxResult.parsed) {
      return 'C# kompiliatorius aptiko sintaksės klaidą.';
    }
    return syntaxResult.value;
  }

  async init(): Promise<void> {
    const [wasmReady, syntaxCompilerReady] = await Promise.all([
      ensureDotnetRuntime(),
      this.initRealSyntaxCompiler(),
    ]);
    this.runtimeMode = wasmReady && syntaxCompilerReady ? 'wasm' : 'fallback';
  }

  compile(source: string): CompileResult {
    const syntaxEngine: CompileResult['syntaxEngine'] = this.syntaxParser
      ? 'tree-sitter-wasm'
      : 'none';
    const syntaxError = this.validateSyntaxWithRealCompiler(source);
    if (syntaxError) {
      return {
        success: false,
        rules: this.lastValidRules,
        errors: [syntaxError],
        mode: this.runtimeMode,
        syntaxEngine,
      };
    }

    if (!/public\s+class\s+DanceRules\b/i.test(source)) {
      return {
        success: false,
        rules: this.lastValidRules,
        errors: [translateCompilerError('identifier class DanceRules not found')],
        mode: this.runtimeMode,
        syntaxEngine,
      };
    }

    if (!hasBalancedBraces(source)) {
      return {
        success: false,
        rules: this.lastValidRules,
        errors: [translateCompilerError('brace mismatch expected }')],
        mode: this.runtimeMode,
        syntaxEngine,
      };
    }

    const tobulasLangas = parseNumericFieldStrict(source, 'tobulasLangas');
    const gerasLangas = parseNumericFieldStrict(source, 'gerasLangas');
    const tobuliTaskai = parseNumericFieldStrict(source, 'tobuliTaskai');
    const geriTaskai = parseNumericFieldStrict(source, 'geriTaskai');
    const serijaIkiUzsivedimo = parseNumericFieldStrict(source, 'serijaIkiUzsivedimo');
    const serijaIkiHype = parseNumericFieldStrict(source, 'serijaIkiHype');
    const arklioSpalvaRaw = parseEnumFieldStrict(source, 'arklioSpalva', HORSE_COLOR_NAMES);
    const karciuSpalvaRaw = parseEnumFieldStrict(source, 'karciuSpalva', HORSE_COLOR_NAMES);
    const suKepure = parseBoolFieldStrict(source, 'suKepure');
    const kepuresTipas = parseEnumFieldStrict(source, 'kepuresTipas', HORSE_HATS);
    const oroEfektas = parseEnumFieldStrict(source, 'oroEfektas', HORSE_WEATHERS);
    const akiuSpalva = parseEyeColorMethodStrict(source);
    const enumValidationErrors = [
      validateEnumDefinition(source, 'Spalva', HORSE_COLOR_NAMES),
      validateEnumDefinition(source, 'KepuresTipas', HORSE_HATS),
      validateEnumDefinition(source, 'OroEfektas', HORSE_WEATHERS),
    ].filter((error): error is string => error !== null);

    const parseValidationErrors = [
      tobulasLangas,
      gerasLangas,
      tobuliTaskai,
      geriTaskai,
      serijaIkiUzsivedimo,
      serijaIkiHype,
      arklioSpalvaRaw,
      karciuSpalvaRaw,
      suKepure,
      kepuresTipas,
      oroEfektas,
      akiuSpalva,
    ]
      .filter((result): result is { kind: 'invalid'; message: string } => result.kind === 'invalid')
      .map((result) => result.message);
    const validationErrors = [...enumValidationErrors, ...parseValidationErrors];
    if (validationErrors.length > 0) {
      return {
        success: false,
        rules: this.lastValidRules,
        errors: validationErrors,
        mode: this.runtimeMode,
        syntaxEngine,
      };
    }

    const arklioSpalvaParsed =
      arklioSpalvaRaw.kind === 'ok'
        ? (arklioSpalvaRaw.value as HorseColorName)
        : DEFAULT_RULES.arklioSpalva;
    const karciuSpalvaParsed =
      karciuSpalvaRaw.kind === 'ok'
        ? (karciuSpalvaRaw.value as HorseColorName)
        : DEFAULT_RULES.karciuSpalva;

    const draft: DanceRules = {
      tobulasLangas:
        tobulasLangas.kind === 'ok' ? tobulasLangas.value : DEFAULT_RULES.tobulasLangas,
      gerasLangas: gerasLangas.kind === 'ok' ? gerasLangas.value : DEFAULT_RULES.gerasLangas,
      tobuliTaskai: tobuliTaskai.kind === 'ok' ? tobuliTaskai.value : DEFAULT_RULES.tobuliTaskai,
      geriTaskai: geriTaskai.kind === 'ok' ? geriTaskai.value : DEFAULT_RULES.geriTaskai,
      serijaIkiHype:
        serijaIkiUzsivedimo.kind === 'ok'
          ? serijaIkiUzsivedimo.value
          : serijaIkiHype.kind === 'ok'
            ? serijaIkiHype.value
            : DEFAULT_RULES.serijaIkiHype,
      akiuSpalva: akiuSpalva.kind === 'ok' ? akiuSpalva.value : DEFAULT_RULES.akiuSpalva,
      arklioSpalva: arklioSpalvaParsed,
      karciuSpalva: karciuSpalvaParsed,
      suKepure: suKepure.kind === 'ok' ? suKepure.value : DEFAULT_RULES.suKepure,
      kepuresTipas:
        kepuresTipas.kind === 'ok' ? (kepuresTipas.value as HorseHat) : DEFAULT_RULES.kepuresTipas,
      oroEfektas:
        oroEfektas.kind === 'ok' ? (oroEfektas.value as HorseWeather) : DEFAULT_RULES.oroEfektas,
    };

    const safe = clampRules(draft);
    if (safe.gerasLangas < safe.tobulasLangas) {
      return {
        success: false,
        rules: this.lastValidRules,
        errors: ['Geras langas negali būti mažesnis už tobulą langą.'],
        mode: this.runtimeMode,
        syntaxEngine,
      };
    }

    this.lastValidRules = safe;

    return {
      success: true,
      rules: safe,
      errors: [],
      mode: this.runtimeMode,
      syntaxEngine,
    };
  }
}
