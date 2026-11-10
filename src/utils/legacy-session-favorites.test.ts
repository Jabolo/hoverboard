import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { importLegacySessionFavorites } from './legacy-session-favorites';
import { isSessionFavorite, setSessionFavorite } from './session-favorites';

describe('legacy bookmark import', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('imports true bookmarks once without restoring a removed selection later', () => {
    expect(importLegacySessionFavorites('account-a', { talkA: true, talkB: false })).toBe(true);
    expect(isSessionFavorite('talkA')).toBe(true);
    expect(isSessionFavorite('talkB')).toBe(false);
    expect(setSessionFavorite('talkA', false)).toBe(true);
    expect(importLegacySessionFavorites('account-a', { talkA: true })).toBe(true);
    expect(isSessionFavorite('talkA')).toBe(false);
  });

  it('respects explicit local choices including removal while the account request was pending', () => {
    setSessionFavorite('pending-removal', false);
    setSessionFavorite('existing-choice', true);
    expect(
      importLegacySessionFavorites('account-b', {
        'pending-removal': true,
        'existing-choice': true,
        'new-choice': true,
      }),
    ).toBe(true);
    expect(isSessionFavorite('pending-removal')).toBe(false);
    expect(isSessionFavorite('existing-choice')).toBe(true);
    expect(isSessionFavorite('new-choice')).toBe(true);
  });

  it('tracks accounts separately while respecting the same local choices', () => {
    expect(importLegacySessionFavorites('account-c', { first: true })).toBe(true);
    expect(importLegacySessionFavorites('account-d', { second: true })).toBe(true);
    expect(isSessionFavorite('first')).toBe(true);
    expect(isSessionFavorite('second')).toBe(true);
  });

  it('does not mark an import complete if browser storage fails, and retries safely', () => {
    const original = window.localStorage.setItem.bind(window.localStorage);
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      if (key === 'devfest-2026:favorite:retry-talk') throw new Error('Quota exceeded');
      return original(key, value);
    });
    expect(importLegacySessionFavorites('account-e', { 'retry-talk': true })).toBe(false);
    expect(window.localStorage.getItem('devfest-2026:favorite-import:account-e')).toBeNull();
    setItem.mockRestore();
    expect(importLegacySessionFavorites('account-e', { 'retry-talk': true })).toBe(true);
    expect(isSessionFavorite('retry-talk')).toBe(true);
  });

  it('does not complete when access to storage is denied', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    expect(importLegacySessionFavorites('account-f', { unseen: true })).toBe(false);
  });
});
