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
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: width < 760,
      hasTouch: width < 760,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/');
    const peek = page.locator('hunt-peek-card');
    const handle = peek.getByRole('button');
    await handle.waitFor();
    assert.equal(await handle.getAttribute('aria-expanded'), 'false');
    await handle.scrollIntoViewIfNeeded();
    const closed = await handle.boundingBox();
    assert.equal(closed.width, 44);
    assert.equal(closed.height, 56);
    assert.equal(await peek.evaluate((el) => el.previousElementSibling?.id), 'partners');
    await page.screenshot({ path: `/tmp/y2k-peek-corner-${width}.png` });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    // Touch or click opens without claiming; Escape tucks it back and returns focus.
    if (width < 760) await handle.tap();
    else await handle.click();
    assert.equal(await handle.getAttribute('aria-expanded'), 'true');
    assert.equal(
      await page.evaluate(
        () => Object.keys(localStorage).filter((k) => k.includes(':earned:')).length,
      ),
      0,
    );
    await page.screenshot({ path: `/tmp/y2k-peek-open-${width}.png` });
    await handle.press('Escape');
    assert.equal(await handle.getAttribute('aria-expanded'), 'false');
    await handle.press('ArrowLeft');
    assert.equal(await handle.getAttribute('aria-expanded'), 'true');
    await handle.press('ArrowRight');
    assert.equal(await handle.getAttribute('aria-expanded'), 'false');
    const box = await handle.boundingBox();
    // Horizontal pulling is optional; default vertical scrolling remains available.
    if (width < 760) {
      const cdp = await context.newCDPSession(page);
      const touch = async (type, x, y) =>
        cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
        });
      const x = box.x + box.width / 2,
        y = box.y + 35;
      await touch('touchStart', x, y);
      for (let step = 1; step <= 8; step++) {
        await touch('touchMove', x - step * 16, y);
        await page.waitForTimeout(25);
      }
      await touch('touchEnd', x - 128, y);
      assert.equal(await handle.getAttribute('aria-expanded'), 'true', 'horizontal swipe opens');
      await handle.tap();
      const box2 = await handle.boundingBox();
      const sx = box2.x + box2.width / 2,
        sy = box2.y + box2.height - 15;
      await touch('touchStart', sx, sy);
      for (let step = 1; step <= 7; step++) {
        await touch('touchMove', sx, sy - step * 12);
        await page.waitForTimeout(25);
      }
      await touch('touchEnd', sx, sy - 84);
      await page.waitForTimeout(300);
      assert.equal(
        await handle.getAttribute('aria-expanded'),
        'false',
        'vertical swipe does not open',
      );
      assert.ok(
        await page.evaluate(() => scrollY > 20),
        'vertical page scrolling works from handle',
      );
      await page.evaluate(() => scrollTo(0, 0));
    } else {
      await page.mouse.move(box.x + 30, box.y + 30);
      await page.mouse.down();
      await page.mouse.move(box.x - 120, box.y + 30, { steps: 10 });
      await page.mouse.up();
      assert.equal(await handle.getAttribute('aria-expanded'), 'true');
      await handle.click();
    }
    await handle.click();
    await peek.getByRole('link', { name: 'Scratch the shy tab' }).click();
    await page
      .locator('hunt-page')
      .getByRole('button', { name: /reveal/i })
      .click();
    await page.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
    // Existing cards retain routes; new footer and team are discoverable in context.
    for (const [route, name, id] of [
      ['/schedule/', 'Check the 00:00 programme clock', 'wkyb3kc'],
      ['/sessions/', 'Random access', 'auxq7ah'],
      ['/sessions/CFP-050/', 'Inspect debug signal', '2ejjjgf'],
      ['/team/', 'Crew cache discovered', 'cr3w8up'],
      ['/y2k/', 'Inspect the floppy disk', 'f00t3rx'],
    ]) {
      await page.goto(base + route);
      const link = page.getByRole('link', { name, exact: true }).first();
      await link.waitFor();
      assert.equal(await link.getAttribute('href'), `/hunt/c/${id}/`);
      const dims = await link.boundingBox();
      assert.ok(dims.height >= 44);
      await link.scrollIntoViewIfNeeded();
      if (route === '/team/') await page.screenshot({ path: `/tmp/y2k-team-${width}.png` });
      if (id === 'cr3w8up' || id === 'f00t3rx') {
        await link.click();
        await page
          .locator('hunt-page')
          .getByRole('button', { name: /reveal/i })
          .click();
        await page.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
    }
    await page.goto(base + '/hunt/');
    const hunt = page.locator('hunt-page');
    await hunt.getByRole('button', { name: /Shy Browser Tab Scratch again/ }).waitFor();
    // Earned cards restore locally before the remote catalog finishes loading.
    await hunt.locator('li.unknown').nth(21).waitFor({ state: 'attached' });
    assert.equal(await hunt.locator('li.unknown').count(), 22, '25 total minus 3 new earned cards');
    await hunt.getByText('Viktoriia', { exact: true }).waitFor();
    await page.reload();
    await hunt.getByRole('button', { name: /Shy Browser Tab Scratch again/ }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      'PASS discovery, pull/tap/keyboard/vertical scroll, real cards, 25 total and persistence at',
      width,
    );
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
