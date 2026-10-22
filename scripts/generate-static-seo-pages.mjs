import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'public/data/seo-routes.json'), 'utf8'));
const eventSchema = JSON.parse(
  fs.readFileSync(path.join(root, 'public/schema/event.jsonld'), 'utf8'),
);
const faqSchema = JSON.parse(fs.readFileSync(path.join(root, 'public/schema/faq.jsonld'), 'utf8'));

// Generate share metadata and no-JavaScript descriptions from the same approved snapshot.
const programme = JSON.parse(
  fs.readFileSync(path.join(root, 'public/data/programme-2026.json'), 'utf8'),
);
const plainText = (value = '') =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
for (const [id, speaker] of Object.entries(programme.speakers)) {
  routes[`/speakers/${id}`] = {
    title: `${speaker.name} | GDG DevFest Warsaw 2026`,
    description: plainText(
      [speaker.title, speaker.company, speaker.shortBio].filter(Boolean).join(' · '),
    ).slice(0, 200),
    image: speaker.photoUrl,
    fallbackHeading: speaker.name,
    fallbackParagraphs: [
      [speaker.title, speaker.company].filter(Boolean).join(' · '),
      plainText(speaker.bio),
      ...Object.values(programme.sessions)
        .filter((session) => session.speakers.includes(id))
        .map((session) => `Session: ${session.title}`),
    ],
  };
}
for (const [id, session] of Object.entries(programme.sessions)) {
  routes[`/sessions/${id}`] = {
    title: `${session.title} | GDG DevFest Warsaw 2026`,
    description: plainText(session.description).slice(0, 200),
    fallbackHeading: session.title,
    fallbackParagraphs: [
      plainText(session.description),
      `Speakers: ${session.speakers.map((id) => programme.speakers[id].name).join(', ')}`,
      'The timetable is not yet published.',
    ],
  };
}

const escapeAttribute = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const replaceTagContent = (html, selector, value) =>
  html.replace(selector, (tag) =>
    tag.replace(/content="[^"]*"/i, `content="${escapeAttribute(value)}"`),
  );

const setMetadata = (html, route, metadata) => {
  const canonical = `https://warsaw.devfest.pl${route === '/' ? '/' : `${route}/`}`;
  let output = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(metadata.title)}</title>`,
  );

  output = replaceTagContent(
    output,
    /<meta\b[^>]*\bname="description"[^>]*>/i,
    metadata.description,
  );
  output = replaceTagContent(output, /<meta\b[^>]*\bproperty="og:title"[^>]*>/i, metadata.title);
  output = replaceTagContent(
    output,
    /<meta\b[^>]*\bproperty="og:description"[^>]*>/i,
    metadata.description,
  );
  output = replaceTagContent(output, /<meta\b[^>]*\bproperty="og:url"[^>]*>/i, canonical);
  output = replaceTagContent(output, /<meta\b[^>]*\bname="twitter:title"[^>]*>/i, metadata.title);
  output = replaceTagContent(
    output,
    /<meta\b[^>]*\bname="twitter:description"[^>]*>/i,
    metadata.description,
  );
  if (metadata.image) {
    const imageUrl = `https://warsaw.devfest.pl${metadata.image}`;
    output = replaceTagContent(output, /<meta\b[^>]*\bproperty="og:image"[^>]*>/i, imageUrl);
    output = replaceTagContent(output, /<meta\b[^>]*\bname="twitter:image"[^>]*>/i, imageUrl);
  }
  output = output.replace(
    /<link\b[^>]*\brel="canonical"[^>]*>/i,
    `<link href="${canonical}" rel="canonical">`,
  );

  const eventScript = metadata.structuredData
    ? `<script id="structured-data" type="application/ld+json">${JSON.stringify(eventSchema, null, 2)}</script>`
    : '';
  const faqScript =
    metadata.structuredData === 'faq'
      ? `<script id="faq-structured-data" type="application/ld+json">${JSON.stringify(faqSchema, null, 2)}</script>`
      : '';
  output = output.replace(
    /<script id="structured-data" type="application\/ld\+json">[\s\S]*?<\/script>/i,
    eventScript,
  );
  if (faqScript) {
    output = output.replace(/<\/head>/i, `${faqScript}</head>`);
  }

  if (route !== '/') {
    const paragraphs = metadata.fallbackParagraphs
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join('');
    const fallback = `<noscript><main id="main-content"><h1>${escapeHtml(metadata.fallbackHeading)}</h1>${paragraphs}<nav aria-label="DevFest Warsaw pages"><a href="/">Home</a> <a href="/schedule">Schedule</a> <a href="/speakers">Speakers</a> <a href="/faq">FAQ</a> <a href="/team">Team</a> <a href="/privacy">Privacy and data</a> <a href="/coc">Code of Conduct</a></nav></main></noscript>`;
    output = output.replace(/<noscript>[\s\S]*?<\/noscript>/i, fallback);
  }

  return output;
};

for (const [route, metadata] of Object.entries(routes)) {
  if (route === '/') continue;
  const routeDir = path.join(distDir, route.slice(1));
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), setMetadata(template, route, metadata));
}

console.log(
  `Generated static SEO pages: ${Object.keys(routes)
    .filter((route) => route !== '/')
    .join(', ')}`,
);
