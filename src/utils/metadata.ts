import { updateMetadata as pwaUpdateMetadata } from 'pwa-helpers/metadata.js';
import routeMetadata from '../../public/data/seo-routes.json';
import { image, title as siteTitle } from './data';
import { EVENT_SCHEMA, FAQ_SCHEMA } from './seo-schemas';

export enum INCLUDE_SITE_TITLE {
  YES,
  NO,
}

interface Image {
  image: string;
  imageAlt: string;
}

const CANONICAL_HOST = 'https://warsaw.devfest.pl';

interface RouteMetadata {
  title: string;
  description: string;
  structuredData: 'event' | 'faq' | null;
}

const ROUTE_METADATA: Record<string, RouteMetadata> = routeMetadata as Record<
  string,
  RouteMetadata
>;

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

const getImageMimeType = (imageUrl: string) => {
  const pathname = (imageUrl.split(/[?#]/, 1)[0] ?? '').toLowerCase();
  const extension = pathname.slice(pathname.lastIndexOf('.') + 1);

  switch (extension) {
    case 'avif':
      return 'image/avif';
    case 'gif':
      return 'image/gif';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png';
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
  indexable = true,
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
    indexable
      ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      : 'noindex, follow',
  );
  setMeta('property', 'og:title', pageTitle);
  setMeta('property', 'og:description', pageDescription);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:site_name', siteTitle);
  setMeta('property', 'og:image', absoluteImageUrl);
  setMeta('property', 'og:image:alt', pageTitle);
  setMeta('property', 'og:image:type', getImageMimeType(absoluteImageUrl));
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
  indexable = true,
) => {
  const fallbackTitle =
    includeSiteTitle === INCLUDE_SITE_TITLE.YES ? `${title} | ${siteTitle}` : title;
  updateSeoMetadata(fallbackTitle, description, image, siteTitle, indexable);
};
