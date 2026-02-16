import { evaluatePuzzleProgress } from '../src/ui/codePuzzles';
import { CodeCompilerService } from '../src/services/codeCompilerService';
import { CSHARP_TEMPLATE } from '../src/services/csharpTemplate';

const service = new CodeCompilerService();

function replace(source: string, from: string, to: string): string {
  if (!source.includes(from)) {
    throw new Error(`Nerasta eilutė pakeitimui: "${from}"`);
  }
  return source.replace(from, to);
}

const stages: Array<{ expectedSolved: number; source: string }> = [];

const stage0 = CSHARP_TEMPLATE;
stages.push({ expectedSolved: 0, source: stage0 });

const stage1 = replace(
  stage0,
  'public float tobulasLangas = 0.05f;',
  'public float tobulasLangas = 0.08f;',
);
stages.push({ expectedSolved: 1, source: stage1 });

const stage2 = replace(
  replace(stage1, 'public int tobuliTaskai = 100;', 'public int tobuliTaskai = 170;'),
  'public int geriTaskai = 50;',
  'public int geriTaskai = 80;',
);
stages.push({ expectedSolved: 2, source: stage2 });

const stage3 = replace(
  stage2,
  'public int serijaIkiUzsivedimo = 10;',
  'public int serijaIkiUzsivedimo = 4;',
);
stages.push({ expectedSolved: 3, source: stage3 });

const stage4 = replace(
  replace(stage3, 'public bool suKepure = false;', 'public bool suKepure = true;'),
  'public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;',
  'public KepuresTipas kepuresTipas = KepuresTipas.KAUBOJAUS;',
);
stages.push({ expectedSolved: 4, source: stage4 });

const stage5 = replace(
  replace(
    stage4,
    'public KepuresTipas kepuresTipas = KepuresTipas.KAUBOJAUS;',
    'public KepuresTipas kepuresTipas = KepuresTipas.KARUNA;',
  ),
  'public OroEfektas oroEfektas = OroEfektas.SAULETA;',
  'public OroEfektas oroEfektas = OroEfektas.ZAIBAS;',
);
const stage5b = replace(
  stage5,
  'public Spalva arklioSpalva = Spalva.SMELIO;',
  'public Spalva arklioSpalva = Spalva.MELYNA;',
);
stages.push({ expectedSolved: 5, source: stage5b });

for (const stage of stages) {
  const compile = service.compile(stage.source);
  if (!compile.success) {
    throw new Error(
      `Stage ${stage.expectedSolved} kodas nesikompiliuoja: ${compile.errors.join(' | ')}`,
    );
  }
  const progress = evaluatePuzzleProgress(compile.rules, stage.source);
  if (progress.solvedCount !== stage.expectedSolved) {
    throw new Error(
      `Neteisingas puzzle progress stage=${stage.expectedSolved}: gauta ${progress.solvedCount}`,
    );
  }
}

console.log('Puzzle progression contract OK: staged rules produce solvedCount 0..5.');
