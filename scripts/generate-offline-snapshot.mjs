import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const agenda = JSON.parse(readFileSync('public/data/agenda-2026.json', 'utf8'));
const programme = JSON.parse(readFileSync('public/data/programme-2026.json', 'utf8'));
const escape = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const spaces = { auditorium: 'Auditorium', classroom: 'Classroom', both: 'All spaces' };
const rows = [...agenda.items]
  .sort((a, b) => a.start.localeCompare(b.start) || a.space.localeCompare(b.space))
  .map((item) => {
    const session = programme.sessions[item.id];
    if (!session && !item.title) throw new Error(`Offline agenda has no title for ${item.id}`);
    if (!spaces[item.space]) throw new Error(`Unknown offline agenda space ${item.space}`);
    const names = (session?.speakers ?? []).map((id) => {
      const speaker = programme.speakers[id];
      if (!speaker) throw new Error(`Unknown offline speaker ${id}`);
      return speaker.name;
    });
    const time = item.end ? `${item.start}–${item.end}` : item.start;
    return `<li><div class="time">${escape(time)} · ${escape(spaces[item.space])}</div><strong>${escape(item.title ?? session.title)}</strong>${names.length ? `<div>${escape(names.join(', '))}</div>` : ''}</li>`;
  })
  .join('\n');
const speakers = Object.values(programme.speakers)
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((speaker) => {
    const role = [speaker.title, speaker.company].filter(Boolean).join(' · ');
    return `<li><strong>${escape(speaker.name)}</strong>${role ? `<div class="time">${escape(role)}</div>` : ''}${speaker.shortBio ? `<div>${escape(speaker.shortBio)}</div>` : ''}</li>`;
  })
  .join('\n');
const snapshot = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#080f1a"><title>Saved programme | DevFest Warsaw 2026</title>
<style>body{margin:0;background:#080f1a;color:#e6eefc;font:16px/1.55 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:24px}h1{font-size:clamp(28px,6vw,42px);line-height:1.1}h2{margin-top:2em}.notice{border:1px solid #fbbc04;border-radius:8px;padding:16px;color:#fff}a{color:#9bc1ff}ul{list-style:none;padding:0}li{border-top:1px solid #31445f;padding:14px 0}.time{color:#a8b9d1;font-size:.9rem}strong{display:block}button{font:inherit}</style></head>
<body><main><h1>DevFest Warsaw 2026</h1><div class="notice" role="status"><strong>You’re offline — this is a saved programme.</strong> Times and details may have changed since this copy was saved. Reconnect to check the latest schedule. Ticket registration, availability and Cloud credits require a connection.</div><p><strong>Saturday, 21 November 2026 · Warsaw time</strong> Google for Startups Campus Warsaw, Plac Konesera 10, 03-736 Warszawa.</p><p><a href="/">Try the online website again</a> · <a href="#saved-agenda">Agenda</a> · <a href="#saved-speakers">Speakers</a></p><h2 id="saved-agenda">Saved agenda</h2><ul>${rows}</ul><p>Times are shown in Europe/Warsaw. Reconnect for updates and full session details.</p><h2 id="saved-speakers">Saved speakers</h2><ul>${speakers}</ul></main></body></html>\n`;
const version = createHash('sha256').update(snapshot).digest('hex').slice(0, 16);
const worker = readFileSync('public/service-worker.js', 'utf8').replace(
  '__OFFLINE_SNAPSHOT_VERSION__',
  version,
);
if (!worker.includes(version)) throw new Error('Offline worker version placeholder missing');
writeFileSync('dist/offline.html', snapshot);
writeFileSync('dist/service-worker.js', worker);
console.log(`Generated offline agenda snapshot (${agenda.items.length} entries, ${version}).`);
