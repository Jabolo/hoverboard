import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  getSessionFavoriteState,
  importSessionFavorite,
  isSessionFavorite,
  setSessionFavorite,
  subscribeSessionFavorites,
} from './session-favorites';

describe('browser session favourites', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists independent choices and explicit removals by session ID', () => {
    expect(getSessionFavoriteState('PANEL-01')).toBeNull();
    expect(setSessionFavorite('PANEL-01', true)).toBe(true);
    expect(isSessionFavorite('PANEL-01')).toBe(true);
    expect(isSessionFavorite('CFP-014')).toBe(false);
    expect(setSessionFavorite('PANEL-01', false)).toBe(true);
    expect(getSessionFavoriteState('PANEL-01')).toBe(false);
    expect(window.localStorage.getItem('devfest-2026:favorite:PANEL-01')).toBe('0');
  });

  it('notifies listeners in the current tab and for relevant cross-tab events', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSessionFavorites(listener);
    setSessionFavorite('CFP-014', true);
    expect(listener).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', newValue: '1' }));
    expect(listener).toHaveBeenCalledTimes(1);
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'devfest-2026:favorite:CFP-014', newValue: '0' }),
    );
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setSessionFavorite('CFP-014', false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps unsaved changes in memory when storage is blocked, without claiming persistence', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(setSessionFavorite('blocked-test', true)).toBe(false);
    expect(isSessionFavorite('blocked-test')).toBe(true);
    expect(setSessionFavorite('blocked-test', false)).toBe(false);
    expect(getSessionFavoriteState('blocked-test')).toBe(false);
    expect(importSessionFavorite('blocked-test')).toBe(false);
    expect(importSessionFavorite('blocked-import')).toBe(false);
    expect(getSessionFavoriteState('blocked-import')).toBeNull();
  });

  it('imports only untouched choices and preserves deliberate removals', () => {
    setSessionFavorite('existing-removal', false);
    expect(importSessionFavorite('existing-removal')).toBe(true);
    expect(getSessionFavoriteState('existing-removal')).toBe(false);
    expect(importSessionFavorite('new-import')).toBe(true);
    expect(getSessionFavoriteState('new-import')).toBe(true);
  });
});
