import { execSync } from 'node:child_process';

const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

const forbidden = [
  { regex: /(^|\/)\.DS_Store$/, label: '.DS_Store' },
  { regex: /\.log$/, label: '*.log' },
  { regex: /(^|\/)Thumbs\.db$/, label: 'Thumbs.db' },
  { regex: /(^|\/)\.env(\.|$)/, label: '.env*' },
];

const offenders = [];
for (const file of tracked) {
  for (const rule of forbidden) {
    if (rule.regex.test(file)) {
      offenders.push(`${file} (${rule.label})`);
    }
  }
}

if (offenders.length > 0) {
  throw new Error(`Repo hygiene pažeidimai:\n${offenders.join('\n')}`);
}

console.log(`Repo hygiene OK: patikrinta ${tracked.length} sekamų failų.`);
