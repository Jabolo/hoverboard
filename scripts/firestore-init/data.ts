import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type PartnerSeed = {
  title: string;
  order: number;
  items: Array<Record<string, unknown>>;
};

type TeamSeed = {
  title: string;
  members: Array<Record<string, unknown>>;
};

export type FirebaseSeedData = {
  blog: Record<string, Record<string, unknown>>;
  config: Record<string, Record<string, unknown>>;
  gallery: string[];
  partners: PartnerSeed[];
  previousSpeakers: Record<string, Record<string, unknown>>;
  schedule: Record<string, Record<string, unknown>>;
  sessions: Record<string, Record<string, unknown>>;
  speakers: Record<string, Record<string, unknown>>;
  team: TeamSeed[];
  tickets: Array<Record<string, unknown>>;
  videos: Array<Record<string, unknown>>;
};

const seedData = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/default-firebase-data.json'), 'utf8'),
);

export const data = seedData as FirebaseSeedData;
