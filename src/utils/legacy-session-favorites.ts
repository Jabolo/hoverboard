import { importSessionFavorite } from './session-favorites';

const MIGRATION_PREFIX = 'devfest-2026:favorite-import:';

/** Import prior account bookmarks into this browser once, without changing the account. */
export function importLegacySessionFavorites(
  userId: string,
  featuredSessions: Record<string, unknown>,
): boolean {
  if (!userId) return false;
  const marker = `${MIGRATION_PREFIX}${encodeURIComponent(userId)}`;
  try {
    if (window.localStorage.getItem(marker) === '1') return true;
  } catch {
    return false;
  }

  let persisted = true;
  for (const [id, selected] of Object.entries(featuredSessions)) {
    if (!id || selected !== true) continue;
    if (!importSessionFavorite(id)) persisted = false;
  }
  if (!persisted) return false;

  try {
    window.localStorage.setItem(marker, '1');
    return true;
  } catch {
    return false;
  }
}
