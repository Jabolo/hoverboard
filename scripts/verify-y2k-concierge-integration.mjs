import assert from 'node:assert/strict';
import process from 'node:process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHuntHandler } from '../hunt-functions/handler.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const handler = createHuntHandler({ includePreview: true });
const mime = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
};
const server = createServer(async (req, res) => {
  if (req.url === '/api/hunt/access') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'unlocked' }));
  }
  if (req.url.startsWith('/api/hunt/')) return handler(req, res);
  if (req.url.startsWith('/api/concierge')) return res.writeHead(503).end();
  if (req.url.startsWith('/__/')) return res.writeHead(404).end();
  let file = path.join(root, new URL(req.url, 'http://local.test').pathname);
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    await stat(file);
  } catch {
    file = path.join(root, 'index.html');
  }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.end(await readFile(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    await context.addInitScript(() => {
      window.firebaseConfig = {
        apiKey: 'demo-preview',
        projectId: 'demo-preview',
        appId: 'demo-preview',
      };
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === base
        ? route.continue()
        : route.fulfill({ status: 204, body: '' }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/hunt/c/y6597cd/');
    const hunt = page.locator('hunt-page');
    await hunt.getByRole('button', { name: /Reveal Scratch here/ }).click();
    await hunt.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
    await page.goto(base + '/hunt/');
    await hunt.getByRole('button', { name: /Welcome Disc Scratch again/ }).waitFor();
    const fab = page.getByRole('button', { name: 'Ask DevFest AI Concierge' });
    await fab.waitFor({ state: 'visible' });
    await fab.click();
    const dialog = page.locator('devfest-concierge[variant="floating"]').locator('dialog');
    await dialog.waitFor({ state: 'visible' });
    const input = dialog.getByRole('textbox', { name: 'Ask DevFest Concierge' });
    await input.fill('Where is the schedule?');
    assert.equal(await input.inputValue(), 'Where is the schedule?');
    await dialog.getByRole('button', { name: 'Close concierge' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await hunt.getByRole('button', { name: /Welcome Disc Scratch again/ }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.deepEqual(errors, []);
    console.log('PASS integrated scratch, collection and concierge controls', width);
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
