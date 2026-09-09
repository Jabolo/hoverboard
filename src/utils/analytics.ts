const MEASUREMENT_ID = 'G-6H09QP1YCQ';
const CONSENT_STORAGE_KEY = 'devfest-analytics-consent';
const GOOGLE_ANALYTICS_SCRIPT = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;

type AnalyticsConsent = 'granted' | 'denied';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let analyticsConsent: AnalyticsConsent | null = readAnalyticsConsent();
let analyticsReady: Promise<void> | null = null;

function readAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

function persistAnalyticsConsent(consent: AnalyticsConsent) {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  } catch {
    // Analytics remains session-only when storage is unavailable.
  }
}

function clearAnalyticsCookies() {
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0]?.trim();
    if (name?.startsWith('_ga')) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  });
}

function loadAnalytics(): Promise<void> {
  if (analyticsReady) return analyticsReady;

  analyticsReady = new Promise((resolve, reject) => {
    window.dataLayer = window.dataLayer || [];
    // Keep the queue shape used by Google's official gtag snippet. The
    // library reads array-like `arguments` entries from dataLayer.
    window.gtag = function gtag() {
      window.dataLayer?.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });

    const script = document.createElement('script');
    script.async = true;
    script.src = GOOGLE_ANALYTICS_SCRIPT;
    script.onload = () => {
      window.gtag?.('config', MEASUREMENT_ID, { send_page_view: false });
      if (analyticsConsent === 'granted') {
        window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
      }
      resolve();
    };
    script.onerror = () => {
      analyticsReady = null;
      reject(new Error('Google Analytics failed to load'));
    };
    document.head.appendChild(script);
  });

  return analyticsReady;
}

export function getAnalyticsConsent(): AnalyticsConsent | null {
  return analyticsConsent;
}

export async function setAnalyticsConsent(consent: AnalyticsConsent) {
  analyticsConsent = consent;
  persistAnalyticsConsent(consent);

  if (consent === 'denied') {
    window.gtag?.('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    clearAnalyticsCookies();
    return;
  }

  await loadAnalytics();
  window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
  logPageView();
}

export async function logPageView() {
  if (analyticsConsent !== 'granted') return;

  await loadAnalytics();
  window.gtag?.('event', 'page_view', {
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
  });
}

export async function logAnalyticsEvent(
  eventName: string,
  parameters: Record<string, unknown> = {},
) {
  if (analyticsConsent !== 'granted') return;

  await loadAnalytics();
  window.gtag?.('event', eventName, parameters);
}

export async function logLogin() {
  await logAnalyticsEvent('login');
}
