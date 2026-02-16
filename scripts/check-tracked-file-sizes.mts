import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

const HARD_LIMIT_BYTES = 350_000;
const allowList = new Set(['package-lock.json']);
const offenders = [];

for (const file of tracked) {
  if (allowList.has(file)) {
    continue;
  }
  const size = statSync(join(process.cwd(), file)).size;
  if (size > HARD_LIMIT_BYTES) {
    offenders.push(`${file}=${size} B`);
  }
}

if (offenders.length > 0) {
  throw new Error(`Per dideli sekami failai:\n${offenders.join('\n')}`);
}

console.log(`Tracked file sizes OK: ${tracked.length} files checked.`);
