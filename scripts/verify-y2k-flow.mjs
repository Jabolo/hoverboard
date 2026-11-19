import process from 'node:process';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHuntHandler } from '../hunt-functions/handler.js';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const handler = createHuntHandler({ includePreview: true });
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/api/hunt/')) return handler(req, res);
  if (req.url.startsWith('/__/')) return res.writeHead(404).end();
  let p = path.join(root, new URL(req.url, 'http://x').pathname);
  try {
    if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html');
    await stat(p);
  } catch {
    p = path.join(root, 'index.html');
  }
  res.setHeader(
    'Content-Type',
    {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
    }[path.extname(p)] || 'application/octet-stream',
  );
  res.end(await readFile(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = process.argv[2] || `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch({ channel: 'chrome' });
try {
  for (const width of [1440, 390, 320]) {
    const p = await b.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base + '/y2k/');
    const h = p.locator('y2k-page');
    const c = h.getByRole('link', { name: 'Scratch your first card', exact: true });
    await c.waitFor();
    assert.equal(await c.getAttribute('href'), '/hunt/c/y6597cd/');
    const ys = await h.evaluate((el) =>
      [
        '.hero',
        '#discover',
        '#play',
        '.party-spotlight',
        'y2k-experiments',
        '#build',
        '.credit',
      ].map((s) => el.shadowRoot.querySelector(s).getBoundingClientRect().top),
    );
    assert.ok(ys.every((y, i) => i === 0 || y > ys[i - 1]));
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok((await c.boundingBox()).height >= 44);
    await p.screenshot({ path: `/tmp/y2k-flow-top-${width}.png` });
    await p.screenshot({ path: `/tmp/y2k-flow-full-${width}.png`, fullPage: true });
    await c.focus();
    await p.keyboard.press('Enter');
    await p
      .locator('hunt-page')
      .getByRole('button', { name: /Reveal Scratch here/ })
      .click();
    await p.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
    await p.goto(base + '/hunt/');
    await p.getByRole('button', { name: /Welcome Disc Scratch again/ }).waitFor();
    await p.reload();
    await p.getByRole('button', { name: /Welcome Disc Scratch again/ }).waitFor();
    await p.goto(base + '/y2k/');
    await h.getByRole('button', { name: 'Play mini-games', exact: true }).click();
    assert.equal(
      await h.locator('#play').evaluate((el) => el === el.getRootNode().activeElement),
      true,
    );
    await h
      .locator('nav')
      .getByRole('button', { name: /Card Hunt/ })
      .click();
    assert.equal(
      await h.locator('#discover').evaluate((el) => el === el.getRootNode().activeElement),
      true,
    );
    for (const route of ['/y2k/', '/']) {
      await p.goto(base + route);
      const link = p.getByRole('link', {
        name: 'Explore Pin Hunt (opens in a new tab)',
        exact: true,
      });
      await link.scrollIntoViewIfNeeded();
      assert.equal(await link.getAttribute('href'), 'https://pinhunt.gdgwarsaw.pl/');
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.match(await link.getAttribute('rel'), /noopener/);
      assert.ok((await link.boundingBox()).height >= 44);
      await link.focus();
      assert.equal(await link.evaluate((el) => el === el.getRootNode().activeElement), true);
      await p
        .locator('.pin-hunt-note')
        .screenshot({ path: `/tmp/pin-hunt-${route === '/' ? 'home' : 'y2k'}-${width}.png` });
      assert.equal(
        await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      'PASS order, real first-card reveal+save, keyboard anchors, mobile targets and overflow',
      width,
    );
    await p.close();
  }
} finally {
  await b.close();
  server.close();
}
