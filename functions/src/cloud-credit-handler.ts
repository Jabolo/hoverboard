import type { Request, Response } from 'express';

// Server access begins 07:00; the website button appears at 09:00 (Warsaw, CET).
export const CREDIT_OPENS_AT = Date.parse('2026-11-21T06:00:00Z');
export const CREDIT_BUTTON_OPENS_AT = Date.parse('2026-11-21T08:00:00Z');
export const CREDIT_CLOSES_AT = Date.parse('2026-11-21T18:00:00Z');

export function handleCloudCredit(
  request: Pick<Request, 'method' | 'query'>,
  response: Response,
  now: number,
  getClaimUrl: () => string,
) {
  response.set('Cache-Control', 'private, no-store, max-age=0');
  response.set('Referrer-Policy', 'no-referrer');
  response.set('X-Robots-Tag', 'noindex, nofollow');
  if (request.method !== 'GET') {
    response.set('Allow', 'GET').status(405).json({ status: 'method-not-allowed' });
    return;
  }
  const state = now < CREDIT_OPENS_AT ? 'upcoming' : now < CREDIT_CLOSES_AT ? 'open' : 'closed';
  if (request.query.claim !== '1') {
    const buttonState = now < CREDIT_BUTTON_OPENS_AT ? 'upcoming' : state;
    response
      .status(200)
      .json({ status: buttonState, serverTime: now, opensAt: CREDIT_BUTTON_OPENS_AT });
    return;
  }
  if (state !== 'open') {
    response.status(state === 'upcoming' ? 403 : 410).json({ status: state });
    return;
  }
  try {
    const url = new URL(getClaimUrl());
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid URL');
    response.redirect(302, url.href);
  } catch {
    response.status(503).json({ status: 'unavailable' });
  }
}
