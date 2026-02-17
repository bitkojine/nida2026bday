import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const assetsDir = join(distDir, 'assets');
const indexPath = join(distDir, 'index.html');

const indexHtml = readFileSync(indexPath, 'utf8');
const assetFiles = new Set(readdirSync(assetsDir));

const requiredPatterns = [
  /^index-.*\.js$/,
  /^index-.*\.css$/,
  /^tree-sitter-c_sharp-.*\.wasm$/,
  /^web-tree-sitter-.*\.wasm$/,
];

for (const pattern of requiredPatterns) {
  const found = Array.from(assetFiles).some((name) => pattern.test(name));
  if (!found) {
    throw new Error(`Trūksta privalomo dist/assets failo pagal šabloną: ${pattern}`);
  }
}

const referencedAssets = Array.from(indexHtml.matchAll(/assets\/([^"']+)/g)).map((m) => m[1]);
if (referencedAssets.length === 0) {
  throw new Error('index.html nerasta nė vienos assets nuorodos.');
}

for (const referenced of referencedAssets) {
  if (!assetFiles.has(referenced)) {
    throw new Error(`index.html nurodo neegzistuojantį asset failą: ${referenced}`);
  }
}

const indexJs = referencedAssets.find((name) => /^index-.*\.js$/.test(name));
if (!indexJs) {
  throw new Error('index.html neturi pagrindinio index-*.js failo nuorodos.');
}
const indexJsSize = statSync(join(assetsDir, indexJs)).size;
if (indexJsSize < 120_000) {
  throw new Error(`Netikėtai mažas index JS failas: ${indexJs}=${indexJsSize} B.`);
}

console.log(
  `Dist OK: ${referencedAssets.length} referenced assets, entry JS ${indexJs}=${indexJsSize} B.`,
);
