import type { Session } from '../models/session';
import type { Speaker, SpeakerData } from '../models/speaker';

export const CURATED_PREVIEW_SPEAKER_IDS = [
  'ivan-lapa',
  'hasan-rafiq',
  'andrii-khrystian',
  'dominika-zajac',
] as const;

/** Keep the local homepage editorial selection stable, independent of record order. */
export function curatedPreviewSpeakers(speakers: Speaker[]): Speaker[] {
  const byId = new Map(speakers.map((speaker) => [speaker.id, speaker]));
  return CURATED_PREVIEW_SPEAKER_IDS.flatMap((id) => {
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
