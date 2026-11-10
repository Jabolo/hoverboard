import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve('dist-agenda-preview');
const port = Number(process.env.AGENDA_PREVIEW_PORT || 4180);
if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('Run npm run build:agenda-preview before starting the local preview.');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid preview port');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
http
  .createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
      let file = path.resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error('Invalid path');
      if (fs.existsSync(file) && fs.statSync(file).isDirectory())
        file = path.join(file, 'index.html');
      if (!fs.existsSync(file) && !path.extname(pathname)) file = path.join(root, 'index.html');
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
      });
      fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(400).end('Bad request');
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`Local agenda preview: http://127.0.0.1:${port}/schedule`);
  });
