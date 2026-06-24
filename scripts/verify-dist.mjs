import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src/rv-tank-level-card.js');
const targets = [
  resolve(root, 'dist/rv-tank-level-card.js'),
  resolve(root, 'rv-tank-level-card.js'),
];

const [sourceBytes, ...targetBytes] = await Promise.all([
  readFile(source),
  ...targets.map((target) => readFile(target)),
]);

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceHash = hash(sourceBytes);

for (let i = 0; i < targets.length; i++) {
  const targetHash = hash(targetBytes[i]);
  if (sourceHash !== targetHash) {
    const rel = targets[i].replace(`${root}/`, '');
    console.error(`${rel} is out of date. Run npm run build.`);
    console.error(`src:    ${sourceHash}`);
    console.error(`${rel}: ${targetHash}`);
    process.exit(1);
  }
}

console.log('Verified distributable files match src');
