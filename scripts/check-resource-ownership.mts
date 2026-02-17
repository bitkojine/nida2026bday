import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && line.startsWith('src/') && line.endsWith('.ts'));

const parseAllowedFiles = new Set(['src/services/syntaxTreeResource.ts']);
const eventApiAllowedFiles = new Set(['src/ui/lifecycleBindings.ts', 'src/core/trackedAsync.ts']);
const asyncApiAllowedFiles = new Set(['src/core/trackedAsync.ts']);
const directParsePattern = /\b(?:syntaxParser|parser)\.parse\s*\(/g;
const directAddEventPattern = /\b(?:window|document|[A-Za-z_]\w*)\.addEventListener\s*\(/g;
const directRemoveEventPattern = /\b(?:window|document|[A-Za-z_]\w*)\.removeEventListener\s*\(/g;
const directTimerPatterns = [
  /\b(?:window\.)?setTimeout\s*\(/g,
  /\b(?:window\.)?clearTimeout\s*\(/g,
  /\b(?:window\.)?setInterval\s*\(/g,
  /\b(?:window\.)?clearInterval\s*\(/g,
  /\b(?:window\.)?requestAnimationFrame\s*\(/g,
  /\b(?:window\.)?cancelAnimationFrame\s*\(/g,
  /\bnew\s+AbortController\s*\(/g,
];

const offenders: string[] = [];
for (const relativePath of trackedFiles) {
  const fullPath = join(process.cwd(), relativePath);
  const text = readFileSync(fullPath, 'utf8');

  if (!parseAllowedFiles.has(relativePath) && directParsePattern.test(text)) {
    offenders.push(
      `${relativePath}: tiesioginis parser.parse(...) kvietimas (naudok withParsedSyntaxTree).`,
    );
  }

  if (!eventApiAllowedFiles.has(relativePath) && directAddEventPattern.test(text)) {
    offenders.push(
      `${relativePath}: tiesioginis addEventListener(...) (naudok bindTrackedEventListener/bindElementClick).`,
    );
  }
  if (!eventApiAllowedFiles.has(relativePath) && directRemoveEventPattern.test(text)) {
    offenders.push(
      `${relativePath}: tiesioginis removeEventListener(...) (naudok disposer modelį per RuntimeScope).`,
    );
  }

  if (!asyncApiAllowedFiles.has(relativePath)) {
    for (const pattern of directTimerPatterns) {
      if (pattern.test(text)) {
        offenders.push(
          `${relativePath}: tiesioginis async resurso API (naudok trackedAsync wrapperius).`,
        );
        break;
      }
    }
  }
}

if (offenders.length > 0) {
  throw new Error(
    [
      'Rasti resursų nuosavybės pažeidimai.',
      'Naudokite: withParsedSyntaxTree(), bindTrackedEventListener(), trackedAsync wrapperius.',
      ...offenders.map((entry) => `- ${entry}`),
    ].join('\n'),
  );
}

console.log(`Resource ownership OK: patikrinta ${trackedFiles.length} failų.`);
