import { updateMetadata as pwaUpdateMetadata } from 'pwa-helpers/metadata.js';
import { image, title as siteTitle } from './data';

export enum INCLUDE_SITE_TITLE {
  YES,
  NO,
}

interface Image {
  image: string;
  imageAlt: string;
}

interface RouteMetadata {
  title: string;
  description: string;
  structuredData: 'event' | 'faq' | null;
}

const CANONICAL_HOST = 'https://warsaw.devfest.pl';
const EVENT_IMAGE = '/images/backgrounds/home-2026.png';

const ROUTE_METADATA: Record<string, RouteMetadata> = {
  '/': {
    title: 'GDG DevFest Warsaw 2026 | Warsaw developer conference',
    description:
      'Join GDG DevFest Warsaw 2026 on 21 November 2026 at Google for Startups Campus Warsaw for talks, workshops, practical learning, and networking.',
    structuredData: 'event',
  },
  '/schedule': {
    title: 'Schedule | GDG DevFest Warsaw 2026',
    description:
      'Explore the GDG DevFest Warsaw 2026 programme in Warsaw: talks, demos, practical sessions, and hands-on workshops published as they are confirmed.',
    structuredData: 'event',
  },
  '/speakers': {
    title: 'Speakers | GDG DevFest Warsaw 2026',
    description:
      'Meet the speakers and explore the speaker archive for GDG DevFest Warsaw, a community-led technology conference in Warsaw.',
    structuredData: 'event',
  },
  '/team': {
    title: 'Organisers | GDG DevFest Warsaw 2026',
    description:
      'Meet the GDG Warsaw volunteers organising DevFest Warsaw 2026 for the local developer and technology community.',
    structuredData: 'event',
  },
  '/faq': {
    title: 'FAQ | GDG DevFest Warsaw 2026',
    description:
      'Find answers about the date, venue, audience, programme, participation, and Call for Papers for GDG DevFest Warsaw 2026.',
    structuredData: 'faq',
  },
  '/privacy': {
    title: 'Privacy and data | GDG DevFest Warsaw 2026',
    description:
      'Read how the DevFest Warsaw website, registration, and newsletter flows handle personal data.',
    structuredData: null,
  },
  '/coc': {
    title: 'Code of Conduct | GDG DevFest Warsaw 2026',
    description:
      'Read the Code of Conduct for GDG DevFest Warsaw 2026 and help keep the community welcoming, inclusive, and respectful.',
    structuredData: null,
  },
};

const EVENT_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${CANONICAL_HOST}/#website`,
      url: `${CANONICAL_HOST}/`,
      name: 'GDG DevFest Warsaw 2026',
      inLanguage: 'en',
    },
    {
      '@type': 'Organization',
      '@id': `${CANONICAL_HOST}/#organization`,
      name: 'Google Developer Groups Warsaw',
      url: 'https://gdg.community.dev/gdg-warszawa/',
      sameAs: [
        'https://gdg.community.dev/gdg-warszawa/',
        'https://www.meetup.com/GDG-Warszawa/',
        'https://www.facebook.com/gdgwarszawa',
        'https://www.instagram.com/gdgwarszawa/',
        'https://www.youtube.com/c/GdgWarszawaPl/featured',
      ],
    },
    {
      '@type': 'Event',
      '@id': `${CANONICAL_HOST}/#event`,
      name: 'GDG DevFest Warsaw 2026',
      description:
        'A one-day, community-led technology conference bringing developers, designers, entrepreneurs, engineers, researchers, and students together at Google for Startups Campus Warsaw. Theme: Real Work, Real Lessons.',
      startDate: '2026-11-21T09:00:00+01:00',
      endDate: '2026-11-21T21:00:00+01:00',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      image: [`${CANONICAL_HOST}${EVENT_IMAGE}`],
      url: `${CANONICAL_HOST}/`,
      inLanguage: 'en',
      location: {
        '@type': 'Place',
        name: 'Google for Startups Campus Warsaw',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Plac Konesera 10',
          postalCode: '03-736',
          addressLocality: 'Warszawa',
          addressCountry: 'PL',
        },
      },
      organizer: {
        '@id': `${CANONICAL_HOST}/#organization`,
      },
      keywords:
        'GDG DevFest Warsaw, developer conference Warsaw, technology conference Poland, Google Cloud, AI, machine learning, Firebase, Android, web performance, open source',
    },
  ],
};

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${CANONICAL_HOST}/faq#faq`,
  url: `${CANONICAL_HOST}/faq`,
  inLanguage: 'en',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'When is GDG DevFest Warsaw 2026?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'GDG DevFest Warsaw 2026 takes place on 21 November 2026.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where is GDG DevFest Warsaw 2026?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The event takes place at Google for Startups Campus Warsaw, Plac Konesera 10, 03-736 Warszawa, Poland.',
      },
    },
    {
      '@type': 'Question',
      name: 'Who is GDG DevFest Warsaw 2026 for?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The event is for developers, designers, entrepreneurs, engineers, researchers, and students, from beginners to experienced practitioners.',
      },
    },
    {
      '@type': 'Question',
      name: 'What topics will GDG DevFest Warsaw cover?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Current focus areas include Practical AI & ML, Google Cloud, Build with AI, AI Antigravity Agent Dev Kit (ADK), Gemini & Gemma, Firebase, Web & Performance, Mobile & Android, Open Source, and Engineering Culture.',
      },
    },
    {
      '@type': 'Question',
      name: 'How can I submit a talk or workshop?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Submit a talk, demo, workshop, panel, or another practical format through the public Advocu Call for Papers. The published deadline is 4 October 2026 at 23:45 Europe/Warsaw: https://app.advocu.com/public/gde/events/6a9e63804f57bc69c8b411c1?cfpid=6a9fd14f4f57bc69c8b577e0',
      },
    },
  ],
};

