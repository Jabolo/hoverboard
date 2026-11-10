/** Anonymous favourites are scoped to this browser and this site origin. */
const STORAGE_PREFIX = 'devfest-2026:favorite:';
const unsaved = new Map<string, boolean>();
const listeners = new Set<() => void>();

function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(sessionId)}`;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key === null) {
    unsaved.clear();
  } else if (event.key.startsWith(STORAGE_PREFIX)) {
    try {
      unsaved.delete(decodeURIComponent(event.key.slice(STORAGE_PREFIX.length)));
    } catch {
      return;
    }
  } else {
    return;
  }
  notify();
}

/** Null means untouched; false is an explicit removal, including an unsaved one. */
export function getSessionFavoriteState(sessionId: string): boolean | null {
  if (!sessionId) return null;
  if (unsaved.has(sessionId)) return unsaved.get(sessionId) === true;
  try {
    const value = window.localStorage.getItem(storageKey(sessionId));
    return value === '1' ? true : value === '0' ? false : null;
  } catch {
    return null;
  }
}

/** Returns the current selection, including unsaved in-memory changes if storage failed. */
export function isSessionFavorite(sessionId: string): boolean {
  return getSessionFavoriteState(sessionId) === true;
}

/** Returns true only when the change was stored persistently in this browser. */
export function setSessionFavorite(sessionId: string, selected: boolean): boolean {
  if (!sessionId) return false;
  let persisted = false;
  try {
    window.localStorage.setItem(storageKey(sessionId), selected ? '1' : '0');
    unsaved.delete(sessionId);
    persisted = true;
  } catch {
    unsaved.set(sessionId, selected);
  }
  notify();
  return persisted;
}

/** Import a legacy selection without replacing any local choice or inventing a user toggle. */
export function importSessionFavorite(sessionId: string): boolean {
  if (!sessionId || unsaved.has(sessionId)) return false;
  try {
    const key = storageKey(sessionId);
    const current = window.localStorage.getItem(key);
    if (current === '1' || current === '0') return true;
    window.localStorage.setItem(key, '1');
    notify();
    return true;
  } catch {
    return false;
  }
}

/** Observes both this tab and changes made by other tabs of the same origin. */
export function subscribeSessionFavorites(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}
