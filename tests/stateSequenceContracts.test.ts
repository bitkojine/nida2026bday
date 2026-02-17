import { describe, expect, it } from 'vitest';
import type { DanceRules } from '../src/core/types';
import { DEFAULT_RULES } from '../src/core/types';
import { CSHARP_TEMPLATE } from '../src/services/csharpTemplate';
import { CodeCompilerService } from '../src/services/codeCompilerService';
import {
  EDITOR_SOURCE_STORAGE_KEY,
  readPersistedEditorSource,
} from '../src/core/editorSourceStorage';
import { CODE_PUZZLES, evaluatePuzzleProgress } from '../src/ui/codePuzzles';

const PUZZLE_PROGRESS_STORAGE_KEY = 'nida2026bday:puzzlesSolvedCount:v1';
const SOUND_MUTED_STORAGE_KEY = 'nida2026bday:soundMuted:v1';

class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

interface SessionModel {
  storage: MemoryStorage;
  editorSource: string;
  rules: DanceRules;
  compileValid: boolean;
  persistedSolved: number;
}

function clampSolvedPuzzleCount(next: number): number {
  const normalized = Number.isFinite(next) ? Math.trunc(next) : 0;
  return Math.max(0, Math.min(CODE_PUZZLES.length, normalized));
}

function readSolvedPuzzleCount(storage: MemoryStorage): number {
  const raw = storage.getItem(PUZZLE_PROGRESS_STORAGE_KEY);
  if (raw === null) {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    storage.removeItem(PUZZLE_PROGRESS_STORAGE_KEY);
    return 0;
  }
  const clamped = clampSolvedPuzzleCount(parsed);
  if (clamped <= 0) {
    storage.removeItem(PUZZLE_PROGRESS_STORAGE_KEY);
    return 0;
  }
  const normalized = `${clamped}`;
  if (raw !== normalized) {
    storage.setItem(PUZZLE_PROGRESS_STORAGE_KEY, normalized);
  }
  return clamped;
}

function writeSolvedPuzzleCount(storage: MemoryStorage, next: number): number {
  const clamped = clampSolvedPuzzleCount(next);
  if (clamped <= 0) {
    storage.removeItem(PUZZLE_PROGRESS_STORAGE_KEY);
    return 0;
  }
  storage.setItem(PUZZLE_PROGRESS_STORAGE_KEY, `${clamped}`);
  return clamped;
}

function renderPuzzleProgress(model: SessionModel): void {
  const progress = evaluatePuzzleProgress(model.rules, model.editorSource);
  const solved = Math.max(progress.solvedCount, model.persistedSolved);
  if (solved > model.persistedSolved) {
    model.persistedSolved = writeSolvedPuzzleCount(model.storage, solved);
    return;
  }
  model.persistedSolved = clampSolvedPuzzleCount(solved);
}

function bootstrapFromStorage(storage: MemoryStorage, compiler: CodeCompilerService): SessionModel {
  const fallback = CSHARP_TEMPLATE;
  const editorSource = readPersistedEditorSource(storage, fallback);
  const compiled = compiler.compile(editorSource);
  const rules = compiled.success ? compiled.rules : DEFAULT_RULES;
  const model: SessionModel = {
    storage,
    editorSource,
    rules,
    compileValid: compiled.success,
    persistedSolved: readSolvedPuzzleCount(storage),
  };
  renderPuzzleProgress(model);
  return model;
}

function replaceRuleValue(source: string, field: string, valueLiteral: string): string {
  const matcher = new RegExp(`(public\\s+[\\w<>]+\\s+${field}\\s*=\\s*)([^;]+)(;)`);
  return source.replace(matcher, `$1${valueLiteral}$3`);
}

