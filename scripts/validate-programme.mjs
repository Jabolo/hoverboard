import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const approvedSessions = {
  'CFP-002': ['calgan-aygun'],
  'CFP-012': ['andrii-khrystian'],
  'CFP-014': ['ivan-lapa'],
  'CFP-021': ['yonatan-levin'],
  'CFP-034': ['hasan-rafiq'],
  'CFP-050': ['dominika-zajac'],
  'INVITED-001': ['adrian-romanski'],
  'PANEL-01': [
    'dmytro-nedvetskyi',
    'yaroslav-polyakov',
    'sergiy-mokiyenko',
    'serhii-kasianchuk',
    'viacheslav-miroshnychenko',
  ],
  'CFP-028': ['tomasz-porozynski'],
  'CFP-043': ['michal-tajchert'],
};
const speakerKeys = [
  'name',
  'bio',
  'shortBio',
  'company',
  'title',
  'country',
  'companyLogo',
  'companyLogoUrl',
  'companyLogoBackground',
  'featured',
  'order',
  'photo',
  'photoUrl',
  'animatedPhotoUrl',
  'socials',
  'badges',
  'sessionRoles',
];
const sessionKeys = ['title', 'description', 'speakers', 'tags', 'language', 'complexity'];

function keys(record, allowed, label) {
  assert(
    record && typeof record === 'object' && !Array.isArray(record),
    `${label}: expected object`,
  );
  for (const key of Object.keys(record))
    assert(allowed.includes(key), `${label}: forbidden field ${key}`);
}

function nonempty(value, label) {
  assert(typeof value === 'string' && value.trim(), `${label}: required text`);
}

function publicLink(value, label) {
  nonempty(value, label);
  const url = new URL(value);
  assert(['http:', 'https:'].includes(url.protocol), `${label}: only public web links allowed`);
  assert(!url.username && !url.password, `${label}: credentials forbidden`);
}

