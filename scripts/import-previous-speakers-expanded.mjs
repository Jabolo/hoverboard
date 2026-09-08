/* global process */

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const targetProject = 'gdg-warsaw-devfest26-web';
const collection = 'previousSpeakers';
const repoRoot = process.env.REPO_ROOT || process.cwd();
const writeMode = process.argv.includes('--write');

const firestoreUrl = (path) =>
  `https://firestore.googleapis.com/v1/projects/${targetProject}/databases/(default)/documents/${path}`;
const firestoreCommitUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${targetProject}/databases/(default)/documents:commit`;

const sourceUrls = {
  2019: 'https://sessionize.com/api/v2/q2ebpsct/view/Speakers?under=True',
  2023: 'https://sessionize.com/app/organizer/event/12810',
  2024: 'https://sessionize.com/app/organizer/event/16520',
  2025: 'https://sites.google.com/view/devfest2025/schedule?authuser=0',
};

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  return body;
}

async function fetchJson(url, options = {}) {
  const body = await fetchText(url, options);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Non-JSON response from ${url}`);
  }
}

const decodeValue = (value) => {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, field]) => [key, decodeValue(field)]),
    );
  }
  return undefined;
};

const encodeValue = (value) => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, encodeValue(item)]),
        ),
      },
    };
  }
  return { nullValue: null };
};

const readDocument = (document) => ({
  id: document.name.split('/').pop(),
  ...Object.fromEntries(
    Object.entries(document.fields || {}).map(([key, value]) => [key, decodeValue(value)]),
  ),
});

const normalize = (value) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();

const aliases = new Map(
  [
    ['Jakub Kolakowski', 'Jakub Kołakowski'],
    ['Marcin Moskala', 'Marcin Moskała'],
    ['Michal Tajchert', 'Michał Tajchert'],
    ['Piotr Trebacz', 'Piotr Trębacz'],
    ['Tomek Porożyński', 'Tomasz Porożyński'],
    ['Tomasz Porozynski', 'Tomasz Porożyński'],
    ['Vladyslav Kampov', 'Vlad Kampov'],
  ].map(([from, to]) => [normalize(from), to]),
);

const canonicalName = (name) => aliases.get(normalize(name)) || name.trim();

const idForName = (name) => {
  const parts = canonicalName(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Łł]/g, (character) => (character === 'Ł' ? 'L' : 'l'))
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/);
  return parts.length > 1 ? `${parts[0]}__${parts.slice(1).join('_')}` : parts[0];
};

const localAsset = (fileName) => {
  if (!fileName) return undefined;
  const normalized = fileName.replace(/^\/+/, '');
  const assetPath = join(repoRoot, 'public', 'images', normalized);
  if (!existsSync(assetPath) || !statSync(assetPath).isFile()) return undefined;
  return `/images/${normalized}`;
};

