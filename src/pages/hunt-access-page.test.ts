import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { HuntAccessPage, requestHuntAccess } from './hunt-access-page';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function response(status: number, data: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}

describe('hunt access endpoint', () => {
  it('checks and unlocks with same-origin cookies and no cache', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { status: 'locked' }))
      .mockResolvedValueOnce(response(200, { status: 'unlocked' }));
    global.fetch = fetchMock;
    await expect(requestHuntAccess()).resolves.toBe('locked');
    await expect(requestHuntAccess('example code')).resolves.toBe('unlocked');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/hunt/access',
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/hunt/access',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ code: 'example code' }),
      }),
    );
  });

  it('fails closed on invalid responses, offline, and missing endpoints', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(401, { status: 'locked' }))
      .mockResolvedValueOnce(response(404, { status: 'unlocked' }))
      .mockResolvedValueOnce(response(200, { status: 'unexpected' }))
      .mockRejectedValueOnce(new Error('offline'));
    global.fetch = fetchMock;
    await expect(requestHuntAccess('wrong')).resolves.toBe('locked');
    await expect(requestHuntAccess()).resolves.toBe('unavailable');
    await expect(requestHuntAccess()).resolves.toBe('unavailable');
    await expect(requestHuntAccess()).resolves.toBe('unavailable');
  });
});

describe('protected page', () => {
  it('keeps a card deep link intact while prompting and retrying a rejected code', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { status: 'locked' }))
      .mockResolvedValueOnce(response(401, { status: 'locked' }));
    global.fetch = fetchMock;
    history.replaceState(null, '', '/hunt/c/test001/?from=poster#card');
    const page = document.createElement('hunt-access-page') as HuntAccessPage;
    document.body.append(page);
    try {
      page.onAfterEnter({ pathname: '/hunt/c/test001/', params: { token: 'test001' } } as never);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.updateComplete;
      expect(page.shadowRoot?.textContent).toContain('still connecting to the year 2000');
      const input = page.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.value = 'wrong';
      page.shadowRoot
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.updateComplete;
      expect(page.shadowRoot?.textContent).toContain('That code was not accepted');
      expect(input.value).toBe('');
      expect(window.location.pathname + window.location.search + window.location.hash).toBe(
        '/hunt/c/test001/?from=poster#card',
      );
    } finally {
      page.remove();
      history.replaceState(null, '', '/');
    }
  });
});

describe('successful unlock', () => {
  it('opens the original card route after accepting the code', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { status: 'locked' }))
      .mockResolvedValueOnce(response(200, { status: 'unlocked' }));
    global.fetch = fetchMock;
    if (!customElements.get('hunt-page')) {
      customElements.define(
        'hunt-page',
        class extends HTMLElement {
          onAfterEnter(location: { params: { token: string } }) {
            this.dataset['token'] = location.params.token;
          }
        },
      );
    }
    const page = document.createElement('hunt-access-page') as HuntAccessPage;
    jest.spyOn(page, 'loadPage').mockResolvedValue();
    document.body.append(page);
    const location = { pathname: '/hunt/c/test001/', params: { token: 'test001' } } as never;
    try {
      page.onAfterEnter(location);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await page.updateComplete;
      const input = page.shadowRoot?.querySelector('input') as HTMLInputElement;
      input.value = 'accepted';
      page.shadowRoot
        ?.querySelector('form')
        ?.dispatchEvent(new Event('submit', { cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      await page.updateComplete;
      expect(page.shadowRoot?.querySelector('hunt-page')?.getAttribute('data-token')).toBe(
        'test001',
      );
    } finally {
      page.remove();
    }
  });
});

describe('scheduled opening', () => {
  it('polls the server and resumes the card route without a reload', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { status: 'locked' }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response(200, { status: 'unlocked' }));
    global.fetch = fetchMock;
    const page = document.createElement('hunt-access-page') as HuntAccessPage;
    jest.spyOn(page, 'loadPage').mockResolvedValue();
    document.body.append(page);
    try {
      page.onAfterEnter({ pathname: '/hunt/c/test001/', params: { token: 'test001' } } as never);
      await jest.advanceTimersByTimeAsync(0);
      expect(page.shadowRoot?.textContent).toContain('21 November at 08:00 Warsaw');
      await jest.advanceTimersByTimeAsync(20_000);
      expect(page.shadowRoot?.textContent).toContain('We will keep checking');
      await jest.advanceTimersByTimeAsync(20_000);
      expect(page.shadowRoot?.querySelector('hunt-page')?.getAttribute('data-token')).toBe(
        'test001',
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      page.remove();
      jest.useRealTimers();
    }
  });
});

describe('session expiration', () => {
  it('rechecks access and prompts after a card request loses its session', async () => {
    global.fetch = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(200, { status: 'unlocked' }))
      .mockResolvedValueOnce(response(200, { status: 'locked' }));
    const page = document.createElement('hunt-access-page') as HuntAccessPage;
    jest.spyOn(page, 'loadPage').mockResolvedValue();
    document.body.append(page);
    try {
      page.onAfterEnter({ pathname: '/hunt/c/test001/', params: { token: 'test001' } } as never);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(page.shadowRoot?.querySelector('hunt-page')).not.toBeNull();
      window.dispatchEvent(new Event('hunt-access-expired'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(page.shadowRoot?.querySelector('hunt-page')).toBeNull();
      expect(page.shadowRoot?.textContent).toContain('Organizer access code');
    } finally {
      page.remove();
    }
  });
});
