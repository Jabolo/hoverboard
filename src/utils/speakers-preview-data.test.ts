import { describe, expect, it } from '@jest/globals';
import { generatePreviewData, isSpeakersPreview, PreviewSource } from './speakers-preview-data';
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

  it('preserves company logos and GDE badges together, including embedded session speakers', () => {
    const data = source();
    data.speakers['alice']!.company = 'Qualtrics';
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
      companyLogoUrl: '/preview/logos/qualtrics.svg',
      badges: [{ name: 'gde' }],
    });
    data.speakers['alice']!.companyLogoUrl = 'https://example.org/logo.svg';
    expect(() => generatePreviewData(data)).toThrow('Company logo must be local');
  });
});
