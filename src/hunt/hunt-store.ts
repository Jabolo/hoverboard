export type HuntGroup = { id: string; label: string; count: number; hint?: string };
export type HuntCard = { id: string; title: string; group: string };
export type EarnedHuntCard = HuntCard & { text: string; game?: 'signal' };
export type HuntResult =
  | { status: 'open'; card: HuntCard }
  | { status: 'earned'; card: EarnedHuntCard }
  | { status: 'future' | 'expired' | 'invalid' | 'unavailable' };
export type HuntProgressEntry =
  | { state: 'found'; card: HuntCard; foundAt: number }
  | { state: 'earned'; card: EarnedHuntCard; foundAt: number; earnedAt: number };
type StorableResult = Extract<HuntResult, { status: 'open' | 'earned' }>;

export const HUNT_STORAGE_KEY = 'devfest-warsaw-2026-hunt:v1';
const codePattern = /^[a-z0-9]{7}$/;
const memory = new Map<string, HuntProgressEntry>();
let storageFailed = false;
const perfectRuns = new Set<string>();

export function hasHuntPerfect(id: string): boolean {
  if (perfectRuns.has(id)) return true;
  try {
    return window.localStorage.getItem(`${HUNT_STORAGE_KEY}:perfect:${id}`) === 'true';
  } catch {
    return false;
  }
}

export function rememberHuntPerfect(id: string): void {
  if (!codePattern.test(id)) return;
  try {
    window.localStorage.setItem(`${HUNT_STORAGE_KEY}:perfect:${id}`, 'true');
  } catch {
    perfectRuns.add(id);
    storageFailed = true;
  }
}

export function normalizeHuntCode(value: string): string {
  const code = value.trim().toLowerCase();
  return codePattern.test(code) ? code : '';
}

export function huntCardPath(code: string): string {
  return `/hunt/c/${normalizeHuntCode(code)}/`;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cardSummary(value: unknown): HuntCard | null {
  if (!record(value)) return null;
  const { id, title, group } = value;
  if (typeof id !== 'string' || !codePattern.test(id)) return null;
  if (typeof title !== 'string' || !title || typeof group !== 'string' || !group) return null;
  return { id, title, group };
}

function earnedCard(value: unknown): EarnedHuntCard | null {
  const summary = cardSummary(value);
  if (!summary || !record(value) || typeof value['text'] !== 'string') return null;
  const card: EarnedHuntCard = { ...summary, text: value['text'] };
  if (value['game'] === 'signal') card.game = 'signal';
  return card;
}

function entryKey(entry: HuntProgressEntry) {
  // Found and earned keys are independent. A simultaneous scan cannot overwrite a reveal.
  return `${HUNT_STORAGE_KEY}:${entry.state}:${entry.card.id}`;
}

function parseEntry(value: unknown): HuntProgressEntry | null {
  if (!record(value)) return null;
  const { state, card, foundAt, earnedAt } = value;
  if (typeof foundAt !== 'number' || !Number.isFinite(foundAt)) return null;
  if (state === 'found') {
    const summary = cardSummary(card);
    return summary && { state, card: summary, foundAt };
  }
  if (state === 'earned' && typeof earnedAt === 'number' && Number.isFinite(earnedAt)) {
    const revealed = earnedCard(card);
    return revealed && { state, card: revealed, foundAt, earnedAt };
  }
  return null;
}

export function getHuntProgress(): HuntProgressEntry[] {
  const entries = new Map(memory);
  try {
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(`${HUNT_STORAGE_KEY}:`)) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      try {
        const entry = parseEntry(JSON.parse(raw));
        if (entry && entryKey(entry) === key) entries.set(key, entry);
      } catch {
        // A corrupt card record does not affect the collection's other records.
      }
    }
  } catch {
    storageFailed = true;
  }

  const cards = new Map<string, HuntProgressEntry>();
  for (const entry of entries.values()) {
    if (entry.state === 'earned' || !cards.has(entry.card.id)) cards.set(entry.card.id, entry);
  }
  return Array.from(cards.values());
}

export function huntStorageAvailable(): boolean {
  if (storageFailed) return false;
  try {
    void window.localStorage.length;
    return true;
  } catch {
    return false;
  }
}

export function rememberHuntCard(result: StorableResult): void {
  const previous = getHuntProgress().find(({ card }) => card.id === result.card.id);
  if (previous?.state === 'earned' || (previous && result.status === 'open')) return;
  const now = Date.now();
  const entry: HuntProgressEntry =
    result.status === 'earned'
      ? {
          state: 'earned',
          card: result.card,
          foundAt: previous?.foundAt ?? now,
          earnedAt: now,
        }
      : { state: 'found', card: result.card, foundAt: now };
  const key = entryKey(entry);
  // Hold a copy only when a write fails. That way, clearing site data clears saved cards.
  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
    memory.delete(key);
  } catch {
    memory.set(key, entry);
    storageFailed = true;
  }
}

async function huntRequest(path: string, method: 'GET' | 'POST', signal?: AbortSignal) {
  try {
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: signal ?? null,
    });
    if (response.status === 401) window.dispatchEvent(new Event('hunt-access-expired'));
    if (!response.ok && response.status !== 404) return null;
    const data: unknown = await response.json();
    return record(data) ? data : null;
  } catch {
    return null;
  }
}

export async function huntGroups(signal?: AbortSignal): Promise<HuntGroup[] | null> {
  const data = await huntRequest('/api/hunt/collection', 'GET', signal);
  const groups: unknown = data?.['groups'];
  if (!Array.isArray(groups)) return null;
  const result: HuntGroup[] = [];
  for (const group of groups as unknown[]) {
    if (!record(group)) return null;
    const { id, label, count, hint } = group;
    if (typeof id !== 'string' || typeof label !== 'string' || typeof count !== 'number')
      return null;
    if (!Number.isSafeInteger(count) || count < 0) return null;
    if (typeof hint === 'string') result.push({ id, label, count, hint });
    else result.push({ id, label, count });
  }
  return result;
}

export async function requestHuntCard(
  token: string,
  method: 'GET' | 'POST' = 'GET',
  signal?: AbortSignal,
): Promise<HuntResult> {
  const code = normalizeHuntCode(token);
  if (!code) return { status: 'invalid' };
  const data = await huntRequest(`/api/hunt/card/${code}`, method, signal);
  const status = data?.['status'];
  if (status === 'invalid' || status === 'future' || status === 'expired') return { status };
  if (status === 'open' && method === 'GET') {
    const card = cardSummary(data?.['card']);
    if (card?.id === code) return { status, card };
  }
  if (status === 'earned' && method === 'POST') {
    const card = earnedCard(data?.['card']);
    if (card?.id === code) return { status, card };
  }
  return { status: 'unavailable' };
}
