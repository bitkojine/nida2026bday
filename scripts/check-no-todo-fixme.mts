import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(
    (line) =>
      line.length > 0 &&
      (line.startsWith('src/') || line.startsWith('tests/') || line.startsWith('e2e/')) &&
      (line.endsWith('.ts') ||
        line.endsWith('.tsx') ||
        line.endsWith('.js') ||
        line.endsWith('.css')),
  );

const offenders = [];
const markerRegex = /\b(TODO|FIXME)\b/gi;

for (const relativePath of trackedFiles) {
  const fullPath = join(process.cwd(), relativePath);
  const text = readFileSync(fullPath, 'utf8');
  if (markerRegex.test(text)) {
    offenders.push(relativePath);
  }
}

if (offenders.length > 0) {
  throw new Error(`Rasti TODO/FIXME markeriai:\n${offenders.join('\n')}`);
}

console.log(`No TODO/FIXME markers in ${trackedFiles.length} source/test files.`);
