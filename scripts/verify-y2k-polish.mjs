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
    const cartridge = h.locator('.idea-cartridge');
    await cartridge.waitFor();
    assert.equal(await h.getByText(/Different activities, different adventures/).count(), 0);
    await cartridge.scrollIntoViewIfNeeded();
    assert.ok(
      (await cartridge.boundingBox()).height < 700,
      'cartridge is not stretched to rules height',
    );
    const ideas = new Set();
    for (let n = 0; n < 14; n++) {
      ideas.add(await cartridge.locator('.prompt').innerText());
      await cartridge.getByRole('button', { name: 'Load another idea', exact: true }).click();
      assert.equal(
        await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    }
    assert.equal(ideas.size, 14);
    await cartridge.screenshot({ path: `/tmp/y2k-cartridge-${width}.png` });
    const sticker = p
      .locator('y2k-page footer-block')
      .getByRole('link', { name: 'Inspect the floppy disk', exact: true });
    await sticker.scrollIntoViewIfNeeded();
    const box = await sticker.boundingBox();
    assert.ok(box.width >= 44 && box.width < 65 && box.height >= 44 && box.height < 65);
    assert.equal(await sticker.getAttribute('href'), '/hunt/c/f00t3rx/');
    assert.equal(await p.getByText('You found the end credits', { exact: true }).count(), 0);
    await p.screenshot({ path: `/tmp/y2k-footer-${width}.png` });
    await sticker.focus();
    await p.keyboard.press('Enter');
    await p
      .locator('hunt-page')
      .getByRole('button', { name: /Reveal Scratch here/ })
      .click();
    await p.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
    await p.goto(base + '/hunt/');
    await p.getByRole('button', { name: /End Credits Scratch again/ }).waitFor();
    await p.reload();
    await p.getByRole('button', { name: /End Credits Scratch again/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      'PASS compact cartridge, all ideas, footer keyboard/reveal/persistence and width',
      width,
    );
    await p.close();
  }
} finally {
  await b.close();
  server.close();
}
