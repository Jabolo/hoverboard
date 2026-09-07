import { Badge } from './badge';
import { Day } from './day';
import { MemberData } from './member';
import { PartnerData } from './partner';
import { PartnerGroupData } from './partner-group';
import { PostData } from './post';
import { PreviousSpeaker } from './previous-speaker';
import { PreviousSession } from './previous-session';
import { SessionData } from './session';
import { Social } from './social';
import { SpeakerData } from './speaker';
import { Ticket } from './ticket';
import { Timeslot } from './timeslot';
import { Track } from './track';
import { Video } from './video';

const socials: Social[] = [
  { icon: 'linkedin', link: 'https://www.linkedin.com', name: 'LinkedIn' },
  { icon: 'website', link: 'https://example.com', name: 'Website' },
];

const badges: Badge[] = [
  { description: 'LinkedIn', link: 'https://www.linkedin.com', name: 'linkedin' },
  { description: 'Website', link: 'https://example.com', name: 'website' },
];

export const defaultBadges = badges;
export const defaultSocials: Social[] = [
  ...socials,
  { icon: 'youtube', link: 'https://www.youtube.com', name: 'YouTube' },
  { icon: 'github', link: 'https://github.com', name: 'GitHub' },
];

export const defaultDays: Day[] = Array.from({ length: 2 }, (_, index) => ({
  date: `2026-11-${21 + index}`,
  dateReadable: `November ${21 + index}, 2026`,
  timeslots: [],
  tracks: [],
}));

export const defaultMembers: MemberData[] = Array.from({ length: 8 }, (_, index) => ({
  name: `Volunteer ${index + 1}`,
  order: index,
  photo: '/images/organizer-logo.svg',
  photoUrl: '/images/organizer-logo.svg',
  socials,
  title: 'Community volunteer',
}));

const partner = (index: number): PartnerData => ({
  logoUrl: '/images/logos/gdg-x.svg',
  name: `Community partner ${index + 1}`,
  order: index,
  url: 'https://developers.google.com/groups/',
});

export const defaultPartnerGroups: PartnerGroupData[] = [
  { items: [partner(0)], order: 0, title: 'Community' },
  { items: Array.from({ length: 11 }, (_, index) => partner(index)), order: 1, title: 'Partners' },
];

export const defaultPosts: PostData[] = Array.from({ length: 5 }, (_, index) => ({
  backgroundColor: '#4285F4',
  brief: `Community update ${index + 1}`,
  content: `Content for community update ${index + 1}`,
  image: '/images/backgrounds/home-2026.png',
  published: '2026-01-01',
  source: 'GDG Warsaw',
  title: `Community update ${index + 1}`,
}));

export const defaultPreviousSpeakers: PreviousSpeaker[] = Array.from(
  { length: 22 },
  (_, index) => ({
    bio: 'Technology community speaker.',
    company: 'Community',
    companyLogo: '/images/logos/gdg-x.svg',
    country: 'Poland',
    id: `previous-speaker-${index + 1}`,
    name: `Previous speaker ${index + 1}`,
    order: index,
    photoUrl: '/images/organizer-logo.svg',
    sessions: {},
    socials,
    title: 'Developer',
  }),
);

export const defaultSessions: SessionData[] = Array.from({ length: 40 }, (_, index) => ({
  complexity: 'intermediate',
  description: `A technology session for the community, example ${index + 1}.`,
  extend: 45,
  icon: 'web',
  image: '/images/backgrounds/home-2026.png',
  language: 'English',
  presentation: 'https://example.com/presentation',
  speakers: [`speaker-${index + 1}`],
  tags: ['technology'],
  title: `Technology session ${index + 1}`,
  videoId: `video-${index + 1}`,
}));

export const defaultSpeakers: SpeakerData[] = Array.from({ length: 27 }, (_, index) => ({
  badges,
  bio: 'Technology community speaker.',
  company: 'Community',
  companyLogo: '/images/logos/gdg-x.svg',
  companyLogoUrl: '/images/logos/gdg-x.svg',
  country: 'Poland',
  featured: index < 4,
  name: `Speaker ${index + 1}`,
  order: index,
  photo: '/images/organizer-logo.svg',
  photoUrl: '/images/organizer-logo.svg',
  pronouns: 'they/them',
  shortBio: 'Technology community speaker.',
  socials,
  title: 'Developer',
}));

export const defaultTickets: Ticket[] = Array.from({ length: 5 }, (_, index) => ({
  available: index === 0,
  currency: 'zł',
  ends: 'November 21, 2026',
  inDemand: index === 1,
  info: 'Example ticket data for model tests.',
  name: `Ticket ${index + 1}`,
  price: index * 10,
  primary: index === 2,
  regular: index > 0,
  soldOut: index === 4,
  starts: 'September 1, 2026',
  url: 'https://example.com/tickets',
}));

export const defaultTimes: Array<{ extend: number; items: string[] }> = [
  { extend: 30, items: ['session-1'] },
  { extend: 45, items: ['session-2'] },
  { extend: 60, items: ['session-3'] },
];

export const defaultTimeslots: Timeslot[] = Array.from({ length: 13 }, (_, index) => ({
  endTime: `${index + 1}:30`,
  sessions: [],
  startTime: `${index + 1}:00`,
}));

export const defaultTracks: Track[] = [{ title: 'Web' }, { title: 'Cloud' }, { title: 'Mobile' }];

export const defaultPreviousSessions: PreviousSession[] = [
  {
    presentation: 'https://example.com/presentation',
    tags: ['technology'],
    title: 'A community technology session',
    videoId: 'example-video',
  },
];

export const defaultVideos: Video[] = Array.from({ length: 22 }, (_, index) => ({
  speakers: `Speaker ${index + 1}`,
  thumbnail: '/images/backgrounds/home-2026.png',
  title: `Community highlight ${index + 1}`,
  youtubeId: `video-${index + 1}`,
}));

export const defaultTeams: Array<{ members: MemberData[]; title: string }> = [
  { members: defaultMembers, title: 'Community volunteers' },
  { members: defaultMembers, title: 'Event team' },
];