const assetSlug = (name) =>
  canonicalName(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Łł]/g, (character) => (character === 'Ł' ? 'L' : 'l'))
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const localPhotoFor = (name, sourceUrl) => {
  const slug = assetSlug(name);
  const extension =
    (sourceUrl || '').match(/\.(jpe?g|png|webp)(?:[?#]|$)/i)?.[1]?.toLowerCase() || 'jpg';
  return (
    localAsset(`previous-speakers/people/${slug}.${extension}`) ||
    localAsset(`previous-speakers/people/${slug}.jpg`) ||
    localAsset(`previous-speakers/people/${slug}.jpeg`) ||
    localAsset(`previous-speakers/people/${slug}.png`) ||
    localAsset(`previous-speakers/people/${slug}.webp`)
  );
};

const socialsFromLinks = (links = []) => {
  const seen = new Set();
  return links
    .map(({ link, name }) => {
      const lower = link.toLowerCase();
      const icon = lower.includes('linkedin.com')
        ? 'linkedin'
        : lower.includes('twitter.com') || lower.includes('x.com')
          ? 'twitter'
          : lower.includes('github.com')
            ? 'github'
            : lower.includes('youtube.com') || lower.includes('youtu.be')
              ? 'youtube'
              : lower.includes('instagram.com')
                ? 'instagram'
                : 'website';
      const label =
        icon === 'linkedin'
          ? 'LinkedIn'
          : icon === 'twitter'
            ? 'Twitter'
            : icon === 'github'
              ? 'GitHub'
              : icon === 'youtube'
                ? 'YouTube'
                : icon === 'instagram'
                  ? 'Instagram'
                  : name || 'Website';
      return { icon, link, name: label };
    })
    .filter((social) => {
      if (seen.has(social.link) || social.link.includes('sessionize.com/')) return false;
      seen.add(social.link);
      return true;
    });
};

const splitTagline = (tagline = '') => {
  const match = tagline.match(/^(.*?)(?:\s+at\s+|\s+@\s+|\s+\|\s+)(.+)$/i);
  return match
    ? { title: match[1].trim(), company: match[2].trim() }
    : { title: tagline.trim(), company: '' };
};

const profile = ({ name, tagline, bio, imageUrl, sessions, socials = [], sourceUrl, year }) => ({
  name: canonicalName(name),
  ...splitTagline(tagline),
  bio:
    bio?.trim() ||
    `${tagline?.trim() || 'Technology community speaker'}; presented “${sessions[0] || 'a session'}” at Warsaw DevFest ${year}.`,
  imageUrl: imageUrl || '',
  sessions: sessions
    .map((title) => ({ title: title.trim(), tags: [] }))
    .filter((session) => session.title),
  socials: socialsFromLinks(socials),
  sourceUrl,
  year: String(year),
});

const fetch2019Profiles = async () => {
  const html = await fetchText(sourceUrls[2019]);
  const document = new JSDOM(html).window.document;
  return Array.from(document.querySelectorAll('.sz-speaker'))
    .map((speaker) => ({
      name: speaker.querySelector('.sz-speaker__name')?.textContent.trim() || '',
      tagline: speaker.querySelector('.sz-speaker__tagline')?.textContent.trim() || '',
      bio: speaker.querySelector('.sz-speaker__bio')?.textContent.trim() || '',
      imageUrl:
        speaker
          .querySelector('.sz-speaker__photo img:not([style*="display: none"])')
          ?.getAttribute('src') || '',
      sessions: Array.from(speaker.querySelectorAll('.sz-speaker__sessions a')).map((link) =>
        link.textContent.trim(),
      ),
      socials: Array.from(speaker.querySelectorAll('.sz-speaker__links a')).map((link) => ({
        link: link.getAttribute('href') || '',
        name: link.getAttribute('title') || link.textContent.trim(),
      })),
    }))
    .filter((speaker) => speaker.name && speaker.name !== 'Anonymized By Request')
    .map((speaker) => profile({ ...speaker, year: 2019, sourceUrl: sourceUrls[2019] }));
};

const devFest2023 = [
  [
    'Akanksha Singh',
    'Flutter Dev | SWE at JP Morgan Chase & Co.',
    'https://cdn.sessionize.com/image/f971-200o200o2-sZ8qevh2buTGRUqZDEDr7v.jpeg',
    ["The Hitchhiker's Guide to Developing Accessible Apps"],
  ],
  [
    'Alicja Ogonowska',
    'Flutter Developer at EQUIQO',
    'https://cdn.sessionize.com/image/4db4-200o200o2-wFexMLi5bbBzxqKzGXgQQ3.jpg',
    ['Let’s Build a Flutter App, Fast!'],
  ],
  [
    'Anna Migas',
    'Lead UI Developer',
    'https://cdn.sessionize.com/image/88fa-200o200o2-ni4UGc3pwVqxGgcXUJC3rs.jpg',
    ['Demystifying web performance tooling'],
  ],
  [
    'Azim Pulat',
    'Software Engineer @ Google',
    'https://cdn.sessionize.com/image/3c8e-200o200o2-7XhoN7zkrxLW1kTziNhTBo.jpeg',
    ['Building Reverse Proxy'],
  ],
  [
    'Dastin Sandura',
    'DDD-GDA co-organizer',
    'https://cdn.sessionize.com/image/7235-200o200o2-K6wCtL6otKrBydxQBAYCxu.jpg',
    [
      '11:00 Discussion groups in Lean Coffee style',
      '13.00 Discussion groups - Gen AI Tools & Strangler Pattern',
      '14:00 Meta Discussion about Lean Coffee style',
    ],
  ],
  [
    'Dilraj Singh',
    'Infosys Consulting / Principal CIO Advisory / Cloud Architect',
    'https://cdn.sessionize.com/image/5431-200o200o2-ErYYHdbdD7oYM66Wez6JMx.png',
    ['Kubernetes on Cloud and best practice'],
  ],
  [
    'Dominik Roszkowski',
    'Google Developer Expert in Flutter',
    'https://cdn.sessionize.com/image/2615-200o200o2-VHDtKbD3b8L3R7aA5ZyDET.jpeg',
    ['From Network Failures to Offline Success: A Journey of Visible App'],
  ],
  [
    'Dominika Zając',
    'GDE for Web | Software Engineer at Qualtrics',
    'https://cdn.sessionize.com/image/d2ff-200o200o2-M4QXq3gLG5gQBbe1HyTvLR.png',
    ['There is an IMPOSTOR among us'],
  ],
  [
    'Himanshu Singh',
    'Android @NordVPN',
    'https://cdn.sessionize.com/image/417d-200o200o2-VVo5jsYfYGtVhsxNDJMShw.png',
    ["Elevating Your App's Performance"],
  ],
  [
    'Irine Kokilashvili',
    'Systems Engineer | EPAM Systems',
    'https://cdn.sessionize.com/image/0a5a-200o200o2-BDrbUmF3DkxCbRKBdWEi2P.png',
    ['Sustainability for workloads in Google Cloud'],
  ],
  [
    'Marcin Moskala',
    'Developer during the day, author at night, trainer at Kt. Academy',
    'https://cdn.sessionize.com/image/c34a-200o200o2-3FjkVzve3a6N6W5Qdawkwk.jpg',
    ['Effective Coroutines'],
  ],
  [
    'Mateusz Łędzewicz',
    'Principal Angular Consultant and Trainer in Lowgular',
    '',
    ['To module or not to module, that is the question!'],
  ],
  [
    'Mateusz Stefańczyk',
    'Senior Angular Developer at House of Angular',
    'https://cdn.sessionize.com/image/dce6-200o200o2-nnSeKrCfbUQ5DAbNc5BFaH.jpg',
    ["Angular 17's Revolutionary Control Flow: Introducing @-Syntax and Deferrable Views"],
  ],
  [
    'Piotr Prus',
    'Android developer',
    'https://cdn.sessionize.com/image/d3b5-200o200o2-ainA1gVSSCHxugeFJdVjM2.jpg',
    [
      'Spin-to-Win Experience with Jetpack Compose',
      'Blast Off: Managing Hundreds of UI Updates for Emoji Cannons',
    ],
  ],
  [
    'Piotr Suwała',
    'Senior Architect @ Kinguin - Carl Jung Enjoyer',
    'https://cdn.sessionize.com/image/37c7-200o200o2-VL5Jrp8WksAKyaGuuxrq6A.jpg',
    [
      '11:00 Discussion groups in Lean Coffee style',
      '13.00 Discussion groups - Gen AI Tools & Strangler Pattern',
      '14:00 Meta Discussion about Lean Coffee style',
    ],
  ],
  [
    'Rodolfo Dias',
    'Google Developer Expert for Web Technologies • Software Engineering Manager, Yara International',
    'https://cdn.sessionize.com/image/a662-200o200o2-whmSdeL7iud1cCCHrxDtZg.jpg',
    ['Beyond Instant Noodles: The challenges of Team Leadership'],
  ],
  [
    'Tamta Kapanadze',
    'Software Engineer',
    'https://cdn.sessionize.com/image/89cb-200o200o2-wvkzPEnZiyNanzMTX1VRrL.jpg',
    ['Real-time messaging 101'],
  ],
  [
    'Tomasz Flis',
    'Senior Frontend Developer - Deskbird',
    'https://cdn.sessionize.com/image/9c44-200o200o2-S14zNaTcpfbUjV3tTt8V9x.jpg',
    ['Angular renaissance'],
  ],
  [
    'Tomek Porożyński',
    'Cloud System Architect, Atos',
    'https://cdn.sessionize.com/image/a4e3-200o200o2-16-a0fb-4226-b7ee-2f49eabe37c8.dd5d6524-0bfe-43ce-982a-3150773998d0.jpg',
    ['Teaching PaLM 2 new tricks - a Live Coding Spectacle!'],
  ],
  [
    'Vladyslav Kampov',
    'Senior UI Engineer at Netflix, Host of Podcast GePeTe',
    'https://cdn.sessionize.com/image/fd36-200o200o2-GkJ2MSWHCk7h79dv2t3v1n.png',
    ['Do you really need your test environment?'],
  ],
].map(([name, tagline, imageUrl, sessions]) =>
  profile({ name, tagline, imageUrl, sessions, year: 2023, sourceUrl: sourceUrls[2023] }),
);

const devFest2024 = [
  [
    'Alicja Ogonowska',
    'Senior Mobile Engineer at OLX Group',
    'https://cdn.sessionize.com/image/4db4-200o200o2-wFexMLi5bbBzxqKzGXgQQ3.jpg',
    ['No Backend? No Problem! Enhance your mobile apps with Firebase Extensions'],
  ],
  [
    'Azim Pulat',
    'SWE @ Google',
    'https://cdn.sessionize.com/image/28ff-200o200o2-9kJH8t2fYwuJSXPzASFB6n.jpeg',
    ['Building Real-time Apps with Go'],
  ],
  [
    'Dariusz Kalbarczyk',
    'Google Developer Expert, Author, Co-founder of Ng Poland & JS Poland',
    'https://cdn.sessionize.com/image/7dfc-200o200o2-fMojTpVhm37jj3uRsXk4HM.png',
    [
      'The Power of Personal Branding in Software Development - The Angular Path by Dariusz Kalbarczyk',
    ],
  ],
  [
    'Ewelina Skowron',
    'Android Developer',
    'https://cdn.sessionize.com/image/d170-200o200o2-HwZ7yUT8Bd8vmL87SqMzTx.jpg',
    ['AI, Technology... and Psychology: A New Era for Mental Health?'],
  ],
  [
    'Jakub Kolakowski',
    'GDG Warszawa',
    'https://cdn.sessionize.com/image/8ddb-200o200o2-f96f13cc-9541-4dd7-8270-488ee8eab7a3.jpg',
    [
      'Websites creation 101 with Google Firebase Hosting, Material Design and Bootstrap [Workshop]',
    ],
  ],
  [
    'Marcin Samsonowski',
    'Architect | Engineer | Trainer | Speaker | Academic Teacher',
    'https://cdn.sessionize.com/image/119b-200o200o2-wV18oFZdz69MqGno3ggWqq.png',
    ['Design As A Code'],
  ],
  [
    'Mateusz Wojtczak',
    'Head of Mobile @ LeanCode',
    'https://cdn.sessionize.com/image/d240-200o200o2-K4csuFiNt6o1wxW3LkeKDa.jpg',
    ['Demystifying App Architecture: From Startups to Banks'],
  ],
  [
    'Piotr Prus',
    'Android developer',
    'https://cdn.sessionize.com/image/d3b5-200o200o2-ainA1gVSSCHxugeFJdVjM2.jpg',
    ['Bringing Your Canvas Creations to Life with Jetpack Compose'],
  ],
  [
    'Tomasz Flis',
    'Senior Frontend Developer',
    'https://cdn.sessionize.com/image/9c44-200o200o2-S14zNaTcpfbUjV3tTt8V9x.jpg',
    ['Angular 19 - what’s new'],
  ],
  [
    'Tomek Porożyński',
    'Cloud Architect, PwC',
    'https://cdn.sessionize.com/image/a4e3-200o200o2-16-a0fb-4226-b7ee-2f49eabe37c8.dd5d6524-0bfe-43ce-982a-3150773998d0.jpg',
    ['Can You Outsmart an AI? Adventures in Prompt Hacking'],
  ],
  [
    'Vasudev Maduri',
    'Staff Data Engineer at Admiral Group | GDE on Cloud',
    'https://cdn.sessionize.com/image/16bd-200o200o2-fp7vngBuiV77jGTTPQEpuT.png',
    [
      "Securing AI Apps:A deep dive into Google's Secure AI Framework for Safe and Responsible AI Practices",
    ],
  ],
  [
    'Volodymyr Babenko',
    'Talent Acquisition specialist',
    'https://cdn.sessionize.com/image/c482-200o200o2-42rYtmS7yWpBU4MNSCGmRm.jpg',
    ['Non-technical Skills that Elevate an Engineer to Senior Level'],
  ],
  [
    'Yoyu Li',
    'Igniting Creativity with Technology',
    'https://cdn.sessionize.com/image/21bf-200o200o2-TbTE3pLpPy7QH8G2YiZzoj.jpg',
    ['The State of Applying Generative AI in Games'],
  ],
].map(([name, tagline, imageUrl, sessions]) =>
  profile({ name, tagline, imageUrl, sessions, year: 2024, sourceUrl: sourceUrls[2024] }),
);

const devFest2025 = [
  [
    'Artem Trush',
    'Backend Lead at Liven by SKELAR',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQW8uX7K-rep1iTBcYB_zPnj46O-IN506yoblJVUSftM7mCs5sSivNkp3Y8gFAi8pDvLiX0or047chgfMgqFnp_MMgo9RhbRZC4d8kvLvhFOzmdWNGCZ49gEAdts8NlByBrH2LWlGj3OzAygupri9bm2-YJoIVV7Ew3uZJyK-iipbkpX4cQ3DSEPB3RaYFNrNIg8aZ7PHKUp_PyKVzUACsuaXr9t0qdXiLEHv3Wb_TA=w1280',
    'Mindset refactoring: the engineer’s guide to effective leadership',
  ],
  [
    'Piotr Prus',
    'GDE Android Developer @ Tilt',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQV0sBD5fMiuA0H286BlQ60PtQIxy76cyQJntQ9hINMLa2Igy-SxD9-yMXeBcGzzGVjQ_HCkY7hxCAKFVkVXpQnCDEoIbRW4jAoRqmWy6tG1NjNlJzqSgMzRdm6QC9vI9aFyIQYvrpCbyCtQf5VtxBP58ak7E7aZe1rHj3Hx9QsKgNbE-lP39RH8_BjdxwS51EjO-fMbrcFt1dARY1AnR1ptxAOB72eWC0deXXPwxz4=w1280',
    'Beyond Basics: Fluid Image Transitions & Gesture Sync in Compose',
  ],
  [
    'Jakub Kołakowski',
    'Technology consultant | GDG Warsaw organizer',
    '',
    'From Manual to Magical: #Obsidian with a [[Human]] Touch and **AI** Flair',
  ],
  [
    'Piotr Trębacz',
    'Cloud Native DevOps practitioner | GDG Warsaw member',
    '',
    'From Manual to Magical: #Obsidian with a [[Human]] Touch and **AI** Flair',
  ],
  [
    'Tomasz Porożyński',
    'AI & Cloud Architect | Google Developer Expert',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQWkqEMfpJviXlG-5Q76-gnUO1GxcS3wqUekKvBYzDQY-6O_lffhdITDPcJmi1f3AUgx_LYGMFtz0BJSJKYJcW_aBFqGGtxXfpZu-YnswpcgYS5HFz4LKWfHRorPxj_Dy_ve293syYMSddL7kLtf7Za6mXpiT28Ib5ki2p_AMRICSdAgJNG0qalb4DUnUcaX-J0ixjExmyQ7yJ5ARoU5aiPkiwrrgywlYMWG41SIZn4=w1280',
    'Turning Text into Multi-Voice Audiobooks with Gemini',
  ],
  [
    'Kamil Borzym',
    'Principal Software Engineer at Allegro',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQW5amncXl59EmENyuFgKOPjjjf2S9U4Kbpd7xEsUouHBu2aNSbRcyvevPxndDTnAXYoVvFHUXXBfz7JWRZBB-bbP2uq6kYUq-k0UVn8w7JrC-nEroUiBMh3VEhvFmTSCa-NxwTSaWjAc8RIR-DDvo5BF0RPQWVLLIV53S7V8X7xinoiQ8Hg7uVIToX4aE77dy8VfwBJImvIReeqxCx2YlsxP4TzO-0qr1-8vjMp3lI=w1280',
    'Eavesdrop Like a Pro: The Untold Techniques for Eavesdropping on Mobile Apps',
  ],
  [
    'Talia Asghar',
    'Google Developer Expert | Software Engineer at Delivery Hero',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQXST65tcuNPGZEuZm-HWtxtJJGkbl2c89cG69QMDcFU5-NQpEH6aCArPW_BH8i6y-iKiogjN7L-Mi8r-oLSY1F5eWd1wmjxXFyPHFvr7JImxy6r-31vftCRbFigqCEvu9d7RJqevOBF2e2kf7u3_voWH3CfdZBORwp5PxTs7UAHC8AOVia7Gt4QN-hHCz2JVPK7UnWIAg6zdWpPrU-fsRLaMKtUwcM-dHo7qrYGJU0=w1280',
    'Debug Like a Pro: Unlocking Hidden Power in the Latest Chrome DevTools',
  ],
  [
    'Vlad Kampov',
    'Staff Software Engineer at Netflix',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQVC68Rje7uea3u-RKVh1-DMPdtCnv1GhfoumY3aFstx0Ypyo8LDqgcuThwvIMG1iKDiB6ah-P30JA_7EI4vlB0imCVSw_8UmB5W8jr_NCLcDg5qAC8I5vpLQn8Io-Ccw3qPULllO_2ihabWAobFHmWysAO9E1uVTpa0wy6eQuH6oN2HXFISMnuw5lV4B3ZgZ0pS2yf2RxsCRaENG2T8RFpuyQVoGci10k5VTJ6rd6c=w1280',
    'Product Engineering in the AI Era: Beyond Code Quality',
  ],
  [
    'Dominik Roszkowski',
    'Flutter Google Developer Expert',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQWS32GdWdH5YfMOcOGon6eFpx7Nw2HbbAFpFlneYa5xMI3tplKVGkndxDhR7eoQgC7doPpTMmKBWMINXNMJ8N2dKSKfpdc5Yb7uoxxyx4H1kAkztz81JUcjP7u5j1jLuubQhXVCpA5ChZ8r-I2frscC37KKX8A9Fn6EjvAD-_DoIVuG8eoxdXRq0A5Pnc5unl7S1bma31jax4yWkoOLftCo5ET3zN6SakJsNbfBeJk=w1280',
    'Native interop with Kotlin and Swift in Flutter',
  ],
  [
    'Volodymyr Babenko',
    'Senior Talent Acquisition Specialist at PeopleForce',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQXCewsa2005SdIk1RqJV1y_qpmaSo2Fwhhs-8ulpthwhjfLvvW1wuibSP-YGp0LcuuArbAQqnCx1ciIszsFkW_5SjyLFEfC9UGWb22fBA2sWpYoW-Tg0_LBmS2yJ6-HU7yW2BYmXMpDZCut1YekOxuNPL9yfWBgN9svFKLt4Q4UxdWwtFSdSwdiwsayDDQf2viNGqEJ3Js7I_TaHV1egWUgjHaWeg4XMyUB-76wyeU=w1280',
    'CV ROI: how to stand out and survive in the era of AI, ATS & machines.',
  ],
  [
    'Yaroslav Polyakov',
    'AI/ML Infra Engineering Manager II at Google',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQVEL5K4WsD4tS2LVAqIcpJk1drIedumJgsjcBmpz8wBx5LsWANShYrw2pCxht-60BoSLixp2cTdh3tCU3La5GMPJdfwogfisBz16lRHmFfaj7bkYSA8esFaDR_u-QJ9Ot_hC0XVDOWYU0mNj7Aru0-Efr9VRSnrymwW7pQx1BJzU9K2f3xSknBJ0L2kDswu0IUq90Q3opUwFj4pToj5X3lHuDE3_JsoEiLL5hawsBI=w1280',
    "Why AI Tools Alone Won't Transform Your Organization",
  ],
  [
    'Filip Zymek',
    'Senior Software Engineer at intent | Ex-Amazon',
    '',
    'A Gentle Introduction to IoT and Mobile',
  ],
  [
    'Niels Leenheer',
    'Co-Founder / CTO of Salonhub',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQXUU6e1m4d1FDZXHGdWrY0xQeb2cWR1fPYJFE-Au95oDDnjF5ZK0vxM5lO9_aEeUpTiaKa0XEKnDhUhlpTvALu0JwdvoQ0LL7Xv3OVoJ1P0Kr3MSj9OcBSPlk8WDUd8_d_gxJzcFrI735wXOp1crEuusuztFdWY4O83gngVYdDt05UojtUx7UDe_7b8EdlyQqvwpFmJtQA5weqFzb_U4CC8CbraBYCIN25EkJFqgcY=w1280',
    'Making money with Project Fugu',
  ],
  [
    'Kateryna Hrytsaienko',
    'Senior Java Developer at Valtech',
    'https://lh3.googleusercontent.com/sitesv/AG8ngQXQM3xKNepziL2xWs4OD8H7w8Xvw5dclVjL3GfFJkW9gNuGZnEv5rO8Wrp-_D08M3kTge7uazsHDU_rN69iX3LWqPmn-57cuS7bnRp3pbDXRp9M6T5ZCVcJljiqhVb4WkcE5ul66XdKQA3_VDPN5mlZixtYOpJDvzVCClFnX5vUmt3vPyr99Gl-yGM8953xf4pLu_8_j_2CoUBfig0Vxx_veV9TAh6zzzrIZb-yIHs=w1280',
    'Hosting AI models with Ray and GKE: why, how and what for?',
  ],
].map(([name, tagline, imageUrl, session]) =>
  profile({
    name,
    tagline,
    imageUrl,
    sessions: [session],
    year: 2025,
    sourceUrl: sourceUrls[2025],
  }),
);

const sourceRecords = [
  ...(await fetch2019Profiles()),
  ...devFest2023,
  ...devFest2024,
  ...devFest2025,
];

const targetBefore = await fetchJson(firestoreUrl(`${collection}?pageSize=100`));
const existing = new Map();
const existingDocumentById = new Map();
const obsoleteDocuments = [];
for (const document of targetBefore.documents || []) {
  const record = readDocument(document);
  const canonicalId = idForName(record.name || document.name.split('/').pop());
  const actualId = document.name.split('/').pop();
  if (actualId === canonicalId) existingDocumentById.set(canonicalId, document);
  if (actualId !== canonicalId) obsoleteDocuments.push(document);
  const previous = existing.get(canonicalId);
  if (!previous) {
    existing.set(canonicalId, { ...record, id: canonicalId });
    continue;
  }
  existing.set(canonicalId, {
    ...previous,
    bio: previous.bio || record.bio || '',
    title: previous.title || record.title || '',
    company: previous.company || record.company || '',
    companyLogo: previous.companyLogo || record.companyLogo,
    country: previous.country || record.country || 'Poland',
    photoUrl: previous.photoUrl || record.photoUrl || '',
    socials: previous.socials?.length ? previous.socials : record.socials || [],
    sessions: { ...(previous.sessions || {}), ...(record.sessions || {}) },
  });
}

const byId = new Map();
for (const record of sourceRecords) {
  const canonical = canonicalName(record.name);
  const id = idForName(canonical);
  const current = byId.get(id) || {
    id,
    name: canonical,
    bio: '',
    title: '',
    company: '',
    country: 'Poland',
    photoUrl: '',
    socials: [],
    sessions: {},
    photoSources: [],
    sourceYears: [],
  };
  const currentSource = current.sourceYears.at(-1) || 0;
  if (record.bio && (!current.bio || Number(record.year) >= currentSource))
    current.bio = record.bio;
  if (record.title && (!current.title || Number(record.year) >= currentSource))
    current.title = record.title;
  if (record.company && (!current.company || Number(record.year) >= currentSource))
    current.company = record.company;
  if (record.imageUrl) {
    current.photoSources.push({ year: record.year, url: record.imageUrl });
    const localPhoto = localPhotoFor(canonical, record.imageUrl);
    if (localPhoto || !current.photoUrl) current.photoUrl = localPhoto || record.imageUrl;
  }
  if (!current.photoUrl)
    current.photoUrl = localAsset(`previous-speakers/people/${assetSlug(canonical)}.jpg`) || '';
  if (record.socials.length && (!current.socials.length || Number(record.year) >= currentSource))
    current.socials = record.socials;
  current.sessions[record.year] = [...(current.sessions[record.year] || []), ...record.sessions];
  current.sourceYears.push(Number(record.year));
  byId.set(id, current);
}

for (const [id, previous] of existing) {
  if (byId.has(id)) continue;
  byId.set(id, {
    id,
    name: previous.name || id.replace(/__/g, ' '),
    bio: previous.bio || '',
    title: previous.title || '',
    company: previous.company || '',
    companyLogo: previous.companyLogo,
    country: previous.country || 'Poland',
    photoUrl: previous.photoUrl || '',
    socials: previous.socials || [],
    sessions: previous.sessions || {},
    photoSources: [],
    sourceYears: Object.keys(previous.sessions || {}).map(Number),
  });
}

for (const [id, current] of byId) {
  const previous = existing.get(id);
  if (previous) {
    current.bio = current.bio || previous.bio || `Previous Warsaw DevFest speaker.`;
    current.title = current.title || previous.title || 'Previous DevFest speaker';
    current.company = current.company || previous.company || '';
    current.country = previous.country || current.country;
    current.companyLogo = previous.companyLogo || current.companyLogo;
    const existingLocalPhoto =
      previous.photoUrl?.startsWith('/images/') && previous.photoUrl !== '/images/not-found.svg';
    current.photoUrl = existingLocalPhoto
      ? previous.photoUrl
      : current.photoUrl || previous.photoUrl || '/images/not-found.svg';
    current.socials = current.socials.length ? current.socials : previous.socials || [];
    current.sessions = { ...previous.sessions, ...current.sessions };
  } else {
    current.bio = current.bio || `Previous Warsaw DevFest speaker.`;
    current.title = current.title || 'Previous DevFest speaker';
    current.photoUrl = current.photoUrl || '/images/not-found.svg';
  }
  for (const year of Object.keys(current.sessions)) {
    const deduped = new Map();
    for (const session of current.sessions[year] || [])
      deduped.set(session.title, { title: session.title, tags: session.tags || [] });
    current.sessions[year] = Array.from(deduped.values());
  }
  current.sourceYears = Array.from(new Set(current.sourceYears)).sort((a, b) => a - b);
  current.photoSources = Array.from(
    new Map(
      current.photoSources.map((source) => [`${source.year}:${source.url}`, source]),
    ).values(),
  );
}

const plans = Array.from(byId.values())
  .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
  .map((speaker, index) => {
    if (speaker.photoUrl.startsWith('http')) speaker.photoUrl = '/images/not-found.svg';
    const publicFields = {
      id: speaker.id,
      name: speaker.name,
      title: speaker.title,
      company: speaker.company,
      ...(speaker.companyLogo ? { companyLogo: speaker.companyLogo } : {}),
      country: speaker.country,
      bio: speaker.bio,
      photoUrl: speaker.photoUrl,
      order: index,
      socials: speaker.socials,
      sessions: speaker.sessions,
    };
    return {
      ...speaker,
      publicFields,
      update: {
        name: `projects/${targetProject}/databases/(default)/documents/${collection}/${speaker.id}`,
        fields: Object.fromEntries(
          Object.entries(publicFields).map(([key, value]) => [key, encodeValue(value)]),
        ),
      },
    };
  });

const sourceCounts = Object.fromEntries(
  [2019, 2023, 2024, 2025].map((year) => [
    year,
    sourceRecords.filter((record) => record.year === String(year)).length,
  ]),
);
const manifest = {
  mode: writeMode ? 'write' : 'dry-run',
  sources: sourceUrls,
  target: { project: targetProject, collection, documentsBefore: existing.size },
  sourceProfiles: sourceCounts,
  totals: {
    plannedDocuments: plans.length,
    linkedSessions: plans.reduce(
      (total, plan) =>
        total +
        Object.values(plan.publicFields.sessions).reduce(
          (count, sessions) => count + sessions.length,
          0,
        ),
      0,
    ),
    placeholderPhotos: plans.filter(
      (plan) => plan.publicFields.photoUrl === '/images/not-found.svg',
    ).length,
    sourcePhotoCount: plans.reduce((count, plan) => count + plan.photoSources.length, 0),
    documentsToCreate: plans.filter((plan) => !existingDocumentById.has(plan.id)).length,
    documentsToUpdate: plans.filter((plan) => existingDocumentById.has(plan.id)).length,
    obsoleteDocumentIds: obsoleteDocuments.map((document) => document.name.split('/').pop()),
  },
  speakers: plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    years: plan.sourceYears,
    sessions: Object.fromEntries(
      Object.entries(plan.publicFields.sessions).map(([year, sessions]) => [year, sessions.length]),
    ),
    photoUrl: plan.publicFields.photoUrl,
    photoSources: plan.photoSources,
  })),
};

if (!writeMode) {
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(0);
}

const accessToken = execFileSync('gcloud', ['auth', 'print-access-token'], {
  encoding: 'utf8',
}).trim();
const commit = await fetchJson(firestoreCommitUrl(), {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    writes: [
      ...plans.map((plan) => ({
        update: plan.update,
        currentDocument: existingDocumentById.has(plan.id)
          ? { updateTime: existingDocumentById.get(plan.id).updateTime }
          : { exists: false },
      })),
      ...obsoleteDocuments.map((document) => ({
        delete: document.name,
        currentDocument: { updateTime: document.updateTime },
      })),
    ],
  }),
});
const targetAfter = await fetchJson(firestoreUrl(`${collection}?pageSize=100`), {
  headers: { Authorization: `Bearer ${accessToken}` },
});
console.log(
  JSON.stringify(
    {
      ...manifest,
      commitWriteResults: commit.writeResults?.length || 0,
      deletedObsoleteDocuments: obsoleteDocuments.length,
      targetDocumentsAfter: targetAfter.documents?.length || 0,
    },
    null,
    2,
  ),
);
