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
      id: 'red-bull',
      parentId: 'community-partners',
      name: 'Red Bull',
      order: 2,
      url: 'https://www.redbull.com/',
      logoUrl: '/images/partners/red-bull-can.webp',
      description: 'Red Bull is a Community Partner of DevFest Warsaw 2026.',
    },
    {
      id: 'jetbrains',
      parentId: 'community-partners',
      name: 'JetBrains',
      order: 3,
      url: 'https://www.jetbrains.com/',
      logoUrl: '/images/partners/jetbrains-mono-white.svg',
      description:
        'JetBrains supports DevFest Warsaw 2026 with annual personal IDE subscriptions for attendee prizes.',
    },
    {
      id: 'meetjs',
      parentId: 'community-partners',
      name: 'meet.js',
      order: 4,
      url: 'https://meetjs.pl/',
      logoUrl: '/images/partners/meetjs.svg',
      description: 'meet.js is a Community Partner of DevFest Warsaw 2026.',
    },
    {
      id: 'legimi',
      parentId: 'community-partners',
      name: 'Legimi',
      order: 5,
      url: 'https://www.legimi.pl/',
      logoUrl: '/images/partners/legimi.svg',
      description: 'Legimi is a Community Partner of DevFest Warsaw 2026.',
    },
    {
      id: 'pixelore',
      parentId: 'community-partners',
      name: 'Pixelore',
      order: 6,
      url: 'https://www.pixelorestudio.com/',
      logoUrl: '/images/partners/pixelore-logo-dark.svg',
      description: 'Pixelore is the photography partner for DevFest Warsaw 2026.',
    },
    {
      id: 'kol-ski',
      parentId: 'community-partners',
      name: 'Kol.ski',
      order: 7,
      url: 'https://kol.ski/',
      logoUrl: '/images/partners/kolski-wordmark-white.svg',
      description: 'Kol.ski is a Community Partner of DevFest Warsaw 2026.',
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
