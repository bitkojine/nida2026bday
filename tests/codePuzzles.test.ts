import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../src/core/types';
import { CSHARP_TEMPLATE } from '../src/services/csharpTemplate';
import { CODE_PUZZLES, evaluatePuzzleProgress } from '../src/ui/codePuzzles';

describe('codePuzzles', () => {
  it('starts with first mission unresolved on default rules', () => {
    const progress = evaluatePuzzleProgress(DEFAULT_RULES, CSHARP_TEMPLATE);
    expect(progress.solvedCount).toBe(0);
    expect(progress.totalCount).toBe(CODE_PUZZLES.length);
    expect(progress.nextPuzzle?.id).toBe(CODE_PUZZLES[0]?.id);
  });

  it('solves missions sequentially and stops at first unmet mission', () => {
    const mission1And2 = evaluatePuzzleProgress(
      {
        ...DEFAULT_RULES,
        tobulasLangas: 0.09,
        tobuliTaskai: 180,
        geriTaskai: 90,
      },
      CSHARP_TEMPLATE,
    );
    expect(mission1And2.solvedCount).toBe(2);
    expect(mission1And2.nextPuzzle?.id).toBe('greitas-uzsivedimas');

    const outOfOrderOnlyLast = evaluatePuzzleProgress(
      {
        ...DEFAULT_RULES,
        suKepure: true,
        kepuresTipas: 'KARUNA',
        oroEfektas: 'SAULETA',
        arklioSpalva: 'ORANZINE',
      },
      CSHARP_TEMPLATE,
    );
    expect(outOfOrderOnlyLast.solvedCount).toBe(0);
    expect(outOfOrderOnlyLast.nextPuzzle?.id).toBe('platesnis-langas');
  });

  it('marks all missions solved for completed birthday-show setup', () => {
    const finalRules = {
      ...DEFAULT_RULES,
      tobulasLangas: 0.1,
      tobuliTaskai: 210,
      geriTaskai: 120,
      serijaIkiHype: 3,
      suKepure: true,
      kepuresTipas: 'KARUNA' as const,
      oroEfektas: 'ZAIBAS' as const,
      arklioSpalva: 'ORANZINE' as const,
    };

    const progress = evaluatePuzzleProgress(finalRules, CSHARP_TEMPLATE);
    expect(progress.solvedCount).toBe(CODE_PUZZLES.length);
    expect(progress.nextPuzzle).toBeNull();
  });
});
