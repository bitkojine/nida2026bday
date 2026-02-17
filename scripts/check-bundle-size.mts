import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distAssetsDir = join(process.cwd(), 'dist', 'assets');
const files = readdirSync(distAssetsDir);

const entryJs = files.find((name) => /^index-.*\.js$/.test(name));
const entryCss = files.find((name) => /^index-.*\.css$/.test(name));

if (!entryJs || !entryCss) {
  throw new Error('Nerasti pagrindiniai build failai dist/assets kataloge.');
}

const jsBytes = statSync(join(distAssetsDir, entryJs)).size;
const cssBytes = statSync(join(distAssetsDir, entryCss)).size;

const JS_BUDGET_BYTES = 225_000;
const CSS_BUDGET_BYTES = 35_000;

if (jsBytes > JS_BUDGET_BYTES) {
  throw new Error(`JS bundle per didelis: ${entryJs}=${jsBytes} B (limitas ${JS_BUDGET_BYTES} B).`);
}

if (cssBytes > CSS_BUDGET_BYTES) {
  throw new Error(
    `CSS bundle per didelis: ${entryCss}=${cssBytes} B (limitas ${CSS_BUDGET_BYTES} B).`,
  );
}

console.log(`Bundle OK: ${entryJs}=${jsBytes} B, ${entryCss}=${cssBytes} B.`);
