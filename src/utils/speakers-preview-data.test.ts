import { describe, expect, it } from '@jest/globals';
import {
  generatePreviewData,
  expectedPreviewRoster,
  isSpeakersPreview,
  PreviewSource,
  resolveSpeakersPreview,
} from './speakers-preview-data';
import type { SpeakerData } from '../models/speaker';

const source = (): PreviewSource => ({
  speakers: {
    alice: { name: 'Alice', photoUrl: '/preview/speakers/alice.webp', order: 1 } as SpeakerData,
    bob: { name: 'Bob', photoUrl: '/preview/speakers/bob.svg', order: 2 } as SpeakerData,
  },
  sessions: {
    'PANEL-01': {
      title: 'Shared panel',
      description: 'Panel abstract',
      speakers: ['alice', 'bob'],
      tags: ['Cloud'],
      day: '2026-11-21',
      startTime: '10:00',
    },
  },
});

describe('local speaker preview mapping', () => {
  it('creates one panel and reciprocal speaker links without exposing timetable data', () => {
    const generated = generatePreviewData(source());
    expect(generated.generatedSchedule).toEqual([]);
    expect(generated.generatedSessions).toHaveLength(1);
    expect(generated.generatedSessions[0]?.speakers.map(({ id }) => id)).toEqual(['alice', 'bob']);
    for (const speaker of generated.generatedSpeakers) {
      expect(speaker.sessions.map(({ id }) => id)).toEqual(['PANEL-01']);
      expect(speaker.tags).toEqual(['Cloud']);
      expect(speaker.sessions[0]).not.toHaveProperty('day');
      expect(speaker.sessions[0]).not.toHaveProperty('startTime');
    }
    expect(generated.generatedSessions[0]).toMatchObject({ mainTag: 'Cloud' });
    expect(generated.generatedSessions[0]).not.toHaveProperty('startTime');
    expect(generated.generatedSessions[0]?.speakers[0]).not.toHaveProperty('sessions');
  });

  it('rejects missing speakers, orphan speakers and duplicate panel members', () => {
    const missing = source();
    missing.sessions['PANEL-01']!.speakers = ['unknown'];
    expect(() => generatePreviewData(missing)).toThrow('Unknown speaker');
    const orphan = source();
    orphan.sessions['PANEL-01']!.speakers = ['alice'];
    expect(() => generatePreviewData(orphan)).toThrow('has no session');
    const duplicate = source();
    duplicate.sessions['PANEL-01']!.speakers = ['alice', 'alice'];
    expect(() => generatePreviewData(duplicate)).toThrow('Duplicate speakers');
  });

  it('rejects remote portraits and incomplete abstracts', () => {
    const remote = source();
    remote.speakers['alice']!.photoUrl = 'https://example.org/alice.jpg';
    expect(() => generatePreviewData(remote)).toThrow('Portrait must be local');
    const incomplete = source();
    incomplete.sessions['PANEL-01']!.description = '';
    expect(() => generatePreviewData(incomplete)).toThrow('Incomplete session');
  });

  it('allows only explicit preview builds on loopback hosts', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', '::1']) {
      expect(isSpeakersPreview('1', host)).toBe(true);
      expect(isSpeakersPreview('0', host)).toBe(false);
    }
    for (const host of ['warsaw.devfest.pl', 'localhost.example.com', '192.168.1.2']) {
      expect(isSpeakersPreview('1', host)).toBe(false);
    }
  });

  it('allows review builds only on the exact Firebase speaker review channel', () => {
    for (const suffix of ['abc123', '1', 'abcdef']) {
      const host = `gdg-warsaw-devfest26-web--speakers-review-2026-${suffix}.web.app`;
      expect(resolveSpeakersPreview('review', host)).toBe(true);
      expect(isSpeakersPreview('1', host)).toBe(false);
      for (const flag of ['', '0', '__SPEAKERS_PREVIEW_BUILD__']) {
        expect(resolveSpeakersPreview(flag, host)).toBe(false);
      }
    }
  });

  it('isolates comparison builds from the original preview and production', () => {
    const comparison = 'gdg-warsaw-devfest26-web--cards-v2-2026-abc123.web.app';
    const original = 'gdg-warsaw-devfest26-web--speakers-review-2026-abc123.web.app';
    expect(resolveSpeakersPreview('comparison', comparison)).toBe(true);
    expect(() => resolveSpeakersPreview('review', comparison)).toThrow();
    for (const host of [original, 'localhost', 'warsaw.devfest.pl', `${comparison}.evil.com`]) {
      expect(() => resolveSpeakersPreview('comparison', host)).toThrow();
    }
    expect(resolveSpeakersPreview('0', comparison)).toBe(false);
  });

  it('isolates the Tomek preview from prior review/comparison channels and all production hosts', () => {
    const tomek = 'gdg-warsaw-devfest26-web--speakers-tomek-2026-abc123.web.app';
    expect(resolveSpeakersPreview('tomek', tomek)).toBe(true);
    for (const flag of ['review', 'comparison', '1']) {
      expect(() => resolveSpeakersPreview(flag, tomek)).toThrow('not allowed on this host');
    }
    for (const host of [
      'gdg-warsaw-devfest26-web--cards-v2-2026-abc123.web.app',
      'gdg-warsaw-devfest26-web--speakers-review-2026-abc123.web.app',
      'warsaw.devfest.pl',
      'gdg-warsaw-devfest26-web.web.app',
      'localhost',
      `${tomek}.evil.com`,
      'other-site--speakers-tomek-2026-abc123.web.app',
      'gdg-warsaw-devfest26-web--speakers-tomek-2026-abc-123.web.app',
      'gdg-warsaw-devfest26-web--speakers-tomek-2026-ABC123.web.app',
    ]) {
      expect(() => resolveSpeakersPreview('tomek', host)).toThrow('not allowed on this host');
    }
    expect(resolveSpeakersPreview('0', tomek)).toBe(false);
  });

  it('uses the confirmed 13/9 roster for Tomek/local previews and preserves old roster guards', () => {
    for (const flag of ['tomek', '1']) {
      expect(expectedPreviewRoster(flag)).toEqual({ speakers: 13, sessions: 9 });
    }
    for (const flag of ['review', 'comparison']) {
      expect(expectedPreviewRoster(flag)).toEqual({ speakers: 12, sessions: 8 });
    }
  });

  it('fails closed for preview flags on production, other channels and lookalikes', () => {
    const denied = [
      'warsaw.devfest.pl',
      'gdg-warsaw-devfest26-web.web.app',
      'gdg-warsaw-devfest26-web.firebaseapp.com',
      'gdg-warsaw-devfest26-web--other-channel-abc123.web.app',
      'other-site--speakers-review-2026-abc123.web.app',
      'gdg-warsaw-devfest26-web--speakers-review-2026-.web.app',
      'gdg-warsaw-devfest26-web--speakers-review-2026-abc-123.web.app',
      'gdg-warsaw-devfest26-web--speakers-review-2026-ABC123.web.app',
      'gdg-warsaw-devfest26-web--speakers-review-2026-abc123.firebaseapp.com',
      'gdg-warsaw-devfest26-web--speakers-review-2026-abc123.web.app.example.com',
      'prefix.gdg-warsaw-devfest26-web--speakers-review-2026-abc123.web.app',
      'localhost.example.com',
      '192.168.1.2',
    ];
    for (const host of denied) {
      for (const flag of ['1', 'review', 'comparison', 'tomek']) {
        expect(isSpeakersPreview(flag, host)).toBe(false);
        expect(() => resolveSpeakersPreview(flag, host)).toThrow('not allowed on this host');
      }
      expect(resolveSpeakersPreview('', host)).toBe(false);
    }
    for (const host of ['localhost', '127.0.0.1', '[::1]', '::1']) {
      expect(() => resolveSpeakersPreview('review', host)).toThrow('not allowed on this host');
      expect(resolveSpeakersPreview('1', host)).toBe(true);
    }
  });

  it('preserves company logos and GDE badges together, including embedded session speakers', () => {
    const data = source();
    data.speakers['alice']!.company = 'Qualtrics';
    data.speakers['alice']!.sessionRoles = { 'PANEL-01': 'Moderator' };
    data.speakers['alice']!.companyLogoUrl = '/preview/logos/qualtrics.svg';
    data.speakers['alice']!.badges = [
      {
        name: 'gde',
        description: 'Google Developer Expert',
        link: 'https://developers.google.com/community/experts',
      },
    ];
    const generated = generatePreviewData(data);
    expect(generated.generatedSpeakers[0]).toMatchObject({
      companyLogoUrl: '/preview/logos/qualtrics.svg',
      badges: [{ name: 'gde' }],
    });
    expect(generated.generatedSessions[0]?.speakers[0]).toMatchObject({
      sessionRoles: { 'PANEL-01': 'Moderator' },
      companyLogoUrl: '/preview/logos/qualtrics.svg',
      badges: [{ name: 'gde' }],
    });
    data.speakers['alice']!.companyLogoUrl = 'https://example.org/logo.svg';
    expect(() => generatePreviewData(data)).toThrow('Company logo must be local');
  });
});
