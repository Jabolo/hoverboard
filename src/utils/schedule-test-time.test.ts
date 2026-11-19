import { describe, expect, it } from '@jest/globals';
import { eventInstant } from './agenda-preview-data';
import { getScheduleTestTime } from './schedule-test-time';

describe('preview-only schedule clock', () => {
  const reviewHost = 'gdg-warsaw-devfest26-web--event-companion-20261119-qttcmmlw.web.app';

  it('maps the requested times to Warsaw event-day instants', () => {
    for (const time of ['09:30', '11:05', '16:05']) {
      expect(getScheduleTestTime(reviewHost, `?schedule-test=${time}`)).toBe(eventInstant(time));
      expect(getScheduleTestTime('localhost', `?schedule-test=${time}`)).toBe(eventInstant(time));
    }
  });

  it('ignores test clocks outside the exact review host and loopback', () => {
    for (const host of [
      'warsaw.devfest.pl',
      'gdg-warsaw-devfest26-web.web.app',
      'gdg-warsaw-devfest26-web--programme-ready-2026-abc.web.app',
      `${reviewHost}.evil.com`,
      'other-site--event-companion-20261119-abc.web.app',
      'localhost.evil.com',
    ]) {
      expect(getScheduleTestTime(host, '?schedule-test=09:30')).toBeNull();
    }
  });

  it('ignores missing, repeated and malformed times', () => {
    for (const search of [
      '',
      '?schedule-test=',
      '?schedule-test=9:30',
      '?schedule-test=24:00',
      '?schedule-test=11:60',
      '?schedule-test=11:05:00',
      '?schedule-test=09:30&schedule-test=11:05',
    ]) {
      expect(getScheduleTestTime(reviewHost, search)).toBeNull();
    }
  });
});
