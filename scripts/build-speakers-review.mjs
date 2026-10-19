/** Build only: review deployment is a separate explicit Hosting channel command. */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'preview/confirmed-speakers-2026');
const output = resolve(root, 'dist-review');
const data = JSON.parse(await readFile(resolve(source, 'data.json'), 'utf8'));
if (
  Object.keys(data.speakers || {}).length !== 12 ||
  Object.keys(data.sessions || {}).length !== 8
) {
  throw new Error('Review requires the approved 12-speaker / 8-session roster');
}
const files = new Set();
for (const speaker of Object.values(data.speakers)) {
  if (!speaker.photoUrl?.startsWith('/preview/speakers/'))
    throw new Error('Missing local portrait');
  files.add(speaker.photoUrl);
  if (speaker.companyLogoUrl) files.add(speaker.companyLogoUrl);
}
for (const path of files) {
  if (!/^\/preview\/(speakers|logos)\/[a-z0-9.-]+$/.test(path)) {
    throw new Error(`Invalid review asset path: ${path}`);
  }
}
await rm(output, { recursive: true, force: true });
const build = spawnSync(
  resolve(root, 'node_modules/.bin/rollup'),
  ['--config', 'rollup.config.ts', '--configPlugin', 'typescript'],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production', SPEAKERS_PREVIEW: 'review' },
    stdio: 'inherit',
  },
);
if (build.status !== 0) process.exit(build.status || 1);
await mkdir(resolve(output, 'preview'), { recursive: true });
await cp(resolve(source, 'data.json'), resolve(output, 'preview/data.json'));
for (const path of files) {
  const destination = resolve(output, `.${path}`);
  await mkdir(dirname(destination), { recursive: true });
  await cp(
    resolve(
      source,
      path.replace('/preview/speakers/', 'photos/').replace('/preview/logos/', 'logos/'),
    ),
    destination,
  );
}
await writeFile(resolve(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
await rm(resolve(output, 'sitemap.xml'), { force: true });
await rm(resolve(output, 'service-worker.js'), { force: true });
await rm(resolve(output, 'firebase-messaging-sw.js'), { force: true });
console.log(
  'Review build ready in dist-review. Deployment permitted only to channel speakers-review-2026.',
);
