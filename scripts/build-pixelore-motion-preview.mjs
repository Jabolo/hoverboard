import assert from 'node:assert/strict';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist-pixelore-preview');
await rm(root, { recursive: true, force: true });
await mkdir(path.join(root, 'images/partners'), { recursive: true });
for (const filename of ['index.html', 'style.css', 'motion.js']) {
  await copyFile(path.join('preview/pixelore-variants', filename), path.join(root, filename));
}
for (const filename of ['pixelore-logo-dark.svg', 'red-bull-can.webp']) {
  await copyFile(
    path.join('public/images/partners', filename),
    path.join(root, 'images/partners', filename),
  );
}
assert.deepEqual((await readdir(root)).sort(), ['images', 'index.html', 'motion.js', 'style.css']);
assert.deepEqual((await readdir(path.join(root, 'images/partners'))).sort(), [
  'pixelore-logo-dark.svg',
  'red-bull-can.webp',
]);
console.log('Built isolated Pixelore preview with five approved files.');
