import { readFileSync, writeFileSync } from 'node:fs';

// PR channels must not send hunt requests to the production catalog.
const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
config.hosting.rewrites = config.hosting.rewrites.filter((rule) => rule.source !== '/api/hunt/**');
writeFileSync('.env.firebase-pr-preview.json', JSON.stringify(config, null, 2) + '\n');
