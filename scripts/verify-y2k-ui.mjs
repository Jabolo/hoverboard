import process from 'node:process';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Run with a trusted Playwright installation, e.g. PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { createHuntHandler } from '../hunt-functions/handler.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const env = parseEnv(await readFile(root + '/hunt-functions/.env', 'utf8'));
const handler = createHuntHandler({
  includePreview: true,
  physicalCards: JSON.parse(env.HUNT_PHYSICAL_CARDS),
});
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
};
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/api/hunt/')) return handler(req, res);
  if (u.pathname.startsWith('/__/')) return res.writeHead(404).end();
  let f = path.join(root, 'dist', u.pathname);
  try {
    if ((await stat(f)).isDirectory()) f = path.join(f, 'index.html');
    await stat(f);
  } catch {
    if (path.extname(u.pathname)) return res.writeHead(404).end();
    f = root + '/dist/index.html';
  }
  res
    .writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' })
    .end(await readFile(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = process.argv[2] || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/y2k/');
    const hub = page.locator('y2k-page');
    await hub.getByRole('heading', { name: /Y2K/ }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      'no horizontal overflow',
    );
    assert.equal(
      await hub
        .locator('.cassette')
        .evaluate((el) => getComputedStyle(el, '::after').animationName),
      'none',
    );
    await hub.getByRole('button', { name: 'Press START' }).click();
    assert.equal(
      await hub.locator('#play').evaluate((el) => el === el.getRootNode().activeElement),
      true,
    );
    const before = await hub.locator('.prompt').innerText();
    await hub.getByRole('button', { name: 'Load another idea' }).click();
    assert.notEqual(await hub.locator('.prompt').innerText(), before);
    const memory = hub.locator('.memory');
    // Inspect only to choose pairs, then exercise real user controls.
    const deck = await hub.evaluate((el) => el.deck);
    for (const symbol of new Set(deck)) {
      const ids = deck.flatMap((s, i) => (s === symbol ? [i] : []));
      await memory.locator('button').nth(ids[0]).click();
      await memory.locator('button').nth(ids[1]).click();
    }
    await hub.getByText('Cache restored! All 4 pairs in 4 turns.').waitFor();
    await hub.getByRole('button', { name: 'New game', exact: true }).click();
    await hub.getByText('0 / 4 pairs · 0 turns').waitFor();
    // rapid double-click cannot match one tile with itself.
    await memory.locator('button').first().dblclick();
    assert.equal(await hub.evaluate((el) => el.flipped.length), 1);
    await hub.getByRole('button', { name: 'New game', exact: true }).click();
    const newDeck = await hub.evaluate((el) => el.deck);
    const other = newDeck.findIndex((s) => s !== newDeck[0]);
    await memory.locator('button').nth(0).click();
    await memory.locator('button').nth(other).click();
    await hub.getByRole('button', { name: 'New game', exact: true }).click();
    await page.waitForTimeout(1200);
    assert.equal(await hub.evaluate((el) => el.turns), 0);
    const game = hub.locator('hunt-signal-game');
    await game.getByRole('button', { name: 'Start game', exact: true }).click();
    for (let i = 0; i < 5; i++) {
      for (
        let n = 0;
        n < 5 && !(await game.getByText('Clear signal', { exact: true }).count());
        n++
      )
        await game.getByRole('button', { name: 'Next signal' }).click();
      await game.getByRole('button', { name: 'Catch signal' }).click();
    }
    await game.getByRole('heading', { name: 'Bonus transmission · 5/5' }).waitFor();
    assert.equal(
      await page.evaluate(() => localStorage.getItem('devfest-warsaw-2026-hunt-v1:perfect:')),
      null,
    );
    await page.screenshot({ path: `/tmp/y2k-hub-${width}.png`, fullPage: true });
    await hub.getByRole('link', { name: 'Scratch the Welcome Disc', exact: true }).first().click();
    const hunt = page.locator('hunt-page');
    await hunt.getByRole('button', { name: /reveal/i }).click();
    await hunt.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
    await page.goBack();
    await hub.getByRole('heading', { name: /Y2K/ }).waitFor();
    await page.reload();
    await hub.getByRole('heading', { name: /Y2K/ }).waitFor();
    if (width < 760) {
      await page.getByRole('button', { name: 'Open navigation menu' }).click();
      const link = page
        .locator('app-drawer')
        .getByRole('link', { name: 'Y2K Arcade', exact: true });
      await link.click();
    }
    console.log('PASS hub', width, 'errors:', JSON.stringify(errors));
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