const getPathname = () => {
  const pathname = window.location.pathname.replace(/\/+$/, '');
  return pathname || '/';
};

const getCanonicalOrigin = () => {
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return window.location.origin;
  }
  return CANONICAL_HOST;
};

const getCanonicalUrl = () => {
  const pathname = getPathname();
  return `${getCanonicalOrigin()}${pathname === '/' ? '/' : pathname}`;
};

const toAbsoluteUrl = (value: string) => {
  try {
    return new URL(value, getCanonicalOrigin()).href;
  } catch {
    return value;
  }
};

const setMeta = (attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
};

const setLink = (rel: string, href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
};

const setStructuredData = (id: string, schema: unknown | null) => {
  const existing = document.head.querySelector<HTMLScriptElement>(`#${id}`);
  if (!schema) {
    existing?.remove();
    return;
  }

  const script = existing ?? document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  if (!existing) document.head.appendChild(script);
};

const updateSeoMetadata = (
  title: string,
  description: string,
  imageUrl: string,
  fallbackTitle: string,
) => {
  const routeMetadata = ROUTE_METADATA[getPathname()];
  const pageTitle = routeMetadata?.title ?? (title || fallbackTitle);
  const pageDescription = routeMetadata?.description ?? description;
  const canonicalUrl = getCanonicalUrl();
  const absoluteImageUrl = toAbsoluteUrl(imageUrl);

  pwaUpdateMetadata({
    title: pageTitle,
    description: pageDescription,
    image: absoluteImageUrl,
    imageAlt: pageTitle,
    url: canonicalUrl,
  });

  setMeta('name', 'description', pageDescription);
  setMeta(
    'name',
    'robots',
    'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  );
  setMeta('property', 'og:title', pageTitle);
  setMeta('property', 'og:description', pageDescription);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:site_name', siteTitle);
  setMeta('property', 'og:image', absoluteImageUrl);
  setMeta('property', 'og:image:alt', pageTitle);
  setMeta('property', 'og:image:type', 'image/png');
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', pageTitle);
  setMeta('name', 'twitter:description', pageDescription);
  setMeta('name', 'twitter:image', absoluteImageUrl);
  setMeta('name', 'twitter:image:alt', pageTitle);
  setLink('canonical', canonicalUrl);
  setLink('describedby', `${getCanonicalOrigin()}/llms.txt`);

  const hasEventSchema =
    routeMetadata?.structuredData === 'event' || routeMetadata?.structuredData === 'faq';
  setStructuredData('structured-data', hasEventSchema ? EVENT_SCHEMA : null);
  setStructuredData(
    'faq-structured-data',
    routeMetadata?.structuredData === 'faq' ? FAQ_SCHEMA : null,
  );
};

export const updateImageMetadata = (title: string, description: string, data: Image) => {
  updateSeoMetadata(`${title} | ${siteTitle}`, description, data.image, siteTitle);
};

export const updateMetadata = (
  title: string,
  description: string,
  includeSiteTitle = INCLUDE_SITE_TITLE.YES,
) => {
  const fallbackTitle =
    includeSiteTitle === INCLUDE_SITE_TITLE.YES ? `${title} | ${siteTitle}` : title;
  updateSeoMetadata(fallbackTitle, description, image, siteTitle);
};
