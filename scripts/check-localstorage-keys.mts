import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mainPath = join(process.cwd(), 'src', 'main.ts');
const source = readFileSync(mainPath, 'utf8');

const keyRegex = /const\s+([A-Z_]+_STORAGE_KEY)\s*=\s*'([^']+)'/g;
const keyEntries = [];
for (const match of source.matchAll(keyRegex)) {
  keyEntries.push({ name: match[1], value: match[2] });
}

if (keyEntries.length === 0) {
  throw new Error('Nerasti STORAGE_KEY apibrėžimai src/main.ts faile.');
}

const keyValues = keyEntries.map((entry) => entry.value);
const duplicates = keyValues.filter((value, index) => keyValues.indexOf(value) !== index);
if (duplicates.length > 0) {
  throw new Error(
    `Pasikartojančios localStorage reikšmės: ${Array.from(new Set(duplicates)).join(', ')}`,
  );
}

const listMatch = source.match(/const\s+LOCAL_STORAGE_KEYS_USED\s*=\s*\[([\s\S]*?)\];/);
if (!listMatch) {
  throw new Error('Nerastas LOCAL_STORAGE_KEYS_USED sąrašas src/main.ts faile.');
}

const listBody = listMatch[1];
const listedKeyNames = keyEntries
  .map((entry) => entry.name)
  .filter((name) => new RegExp(`\\b${name}\\b`).test(listBody));

const missingFromList = keyEntries
  .filter((entry) => entry.name !== 'LEGACY_PUZZLE_UNLOCK_STORAGE_KEY')
  .filter((entry) => !listedKeyNames.includes(entry.name))
  .map((entry) => entry.name);

if (missingFromList.length > 0) {
  throw new Error(`LOCAL_STORAGE_KEYS_USED trūksta rakto(-ų): ${missingFromList.join(', ')}`);
}

console.log(
  `LocalStorage key map OK: ${keyEntries.length} keys, ${listedKeyNames.length} listed in LOCAL_STORAGE_KEYS_USED.`,
);
