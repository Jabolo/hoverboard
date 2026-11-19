import { afterEach, describe, expect, it, jest } from '@jest/globals';
import agenda from '../../public/data/agenda-2026.json';
import team from '../../public/data/event-team.json';
import programme from '../../public/data/programme-2026.json';
import type { A2UIMessage } from '../concierge/a2ui-protocol';
import { setSessionFavorite } from '../utils/session-favorites';
import { clearConciergeClientCache, DevfestConcierge } from './devfest-concierge';

function mockBootstrapFetch(conciergeResponder?: () => Promise<Response>): jest.Mock<typeof fetch> {
  return jest.fn<typeof fetch>(async (input, _init) => {
    const url = String(input);
    if (url.includes('/data/agenda-2026.json')) {
      return { ok: true, status: 200, json: async () => agenda } as Response;
    }
    if (url.includes('/data/programme-2026.json')) {
      return { ok: true, status: 200, json: async () => programme } as Response;
    }
    if (url.includes('/data/event-team.json')) {
      return { ok: true, status: 200, json: async () => team } as Response;
    }
    if (url.includes('/api/cloud-credit')) {
      return { ok: true, status: 200, json: async () => ({ status: 'upcoming' }) } as Response;
    }
    if (url.includes('/api/concierge') && conciergeResponder) {
      return conciergeResponder();
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });
}

async function flushRender(element: DevfestConcierge): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
}

