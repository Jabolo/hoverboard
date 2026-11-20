import process from 'node:process';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const { createHuntHandler } = await import('../hunt-functions/handler.js');
const handler = createHuntHandler({ includePreview: true });
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/__/')) return res.writeHead(404).end();
  if (req.url === '/api/hunt/access') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'unlocked' }));
  }
  if (req.url.startsWith('/api/hunt/')) return handler(req, res);
  let p = path.join(root, 'dist', new URL(req.url, 'http://x').pathname);
  try {
    if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html');
    await stat(p);
  } catch {
    p = path.join(root, 'dist/index.html');
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
      '.wav': 'audio/wav',
    }[path.extname(p)] || 'application/octet-stream',
  );
  res.end(await readFile(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      serviceWorkers: 'block',
    });
    const errors = [];
    await page.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === base) return route.continue();
      return route.fulfill({ status: 204, body: '' });
    });
    await page.addInitScript(() => {
      window.firebaseConfig = {
        apiKey: 'demo-preview',
        projectId: 'demo-preview',
        appId: 'demo-preview',
      };
      window.scratchSoundStarts = 0;
      window.scratchSoundDuration = 0;
      window.lastFoilSnapshot = '';
      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        const data = toDataURL.apply(this, args);
        if (this.classList.contains('scratch-canvas')) window.lastFoilSnapshot = data;
        return data;
      };
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.scratchSoundStarts++;
        window.scratchSoundDuration = this.buffer?.duration || 0;
        return start.apply(this, args);
      };
    });
    page.on('pageerror', (e) => errors.push(e.message));
    const soundResponse = page.waitForResponse((response) =>
      response.url().endsWith('/audio/piotr-scratch-fine.wav'),
    );
    await page.goto(base + '/hunt/c/y6597cd/');
    assert.equal((await soundResponse).status(), 200);
    const hunt = page.locator('hunt-page');
    const canvas = hunt.locator('.scratch-canvas');
    await canvas.waitFor();
    assert.equal(await hunt.getByRole('button', { name: /sound/i }).count(), 0);
    assert.equal(await page.evaluate(() => window.scratchSoundStarts), 0);
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 15, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 15, box.y + 20, { steps: 16 });
    await page.waitForFunction(() => window.scratchSoundStarts > 0);
    assert.ok(
      await page.evaluate(() => window.scratchSoundDuration > 1.9),
      'Fine scrape recording played',
    );
    await page.mouse.up();
    assert.equal(await hunt.getByRole('heading', { name: 'Collected', exact: true }).count(), 0);
    for (let y = 42; y < box.height - 8; y += 20) {
      await page.mouse.move(box.x + 12, box.y + y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 12, box.y + y, { steps: 15 });
      await page.mouse.up();
      if (await hunt.getByRole('heading', { name: 'Collected', exact: true }).count()) break;
    }
    await hunt.getByRole('heading', { name: 'Collected', exact: true }).waitFor({ timeout: 5000 });
    const result = hunt.locator('.reveal-result.has-scratch');
    assert.equal(await result.count(), 1);
    const resultBox = await result.boundingBox();
    assert.ok(
      Math.abs(resultBox.height - box.height) < 12,
      'scratch panel and result keep the same height',
    );
    const texture = await result.evaluate((el) => el.style.getPropertyValue('--reveal-foil'));
    const captured = await page.evaluate(() => window.lastFoilSnapshot);
    assert.ok(captured.startsWith('data:image/png;base64,'));
    assert.ok(texture.includes(captured), 'result preserves the actual scratched foil');
    const alphas = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let clear = false,
        covered = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 32) clear = true;
        if (data[i] > 220) covered = true;
      }
      return { clear, covered };
    }, captured);
    assert.deepEqual(alphas, { clear: true, covered: true }, 'captured foil retains scratch marks');
    await hunt.getByRole('button', { name: 'Scratch again', exact: true }).click();
    await hunt.locator('dialog .scratch-canvas').waitFor();
    await hunt
      .locator('dialog')
      .getByRole('button', { name: /Reveal Scratch again/ })
      .click();
    await hunt.getByRole('heading', { name: 'Collected card' }).waitFor();
    assert.equal(await hunt.locator('dialog .reveal-result.has-scratch').count(), 1);
    await hunt.locator('dialog').getByRole('button', { name: 'Close' }).click();
    await page.reload();
    await hunt.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.deepEqual(errors, []);
    console.log('PASS scratch threshold, recorded sound, result, replay and persistence', width);
    await page.close();
  }
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(base + '/hunt/c/y6597cd/');
  const touchCanvas = touchPage.locator('hunt-page .scratch-canvas');
  await touchCanvas.waitFor();
  const touchBox = await touchCanvas.boundingBox();
  const cdp = await touchContext.newCDPSession(touchPage);
  for (let y = 15; y < touchBox.height - 10; y += 20) {
    const point = (x) => [{ x, y: touchBox.y + y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: point(touchBox.x + 12),
    });
    for (let x = 25; x < touchBox.width - 8; x += 18) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(touchBox.x + x),
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (await touchPage.getByRole('heading', { name: 'Collected', exact: true }).count()) break;
  }
  await touchPage.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
  await touchContext.close();
  console.log('PASS touch scratch and threshold reveal');
  // The moving light must respond to the pointer and a delayed approval must not reveal text early.
  const boundary = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await boundary.goto(base + '/hunt/c/y6597cd/');
  const boundaryCanvas = boundary.locator('hunt-page .scratch-canvas');
  await boundaryCanvas.waitFor();
  const lightBox = await boundaryCanvas.boundingBox();
  await boundary.mouse.move(lightBox.x + 12, lightBox.y + 15);
  await boundary.waitForTimeout(120);
  const lightBefore = await boundaryCanvas.evaluate((el) => el.toDataURL());
  await boundary.mouse.move(lightBox.x + lightBox.width - 12, lightBox.y + lightBox.height - 15);
  await boundary.waitForTimeout(120);
  const lightAfter = await boundaryCanvas.evaluate((el) => el.toDataURL());
  assert.notEqual(lightAfter, lightBefore, 'foil light responds across both axes');
  await boundary.route('**/api/hunt/**', async (route) => {
    if (route.request().method() === 'POST')
      await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await boundary.getByRole('button', { name: /Reveal Scratch here/ }).click();
  assert.equal(await boundary.getByRole('heading', { name: 'Collected', exact: true }).count(), 0);
  assert.equal(await boundary.locator('hunt-page .scratch-canvas').count(), 1);
  await boundary.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
  await boundary.close();
  console.log('PASS moving foil light and server approval boundary');
  // A failed server check must leave the foil available for a retry.
  const retry = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await retry.goto(base + '/hunt/c/y6597cd/');
  await retry.locator('hunt-page .scratch-canvas').waitFor();
  const failPost = (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
      : route.continue();
  await retry.route('**/api/hunt/cards/**', failPost);
  // Match the actual endpoint regardless of its card-path spelling.
  await retry.route('**/api/hunt/**', failPost);
  await retry.getByRole('button', { name: /Reveal Scratch here/ }).click();
  await retry.getByText(/Couldn’t save your reveal/).waitFor();
  assert.equal(await retry.locator('hunt-page .scratch-canvas').count(), 1);
  await retry.unroute('**/api/hunt/**', failPost);
  await retry.unroute('**/api/hunt/cards/**', failPost);
  await retry.getByRole('button', { name: /Reveal Scratch here/ }).click();
  await retry.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
  await retry.close();
  console.log('PASS failed reveal remains retryable');
  const p = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await p.goto(base + '/hunt/c/y6597cd/');
  const c = p.locator('hunt-page .scratch-canvas');
  await c.waitFor();
  const box = await c.boundingBox();
  await p.mouse.move(box.x + 20, box.y + 20);
  await p.mouse.down();
  await p.mouse.move(box.x + 100, box.y + 20, { steps: 8 });
  const empty = await p
    .locator('hunt-page .scratch-dust')
    .evaluate(
      (el) =>
        !Array.from(el.getContext('2d').getImageData(0, 0, el.width, el.height).data).some(Boolean),
    );
  assert.equal(empty, true);
  await p.mouse.up();
  await p.getByRole('button', { name: /Reveal Scratch here/ }).click();
  await p.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
  const animation = await p
    .locator('hunt-page .reveal-result')
    .evaluate((el) => getComputedStyle(el, '::after').animationName);
  assert.equal(animation, 'none');
  console.log('PASS reduced motion and keyboard-accessible reveal');
  await p.close();
} finally {
  await browser.close();
  server.close();
}
