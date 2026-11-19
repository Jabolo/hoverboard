import { afterEach, describe, expect, it, jest } from '@jest/globals';
import './sticky-countdown';
import type { StickyCountdown } from './sticky-countdown';

describe('sticky countdown', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    history.replaceState({}, '', '/');
  });

  it('appears on a subpage and disappears at the event start', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-21T07:59:58Z'));
    history.replaceState({}, '', '/speakers/');
    const countdown = document.createElement('sticky-countdown') as StickyCountdown;
    document.body.append(countdown);
    await countdown.updateComplete;
    expect(countdown.shadowRoot?.querySelector('.bar.visible')).not.toBeNull();
    jest.advanceTimersByTime(2000);
    await countdown.updateComplete;
    expect(countdown.shadowRoot?.querySelector('.bar')).toBeNull();
  });

  it('does not overlay the homepage when the hero countdown is hidden', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-19T12:00:00Z'));
    Object.defineProperty(window, 'scrollY', { value: 500, configurable: true });
    const app = document.createElement('hoverboard-app');
    const appRoot = app.attachShadow({ mode: 'open' });
    const main = document.createElement('main');
    const home = document.createElement('home-page');
    const homeRoot = home.attachShadow({ mode: 'open' });
    const heroTimer = document.createElement('event-countdown');
    heroTimer.style.display = 'none';
    homeRoot.append(heroTimer);
    main.append(home);
    appRoot.append(main);
    document.body.append(app);
    const countdown = document.createElement('sticky-countdown') as StickyCountdown;
    document.body.append(countdown);
    await countdown.updateComplete;
    expect(countdown.shadowRoot?.querySelector('.bar.visible')).toBeNull();

    jest.advanceTimersByTime(1000);
    await countdown.updateComplete;
    expect(countdown.shadowRoot?.querySelector('.bar.visible')).toBeNull();
  });
});
