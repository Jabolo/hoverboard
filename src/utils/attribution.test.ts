import { afterEach, describe, expect, it } from '@jest/globals';
import { getAttributionParams } from './attribution';

describe('attribution', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    window.sessionStorage.clear();
  });

  it('keeps campaign and Evenea partner params during SPA navigation', () => {
    window.history.replaceState(
      {},
      '',
      '/?utm_source=bevy&utm_medium=partner&utm_campaign=devfest_warsaw_2026&source=Bevy-GDG-Community',
    );

    expect(getAttributionParams()).toEqual({
      utm_source: 'bevy',
      utm_medium: 'partner',
      utm_campaign: 'devfest_warsaw_2026',
      source: 'Bevy-GDG-Community',
    });

    window.history.replaceState({}, '', '/schedule');

    expect(getAttributionParams()).toEqual({
      utm_source: 'bevy',
      utm_medium: 'partner',
      utm_campaign: 'devfest_warsaw_2026',
      source: 'Bevy-GDG-Community',
    });
  });

  it('ignores unrelated query parameters', () => {
    window.history.replaceState({}, '', '/?foo=bar&ref=internal');

    expect(getAttributionParams()).toEqual({});
  });

  it('replaces a previous campaign when a new campaign starts', () => {
    window.history.replaceState({}, '', '/?utm_source=bevy&source=Bevy-GDG-Community');
    getAttributionParams();

    window.history.replaceState({}, '', '/?utm_source=linkedin&utm_medium=social');

    expect(getAttributionParams()).toEqual({
      utm_source: 'linkedin',
      utm_medium: 'social',
    });
  });
});
