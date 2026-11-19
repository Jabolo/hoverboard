import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  getHuntProgress,
  HUNT_STORAGE_KEY,
  huntStorageAvailable,
  huntGroups,
  mergeHuntProgress,
  normalizeHuntCode,
  parseHuntProgressEntry,
  rememberHuntCard,
  requestHuntCard,
} from './hunt-store';

const first = { id: 'test001', group: 'mystery', title: 'Test card' };
const second = { id: 'test002', group: 'mystery', title: 'Another card' };

beforeEach(() => localStorage.clear());

describe('browser card collection', () => {
  it('deduplicates found and earned records while keeping finds from other tabs', () => {
    rememberHuntCard({ status: 'open', card: first });
    rememberHuntCard({ status: 'open', card: second });
    rememberHuntCard({ status: 'earned', card: { ...first, text: 'You found it.' } });
    rememberHuntCard({ status: 'open', card: first });
    expect(getHuntProgress()).toEqual([
      expect.objectContaining({ state: 'earned', card: { ...first, text: 'You found it.' } }),
      expect.objectContaining({ state: 'found', card: second }),
    ]);
  });

  it('ignores bad saved records and removes earlier progress when site data is cleared', () => {
    localStorage.setItem(`${HUNT_STORAGE_KEY}:found:test002`, '{');
    rememberHuntCard({ status: 'open', card: first });
    expect(getHuntProgress()).toHaveLength(1);
    localStorage.clear();
    expect(getHuntProgress()).toEqual([]);
  });

  it('keeps a find in memory when writing to storage fails', () => {
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    rememberHuntCard({ status: 'open', card: first });
    expect(getHuntProgress()).toEqual([expect.objectContaining({ state: 'found', card: first })]);
    expect(huntStorageAvailable()).toBe(false);
    write.mockRestore();
  });

  it('validates case-insensitive entry codes before requesting a card', async () => {
    expect(normalizeHuntCode(' TEST001 ')).toBe('test001');
    expect(normalizeHuntCode('../../test001')).toBe('');
    await expect(requestHuntCard('not a code')).resolves.toEqual({ status: 'invalid' });
  });
});

it('combines devices without downgrading an earned card to an unopened find', () => {
  const found = { state: 'found' as const, card: first, foundAt: 1 };
  const earned = {
    state: 'earned' as const,
    card: { ...first, text: 'Found' },
    foundAt: 1,
    earnedAt: 2,
  };
  const other = { state: 'found' as const, card: second, foundAt: 3 };
  expect(mergeHuntProgress([found, other], [earned])).toEqual([earned, other]);
  expect(mergeHuntProgress([earned], [found, other])).toEqual([earned, other]);
});

it('rejects malformed records before they can appear in a synced collection', () => {
  expect(
    parseHuntProgressEntry({ state: 'earned', card: first, foundAt: 1, earnedAt: 2 }),
  ).toBeNull();
  expect(
    parseHuntProgressEntry({ state: 'found', card: { ...first, id: '../oops' }, foundAt: 1 }),
  ).toBeNull();
  expect(parseHuntProgressEntry({ state: 'found', card: first, foundAt: Infinity })).toBeNull();
});

it('sends the same-origin session on collection, card, and reveal requests', async () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  } as Response);
  global.fetch = fetchMock;
  try {
    await huntGroups();
    await requestHuntCard('test001');
    await requestHuntCard('test001', 'POST');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toEqual(
        expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
      );
    }
  } finally {
    global.fetch = originalFetch;
  }
});

it('notifies the gate when a card session has expired', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue({ ok: false, status: 401 } as Response);
  const listener = jest.fn();
  window.addEventListener('hunt-access-expired', listener);
  try {
    await expect(requestHuntCard('test001')).resolves.toEqual({ status: 'unavailable' });
    expect(listener).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener('hunt-access-expired', listener);
    global.fetch = originalFetch;
  }
});
