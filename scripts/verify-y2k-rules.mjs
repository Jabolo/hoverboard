import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const page = await readFile(new URL('../src/pages/y2k-page.ts', import.meta.url), 'utf8');
const hunt = await readFile(new URL('../src/pages/hunt-page.ts', import.meta.url), 'utf8');
const team = JSON.parse(
  await readFile(new URL('../public/data/event-team.json', import.meta.url), 'utf8'),
);
assert.match(JSON.stringify(team), /Viktoriia Vinnykova/);
for (const text of [page, hunt]) {
  assert.doesNotMatch(text, /\bVika\b/);
  assert.match(text, /Viktoriia/);
}
for (const rule of [
  'Y2K Vibe Lab:',
  'Y2K Arcade:',
  'Handwritten code is not a requirement',
  'public',
  'Put instructions on your project page',
  'Participant names',
  'will remain private',
  'not open yet',
  'does not submit a challenge entry',
])
  assert.ok(page.includes(rule), rule);
assert.doesNotMatch(page, /Different activities, different adventures/);
assert.doesNotMatch(page, /LinkedIn community will choose|docs\.google\.com\/document/);
assert.match(page, /deadline, voting process and[\s\S]*?still to be confirmed/);
console.log(
  'PASS challenge rules, privacy, separate activities, Team spelling and no private doc link',
);