/** Fail the release build before Rollup if the approved public snapshot has drifted. */
export function validateProgramme(source, publicRoot = path.join(root, 'public')) {
  keys(source, ['speakers', 'sessions'], 'programme');
  keys(source.speakers, Object.values(approvedSessions).flat(), 'speakers');
  keys(source.sessions, Object.keys(approvedSessions), 'sessions');
  const actualSpeakerIds = Object.keys(source.speakers).sort();
  assert.deepEqual(
    actualSpeakerIds,
    Object.values(approvedSessions).flat().sort(),
    'Expected exactly 14 approved speakers',
  );
  assert.deepEqual(
    Object.keys(source.sessions).sort(),
    Object.keys(approvedSessions).sort(),
    'Expected exactly 10 approved sessions',
  );
  assert(!JSON.stringify(source).includes('/preview/'), 'Legacy preview paths are forbidden');
  assert(!JSON.stringify(source).includes('CFP-042'), 'Unconfirmed CFP-042 is forbidden');

  const assets = new Set();
  function asset(value, folder, label) {
    assert(typeof value === 'string', `${label}: expected local image path`);
    const pattern = new RegExp(
      `^/images/${folder}/2026/[a-z0-9-]+\\.([a-f0-9]{8})\\.(webp|png|jpg|jpeg|svg)$`,
    );
    const match = pattern.exec(value);
    assert(match, `${label}: expected strict local image path with content hash`);
    const filename = path.join(publicRoot, value.slice(1));
    const real = fs.realpathSync(filename);
    assert(
      real.startsWith(
        `${fs.realpathSync(path.join(publicRoot, 'images', folder, '2026'))}${path.sep}`,
      ),
      `${label}: image escapes approved directory`,
    );
    assert(fs.statSync(real).isFile(), `${label}: image is not a file`);
    const bytes = fs.readFileSync(real);
    assert(bytes.length > 0, `${label}: empty image`);
    assert.equal(
      crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8),
      match[1],
      `${label}: content hash mismatch`,
    );
    assets.add(value);
  }

  const names = new Set();
  for (const [id, speaker] of Object.entries(source.speakers)) {
    keys(speaker, speakerKeys, id);
    nonempty(speaker.name, `${id}.name`);
    assert(!names.has(speaker.name), `${id}: duplicate speaker name`);
    names.add(speaker.name);
    for (const field of ['bio', 'shortBio', 'company', 'title']) {
      assert(typeof speaker[field] === 'string', `${id}.${field}: expected text`);
    }
    assert(!speaker.country, `${id}: nationality labels are forbidden`);
    assert(typeof speaker.featured === 'boolean', `${id}.featured: expected boolean`);
    assert(Number.isFinite(speaker.order), `${id}.order: expected number`);
    asset(speaker.photoUrl, 'speakers', `${id}.photoUrl`);
    if (speaker.animatedPhotoUrl)
      asset(speaker.animatedPhotoUrl, 'speakers', `${id}.animatedPhotoUrl`);
    assert.equal(speaker.photo, speaker.photoUrl, `${id}: inconsistent portrait aliases`);
    assert.equal(
      speaker.companyLogo || '',
      speaker.companyLogoUrl || '',
      `${id}: inconsistent company logo aliases`,
    );
    if (speaker.companyLogoUrl)
      asset(speaker.companyLogoUrl, 'speaker-companies', `${id}.companyLogoUrl`);
    if (speaker.companyLogoBackground !== undefined)
      assert(
        ['light', 'dark'].includes(speaker.companyLogoBackground),
        `${id}: invalid logo background`,
      );
    for (const [field, allowed] of [
      ['socials', ['icon', 'name', 'link']],
      ['badges', ['name', 'description', 'link']],
    ]) {
      if (speaker[field] === undefined) continue;
      assert(Array.isArray(speaker[field]), `${id}.${field}: expected array`);
      for (const entry of speaker[field]) {
        keys(entry, allowed, `${id}.${field}`);
        for (const key of allowed) nonempty(entry[key], `${id}.${field}.${key}`);
        publicLink(entry.link, `${id}.${field}.link`);
      }
    }
    if (speaker.sessionRoles) {
      keys(speaker.sessionRoles, ['PANEL-01'], `${id}.sessionRoles`);
      for (const [sessionId, role] of Object.entries(speaker.sessionRoles)) {
        assert(source.sessions[sessionId].speakers.includes(id), `${id}: orphaned session role`);
        assert.equal(
          role,
          id === 'dmytro-nedvetskyi' ? 'Moderator' : 'Panellist',
          `${id}: invalid panel role`,
        );
      }
    }
  }
  for (const [id, session] of Object.entries(source.sessions)) {
    keys(session, sessionKeys, id);
    nonempty(session.title, `${id}.title`);
    nonempty(session.description, `${id}.description`);
    assert(Array.isArray(session.speakers), `${id}: expected speakers array`);
    assert.equal(
      new Set(session.speakers).size,
      session.speakers.length,
      `${id}: duplicate speaker references`,
    );
    assert.deepEqual(
      [...session.speakers].sort(),
      [...approvedSessions[id]].sort(),
      `${id}: unapproved speaker/session relationship`,
    );
    assert(
      Array.isArray(session.tags) &&
        session.tags.every((tag) => typeof tag === 'string' && tag.trim()),
      `${id}: invalid tags`,
    );
    for (const field of ['language', 'complexity'])
      if (session[field] !== undefined) nonempty(session[field], `${id}.${field}`);
    for (const speakerId of session.speakers) {
      assert(source.speakers[speakerId], `${id}: unknown speaker ${speakerId}`);
      if (id === 'PANEL-01') {
        assert.equal(
          source.speakers[speakerId].sessionRoles?.[id],
          speakerId === 'dmytro-nedvetskyi' ? 'Moderator' : 'Panellist',
          `${speakerId}: missing reciprocal panel role`,
        );
      }
    }
  }
  return {
    speakers: actualSpeakerIds.length,
    sessions: Object.keys(source.sessions).length,
    panelParticipants: source.sessions['PANEL-01'].speakers.length,
    assets: assets.size,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(root, 'public/data/settings.json'), 'utf8'))
        .disabledSchedule,
      true,
      'Programme-only publication requires disabledSchedule=true; schedule release needs an explicit adapter change',
    );
    const source = JSON.parse(
      fs.readFileSync(path.join(root, 'public/data/programme-2026.json'), 'utf8'),
    );
    console.log('Approved programme validated:', JSON.stringify(validateProgramme(source)));
  } catch (error) {
    console.error(`Programme validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
