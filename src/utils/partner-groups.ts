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

const categoryOrder = [
  'Platinum Sponsors',
  'Gold Sponsors',
  'Silver Sponsors',
  'Bronze Sponsors',
  'Community Partners',
];

export function visiblePartnerGroups(groups: PartnerGroup[]): PartnerGroup[] {
  const community = groups.find((group) => group.title === communityPartners.title);
  const approvedNames = new Set(
    communityPartners.items.map((partner) => partner.name.toLowerCase()),
  );
  const mergedCommunity = {
    ...communityPartners,
    items: [
      ...(community?.items ?? []).filter(
        (partner) => !approvedNames.has(partner.name.toLowerCase()),
      ),
      ...communityPartners.items,
    ].sort((a, b) => a.order - b.order),
  };
  const rank = (group: PartnerGroup) => {
    const category = categoryOrder.indexOf(group.title);
    return category === -1 ? group.order : (category + 1) * 10;
  };
  return [...groups.filter((group) => group.title !== communityPartners.title), mergedCommunity]
    .filter((group) => group.items.length > 0)
    .sort((a, b) => rank(a) - rank(b));
}
