import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { CloudCreditBlock, isHostedCreditReview } from './cloud-credit-block';

describe('cloud credit review mode', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    document.body.replaceChildren();
    globalThis.fetch = originalFetch;
  });

  it('recognizes only hosted release-review channels, not production or loopback', () => {
    expect(
      isHostedCreditReview('gdg-warsaw-devfest26-web--event-companion-20261119-a1.web.app'),
    ).toBe(true);
    expect(isHostedCreditReview('gdg-warsaw-devfest26-web--programme-ready-2026-a1.web.app')).toBe(
      true,
    );
    expect(isHostedCreditReview('localhost')).toBe(false);
    expect(isHostedCreditReview('warsaw.devfest.pl')).toBe(false);
    expect(
      isHostedCreditReview(
        'gdg-warsaw-devfest26-web--event-companion-20261119-a1.web.app.evil.com',
      ),
    ).toBe(false);
  });

  it('shows a preview-specific unavailable message without requesting the function', async () => {
    const fetchMock = jest.fn<typeof fetch>();
    globalThis.fetch = fetchMock;
    const element = new CloudCreditBlock();
    Reflect.set(element, 'hostedReviewPreview', true);
    document.body.appendChild(element);
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).toContain(
      'Claim status is unavailable in this preview.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves the local open preview endpoint', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'open' }),
    } as Response);
    globalThis.fetch = fetchMock;
    const element = new CloudCreditBlock();
    Reflect.set(element, 'hostedReviewPreview', false);
    Reflect.set(element, 'previewMode', true);
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await element.updateComplete;
    expect(fetchMock).toHaveBeenCalledWith('/api/cloud-credit?preview=open', { cache: 'no-store' });
    expect(element.shadowRoot?.querySelector('a')?.getAttribute('href')).toBe(
      '/api/cloud-credit?claim=1&preview=open',
    );
  });
});
