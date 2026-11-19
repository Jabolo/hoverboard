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
const server = createServer(async (req, res) => {
  if (req.url === '/api/hunt/access') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'unlocked' }));
  }
  if (req.url.startsWith('/api/hunt/')) return handler(req, res);
  if (req.url.startsWith('/__/')) return res.writeHead(404).end();
  let file = path.join(root, new URL(req.url, 'http://local.test').pathname);
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    await stat(file);
  } catch {
    file = path.join(root, 'index.html');
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
    }[path.extname(file)] || 'application/octet-stream',
  );
  res.end(await readFile(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const contexts = [];
const errors = [];
const blocked = new Set();
async function device(width = 390, pageErrors = errors) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  contexts.push(context);
  // No remote service, analytics endpoint or production Firebase project can be
  // reached by these synthetic browser accounts and fixtures.
  await context.addInitScript(() => {
    window.firebaseConfig = {
      apiKey: 'demo-preview',
      projectId: 'demo-preview',
      appId: 'demo-preview',
    };
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const origin = url.origin;
    if ([base, 'http://127.0.0.1:18080', 'http://127.0.0.1:19099'].includes(origin))
      return route.continue();
    // The Auth emulator popup still loads Google's public GAPI bootstrap.
    if (
      origin === 'https://apis.google.com' &&
      route.request().method() === 'GET' &&
      (url.pathname === '/js/api.js' || url.pathname.startsWith('/_/scs/'))
    )
      return route.continue();
    if (origin === 'https://www.google.com' && url.pathname === '/images/cleardot.gif')
      return route.continue();
    blocked.add(`${origin}${url.pathname}`);
    return route.fulfill({ status: 204, body: '' });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return { context, page };
}
async function login(page, email, create = false) {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Sign in to sync' }).click(),
  ]);
  if (create) {
    await popup.getByText('Add new account').click();
    try {
      await popup.locator('input:visible').first().fill(email, { timeout: 10000 });
    } catch (error) {
      console.error('Emulator popup state:', await popup.locator('body').innerText());
      console.error('Emulator popup URL:', popup.url());
      throw error;
    }
    await popup.getByRole('button', { name: /Sign in with Google.com/i }).click();
  } else {
    await popup.getByText(email, { exact: true }).click();
  }
  try {
    await page.getByText('Your cards are synced', { exact: false }).waitFor({ timeout: 30000 });
  } catch (error) {
    console.error('Sync state:', await page.locator('.cloud-panel').innerText());
    throw error;
  }
}
async function collect(page, code) {
  await page.goto(`${base}/hunt/c/${code}/`);
  await page.getByRole('button', { name: /Reveal Scratch here/ }).click();
  await page.getByRole('heading', { name: 'Collected', exact: true }).waitFor();
  await page.goto(`${base}/hunt/`);
}
try {
  // A generic remote preview must not initialize the live sync client.
  const previewErrors = [];
  const preview = await device(390, previewErrors);
  await preview.page.addInitScript(() => {
    window.firebaseConfig = {
      apiKey: 'demo-preview',
      projectId: 'demo-preview',
      appId: 'demo-preview',
    };
  });
  await preview.page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'preview.invalid') return route.abort();
    const response = await route.fetch({ url: `${base}${url.pathname}${url.search}` });
    return route.fulfill({ response });
  });
  await preview.page.goto('http://preview.invalid/hunt/');
  await preview.page.getByText('Cloud sync could not load.', { exact: false }).waitFor();
  assert.equal(
    await preview.page.getByRole('button', { name: 'Sign in to sync' }).isDisabled(),
    true,
  );
  // All external requests are deliberately blocked in this isolated preview.
  assert.ok(previewErrors.every((error) => error === 'Failed to fetch'));
  console.log('PASS preview cannot enable live sync');

  for (const width of [320, 1440]) {
    const layout = await device(width);
    await layout.page.goto(`${base}/hunt/`);
    const button = layout.page.getByRole('button', { name: 'Sign in to sync' });
    await button.waitFor();
    await layout.page
      .locator('hunt-page')
      .locator('.cloud-actions button:not([disabled])')
      .waitFor();
    await button.scrollIntoViewIfNeeded();
    await button.focus();
    assert.equal(await button.evaluate((el) => el.getRootNode().activeElement === el), true);
    assert.ok((await button.boundingBox()).height >= 44);
    assert.equal(
      await layout.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await layout.page.screenshot({ path: `/tmp/y2k-cloud-layout-${width}.png` });
  }
  const cancelled = await device();
  await collect(cancelled.page, 'y6597cd');
  let closedPopup;
  try {
    [closedPopup] = await Promise.all([
      cancelled.page.waitForEvent('popup', { timeout: 12000 }),
      cancelled.page.getByRole('button', { name: 'Sign in to sync' }).click(),
    ]);
  } catch (error) {
    console.error('Sign-in state:', await cancelled.page.locator('.cloud-panel').innerText());
    console.error('Blocked remote hosts and paths:', [...blocked]);
    throw error;
  }
  await closedPopup.close();
  await cancelled.page
    .getByText('Sign-in was closed.', { exact: false })
    .waitFor({ timeout: 30000 });
  await cancelled.page.getByRole('button', { name: /Welcome Disc Scratch again/ }).waitFor();
  const first = await device();
  console.log('PASS mobile and desktop layout');
  await collect(first.page, 'y6597cd');
  await first.page.getByRole('button', { name: /Welcome Disc Scratch again/ }).waitFor();
  await first.page.screenshot({ path: '/tmp/y2k-cloud-before-sync.png', fullPage: true });
  await login(first.page, 'alice@example.test', true);
  await first.page.screenshot({ path: '/tmp/y2k-cloud-synced.png', fullPage: true });
  await first.page.reload();
  await first.page.getByText('Your cards are synced', { exact: false }).waitFor({ timeout: 30000 });

  const second = await device();
  await second.page.goto(`${base}/hunt/`);
  await login(second.page, 'alice@example.test');
  await second.page.getByRole('button', { name: /Welcome Disc Scratch again/ }).waitFor();
  await collect(second.page, 'f00t3rx');
  await second.page
    .getByText('Your cards are synced', { exact: false })
    .waitFor({ timeout: 30000 });
  await first.page
    .getByRole('button', { name: /End Credits Scratch again/ })
    .waitFor({ timeout: 30000 });

  // Independent simultaneous writes must merge instead of replacing each other.
  await Promise.all([collect(first.page, 'p3ek7up'), collect(second.page, 'wkyb3kc')]);
  await first.page
    .getByRole('button', { name: /Dial-up Clock Scratch again/ })
    .waitFor({ timeout: 30000 });
  await second.page
    .getByRole('button', { name: /Shy Browser Tab Scratch again/ })
    .waitFor({ timeout: 30000 });
  console.log('PASS two-device and concurrent sync');

  await second.context.setOffline(true);
  await second.page.getByText('Waiting for a connection', { exact: false }).waitFor();
  await second.context.setOffline(false);
  await second.page
    .getByText('Your cards are synced', { exact: false })
    .waitFor({ timeout: 30000 });

  const third = await device();
  await third.page.goto(`${base}/hunt/`);
  await login(third.page, 'bob@example.test', true);
  assert.equal(
    await third.page.getByRole('button', { name: /Welcome Disc Scratch again/ }).count(),
    0,
  );
  assert.equal(
    await third.page.getByRole('button', { name: /End Credits Scratch again/ }).count(),
    0,
  );
  // A malformed local entry is rejected by the rules. Successful writes must
  // not mask that failure, and a retry after removing it must recover.
  await third.page.evaluate(() => {
    localStorage.setItem(
      'devfest-warsaw-2026-hunt:v1:found:test999',
      JSON.stringify({
        state: 'found',
        card: { id: 'test999', title: 'Broken fixture', group: 'invalid' },
        foundAt: 1,
      }),
    );
  });
  await collect(third.page, 'auxq7ah');
  await third.page.getByText('Sync needs attention', { exact: false }).waitFor({ timeout: 30000 });
  assert.equal(await third.page.getByText('Your cards are synced', { exact: false }).count(), 0);
  await third.page.evaluate(() =>
    localStorage.removeItem('devfest-warsaw-2026-hunt:v1:found:test999'),
  );
  await third.page.getByRole('button', { name: 'Retry sync' }).click();
  await third.page.getByText('Your cards are synced', { exact: false }).waitFor({ timeout: 30000 });
  console.log('PASS account isolation and rejected-write recovery');

  await first.page.getByRole('button', { name: 'Stop syncing' }).click();
  await first.page.getByText('Saved in this browser', { exact: false }).waitFor();
  await first.page.getByRole('button', { name: /Welcome Disc Scratch again/ }).waitFor();
  assert.equal(
    await first.page.getByRole('button', { name: /End Credits Scratch again/ }).count(),
    0,
  );

  // Offline deletion must report failure and leave local cards untouched.
  await second.context.setOffline(true);
  second.page.once('dialog', (dialog) => dialog.accept());
  await second.page.getByRole('button', { name: 'Delete synced cards' }).click();
  await second.page.getByText(/Could not confirm cloud deletion/).waitFor();
  await second.page.getByRole('button', { name: /End Credits Scratch again/ }).waitFor();
  await second.context.setOffline(false);
  await login(second.page, 'alice@example.test');

  second.page.once('dialog', (dialog) => dialog.accept());
  await second.page.getByRole('button', { name: 'Delete synced cards' }).click();
  await second.page
    .getByText('Synced cards deleted.', { exact: false })
    .waitFor({ timeout: 30000 });
  await second.page.getByRole('button', { name: /End Credits Scratch again/ }).waitFor();

  const fourth = await device();
  await fourth.page.goto(`${base}/hunt/`);
  await login(fourth.page, 'alice@example.test');
  assert.equal(
    await fourth.page.getByRole('button', { name: /Welcome Disc Scratch again/ }).count(),
    0,
  );
  assert.equal(
    await fourth.page.getByRole('button', { name: /End Credits Scratch again/ }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS browser-local reveal, opt-in import, reload, two-device sync, offline recovery, account isolation and cloud deletion',
  );
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
