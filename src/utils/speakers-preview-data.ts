import type { Session, SessionData } from '../models/session';
import type { Speaker, SpeakerData } from '../models/speaker';

export type GeneratedPreviewSession = Omit<Session, 'speakers'> & {
  speakers: Speaker[];
  mainTag: string;
};
export type GeneratedPreviewSpeaker = Speaker & {
  tags: string[];
  sessions: (Session & { mainTag: string })[];
};
export interface PreviewSource {
  speakers: Record<string, SpeakerData>;
  sessions: Record<string, SessionData>;
}
export interface PreviewCollections {
  generatedSpeakers: GeneratedPreviewSpeaker[];
  generatedSessions: GeneratedPreviewSession[];
  generatedSchedule: never[];
}

/** Reproduce Hoverboard's generated relationship shape without any timetable fields. */
export function generatePreviewData(source: PreviewSource): PreviewCollections {
  if (!source || !source.speakers || !source.sessions) throw new Error('Missing preview records');
  const speakers: Record<string, GeneratedPreviewSpeaker> = {};
  for (const [id, raw] of Object.entries(source.speakers)) {
    if (!raw.name?.trim()) throw new Error(`Missing name for ${id}`);
    if (!raw.photoUrl?.startsWith('/preview/speakers/')) {
      throw new Error(`Portrait must be local for ${id}`);
    }
    if (raw.companyLogoUrl && !raw.companyLogoUrl.startsWith('/preview/logos/')) {
      throw new Error(`Company logo must be local for ${id}`);
    }
    speakers[id] = {
      id,
      name: raw.name,
      bio: raw.bio || '',
      shortBio: raw.shortBio || '',
      company: raw.company || '',
      companyLogo: raw.companyLogoUrl || '',
      companyLogoUrl: raw.companyLogoUrl || '',
      companyLogoBackground: raw.companyLogoBackground === 'dark' ? 'dark' : 'light',
      country: raw.country || '',
      sessionRoles: raw.sessionRoles || {},
      title: raw.title || '',
      photo: raw.photoUrl,
      photoUrl: raw.photoUrl,
      order: raw.order ?? 0,
      featured: !!raw.featured,
      socials: raw.socials || [],
      badges: raw.badges || [],
      tags: [],
      sessions: [],
    };
  }
  const sessions: GeneratedPreviewSession[] = [];
  for (const [id, raw] of Object.entries(source.sessions)) {
    if (!raw.title?.trim() || !raw.description?.trim() || !raw.speakers?.length) {
      throw new Error(`Incomplete session ${id}`);
    }
    if (new Set(raw.speakers).size !== raw.speakers.length) {
      throw new Error(`Duplicate speakers in ${id}`);
    }
    const session: Session & { mainTag: string } = {
      id,
      title: raw.title,
      description: raw.description,
      speakers: raw.speakers,
      tags: raw.tags || [],
      mainTag: raw.tags?.[0] || 'General',
      ...(raw.language ? { language: raw.language } : {}),
      ...(raw.complexity ? { complexity: raw.complexity } : {}),
    };
    const embedded = raw.speakers.map((speakerId) => {
      const speaker = speakers[speakerId];
      if (!speaker) throw new Error(`Unknown speaker ${speakerId} in ${id}`);
      speaker.sessions.push(session);
      speaker.tags = [...new Set([...speaker.tags, ...(session.tags || [])])];
      // Embedded speakers match the generator's base speaker records, without recursive sessions.
      const { sessions: _sessions, tags: _tags, ...base } = speaker;
      return base;
    });
    sessions.push({ ...session, speakers: embedded });
  }
  for (const speaker of Object.values(speakers)) {
    if (!speaker.sessions.length) throw new Error(`Speaker ${speaker.id} has no session`);
  }
  return {
    generatedSpeakers: Object.values(speakers).sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name),
    ),
    generatedSessions: sessions.sort((a, b) => a.id.localeCompare(b.id)),
    generatedSchedule: [],
  };
}

export function isSpeakersPreview(buildFlag: string, hostname: string): boolean {
  if (buildFlag === '1') {
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
  }
  if (buildFlag === 'tomek') {
    return /^gdg-warsaw-devfest26-web--speakers-tomek-2026-[a-z0-9]+\.web\.app$/.test(hostname);
  }
  if (buildFlag === 'comparison') {
    return /^gdg-warsaw-devfest26-web--cards-v2-2026-[a-z0-9]+\.web\.app$/.test(hostname);
  }
  return (
    buildFlag === 'review' &&
    /^gdg-warsaw-devfest26-web--speakers-review-2026-[a-z0-9]+\.web\.app$/.test(hostname)
  );
}

export function resolveSpeakersPreview(buildFlag: string, hostname: string): boolean {
  const enabled = isSpeakersPreview(buildFlag, hostname);
  if (['1', 'review', 'comparison', 'tomek'].includes(buildFlag) && !enabled) {
    throw new Error('Speaker review preview is not allowed on this host');
  }
  return enabled;
}

/** Preserve each approved roster boundary when a preview is rebuilt. */
export function expectedPreviewRoster(buildFlag: string): { speakers: number; sessions: number } {
  return buildFlag === 'tomek' || buildFlag === '1'
    ? { speakers: 13, sessions: 9 }
    : { speakers: 12, sessions: 8 };
}
