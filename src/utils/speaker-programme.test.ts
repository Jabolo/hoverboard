import { describe, expect, it } from '@jest/globals';
import type { Speaker } from '../models/speaker';
import type { Session } from '../models/session';
import { curatedSpeakers, speakerSessionLinks, speakerSocialLabel } from './speaker-programme';

const speaker = (id: string) => ({ id, name: id, featured: false }) as Speaker;
const panel: Session = {
  id: 'PANEL-01',
  title: 'A shared discussion',
  description: 'Panel abstract',
  speakers: ['moderator', 'one', 'two', 'three', 'four'],
};

describe('speaker programme presentation', () => {
  it('selects the four editorial picks in a stable order without relying on record order or featured flags', () => {
    const input = ['other', 'arek-borucki', 'tomasz-porozynski', 'ivan-lapa', 'hasan-rafiq'].map(
      speaker,
    );
    expect(curatedSpeakers(input).map(({ id }) => id)).toEqual([
      'ivan-lapa',
      'hasan-rafiq',
      'tomasz-porozynski',
      'arek-borucki',
    ]);
    expect(input.map(({ id }) => id)).toEqual([
      'other',
      'arek-borucki',
      'tomasz-porozynski',
      'ivan-lapa',
      'hasan-rafiq',
    ]);
  });

  it('does not silently replace a missing editorial pick with another person', () => {
    expect(curatedSpeakers([speaker('other'), speaker('hasan-rafiq')]).map(({ id }) => id)).toEqual(
      ['hasan-rafiq'],
    );
  });

  it('links the moderator and panellists to the same shared session without duplicating records', () => {
    const moderator = speakerSessionLinks([panel, panel], { 'PANEL-01': 'Moderator' });
    const panellists = Array.from({ length: 4 }, () =>
      speakerSessionLinks([panel], { 'PANEL-01': 'Panellist' }),
    );
    expect(moderator).toEqual([
      {
        id: 'PANEL-01',
        title: panel.title,
        href: '/sessions/PANEL-01',
        label: 'Moderator · Shared panel',
      },
    ]);
    for (const links of panellists) {
      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({
        href: moderator[0]!.href,
        label: 'Panellist · Shared panel',
      });
    }
    expect(panel.speakers).toHaveLength(5);
  });

  it('handles missing programme data and links regular sessions to their own abstract route', () => {
    expect(speakerSessionLinks()).toEqual([]);
    const talk: Session = { id: 'CFP-014', title: 'Practical AI', description: 'Talk abstract' };
    expect(speakerSessionLinks([talk])).toEqual([
      { id: talk.id, title: talk.title, href: '/sessions/CFP-014', label: 'Session' },
    ]);
    expect(speakerSessionLinks([panel])[0]?.label).toBe('Shared panel');
  });
});

describe('speaker social link labels', () => {
  it('uses the speaker and correctly capitalised service name', () => {
    expect(speakerSocialLabel('Ivan Lapa', 'linkedin', 'linkedin')).toBe(
      'Visit Ivan Lapa on LinkedIn (opens in a new tab)',
    );
  });
  it('distinguishes multiple website links and handles incomplete source data', () => {
    expect(
      speakerSocialLabel('Yonatan Levin', 'Website', 'website', 'https://www.medium.com/@yonatan'),
    ).toContain('website (medium.com)');
    expect(speakerSocialLabel('', '', '', 'not a url')).toBe(
      'Visit speaker on website (opens in a new tab)',
    );
  });
});
