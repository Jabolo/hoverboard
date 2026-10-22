import type { Session } from '../models/session';
import type { Speaker, SpeakerData } from '../models/speaker';

export const CURATED_SPEAKER_IDS = [
  'ivan-lapa',
  'hasan-rafiq',
  'andrii-khrystian',
  'dominika-zajac',
] as const;

/** Keep the homepage editorial selection stable, independent of record order. */
export function curatedSpeakers(speakers: Speaker[]): Speaker[] {
  const byId = new Map(speakers.map((speaker) => [speaker.id, speaker]));
  return CURATED_SPEAKER_IDS.flatMap((id) => {
    const speaker = byId.get(id);
    return speaker ? [speaker] : [];
  });
}

export interface SpeakerSessionLink {
  id: string;
  title: string;
  href: string;
  label: string;
}

/** A shared panel remains one session; each person carries their own participation role. */
export function speakerSessionLinks(
  sessions: Session[] = [],
  roles: SpeakerData['sessionRoles'] = {},
): SpeakerSessionLink[] {
  const seen = new Set<string>();
  return sessions.flatMap((session) => {
    if (!session.id || !session.title?.trim() || seen.has(session.id)) return [];
    seen.add(session.id);
    const role = roles[session.id];
    return [
      {
        id: session.id,
        title: session.title,
        href: `/sessions/${encodeURIComponent(session.id)}`,
        label: role
          ? `${role} · Shared panel`
          : session.id === 'PANEL-01'
            ? 'Shared panel'
            : 'Session',
      },
    ];
  });
}

/** Give the link, rather than its decorative icon, an unambiguous accessible name. */
export function speakerSocialLabel(
  speakerName = '',
  socialName = '',
  icon = '',
  link = '',
): string {
  const names: Record<string, string> = {
    github: 'GitHub',
    linkedin: 'LinkedIn',
    twitter: 'X / Twitter',
    youtube: 'YouTube',
    facebook: 'Facebook',
    instagram: 'Instagram',
    website: 'website',
  };
  const service = names[icon.toLowerCase()] || socialName.trim() || 'website';
  let destination = '';
  if (icon === 'website' && link) {
    try {
      destination = ` (${new URL(link).hostname.replace(/^www\./, '')})`;
    } catch {
      /* Label remains useful for malformed source URLs. */
    }
  }
  return `Visit ${speakerName.trim() || 'speaker'} on ${service}${destination} (opens in a new tab)`;
}
