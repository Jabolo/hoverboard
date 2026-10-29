import { describe, expect, it } from '@jest/globals';
import { PartnerGroup } from '../models/partner-group';
import { communityPartners, goldSponsors, visiblePartnerGroups } from './partner-groups';

describe('visible partner groups', () => {
  it('shows approved community partners without requiring database changes', () => {
    const groups = visiblePartnerGroups([]);
    expect(groups.map((group) => group.title)).toEqual(['Gold Sponsors', 'Community Partners']);
    expect(groups[1]!.items.map((partner) => partner.name)).toEqual([
      'Helion',
      'Red Bull',
      'JetBrains',
    ]);
    expect(groups[1]!.items[2]!.description).not.toMatch(/three|\b3\b/i);
  });

  it('hides empty tiers and orders filled tiers above community partners', () => {
    const group = (title: string, order: number, filled: boolean): PartnerGroup => ({
      id: title,
      title,
      order,
      items: filled ? [{ ...communityPartners.items[0]!, name: title }] : [],
    });
    expect(
      visiblePartnerGroups([
        group('Silver Sponsors', 1, true),
        group('Platinum Sponsors', 99, true),
        group('Gold Sponsors', 2, false),
        group('Bronze Sponsors', 3, false),
      ]).map((item) => item.title),
    ).toEqual(['Platinum Sponsors', 'Gold Sponsors', 'Silver Sponsors', 'Community Partners']);
  });

  it('places MongoDB once in Gold even when live data has an older category', () => {
    const result = visiblePartnerGroups([
      { ...communityPartners, items: [...communityPartners.items, goldSponsors.items[0]!] },
      { ...goldSponsors, items: [goldSponsors.items[0]!] },
    ]);
    expect(
      result.flatMap((group) => group.items).filter((partner) => partner.name === 'MongoDB'),
    ).toHaveLength(1);
    expect(result[0]!.title).toBe('Gold Sponsors');
    expect(result[0]!.items[0]!.url).toBe('https://www.mongodb.com/');
  });

  it('preserves existing partners and avoids duplicate community logos', () => {
    const venue = {
      ...communityPartners,
      id: 'venue',
      title: 'Venue & Community Partner',
      order: 1,
    };
    const result = visiblePartnerGroups([
      { ...venue, items: [{ ...venue.items[0]!, name: 'Google for Startups' }] },
      communityPartners,
    ]);
    expect(result[0]!.items[0]!.name).toBe('Google for Startups');
    expect(result[2]!.items).toHaveLength(3);
    expect(communityPartners.items).toHaveLength(3);
  });
});
