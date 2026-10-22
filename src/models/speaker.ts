import { Badge } from './badge';
import { Social } from './social';
import { Id } from './types';
import type { Session } from './session';

export interface SpeakerData {
  badges?: Badge[];
  bio: string;
  company: string;
  companyLogo: string;
  companyLogoUrl: string;
  companyLogoBackground?: 'light' | 'dark';
  country: string;
  featured: boolean;
  name: string;
  order: number;
  photo: string;
  photoUrl: string;
  animatedPhotoUrl?: string;
  pronouns?: string;
  shortBio: string;
  socials: Social[];
  title: string;
  sessions?: Session[];
  sessionRoles?: Record<string, 'Moderator' | 'Panellist'>;
}

export type Speaker = Id & SpeakerData;

export type SpeakerWithTags = Speaker & {
  tags: string[];
};
