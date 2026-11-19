const groups = [
  { id: 'web', label: 'Web Relics', hint: 'Look for small details as you explore the site.' },
  { id: 'play', label: 'Play Files', hint: 'See what people are making and playing.' },
  { id: 'venue', label: 'Field Finds', hint: 'Some are around for only part of the day.' },
  { id: 'mystery', label: 'Mystery' },
];

const webCards = [
  {
    id: 'b055win',
    group: 'play',
    title: 'Professional Pop-up Closer',
    text: 'Three shields, zero unwanted toolbars. The pop-up from 2002 is finally closed. This is a souvenir of your Arcade adventure, not a prize or competition entry.',
  },
  {
    id: 'bug5afe',
    group: 'play',
    title: 'Paperclip Containment Unit',
    text: 'It looks like you are trying to contain a paperclip. Would you like help with that? Too late. You already did. A playful Arcade souvenir, not a prize or competition entry.',
  },
  {
    id: 'cd2002x',
    group: 'play',
    title: 'World Wide Weird Restored',
    text: 'Your download is finally 100% complete. The glitter cursor is loose and the guestbook is open. Welcome back to 2002. A playful Arcade souvenir, not a prize or competition entry.',
  },
  {
    id: 'cr3w8up',
    group: 'web',
    title: 'Crew Cache',
    text: 'Behind every smooth event is a team with 47 browser tabs open. Say hello to someone making today happen. No quest required, just good vibes.',
  },
  {
    id: 'f00t3rx',
    group: 'web',
    title: 'End Credits',
    text: 'You scrolled past the end. The internet awards you one imaginary floppy disk. Please do not save over your homework.',
  },
  {
    id: 'p3ek7up',
    group: 'web',
    title: 'Shy Browser Tab',
    text: 'You pulled me out of the sidebar! I was hiding from the 99 other tabs. Build a browser tab that asks for a tiny holiday.',
  },
  // Website entry and deliberate Easter eggs.
  {
    id: 'y6597cd',
    group: 'web',
    title: 'Welcome Disc',
    text: 'You found the first disc. Check the DevFest programme for a detail that feels a few decades out of date.',
  },
  {
    id: 'wkyb3kc',
    group: 'web',
    title: 'Dial-up Clock',
    text: 'Your modem would like five more minutes. For faster service, follow the smell of coffee.',
  },
  {
    id: '2ejjjgf',
    group: 'web',
    title: 'Loading Screen Glitch',
    text: 'Give a loading screen a personality. What does it say when it gets to 99% and starts doubting itself?',
  },
  {
    id: 'auxq7ah',
    group: 'web',
    title: 'Random Access',
    text: 'Invent a browser toolbar that grants one deeply unnecessary superpower. How many pixels does it take to activate?',
  },
  {
    id: 'jwvxcv9',
    group: 'web',
    title: 'Check the Frequency',
    text: 'Somewhere in the static there’s a good packet. See if you can catch it.',
    game: 'signal',
  },
  // Direct links for the activity hosts.
  {
    id: 'pvbusdb',
    group: 'play',
    title: 'Chaos Cartridge',
    text: 'Build a screensaver for a dial-up internet café. Give it one button that makes everything worse in a funny way.',
  },
  {
    id: 'rmz75w8',
    group: 'play',
    title: 'Signal Catcher',
    text: 'Your modem is sending one good packet. Catch it before the connection drops.',
    game: 'signal',
  },
];

const previewCards = [
  {
    id: 'esmvnrm',
    group: 'preview',
    title: 'Timed Card Test',
    text: 'You revealed an active preview card. This test stamp is separate from the event’s finds.',
    opensAt: Date.parse('2026-11-18T00:00:00+01:00'),
    closesAt: Date.parse('2026-11-30T00:00:00+01:00'),
  },
  {
    id: 'z9swftn',
    group: 'preview',
    title: 'Future Card Test',
    text: 'This preview fixture is here to check the opens-later state.',
    opensAt: Date.parse('2026-12-31T00:00:00+01:00'),
    closesAt: Date.parse('2026-12-31T01:00:00+01:00'),
  },
  {
    id: '96wt9u8',
    group: 'preview',
    title: 'Expired Card Test',
    text: 'This preview fixture is here to check the expired state.',
    opensAt: Date.parse('2026-11-17T00:00:00+01:00'),
    closesAt: Date.parse('2026-11-17T01:00:00+01:00'),
  },
];

export function readPhysicalCards(serialized) {
  const cards = JSON.parse(serialized);
  if (!Array.isArray(cards) || !cards.length)
    throw new Error('Missing physical card configuration');

  const knownIds = new Set([...webCards, ...previewCards].map(({ id }) => id));
  const groupIds = new Set(groups.map(({ id }) => id));
  return cards.map((card) => {
    const { id, group, title, text, game, opensAt, closesAt } = card;
    if (
      typeof id !== 'string' ||
      !/^[a-z0-9]{7}$/.test(id) ||
      knownIds.has(id) ||
      !groupIds.has(group) ||
      typeof title !== 'string' ||
      !title.trim() ||
      typeof text !== 'string' ||
      !text.trim() ||
      (game !== undefined && game !== 'signal')
    ) {
      throw new Error('Invalid physical card configuration');
    }
    knownIds.add(id);

    const metadata = { id, group, title, text, game };
    if (opensAt === undefined && closesAt === undefined) return metadata;

    const hasOffset = (date) => typeof date === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(date);
    if (!hasOffset(opensAt) || !hasOffset(closesAt))
      throw new Error('Missing timed card UTC offset');

    const openTime = Date.parse(opensAt);
    const closeTime = Date.parse(closesAt);
    if (!(openTime < closeTime)) throw new Error('Invalid timed card window');
    return { ...metadata, opensAt: openTime, closesAt: closeTime };
  });
}

export function createCatalog(physicalCards, includePreview) {
  const eventCards = [...webCards, ...physicalCards];
  const cards = includePreview ? [...eventCards, ...previewCards] : eventCards;
  return {
    byId: new Map(cards.map((card) => [card.id, card])),
    groups: groups.map((group) => ({
      ...group,
      count: eventCards.filter((card) => card.group === group.id).length,
    })),
  };
}
