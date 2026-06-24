import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src/rv-tank-level-card.js');
const targets = [
  resolve(root, 'dist/rv-tank-level-card.js'),
  resolve(root, 'rv-tank-level-card.js'),
];

for (const target of targets) {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

console.log('Built rv-tank-level-card.js and dist/rv-tank-level-card.js from src/rv-tank-level-card.js');