describe('devfest-concierge', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    document.body.replaceChildren();
    globalThis.fetch = originalFetch;
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearConciergeClientCache();
    jest.restoreAllMocks();
  });

  it('renders compact launcher with dialog closed on load and zero /api/concierge calls', async () => {
    const fetchMock = mockBootstrapFetch();
    globalThis.fetch = fetchMock;

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    expect(root.querySelector('.launcher-shell')).not.toBeNull();
    expect(root.querySelectorAll('.launcher-shell .intent-chip')).toHaveLength(5);
    const dialog = root.querySelector<HTMLDialogElement>('#concierge-dialog');
    expect(dialog?.hasAttribute('open')).toBe(false);

    const conciergeCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/concierge'),
    );
    expect(conciergeCalls).toHaveLength(0);
  });

  it('opens dialog and renders instant preset chips locally with zero API credits spent', async () => {
    const fetchMock = mockBootstrapFetch();
    globalThis.fetch = fetchMock;

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    const venueChip = root.querySelector<HTMLButtonElement>(
      '.launcher-shell button[data-intent="logistics-venue"]',
    )!;
    venueChip.click();
    await flushRender(element);

    const dialog = root.querySelector<HTMLDialogElement>('#concierge-dialog');
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe('Instant · Local A2UI');
    expect(root.querySelector('.logistics-card')).not.toBeNull();

    const conciergeCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/concierge'),
    );
    expect(conciergeCalls).toHaveLength(0);
  });

  it('calls /api/concierge for custom queries and serves repeated identical query from client cache', async () => {
    const liveMessages: A2UIMessage[] = [
      {
        type: 'createSurface',
        surfaceId: 'live-surface',
        title: 'Organizer Lookup',
        source: 'gemini-3.5-flash-lite',
        timestamp: Date.now(),
      },
      {
        type: 'updateDataModel',
        surfaceId: 'live-surface',
        data: { savedSessions: {}, conflicts: {} },
      },
      {
        type: 'updateComponents',
        surfaceId: 'live-surface',
        rootId: 'live-root',
        components: [
          {
            id: 'live-root',
            component: 'SurfaceContainer',
            parentId: null,
            children: ['live-banner'],
            props: { title: 'Michał Jabłoński' },
          },
          {
            id: 'live-banner',
            component: 'CalloutBanner',
            parentId: 'live-root',
            props: {
              tone: 'info',
              title: 'GDG Warszawa Organizer',
              body: 'Michał Jabłoński is on the DevFest Warsaw 2026 organizing team.',
            },
          },
        ],
      },
    ];

    const fetchMock = mockBootstrapFetch(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ cached: false, messages: liveMessages }),
        }) as Response,
    );
    globalThis.fetch = fetchMock;

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>('#concierge-input')!;
    input.value = 'who is michał jabłoński?';
    input.dispatchEvent(new Event('input'));
    root
      .querySelector<HTMLFormElement>('.launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flushRender(element);

    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe(
      'Live · Gemini 3.5 Flash-Lite',
    );
    expect(root.querySelector('.surface-title')?.textContent).toBe('Michał Jabłoński');

    // Submit again — should hit client cache without another fetch to /api/concierge
    root
      .querySelector<HTMLFormElement>('.dialog-controls .launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flushRender(element);

    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe(
      'Cached · Gemini 3.5 Flash-Lite',
    );
    const conciergeCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/concierge'),
    );
    expect(conciergeCalls).toHaveLength(1);
  });

  it('falls back to the local A2UI engine and shows notice on 429 rate limit', async () => {
    globalThis.fetch = mockBootstrapFetch(
      async () =>
        ({
          ok: false,
          status: 429,
          json: async () => ({ error: 'rate_limited' }),
        }) as Response,
    );

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>('#concierge-input')!;
    input.value = 'Custom workshop query';
    input.dispatchEvent(new Event('input'));
    root
      .querySelector<HTMLFormElement>('.launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flushRender(element);

    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe('Instant · Local A2UI');
    expect(root.querySelector('.status-notice')?.textContent).toContain(
      'Rate limit reached — running on Grounded Local A2UI Engine',
    );
  });

  it('syncs session bookmarks, reveals A2UI JSON in native details, and closes via close button', async () => {
    globalThis.fetch = mockBootstrapFetch();
    setSessionFavorite('INVITED-004', true);

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    const compareChip = root.querySelector<HTMLButtonElement>(
      '.launcher-shell button[data-intent="compare-rooms"]',
    )!;
    compareChip.click();
    await flushRender(element);

    const cfpCard = root.querySelector<HTMLElement>(
      'article.session-card[data-session-id="CFP-021"]',
    );
    const saveBtn = cfpCard?.querySelector<HTMLButtonElement>('.save-btn');
    if (saveBtn) {
      expect(saveBtn.getAttribute('aria-pressed')).toBe('false');
      saveBtn.click();
      await flushRender(element);

      const updatedCard = root.querySelector<HTMLElement>(
        'article.session-card[data-session-id="CFP-021"]',
      );
      expect(updatedCard?.querySelector('.save-btn')?.getAttribute('aria-pressed')).toBe('true');
      expect(updatedCard?.querySelector('.conflict-warning')?.textContent).toContain(
        'Schedule conflict:',
      );
    }

    const details = root.querySelector<HTMLDetailsElement>('.inspector-details')!;
    expect(details.textContent).toContain('"SurfaceContainer"');

    root.querySelector<HTMLButtonElement>('.close-btn')!.click();
    await element.updateComplete;
    expect(root.querySelector<HTMLDialogElement>('#concierge-dialog')?.hasAttribute('open')).toBe(
      false,
    );
  });

  it('renders hero chrome when variant="hero" and omits it in default band variant', async () => {
    globalThis.fetch = mockBootstrapFetch();

    const heroEl = new DevfestConcierge();
    heroEl.variant = 'hero';
    document.body.appendChild(heroEl);
    await flushRender(heroEl);
    expect(heroEl.shadowRoot?.querySelector('.launcher-header')?.textContent).toContain(
      'devfest-concierge',
    );
    heroEl.remove();

    const bandEl = new DevfestConcierge();
    document.body.appendChild(bandEl);
    await flushRender(bandEl);
    expect(bandEl.shadowRoot?.querySelector('.launcher-header')).toBeNull();
  });

  it('evaluates Rooms now live across schedule slots with zero AI calls', async () => {
    const fetchMock = mockBootstrapFetch();
    globalThis.fetch = fetchMock;
    const nowSpy = jest.spyOn(Date, 'now');

    nowSpy.mockReturnValue(Date.parse('2026-11-21T10:20:00+01:00'));
    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    const roomsChip = root.querySelector<HTMLButtonElement>(
      '.launcher-shell button[data-intent="compare-rooms"]',
    )!;
    roomsChip.click();
    await flushRender(element);

    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe('Live · Local Clock');
    expect(root.querySelector('.callout-title')?.textContent).toContain('10:15');

    nowSpy.mockReturnValue(Date.parse('2026-11-21T11:10:00+01:00'));
    roomsChip.click();
    await flushRender(element);

    expect(root.querySelector('.callout-title')?.textContent).toContain('11:00');
    const conciergeCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/concierge'),
    );
    expect(conciergeCalls).toHaveLength(0);
  });

  it('expires client cache across schedule slot boundaries for time-sensitive queries', async () => {
    let callCount = 0;
    const fetchMock = mockBootstrapFetch(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          cached: false,
          messages: [
            {
              type: 'createSurface',
              surfaceId: `s-${callCount}`,
              title: 'Live Rooms',
              source: 'gemini-3.5-flash-lite',
              timestamp: Date.now(),
            },
            { type: 'updateDataModel', surfaceId: `s-${callCount}`, data: {} },
            {
              type: 'updateComponents',
              surfaceId: `s-${callCount}`,
              rootId: `root-${callCount}`,
              components: [
                {
                  id: `root-${callCount}`,
                  component: 'SurfaceContainer',
                  parentId: null,
                  children: [],
                  props: { title: `Slot Response #${callCount}` },
                },
              ],
            },
          ],
        }),
      } as Response;
    });
    globalThis.fetch = fetchMock;
    const nowSpy = jest.spyOn(Date, 'now');

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);
    const root = element.shadowRoot!;

    nowSpy.mockReturnValue(Date.parse('2026-11-21T10:44:00+01:00'));
    const input = root.querySelector<HTMLInputElement>('#concierge-input')!;
    input.value = 'What talks are live right now?';
    input.dispatchEvent(new Event('input'));
    root
      .querySelector<HTMLFormElement>('.launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flushRender(element);
    expect(root.querySelector('.surface-title')?.textContent).toBe('Slot Response #1');

    // Within same slot (before 10:45): hits client cache
    nowSpy.mockReturnValue(Date.parse('2026-11-21T10:44:30+01:00'));
    root
      .querySelector<HTMLFormElement>('.dialog-controls .launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flushRender(element);
    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe(
      'Cached · Gemini 3.5 Flash-Lite',
    );
    expect(callCount).toBe(1);

    // Crossing 10:45 boundary: misses cache and fetches fresh live response
    nowSpy.mockReturnValue(Date.parse('2026-11-21T10:46:00+01:00'));
    root
      .querySelector<HTMLFormElement>('.dialog-controls .launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flushRender(element);
    expect(root.querySelector('.surface-title')?.textContent).toBe('Slot Response #2');
    expect(callCount).toBe(2);
  });
});
