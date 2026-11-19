import { describe, expect, it, jest } from '@jest/globals';
import fixture from '../../public/data/programme-2026.json';
import {
  generatePublishedProgramme,
  getProgrammeSummary,
  loadPublishedProgramme,
} from './published-programme';
import { isReleaseReviewHost, PreviewSource } from './speakers-preview-data';

const source = () => JSON.parse(JSON.stringify(fixture)) as PreviewSource;

describe('approved programme publication', () => {
  it('derives homepage counts from programme data rather than fixed copy', () => {
    const data = generatePublishedProgramme(source());
    expect(getProgrammeSummary(data)).toBe('19 speakers / 16 sessions');
    expect(
      getProgrammeSummary({
        generatedSpeakers: data.generatedSpeakers.slice(0, 5),
        generatedSessions: data.generatedSessions.slice(0, 3),
      }),
    ).toBe('5 speakers / 3 sessions');
  });

  it('publishes only the approved sessions and reciprocal links with one shared panel', () => {
    const data = generatePublishedProgramme(source());
    expect(data.generatedSpeakers).toHaveLength(19);
    expect(data.generatedSessions.map(({ id }) => id).sort()).toEqual([
      'CFP-002',
      'CFP-012',
      'CFP-014',
      'CFP-015',
      'CFP-021',
      'CFP-028',
      'CFP-034',
      'CFP-043',
      'CFP-050',
      'INVITED-001',
      'INVITED-002',
      'INVITED-003',
      'INVITED-004',
      'INVITED-005',
      'PANEL-01',
      'scaling-hugging-face-hub',
    ]);
    expect(data.generatedSchedule).toEqual([]);
    const panel = data.generatedSessions.find(({ id }) => id === 'PANEL-01');
    expect(panel?.speakers.map(({ id }) => id)).toEqual([
      'dmytro-nedvetskyi',
      'yaroslav-polyakov',
      'igor-kachura',
      'serhii-kasianchuk',
      'viacheslav-miroshnychenko',
    ]);
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

  it('includes Bruno and the final SRE session without organizational contact details', () => {
    const data = generatePublishedProgramme(source());
    const speaker = data.generatedSpeakers.find(({ id }) => id === 'bruno-sienkiewicz');
    const session = data.generatedSessions.find(({ id }) => id === 'INVITED-005');
    expect(speaker?.name).toBe('Bruno Sienkiewicz');
    expect(speaker?.sessions.map(({ id }) => id)).toEqual(['INVITED-005']);
    expect(session?.description).toContain('No laptop, accounts or installed software');
    expect(session?.language).toBe('English');
    expect(JSON.stringify(speaker)).not.toContain('bsienkiewicz@');
  });

  it('publishes Dominika’s workshop setup without exposing private contact details', () => {
    const data = generatePublishedProgramme(source());
    const workshop = data.generatedSessions.find(({ id }) => id === 'CFP-050');
    expect(workshop?.description).toContain('“Works on my machine” doesn’t count as debugging.');
    for (const requirement of [
      '## Setup before the workshop',
      '15 minutes',
      'Node.js 22 LTS',
      'v20.19+ or v22.12+',
      'Node 18 will not work',
      'git --version',
      'Google Chrome',
      'https://antigravity.google',
      'logged in',
      'docs/client-configurations.md',
      'restart your agent',
      'take a screenshot and list the network requests',
      'repository will be shared at the start',
    ]) {
      expect(workshop?.description).toContain(requirement);
    }
    expect(workshop?.description).not.toContain('dominikazajac00@gmail.com');
  });

  it('links Ivan to both sessions and presents Adrian’s session as a workshop', () => {
    const data = generatePublishedProgramme(source());
    const ivan = data.generatedSpeakers.find(({ id }) => id === 'ivan-lapa');
    const workshop = data.generatedSessions.find(({ id }) => id === 'CFP-015');
    const adrian = data.generatedSessions.find(({ id }) => id === 'INVITED-001');
    expect(ivan?.sessions.map(({ id }) => id).sort()).toEqual(['CFP-014', 'CFP-015']);
    expect(workshop?.speakers.map(({ id }) => id)).toEqual(['ivan-lapa']);
    expect(workshop?.description).toContain('45-minute workshop');
    expect(adrian?.description).toContain('45-minute workshop');
    expect(data.generatedSchedule).toEqual([]);
  });

  it('links Greg to his workshop without private contact or schedule', () => {
    const data = generatePublishedProgramme(source());
    const speaker = data.generatedSpeakers.find(({ id }) => id === 'greg-radzio');
    const workshop = data.generatedSessions.find(({ id }) => id === 'INVITED-003');
    expect(speaker?.photoUrl).toBe('/images/speakers/2026/greg-radzio.7b503f39.webp');
    expect(speaker?.sessions.map(({ id }) => id)).toEqual(['INVITED-003']);
    expect(workshop?.speakers.map(({ id }) => id)).toEqual(['greg-radzio']);
    expect(workshop?.description).toContain('Requirements: Docker');
    expect(workshop).not.toHaveProperty('startTime');
    expect(JSON.stringify({ speaker, workshop })).not.toContain('grzegorz@lowgular.io');
  });

  it('links Julia to the workshop without exposing her private email', () => {
    const data = generatePublishedProgramme(source());
    const speaker = data.generatedSpeakers.find(({ id }) => id === 'julia-rapczynska');
    const workshop = data.generatedSessions.find(({ id }) => id === 'INVITED-004');
    expect(speaker?.sessions.map(({ id }) => id)).toEqual(['INVITED-004']);
    expect(workshop?.speakers.map(({ id }) => id)).toEqual(['julia-rapczynska']);
    expect(workshop?.description).toContain('40-minute workshop');
    expect(JSON.stringify({ speaker, workshop })).not.toContain('jmykhailovych@gmail.com');
  });

  it('replaces Sergiy with Igor on the shared panel', () => {
    const data = generatePublishedProgramme(source());
    expect(data.generatedSpeakers.map(({ id }) => id)).not.toContain('sergiy-mokiyenko');
    expect(
      data.generatedSpeakers.find(({ id }) => id === 'igor-kachura')?.sessions.map(({ id }) => id),
    ).toEqual(['PANEL-01']);
  });

  it('rejects stale roster sizes, preview assets, and invalid or orphaned relationships', () => {
    const stale = source();
    delete stale.speakers['michal-tajchert'];
    delete stale.sessions['CFP-043'];
    expect(() => generatePublishedProgramme(stale)).toThrow('19 confirmed');
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

  it('links Kasper to his confirmed talk without publishing a timetable', () => {
    const data = generatePublishedProgramme(source());
    const speaker = data.generatedSpeakers.find(({ id }) => id === 'kasper-kulikowski');
    const talk = data.generatedSessions.find(({ id }) => id === 'INVITED-002');
    expect(speaker?.sessions.map(({ id }) => id)).toEqual(['INVITED-002']);
    expect(talk?.speakers.map(({ id }) => id)).toEqual(['kasper-kulikowski']);
    expect(talk?.title).toBe('The Agentic Web');
    expect(data.generatedSchedule).toEqual([]);
  });

  it('uses read-only operational SDKs only on loopback and the exact review channels', () => {
    for (const host of [
      'localhost',
      '127.0.0.1',
      '[::1]',
      'gdg-warsaw-devfest26-web--programme-ready-2026-a1b2.web.app',
      'gdg-warsaw-devfest26-web--event-companion-20261119-a1b2.web.app',
    ]) {
      expect(isReleaseReviewHost(host)).toBe(true);
    }
    for (const host of [
      'warsaw.devfest.pl',
      'gdg-warsaw-devfest26-web.web.app',
      'other-site--programme-ready-2026-a1b2.web.app',
      'gdg-warsaw-devfest26-web--programme-ready-2026-a1b2.web.app.evil.com',
      'gdg-warsaw-devfest26-web--event-companion-20261119-a1b2.web.app.evil.com',
      'other-site--event-companion-20261119-a1b2.web.app',
      'gdg-warsaw-devfest26-web--event-companion-20261119-.web.app',
      'gdg-warsaw-devfest26-web--event-companion-20261119-a-b.web.app',
      'gdg-warsaw-devfest26-web--event-companion-20261119-a1b2.firebaseapp.com',
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
