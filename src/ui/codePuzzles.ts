import type { DanceRules } from '../core/types';

export interface CodePuzzle {
  id: string;
  titleLt: string;
  storyLt: string;
  goalLt: string;
  hintLt: string;
  templateId: string | null;
  check: (rules: DanceRules, source: string) => boolean;
}

export interface PuzzleProgress {
  solvedIds: string[];
  solvedCount: number;
  totalCount: number;
  nextPuzzle: CodePuzzle | null;
}

const DEFAULT_BODY_COLOR = '#d6b48a';

export const CODE_PUZZLES: CodePuzzle[] = [
  {
    id: 'platesnis-langas',
    titleLt: '1. Pirmas garsas',
    storyLt: 'Arklys ruošiasi pirmai „Su gimtadieniu“ natai ir nori daugiau atlaidumo.',
    goalLt: 'Padidink TOBULO langą bent iki 0.08.',
    hintLt: 'Keisk `tobulasLangas` reikšmę.',
    templateId: 'svelnus-srautas',
    check: (rules) => rules.tobulasLangas >= 0.08,
  },
  {
    id: 'stipresni-taskai',
    titleLt: '2. Drąsesnis ritmas',
    storyLt: 'Publika ploja, todėl arklys nori drąsesnio apdovanojimo už taiklius paspaudimus.',
    goalLt: 'Nustatyk TOBULUS taškus bent 170 ir GERUS taškus bent 80.',
    hintLt: 'Keisk `tobuliTaskai` ir `geriTaskai`.',
    templateId: 'uzsivedimo-raketa',
    check: (rules) => rules.tobuliTaskai >= 170 && rules.geriTaskai >= 80,
  },
  {
    id: 'greitas-uzsivedimas',
    titleLt: '3. Užsivedimo režimas',
    storyLt: 'Kad priedainis skambėtų energingai, arklys turi greičiau įsijungti UŽSIVEDIMĄ.',
    goalLt: 'Sumažink seriją iki UŽSIVEDIMO iki 4 arba mažiau.',
    hintLt: 'Keisk `serijaIkiUzsivedimo`.',
    templateId: 'uzsivedimo-raketa',
    check: (rules) => rules.serijaIkiHype <= 4,
  },
  {
    id: 'scenos-stilius',
    titleLt: '4. Scenos įvaizdis',
    storyLt: 'Prieš gimtadienio kulminaciją arklys pasipuošia ir išeina į sceną.',
    goalLt: 'Uždėk kepurę ir pasirink ryškesnį kepurės tipą.',
    hintLt: 'Keisk `suKepure` ir `kepuresTipas`.',
    templateId: 'disko-zaibas',
    check: (rules) => rules.suKepure && rules.kepuresTipas !== 'KLASIKINE',
  },
  {
    id: 'gimtadienio-finalas',
    titleLt: '5. Gimtadienio finalas',
    storyLt:
      'Finalui arklys groja ryškiai, su karūna, ir užbaigia „Su gimtadieniu“ šventinį numerį.',
    goalLt: 'Naudok karūną, pakeisk orą nuo SAULETA ir pasirink kitą kūno spalvą nei numatytoji.',
    hintLt:
      'Nustatyk `kepuresTipas = "KARUNA"`, pasirink `oroEfektas` (ne SAULETA) ir pakeisk `arklioSpalva`.',
    templateId: 'karnavaline-kepure',
    check: (rules, source) =>
      rules.suKepure &&
      rules.kepuresTipas === 'KARUNA' &&
      rules.oroEfektas !== 'SAULETA' &&
      rules.arklioSpalva.toLowerCase() !== DEFAULT_BODY_COLOR &&
      source.includes('ArUzsivedimui'),
  },
];

export function evaluatePuzzleProgress(rules: DanceRules, source: string): PuzzleProgress {
  const solvedIds: string[] = [];
  for (const puzzle of CODE_PUZZLES) {
    if (!puzzle.check(rules, source)) {
      break;
    }
    solvedIds.push(puzzle.id);
  }

  return {
    solvedIds,
    solvedCount: solvedIds.length,
    totalCount: CODE_PUZZLES.length,
    nextPuzzle: CODE_PUZZLES[solvedIds.length] ?? null,
  };
}
