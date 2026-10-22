import { describe, expect, it, jest } from '@jest/globals';
import fixture from '../../public/data/programme-2026.json';
import { generatePublishedProgramme, loadPublishedProgramme } from './published-programme';
import { isReleaseReviewHost, PreviewSource } from './speakers-preview-data';

const source = () => JSON.parse(JSON.stringify(fixture)) as PreviewSource;

describe('approved programme publication', () => {
  it('publishes only the approved sessions and reciprocal links with one shared panel', () => {
    const data = generatePublishedProgramme(source());
    expect(data.generatedSpeakers).toHaveLength(14);
    expect(data.generatedSessions.map(({ id }) => id).sort()).toEqual([
      'CFP-002',
      'CFP-012',
      'CFP-014',
      'CFP-021',
      'CFP-028',
      'CFP-034',
      'CFP-043',
      'CFP-050',
      'INVITED-001',
      'PANEL-01',
    ]);
    expect(data.generatedSchedule).toEqual([]);
    const panel = data.generatedSessions.find(({ id }) => id === 'PANEL-01');
    expect(panel?.speakers).toHaveLength(5);
    for (const speaker of data.generatedSpeakers) {
      for (const session of speaker.sessions) {
        expect(
          data.generatedSessions.find(({ id }) => id === session.id)?.speakers.map(({ id }) => id),
        ).toContain(speaker.id);
        expect(session).not.toHaveProperty('startTime');
        expect(session).not.toHaveProperty('track');
      }
      expect(speaker.country).toBe('');
      expect(speaker.photoUrl).toMatch(/^\/images\/speakers\/2026\//);
    }
  });

  it('rejects stale roster sizes, preview assets, and invalid or orphaned relationships', () => {
    const stale = source();
    delete stale.speakers['michal-tajchert'];
    delete stale.sessions['CFP-043'];
    expect(() => generatePublishedProgramme(stale)).toThrow('14 confirmed');
    const preview = source();
    preview.speakers['ivan-lapa']!.photoUrl = '/preview/speakers/ivan.jpg';
    expect(() => generatePublishedProgramme(preview)).toThrow('Portrait must be local');
    const orphan = source();
    orphan.sessions['CFP-014']!.speakers = ['not-confirmed'];
    expect(() => generatePublishedProgramme(orphan)).toThrow('Unknown speaker');
    const traversal = source();
    traversal.speakers['ivan-lapa']!.photoUrl = '/images/speakers/2026/../portrait.webp';
    expect(() => generatePublishedProgramme(traversal)).toThrow('Portrait must be local');
  });

  it('uses read-only operational SDKs only on loopback and the exact release review channel', () => {
    for (const host of [
      'localhost',
      '127.0.0.1',
      '[::1]',
      'gdg-warsaw-devfest26-web--programme-ready-2026-a1b2.web.app',
    ]) {
      expect(isReleaseReviewHost(host)).toBe(true);
    }
    for (const host of [
      'warsaw.devfest.pl',
      'gdg-warsaw-devfest26-web.web.app',
      'other-site--programme-ready-2026-a1b2.web.app',
      'gdg-warsaw-devfest26-web--programme-ready-2026-a1b2.web.app.evil.com',
      'localhost.evil.com',
      'gdg-warsaw-devfest26-web--speakers-tomek-2026-a1b2.web.app',
    ]) {
      expect(isReleaseReviewHost(host)).toBe(false);
    }
  });

  it('shows a visible load error instead of falling back to any database', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValue({ ok: false, status: 404 } as Response);
    const original = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      await expect(loadPublishedProgramme()).rejects.toThrow('404');
      expect(document.querySelector('[role="alert"]')?.textContent).toContain(
        'programme could not be loaded',
      );
    } finally {
      globalThis.fetch = original;
      document.querySelector('[role="alert"]')?.remove();
    }
  });
});
