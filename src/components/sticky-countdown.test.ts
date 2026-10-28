import { afterEach, describe, expect, it, jest } from '@jest/globals';
import './sticky-countdown';
import type { StickyCountdown } from './sticky-countdown';

describe('sticky countdown', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
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
});
