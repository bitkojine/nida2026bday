import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && (line.startsWith('src/') || line.startsWith('tests/')));

const offenders = [];
const forbiddenPatterns = [
  { regex: /\bconsole\.log\s*\(/g, label: 'console.log' },
  { regex: /\bdebugger\s*;/g, label: 'debugger' },
];

for (const relativePath of trackedFiles) {
  const fullPath = join(process.cwd(), relativePath);
  const text = readFileSync(fullPath, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(text)) {
      offenders.push(`${relativePath}: ${pattern.label}`);
    }
  }
}

if (offenders.length > 0) {
  throw new Error(`Rasti neleistini debug pėdsakai:\n${offenders.join('\n')}`);
}

console.log(`Source hygiene OK: patikrinta ${trackedFiles.length} failų.`);
