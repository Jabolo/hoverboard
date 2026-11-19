import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  getHuntProgress,
  HUNT_STORAGE_KEY,
  huntStorageAvailable,
  normalizeHuntCode,
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
