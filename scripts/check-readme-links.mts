import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const readmePath = join(process.cwd(), 'README.md');
const markdown = readFileSync(readmePath, 'utf8');
const dir = dirname(readmePath);

const linkRegex = /\[[^\]]+]\(([^)]+)\)/g;
const unresolved = [];

for (const match of markdown.matchAll(linkRegex)) {
  const target = match[1].trim();
  if (
    target.startsWith('http://') ||
    target.startsWith('https://') ||
    target.startsWith('#') ||
    target.startsWith('mailto:')
  ) {
    continue;
  }
  const normalized = target.split('#')[0];
  if (!normalized) {
    continue;
  }
  const candidate = join(dir, normalized);
  if (!existsSync(candidate)) {
    unresolved.push(target);
  }
}

if (unresolved.length > 0) {
  throw new Error(`README nuorodos veda į neegzistuojančius failus:\n${unresolved.join('\n')}`);
}

console.log('README links OK.');
