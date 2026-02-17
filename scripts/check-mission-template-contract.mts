import { CSHARP_TEMPLATE } from '../src/services/csharpTemplate';
import { DANCE_RULE_TEMPLATES, applyDanceRuleTemplate } from '../src/ui/danceRuleTemplates';
import { CODE_PUZZLES } from '../src/ui/codePuzzles';

function assertUnique(values: string[], label: string): void {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `${label} turi pasikartojančių reikšmių: ${Array.from(new Set(duplicates)).join(', ')}`,
    );
  }
}

const templateIds = DANCE_RULE_TEMPLATES.map((template) => template.id);
assertUnique(templateIds, 'Template ID');

const puzzleIds = CODE_PUZZLES.map((puzzle) => puzzle.id);
assertUnique(puzzleIds, 'Puzzle ID');

for (const puzzle of CODE_PUZZLES) {
  if (puzzle.templateId !== null && !templateIds.includes(puzzle.templateId)) {
    throw new Error(
      `Puzzle "${puzzle.id}" nurodo neegzistuojantį templateId "${puzzle.templateId}".`,
    );
  }
}

for (const template of DANCE_RULE_TEMPLATES) {
  const applied = applyDanceRuleTemplate(CSHARP_TEMPLATE, template.id);
  if (applied === CSHARP_TEMPLATE) {
    throw new Error(`Template "${template.id}" nekeičia C# šaltinio.`);
  }

  const requiredValueChecks = [
    template.values.tobulasLangas,
    template.values.gerasLangas,
    template.values.tobuliTaskai,
    template.values.geriTaskai,
    template.values.serijaIkiUzsivedimo,
    template.values.arklioSpalva,
    template.values.karciuSpalva,
    template.values.suKepure,
    template.values.kepuresTipas,
    template.values.oroEfektas,
  ];
  for (const value of requiredValueChecks) {
    if (!applied.includes(value)) {
      throw new Error(`Template "${template.id}" neįrašo reikšmės "${value}" į C# šaltinį.`);
    }
  }
}

console.log(
  `Mission/template contract OK: ${CODE_PUZZLES.length} puzzles, ${DANCE_RULE_TEMPLATES.length} templates.`,
);
