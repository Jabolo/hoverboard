import { generateProgrammeData, PreviewCollections, PreviewSource } from './speakers-preview-data';

export const PROGRAMME_URL = '/data/programme-2026.json';

/** Hosting publishes this reviewed snapshot atomically with its portrait assets. */
export function generatePublishedProgramme(source: PreviewSource): PreviewCollections {
  const data = generateProgrammeData(source, 'published');
  if (data.generatedSpeakers.length !== 15 || data.generatedSessions.length !== 11) {
    throw new Error('Expected 15 confirmed speakers and 11 sessions');
  }
  return data;
}

let loaded: Promise<PreviewCollections> | undefined;
export function loadPublishedProgramme(): Promise<PreviewCollections> {
  loaded ??= fetch(PROGRAMME_URL, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Programme request failed (${response.status})`);
      return generatePublishedProgramme(await response.json());
    })
    .catch((error: unknown) => {
      const alert = document.createElement('p');
      alert.setAttribute('role', 'alert');
      alert.style.cssText = 'padding:20px;background:#b3261e;color:white;font-weight:bold';
      alert.textContent =
        'The confirmed programme could not be loaded. Please reload to try again.';
      document.body.prepend(alert);
      throw error;
    });
  return loaded;
}
