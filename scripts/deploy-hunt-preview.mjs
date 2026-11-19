import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);

const args = process.argv.slice(2);
if (args.length !== 1 || !['api', 'hosting', 'local'].includes(args[0])) {
  throw new Error('Use node scripts/deploy-hunt-preview.mjs api|hosting|local');
}

const mode = args[0];
const project = 'gdg-warsaw-devfest26-web';
const channel = 'y2k-card-hunt';
const apiSource = '/api/hunt/**';
const huntPaths = ['/hunt', '/hunt/**'];
const base = JSON.parse(readFileSync('firebase.json', 'utf8')).hosting;
const config = {
  functions: [
    {
      source: 'hunt-functions',
      codebase: 'hunt-preview',
      ignore: ['node_modules', '.git', '.env*', '*.test.js'],
    },
  ],
  hosting: {
    ...base,
    rewrites: [
      { source: apiSource, function: { functionId: 'y2kCardHuntPreview', region: 'us-central1' } },
      ...huntPaths.map((source) => ({ source, destination: '/index.html' })),
      ...base.rewrites.filter((rule) => !rule.function),
    ],
    headers: [
      ...base.headers,
      {
        source: '**',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      ...huntPaths.map((source) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      })),
    ],
  },
  emulators: { functions: { port: 5016 }, hosting: { port: 5017 }, ui: { enabled: false } },
};

if (
  mode === 'api' &&
  !readFileSync('hunt-functions/.env', 'utf8').includes('HUNT_PHYSICAL_CARDS=')
) {
  throw new Error('Set HUNT_PHYSICAL_CARDS in the ignored hunt-functions/.env first.');
}

const configPath = `.env.firebase-hunt-preview-${process.pid}.json`;
writeFileSync(configPath, JSON.stringify(config), { flag: 'wx' });
const firebaseArgs =
  mode === 'api'
    ? ['deploy', '--only', 'functions:hunt-preview']
    : mode === 'hosting'
      ? ['hosting:channel:deploy', channel, '--expires', '14d', '--no-authorized-domains']
      : ['emulators:start', '--only', 'hosting,functions'];
try {
  // Use the signed-in Firebase CLI identity rather than an inherited deployment token.
  const env = { ...process.env };
  delete env.FIREBASE_TOKEN;
  const firebaseExecutable = new URL(
    '../node_modules/firebase-tools/lib/bin/firebase.js',
    import.meta.url,
  );
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(firebaseExecutable),
      ...firebaseArgs,
      '--config',
      configPath,
      '--project',
      mode === 'local' ? 'demo-devfest-hunt' : project,
      '--non-interactive',
    ],
    { env, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(configPath, { force: true });
}
