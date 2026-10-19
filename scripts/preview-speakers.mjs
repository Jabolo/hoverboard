/** Local-only preview. Intentionally does not invoke Firebase CLI or write Firestore. */
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist-preview');
const source = resolve(root, 'preview/confirmed-speakers-2026');
const options = new Set(process.argv.slice(2));
if (!options.has('--serve-only')) {
  // Fail before building if the approved input has not yet been prepared.
  const data = JSON.parse(await readFile(resolve(source, 'data.json'), 'utf8'));
  if (
    Object.keys(data.speakers || {}).length !== 12 ||
    Object.keys(data.sessions || {}).length !== 8
  ) {
    throw new Error(
      'Expected 12 speakers and 8 sessions in preview/confirmed-speakers-2026/data.json',
    );
  }
  await rm(output, { recursive: true, force: true });
  const result = spawnSync(
    resolve(root, 'node_modules/.bin/rollup'),
    ['--config', 'rollup.config.ts', '--configPlugin', 'typescript'],
    {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'development', SPEAKERS_PREVIEW: '1' },
      stdio: 'inherit',
    },
  );
  if (result.status !== 0) process.exit(result.status || 1);
  await mkdir(resolve(output, 'preview'), { recursive: true });
  await cp(resolve(source, 'data.json'), resolve(output, 'preview/data.json'));
  await cp(resolve(source, 'photos'), resolve(output, 'preview/speakers'), { recursive: true });
  await cp(resolve(source, 'logos'), resolve(output, 'preview/logos'), { recursive: true });
}
if (!options.has('--build-only')) {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.md': 'text/markdown; charset=utf-8',
  };
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader(
      'Content-Security-Policy',
      "connect-src 'self' https://firestore.googleapis.com; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://evenea.pl https://*.evenea.pl; form-action 'none'",
    );
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host || '')) {
      response.writeHead(403).end('Loopback hosts only');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end('Read-only preview');
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
      let file = resolve(output, `.${pathname}`);
      if (!file.startsWith(output + sep) && file !== output) {
        response.writeHead(403).end();
        return;
      }
      const info = await stat(file).catch(() => null);
      if (info?.isDirectory()) file = resolve(file, 'index.html');
      else if (
        !info &&
        !extname(pathname) &&
        !pathname.startsWith('/preview/') &&
        !pathname.startsWith('/__/')
      ) {
        file = resolve(output, 'index.html');
      }
      const body = await readFile(file);
      response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
      response.writeHead(200).end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404).end('Preview resource not found');
    }
  });
  let port = 5002;
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < 5012) {
      port += 1;
      server.listen(port, '127.0.0.1');
    } else throw error;
  });
  server.on('listening', () =>
    console.log(
      `Speaker preview: http://localhost:${port}/speakers (loopback only; no deployment)`,
    ),
  );
  server.listen(port, '127.0.0.1');
}
