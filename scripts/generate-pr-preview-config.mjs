import { readFileSync, writeFileSync } from 'node:fs';

// PR channels must never proxy unauthenticated traffic to production Cloud Functions
// or be indexed by search engines.
const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
config.hosting.rewrites = (config.hosting.rewrites ?? []).filter(
  (rule) => !rule.function && !String(rule.source ?? '').startsWith('/api/'),
);
const ignore = new Set(config.hosting.ignore ?? []);
ignore.add('**/*.map');
config.hosting.ignore = [...ignore];

config.hosting.headers = config.hosting.headers ?? [];
const globalHeaderBlock = config.hosting.headers.find((entry) => entry.source === '**');
const noIndexHeader = { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' };
if (globalHeaderBlock) {
  globalHeaderBlock.headers = (globalHeaderBlock.headers ?? []).filter(
    (header) => header.key.toLowerCase() !== 'x-robots-tag',
  );
  globalHeaderBlock.headers.push(noIndexHeader);
} else {
  config.hosting.headers.unshift({ source: '**', headers: [noIndexHeader] });
}

writeFileSync('.env.firebase-pr-preview.json', JSON.stringify(config, null, 2) + '\n');