function applyMissionStageRules(source: string, solvedCount: number): string {
  const stage = Math.max(0, Math.min(5, Math.trunc(solvedCount)));
  let next = source;
  next = replaceRuleValue(next, 'tobulasLangas', stage >= 1 ? '0.08f' : '0.05f');
  next = replaceRuleValue(next, 'tobuliTaskai', stage >= 2 ? '170' : '100');
  next = replaceRuleValue(next, 'geriTaskai', stage >= 2 ? '80' : '50');
  next = replaceRuleValue(next, 'serijaIkiUzsivedimo', stage >= 3 ? '4' : '10');
  next = replaceRuleValue(next, 'suKepure', stage >= 4 ? 'true' : 'false');
  next = replaceRuleValue(
    next,
    'kepuresTipas',
    stage >= 5
      ? 'KepuresTipas.KARUNA'
      : stage >= 4
        ? 'KepuresTipas.KAUBOJAUS'
        : 'KepuresTipas.KLASIKINE',
  );
  next = replaceRuleValue(
    next,
    'oroEfektas',
    stage >= 5 ? 'OroEfektas.ZAIBAS' : 'OroEfektas.SAULETA',
  );
  next = replaceRuleValue(next, 'arklioSpalva', stage >= 5 ? 'Spalva.ORANZINE' : 'Spalva.SMELIO');
  return next;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function applyEditorSource(
  model: SessionModel,
  compiler: CodeCompilerService,
  nextSource: string,
): void {
  model.editorSource = nextSource;
  model.storage.setItem(EDITOR_SOURCE_STORAGE_KEY, nextSource);
  const previousRules = model.rules;
  const compiled = compiler.compile(nextSource);
  model.compileValid = compiled.success;
  if (compiled.success) {
    model.rules = compiled.rules;
  } else {
    model.rules = previousRules;
  }
  renderPuzzleProgress(model);
}

function resetCode(model: SessionModel, compiler: CodeCompilerService): void {
  applyEditorSource(model, compiler, CSHARP_TEMPLATE);
}

function resetAll(model: SessionModel, compiler: CodeCompilerService): void {
  model.storage.removeItem(PUZZLE_PROGRESS_STORAGE_KEY);
  model.storage.removeItem(SOUND_MUTED_STORAGE_KEY);
  model.storage.removeItem(EDITOR_SOURCE_STORAGE_KEY);
  model.persistedSolved = 0;
  model.rules = DEFAULT_RULES;
  resetCode(model, compiler);
}

function assertInvariants(model: SessionModel): void {
  expect(model.persistedSolved).toBeGreaterThanOrEqual(0);
  expect(model.persistedSolved).toBeLessThanOrEqual(CODE_PUZZLES.length);
  const persistedRaw = model.storage.getItem(PUZZLE_PROGRESS_STORAGE_KEY);
  if (persistedRaw !== null) {
    const parsed = Number.parseInt(persistedRaw, 10);
    expect(Number.isFinite(parsed)).toBe(true);
    expect(clampSolvedPuzzleCount(parsed)).toBe(model.persistedSolved);
  }
}

describe('state sequence contracts', () => {
  it('keeps key gameplay invariants under randomized edit/reset/reload sequences', () => {
    const compiler = new CodeCompilerService();

    for (let seed = 1; seed <= 20; seed += 1) {
      const random = mulberry32(seed);
      const storage = new MemoryStorage();
      let model = bootstrapFromStorage(storage, compiler);

      for (let step = 0; step < 35; step += 1) {
        const choice = Math.floor(random() * 8);
        switch (choice) {
          case 0: {
            const stage = Math.floor(random() * (CODE_PUZZLES.length + 1));
            applyEditorSource(model, compiler, applyMissionStageRules(model.editorSource, stage));
            break;
          }
          case 1: {
            const invalid = CSHARP_TEMPLATE.replace(
              'public int geriTaskai = 50;',
              'public int geriTaskai = ;',
            );
            applyEditorSource(model, compiler, invalid);
            expect(model.compileValid).toBe(false);
            break;
          }
          case 2:
            resetCode(model, compiler);
            expect(model.compileValid).toBe(true);
            break;
          case 3:
            resetAll(model, compiler);
            expect(model.persistedSolved).toBe(0);
            expect(model.storage.getItem(PUZZLE_PROGRESS_STORAGE_KEY)).toBeNull();
            expect(model.storage.getItem(SOUND_MUTED_STORAGE_KEY)).toBeNull();
            expect(model.compileValid).toBe(true);
            break;
          case 4:
            model.storage.setItem(
              PUZZLE_PROGRESS_STORAGE_KEY,
              ['-4', '999', 'not-a-number'][step % 3]!,
            );
            model = bootstrapFromStorage(storage, compiler);
            break;
          case 5:
            model.storage.setItem(SOUND_MUTED_STORAGE_KEY, random() > 0.5 ? '1' : '0');
            break;
          case 6:
            model = bootstrapFromStorage(storage, compiler);
            break;
          default: {
            const stage = Math.floor(random() * (CODE_PUZZLES.length + 1));
            const next = applyMissionStageRules(CSHARP_TEMPLATE, stage);
            applyEditorSource(model, compiler, next);
            break;
          }
        }
        assertInvariants(model);
      }
    }
  });
});
