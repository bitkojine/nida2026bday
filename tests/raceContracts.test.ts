import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../src/core/types';
import { CodeCompilerService } from '../src/services/codeCompilerService';
import { CSHARP_TEMPLATE } from '../src/services/csharpTemplate';
import { evaluatePuzzleProgress } from '../src/ui/codePuzzles';

function replace(source: string, from: string, to: string): string {
  expect(source).toContain(from);
  return source.replace(from, to);
}

describe('high-value contracts for fast checks', () => {
  it('keeps compiler contract stable for template + broken input', () => {
    const service = new CodeCompilerService();

    const base = service.compile(CSHARP_TEMPLATE);
    expect(base.success).toBe(true);
    if (!base.success) {
      return;
    }

    for (const key of Object.keys(DEFAULT_RULES) as Array<keyof typeof DEFAULT_RULES>) {
      expect(base.rules[key]).toBe(DEFAULT_RULES[key]);
    }

    const broken = CSHARP_TEMPLATE.replace(
      'public int geriTaskai = 50;',
      'public int geriTaskai = ;',
    );
    expect(service.compile(broken).success).toBe(false);
  });

  it('keeps mission progression contract stable across stages 0..5', () => {
    const service = new CodeCompilerService();

    const stage0 = CSHARP_TEMPLATE;
    const stage1 = replace(
      stage0,
      'public float tobulasLangas = 0.05f;',
      'public float tobulasLangas = 0.08f;',
    );
    const stage2 = replace(
      replace(stage1, 'public int tobuliTaskai = 100;', 'public int tobuliTaskai = 170;'),
      'public int geriTaskai = 50;',
      'public int geriTaskai = 80;',
    );
    const stage3 = replace(
      stage2,
      'public int serijaIkiUzsivedimo = 10;',
      'public int serijaIkiUzsivedimo = 4;',
    );
    const stage4 = replace(
      replace(stage3, 'public bool suKepure = false;', 'public bool suKepure = true;'),
      'public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;',
      'public KepuresTipas kepuresTipas = KepuresTipas.KAUBOJAUS;',
    );
    const stage5 = replace(
      replace(
        replace(
          stage4,
          'public KepuresTipas kepuresTipas = KepuresTipas.KAUBOJAUS;',
          'public KepuresTipas kepuresTipas = KepuresTipas.KARUNA;',
        ),
        'public OroEfektas oroEfektas = OroEfektas.SAULETA;',
        'public OroEfektas oroEfektas = OroEfektas.ZAIBAS;',
      ),
      'public Spalva arklioSpalva = Spalva.SMELIO;',
      'public Spalva arklioSpalva = Spalva.MELYNA;',
    );

    const sources = [stage0, stage1, stage2, stage3, stage4, stage5];
    for (const [expectedSolved, source] of sources.entries()) {
      const compiled = service.compile(source);
      expect(compiled.success).toBe(true);
      if (!compiled.success) {
        continue;
      }
      const progress = evaluatePuzzleProgress(compiled.rules, source);
      expect(progress.solvedCount).toBe(expectedSolved);
    }
  });
});
