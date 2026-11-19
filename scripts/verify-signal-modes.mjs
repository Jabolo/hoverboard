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
    await p.clock.install();
    const game = h.locator('hunt-signal-game');
    await game.getByRole('button', { name: 'Normal', exact: true }).waitFor();
    await game.getByRole('button', { name: 'Start game', exact: true }).click();
    assert.equal(await game.locator('.lamp.clear').count(), 1);
    // A miss does not consume one of the four successful catches.
    await game.getByRole('button', { name: 'Catch signal', exact: true }).click();
    assert.match(await game.locator('.scoreboard').innerText(), /Score: 0 \/ 4/);
    for (let n = 0; n < 4; n++) {
      for (
        let step = 0;
        step < 4 && (await game.locator('.dial strong').innerText()) !== 'Clear signal';
        step++
      )
        await game.getByRole('button', { name: 'Next signal', exact: true }).click();
      await game.getByRole('button', { name: 'Catch signal', exact: true }).click();
    }
    await game.getByText('All four caught in 5 tries!', { exact: false }).waitFor();
    assert.equal(
      await game.getByRole('heading', { name: 'Bonus transmission', exact: true }).count(),
      0,
    );
    await game.getByRole('button', { name: 'Play again', exact: true }).click();
    for (let n = 0; n < 4; n++) {
      for (
        let step = 0;
        step < 4 && (await game.locator('.dial strong').innerText()) !== 'Clear signal';
        step++
      )
        await game.getByRole('button', { name: 'Next signal', exact: true }).click();
      await game.getByRole('button', { name: 'Catch signal', exact: true }).click();
    }
    await game.getByRole('heading', { name: 'Bonus transmission', exact: true }).waitFor();
    await game.getByRole('button', { name: 'Hardcore', exact: true }).click();
    assert.equal(await game.getByRole('checkbox').count(), 0);
    await game.getByRole('button', { name: 'Start game', exact: true }).click();
    assert.equal(await game.getByRole('button', { name: 'Next signal', exact: true }).count(), 0);
    assert.match(await game.locator('.scoreboard').innerText(), /Time: 30s/);
    assert.equal(await game.locator('.lamp.clear').count(), 0);
    assert.equal(await game.locator('.lamp.hit, strong.clear').count(), 0);
    assert.equal(await game.locator('.lamps').getAttribute('aria-hidden'), 'true');
    await game.screenshot({ path: `/tmp/signal-no-hint-${width}.png` });
    for (let n = 0; n < 3; n++) {
      for (
        let step = 0;
        step < 4 && (await game.locator('.dial strong').innerText()) !== 'Clear signal';
        step++
      )
        await p.clock.runFor(await game.evaluate((el) => el.speed));
      assert.equal(await game.locator('.lamp.clear').count(), 0);
      assert.equal(await game.locator('.lamp.active').count(), 1);
      assert.equal(await game.locator('.lamp.active.hit').count(), 1);
      assert.equal(await game.locator('strong.clear').innerText(), 'Clear signal');
      assert.equal(
        await game.locator('.lamp.hit').evaluate((el) => getComputedStyle(el).backgroundColor),
        await game.locator('strong.clear').evaluate((el) => getComputedStyle(el).color),
      );
      await game.screenshot({ path: `/tmp/signal-green-${width}.png` });
      const before = await game.evaluate((el) => ({ target: el.target, speed: el.speed }));
      await game.getByRole('button', { name: 'Catch signal', exact: true }).click();
      assert.equal(await game.evaluate((el) => el.score), n + 1);
      assert.notEqual(await game.evaluate((el) => el.target), before.target);
      assert.ok((await game.evaluate((el) => el.speed)) < before.speed);
      // Repeated presses in the same frame cannot farm points or penalties.
      const tries = await game.evaluate((el) => el.attempts);
      await game.getByRole('button', { name: 'Catch signal', exact: true }).click();
      assert.equal(await game.evaluate((el) => el.attempts), tries);
    }
    await p.clock.runFor(251);
    const beforeMiss = await game.evaluate((el) => ({ deadline: el.deadline, score: el.score }));
    assert.notEqual(await game.locator('.dial strong').innerText(), 'Clear signal');
    await game.getByRole('button', { name: 'Catch signal', exact: true }).click();
    assert.equal(await game.evaluate((el) => el.deadline), beforeMiss.deadline - 2000);
    assert.equal(await game.evaluate((el) => el.score), beforeMiss.score);
    await p.clock.runFor(30001);
    await game.getByText('Time! 3 signals caught.', { exact: false }).waitFor();
    assert.match(await game.locator('.scoreboard').innerText(), /Time: 0s/);
    assert.equal(await game.getByRole('button', { name: 'Catch signal', exact: true }).count(), 0);
    assert.equal(await game.evaluate((el) => el.timer), undefined);
    assert.equal(await game.evaluate((el) => el.clockTimer), undefined);
    await game.scrollIntoViewIfNeeded();
    await game.screenshot({ path: `/tmp/signal-hardcore-${width}.png` });
    await p.reload();
    const again = p.locator('hunt-signal-game');
    await again.getByRole('button', { name: 'Hardcore', exact: true }).click();
    assert.match(await again.locator('.scoreboard').innerText(), /Best: 3/);
    await again.getByRole('button', { name: 'Start game', exact: true }).click();
    await p.clock.runFor(30001);
    await again.getByText('Time! 0 signals caught.', { exact: false }).waitFor();
    await again.getByRole('button', { name: 'Play again', exact: true }).click();
    assert.match(await again.locator('.scoreboard').innerText(), /Time: 30s/);
    await again.getByRole('button', { name: 'Stop game', exact: true }).click();
    assert.equal(await again.evaluate((el) => el.timer), undefined);
    await again.getByRole('button', { name: 'Play again', exact: true }).click();
    await p.clock.runFor(28001);
    if ((await again.locator('.dial strong').innerText()) === 'Clear signal')
      await p.clock.runFor(720);
    await again.getByRole('button', { name: 'Catch signal', exact: true }).click();
    await again.getByText('Time! 0 signals caught.', { exact: false }).waitFor();
    assert.match(await again.locator('.scoreboard').innerText(), /Time: 0s/);
    assert.match(await again.locator('.scoreboard').innerText(), /Best: 3/);

    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log(
      'PASS normal four catches, hardcore movement/speed/countdown/penalty/best/retry',
      width,
    );
    await p.close();
  }
} finally {
  await b.close();
  server.close();
}
