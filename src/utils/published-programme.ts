import { generateProgrammeData, PreviewCollections, PreviewSource } from './speakers-preview-data';

export const PROGRAMME_URL = '/data/programme-2026.json';

/** Hosting publishes this reviewed snapshot atomically with its portrait assets. */
export function generatePublishedProgramme(source: PreviewSource): PreviewCollections {
  const data = generateProgrammeData(source, 'published');
  if (data.generatedSpeakers.length !== 19 || data.generatedSessions.length !== 16) {
    throw new Error('Expected 19 confirmed speakers and 16 sessions');
  }
  return data;
}

/** Counts come from the same reviewed snapshot used by the speaker and session pages. */
export function getProgrammeSummary(
  data: Pick<PreviewCollections, 'generatedSpeakers' | 'generatedSessions'>,
): string {
  return `${data.generatedSpeakers.length} speakers / ${data.generatedSessions.length} sessions`;
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
