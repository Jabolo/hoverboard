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
const env = parseEnv(
  await readFile(process.env.HUNT_ENV_FILE || root + '/hunt-functions/.env', 'utf8'),
);
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
      viewport: { width, height: 844 },
      reducedMotion: 'reduce',
      hasTouch: width < 760,
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const go = async () => {
      await page.goto(base + '/y2k/');
      await page
        .locator('y2k-experiments')
        .getByRole('heading', { name: 'Recovered from the Scratch Lab' })
        .waitFor();
    };
    await go();
    const lab = page.locator('y2k-experiments');
    const reward = lab.getByRole('link', { name: 'Scratch my souvenir card' });
    const collect = async (id, title) => {
      assert.equal(await reward.getAttribute('href'), `/hunt/c/${id}/`);
      await reward.click();
      await page
        .locator('hunt-page')
        .getByRole('button', { name: /reveal/i })
        .click();
      await page.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
      await page.goto(base + '/hunt/');
      await page.getByRole('button', { name: new RegExp(title + ' Scratch again') }).waitFor();
      await go();
    };
    assert.equal(await reward.count(), 0);
    // Boss: no shortcut before the third shield.
    for (let n = 1; n <= 3; n++) {
      await lab
        .getByRole('button', { name: `Reveal Scratch shield ${n} of 3`, exact: true })
        .click();
      assert.equal(await reward.count(), 0);
      await lab
        .getByRole('button', { name: n === 3 ? 'Deliver final blow' : 'Next shield', exact: true })
        .click();
    }
    await reward.waitFor();
    await collect('b055win', 'Professional Pop-up Closer');
    // Quarantine: must investigate; wrong answer and three clues do not earn.
    await lab.getByRole('button', { name: /^Bug Quarantine/ }).click();
    await lab.getByRole('button', { name: 'A rogue paperclip', exact: true }).click();
    await lab.getByText('Reveal at least one clue before making your call.').waitFor();
    assert.equal(await reward.count(), 0);
    await lab.getByRole('button', { name: 'Reveal Reveal quarantine clue 1', exact: true }).click();
    await lab.getByRole('button', { name: 'A dancing hamster', exact: true }).click();
    assert.equal(await reward.count(), 0);
    await lab.getByRole('button', { name: 'Reset quarantine', exact: true }).click();
    for (let n = 1; n <= 3; n++)
      await lab
        .getByRole('button', { name: `Reveal Reveal quarantine clue ${n}`, exact: true })
        .click();
    await lab.getByText('CONTAINMENT BREACH', { exact: true }).waitFor();
    assert.equal(await reward.count(), 0);
    await lab.getByRole('button', { name: 'Reset quarantine', exact: true }).click();
    await lab.getByRole('button', { name: 'Reveal Reveal quarantine clue 2', exact: true }).click();
    await lab.getByRole('button', { name: 'A rogue paperclip', exact: true }).click();
    await reward.waitFor();
    await collect('bug5afe', 'Paperclip Containment Unit');
    // Recovery: all fragments plus explicit boot; reset clears uncollected win UI.
    await lab.getByRole('button', { name: /^The Corrupted CD-ROM/ }).click();
    const boot = lab.getByRole('button', { name: 'Boot recovered website', exact: true });
    assert.equal(await boot.isDisabled(), true);
    for (let n = 1; n <= 3; n++)
      await lab
        .getByRole('button', { name: `Reveal Recover disc fragment ${n}`, exact: true })
        .click();
    assert.equal(await reward.count(), 0);
    await boot.click();
    await reward.waitFor();
    await page.screenshot({ path: `/tmp/y2k-experiments-${width}.png`, fullPage: true });
    await collect('cd2002x', 'World Wide Weird Restored');
    await lab.getByRole('button', { name: /^The Corrupted CD-ROM/ }).click();
    assert.equal(await reward.count(), 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS three lab games, losing/retry paths, completion rewards and persistent collection at',
      width,
    );
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
