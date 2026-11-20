// Local-only real Firebase Auth test. Never uses event production data or catalog.
import process from 'node:process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHuntHandler } from '../hunt-functions/handler.js';

const configPath = process.env.HUNT_TEST_FIREBASE_CONFIG;
if (!configPath)
  throw new Error('Set HUNT_TEST_FIREBASE_CONFIG to the isolated test Web app config file');
const config = JSON.parse(await readFile(configPath, 'utf8'));
if (
  config.projectId !== 'devfest-y2k-sync-test-1120' ||
  config.authDomain !== 'devfest-y2k-sync-test-1120.firebaseapp.com'
) {
  throw new Error('Refusing a project other than the isolated Y2K test');
}
const baseDir = fileURLToPath(new URL('../dist/', import.meta.url));
const mockHunt = createHuntHandler({ includePreview: true });
const mime = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/api/hunt/access') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ status: 'unlocked' }));
    return;
  }
  if (url.pathname.startsWith('/api/hunt/')) return mockHunt(request, response);
  if (url.pathname === '/__/firebase/init.js') {
    response.setHeader('Content-Type', 'application/javascript');
    const safeConfig = JSON.stringify(config).replaceAll('<', '\\u003c');
    response.end(
      `window.huntRealAuthTestConfig=${safeConfig};window.firebase.initializeApp(window.huntRealAuthTestConfig);`,
    );
    return;
  }
  if (url.pathname.startsWith('/__/')) return response.writeHead(404).end();
  let file = path.join(baseDir, url.pathname);
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    await stat(file);
  } catch {
    file = path.join(baseDir, 'index.html');
  }
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  response.end(await readFile(file));
});
server.listen(0, '127.0.0.1', () => {
  console.log(`Isolated Y2K test: http://localhost:${server.address().port}/hunt/`);
  console.log(
    'Only the dedicated test Firebase project and mock cards are used. Press Ctrl-C to stop.',
  );
});
