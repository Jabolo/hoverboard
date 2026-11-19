import { eventInstant } from './agenda-preview-data';

const REVIEW_HOST = /^gdg-warsaw-devfest26-web--event-companion-20261119-[a-z0-9]+\.web\.app$/;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isScheduleTestHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname) || REVIEW_HOST.test(hostname);
}

/** Optional preview-only programme clock; it never changes other event clocks. */
export function getScheduleTestTime(hostname: string, search: string): number | null {
  if (!isScheduleTestHost(hostname)) return null;
  const values = new URLSearchParams(search).getAll('schedule-test');
  if (values.length !== 1 || !values[0] || !TIME.test(values[0])) return null;
  return eventInstant(values[0]);
}
