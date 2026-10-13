import { PartnerGroup } from '../models/partner-group';

// Approved partner records: DevFest 2026 Partnerships & Sponsorship Google Doc.
// Bundled with hosting so previews never need to write to the live database.
export const communityPartners: PartnerGroup = {
  id: 'community-partners',
  title: 'Community Partners',
  order: 50,
  items: [
    {
      id: 'helion',
      parentId: 'community-partners',
      name: 'Helion',
      order: 1,
      url: 'https://helion.pl/',
      logoUrl: '/images/partners/helion-red.png',
      description: 'Helion supports DevFest Warsaw 2026 with book prizes for our community.',
    },
    {
      id: 'jetbrains',
      parentId: 'community-partners',
      name: 'JetBrains',
      order: 2,
      url: 'https://www.jetbrains.com/',
      logoUrl: '/images/partners/jetbrains-mono-white.svg',
      description:
        'JetBrains supports DevFest Warsaw 2026 with annual personal IDE subscriptions for attendee prizes.',
    },
  ],
};

export const goldSponsors: PartnerGroup = {
  id: 'gold-sponsors',
  title: 'Gold Sponsors',
  order: 20,
  items: [
    {
      id: 'mongodb',
      parentId: 'gold-sponsors',
      name: 'MongoDB',
      order: 1,
      url: 'https://www.mongodb.com/',
      logoUrl: '/images/partners/mongodb.svg',
      description: 'MongoDB is a Gold Sponsor of DevFest Warsaw 2026.',
    },
  ],
};

const categoryOrder = [
  'Platinum Sponsors',
  'Gold Sponsors',
  'Silver Sponsors',
  'Bronze Sponsors',
  'Community Partners',
];

export function visiblePartnerGroups(groups: PartnerGroup[]): PartnerGroup[] {
  const approvedGroups = [goldSponsors, communityPartners];
  const approvedNames = new Set(
    approvedGroups.flatMap((group) => group.items.map((partner) => partner.name.toLowerCase())),
  );
  const existing = groups.map((group) => ({
    ...group,
    items: group.items.filter((partner) => !approvedNames.has(partner.name.toLowerCase())),
  }));
  const merged = approvedGroups.map((approved) => {
    const group = existing.find((candidate) => candidate.title === approved.title);
    return {
      ...approved,
      items: [...(group?.items ?? []), ...approved.items].sort((a, b) => a.order - b.order),
    };
  });
  const rank = (group: PartnerGroup) => {
    const category = categoryOrder.indexOf(group.title);
    return category === -1 ? group.order : (category + 1) * 10;
  };
  return [
    ...existing.filter(
      (group) => !approvedGroups.some((approved) => approved.title === group.title),
    ),
    ...merged,
  ]
    .filter((group) => group.items.length > 0)
    .sort((a, b) => rank(a) - rank(b));
}
