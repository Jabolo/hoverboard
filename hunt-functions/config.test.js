import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

test('production routes and both function codebases are configured without removing cloud credit', () => {
  const config = read('firebase.json');
  assert.deepEqual(
    config.functions.map(({ codebase }) => codebase),
    ['default', 'hunt-preview'],
  );
  assert.ok(
    config.functions
      .find(({ codebase }) => codebase === 'hunt-preview')
      .ignore.includes('.secret*'),
  );
  assert.match(readFileSync(new URL('.gitignore', root), 'utf8'), /^\.secret\*$/m);
  assert.ok(
    config.functions.find(({ codebase }) => codebase === 'default').ignore.includes('.secret*'),
  );
  const routes = config.hosting.rewrites;
  assert.equal(
    routes.find(({ source }) => source === '/api/hunt/**').function.functionId,
    'y2kCardHunt',
  );
  assert.equal(
    routes.find(({ source }) => source === '/api/cloud-credit').function.functionId,
    'cloudCredit',
  );
  for (const source of ['/hunt', '/hunt/**']) {
    assert.equal(routes.find((rule) => rule.source === source).destination, '/index.html');
    const headers = config.hosting.headers.find((rule) => rule.source === source).headers;
    assert.ok(
      headers.some(({ key, value }) => key === 'Referrer-Policy' && value === 'no-referrer'),
    );
    assert.ok(headers.some(({ key, value }) => key === 'Cache-Control' && value === 'no-store'));
  }
});

test('PR preview strips the production hunt function while retaining other routing', () => {
  execFileSync(process.execPath, ['scripts/generate-pr-preview-config.mjs'], { cwd: root });
  const base = read('firebase.json');
  const preview = read('.env.firebase-pr-preview.json');
  assert.deepEqual(
    preview.hosting.rewrites,
    base.hosting.rewrites.filter(({ source }) => source !== '/api/hunt/**'),
  );
});
