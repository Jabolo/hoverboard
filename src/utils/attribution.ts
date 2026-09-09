const ATTRIBUTION_STORAGE_KEY = 'devfest-attribution';

const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_id',
  'utm_term',
  'utm_content',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'source',
] as const;

type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
type AttributionParams = Partial<Record<AttributionKey, string>>;

function readStoredAttribution(): AttributionParams {
  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return ATTRIBUTION_KEYS.reduce<AttributionParams>((params, key) => {
      if (typeof parsed[key] === 'string' && parsed[key]) {
        params[key] = parsed[key];
      }
      return params;
    }, {});
  } catch {
    return {};
  }
}

function persistAttribution(params: AttributionParams) {
  try {
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Campaign attribution remains URL-only when session storage is unavailable.
  }
}

/**
 * Reads campaign and Evenea partner parameters from the landing URL and keeps
 * them for the current browser tab so SPA navigation does not lose attribution.
 */
export function getAttributionParams(): AttributionParams {
  const stored = readStoredAttribution();
  const current = new URLSearchParams(window.location.search);
  const currentParams: AttributionParams = {};

  ATTRIBUTION_KEYS.forEach((key) => {
    const value = current.get(key);
    if (value) currentParams[key] = value;
  });

  const hasNewCampaign = Object.keys(currentParams).length > 0;
  const merged: AttributionParams = hasNewCampaign ? currentParams : stored;

  if (hasNewCampaign) persistAttribution(merged);
  return merged;
}
