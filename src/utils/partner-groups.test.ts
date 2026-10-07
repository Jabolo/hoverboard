import { describe, expect, it } from '@jest/globals';
import { PartnerGroup } from '../models/partner-group';
import { communityPartners, visiblePartnerGroups } from './partner-groups';

describe('visible partner groups', () => {
  it('shows approved community partners without requiring database changes', () => {
    const groups = visiblePartnerGroups([]);
    expect(groups.map((group) => group.title)).toEqual(['Community Partners']);
    expect(groups[0]!.items.map((partner) => partner.name)).toEqual(['Helion', 'JetBrains']);
    expect(groups[0]!.items[1]!.description).not.toMatch(/three|\b3\b/i);
  });

  it('hides empty tiers and orders filled tiers above community partners', () => {
    const group = (title: string, order: number, filled: boolean): PartnerGroup => ({
      id: title,
      title,
      order,
      items: filled ? [communityPartners.items[0]!] : [],
    });
    expect(
      visiblePartnerGroups([
        group('Silver Sponsors', 1, true),
        group('Platinum Sponsors', 99, true),
        group('Gold Sponsors', 2, false),
        group('Bronze Sponsors', 3, false),
      ]).map((item) => item.title),
    ).toEqual(['Platinum Sponsors', 'Silver Sponsors', 'Community Partners']);
  });

  it('preserves existing partners and avoids duplicate community logos', () => {
    const venue = {
      ...communityPartners,
      id: 'venue',
      title: 'Venue & Community Partner',
      order: 1,
    };
    const result = visiblePartnerGroups([venue, communityPartners]);
    expect(result[0]).toBe(venue);
    expect(result[1]!.items).toHaveLength(2);
    expect(communityPartners.items).toHaveLength(2);
  });
});
