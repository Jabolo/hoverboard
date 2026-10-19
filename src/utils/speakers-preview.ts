import {
  generatePreviewData,
  resolveSpeakersPreview,
  PreviewCollections,
} from './speakers-preview-data';

// Replaced by Rollup from SPEAKERS_PREVIEW=1 or review. Never enabled by a URL or storage.
const buildFlag: string = '__SPEAKERS_PREVIEW_BUILD__';
export const speakersPreview = (() => {
  try {
    return resolveSpeakersPreview(buildFlag, window.location.hostname);
  } catch (error) {
    const banner = document.createElement('p');
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'padding:20px;background:#b3261e;color:white;font-weight:bold';
    banner.textContent =
      'Speaker review preview is not allowed on this host. No production programme data was loaded.';
    (document.body ?? document.documentElement).prepend(banner);
    throw error;
  }
})();
export function assertPreviewWritesDisabled() {
  if (speakersPreview) throw new Error('This speaker review preview is read-only');
}

let loaded: Promise<PreviewCollections> | undefined;
export function loadPreviewData(): Promise<PreviewCollections> {
  loaded ??= fetch('/preview/data.json', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Preview data request failed (${response.status})`);
      const data = generatePreviewData(await response.json());
      if (data.generatedSpeakers.length !== 12 || data.generatedSessions.length !== 8) {
        throw new Error('Expected 12 confirmed speakers and 8 sessions');
      }
      return data;
    })
    .catch((error: unknown) => {
      const banner = document.createElement('p');
      banner.setAttribute('role', 'alert');
      banner.style.cssText = 'padding:20px;background:#b3261e;color:white;font-weight:bold';
      banner.textContent = `Speaker review preview failed: ${error instanceof Error ? error.message : String(error)}. No production programme data was loaded.`;
      document.body.prepend(banner);
      throw error;
    });
  return loaded;
}

export function previewCollection(path: string): keyof PreviewCollections | undefined {
  const collection = path.split('/')[0];
  return collection === 'generatedSpeakers' ||
    collection === 'generatedSessions' ||
    collection === 'generatedSchedule'
    ? collection
    : undefined;
}
