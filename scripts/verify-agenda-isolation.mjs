import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
assert(
  !fs.existsSync(path.join(root, 'data/agenda-draft-2026.json')),
  'Draft agenda was copied to the production build',
);
assert(fs.existsSync(path.join(root, 'data/agenda-2026.json')), 'Published agenda is missing');
const check = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) check(filename);
    else if (/\.(?:json|html|js|map)$/.test(entry.name)) {
      const contents = fs.readFileSync(filename, 'utf8');
      for (const marker of ['open-07', '/data/agenda-draft-2026.json']) {
        assert(!contents.includes(marker), `Draft agenda preview found in ${filename}: ${marker}`);
      }
    }
  }
};
check(root);
console.log('Production build contains the published agenda and no local draft agenda.');
