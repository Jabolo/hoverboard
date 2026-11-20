import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
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
    window.history.replaceState({}, '', '/');
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
    expect(root.querySelector('.prompt-prefix')).toBeNull();
    expect(root.querySelectorAll('.launcher-shell .intent-chip')).toHaveLength(5);
    const frameChildren = Array.from(root.querySelector('.launcher-frame')!.children);
    const chipIdx = frameChildren.findIndex((el) => el.classList.contains('chip-strip'));
    const privacyIdx = frameChildren.findIndex((el) => el.classList.contains('ai-privacy-note'));
    expect(chipIdx).toBeGreaterThan(-1);
    expect(privacyIdx).toBeGreaterThan(chipIdx);
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
    expect(root.querySelector('#concierge-dialog-title')?.textContent?.trim()).toBe(
      'DevFest Concierge',
    );
    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe('Instant');
    expect(root.querySelector('.logistics-card')).not.toBeNull();
    expect(root.querySelector('.inspector-details')).toBeNull();

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

    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe('Gemini AI');
    expect(root.querySelector('.source-badge')?.getAttribute('data-origin')).toBe('live');
    expect(root.querySelector('.surface-title')?.textContent).toBe('Michał Jabłoński');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('michał');

    // Submit again — should hit client cache without another fetch to /api/concierge
    root
      .querySelector<HTMLFormElement>('.dialog-controls .launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flushRender(element);

    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe('Gemini AI');
    expect(root.querySelector('.source-badge')?.getAttribute('data-origin')).toBe('cached');
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

    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe('Instant');
    expect(root.querySelector('.status-notice')?.textContent).toContain(
      'AI busy — showing instant programme answer.',
    );
  });

  it('syncs session bookmarks, gates A2UI JSON inspector behind ?debug=1, and closes via close button', async () => {
    globalThis.fetch = mockBootstrapFetch();
    window.history.replaceState({}, '', '/?debug=1');
    setSessionFavorite('INVITED-004', true);

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    const trackChip = root.querySelector<HTMLButtonElement>(
      '.launcher-shell button[data-intent="track-ai"]',
    )!;
    trackChip.click();
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
    expect(details).not.toBeNull();
    expect(details.textContent).toContain('"SurfaceContainer"');

    root.querySelector<HTMLButtonElement>('.close-btn')!.click();
    await element.updateComplete;
    expect(root.querySelector<HTMLDialogElement>('#concierge-dialog')?.hasAttribute('open')).toBe(
      false,
    );
  });

  it('omits launcher-header, dialog, and bootstrap fetches when variant="hero"', async () => {
    const fetchMock = mockBootstrapFetch();
    globalThis.fetch = fetchMock;

    const heroEl = new DevfestConcierge();
    heroEl.variant = 'hero';
    document.body.appendChild(heroEl);
    await flushRender(heroEl);
    expect(heroEl.shadowRoot?.querySelector('.launcher-header')).toBeNull();
    expect(heroEl.shadowRoot?.querySelector('#concierge-dialog')).toBeNull();
    expect(heroEl.shadowRoot?.querySelector('.prompt-prefix')).toBeNull();
    expect(fetchMock.mock.calls).toHaveLength(0);
    heroEl.remove();

    const bandEl = new DevfestConcierge();
    document.body.appendChild(bandEl);
    await flushRender(bandEl);
    expect(bandEl.shadowRoot?.querySelector('.launcher-header')).toBeNull();
    expect(bandEl.shadowRoot?.querySelector('#concierge-dialog')).not.toBeNull();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
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

    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe('Live clock');
    expect(root.querySelector('.callout-title')?.textContent).toContain('10:15');
    expect(root.querySelectorAll('.session-card')).toHaveLength(0);

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
    expect(root.querySelector('.source-badge')?.textContent?.trim()).toBe('Gemini AI');
    expect(root.querySelector('.source-badge')?.getAttribute('data-origin')).toBe('cached');
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

  it('opens floating dialog via Ctrl/Cmd+K shortcut and suppresses duplicate ComparisonGrid heading', async () => {
    const fetchMock = mockBootstrapFetch();
    globalThis.fetch = fetchMock;

    const floatingEl = new DevfestConcierge();
    floatingEl.variant = 'floating';
    document.body.appendChild(floatingEl);
    await flushRender(floatingEl);

    const heroEl = new DevfestConcierge();
    heroEl.variant = 'hero';
    document.body.appendChild(heroEl);
    await flushRender(heroEl);

    // Single bootstrap only (hero does not double-fetch)
    const agendaCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/data/agenda-2026.json'),
    );
    expect(agendaCalls).toHaveLength(1);

    const floatingRoot = floatingEl.shadowRoot!;
    const dialog = floatingRoot.querySelector<HTMLDialogElement>('#concierge-dialog')!;
    expect(dialog.hasAttribute('open')).toBe(false);

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }),
    );
    await floatingEl.updateComplete;
    expect(dialog.hasAttribute('open')).toBe(true);

    // Trigger Rooms now from hero (CalloutBanner + ComparisonGrid share the same title)
    const roomsChip = heroEl.shadowRoot!.querySelector<HTMLButtonElement>(
      '.launcher-shell button[data-intent="compare-rooms"]',
    )!;
    roomsChip.click();
    await flushRender(floatingEl);

    expect(floatingRoot.querySelector('.comparison-wrap h3')).toBeNull();
    expect(floatingRoot.querySelector('.callout-title')?.textContent).toBeTruthy();
  });

  it('renders loading skeleton while awaiting live /api/concierge and clears it on resolve', async () => {
    let resolveResponse!: (res: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    globalThis.fetch = mockBootstrapFetch(() => pendingPromise);

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    const input = root.querySelector<HTMLInputElement>('#concierge-input')!;
    input.value = 'Custom query for loading state';
    input.dispatchEvent(new Event('input'));
    root
      .querySelector<HTMLFormElement>('.launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await element.updateComplete;

    expect(root.querySelector('.loading-surface')).not.toBeNull();

    resolveResponse({
      ok: true,
      status: 200,
      json: async () => ({
        cached: false,
        messages: [
          {
            type: 'createSurface',
            surfaceId: 'resolved-s',
            title: 'Done',
            source: 'gemini-3.5-flash-lite',
            timestamp: Date.now(),
          },
          { type: 'updateDataModel', surfaceId: 'resolved-s', data: {} },
          {
            type: 'updateComponents',
            surfaceId: 'resolved-s',
            rootId: 'resolved-r',
            components: [
              {
                id: 'resolved-r',
                component: 'SurfaceContainer',
                parentId: null,
                children: [],
                props: { title: 'Resolved Surface' },
              },
            ],
          },
        ],
      }),
    } as Response);
    await flushRender(element);

    expect(root.querySelector('.loading-surface')).toBeNull();
    expect(root.querySelector('.surface-title')?.textContent).toBe('Resolved Surface');
  });

  it('opens local overview on empty submit with zero /api/concierge calls', async () => {
    const fetchMock = mockBootstrapFetch();
    globalThis.fetch = fetchMock;

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    root
      .querySelector<HTMLFormElement>('.launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flushRender(element);

    expect(root.querySelector<HTMLDialogElement>('#concierge-dialog')?.hasAttribute('open')).toBe(
      true,
    );
    expect(root.querySelector('.surface-title')?.textContent).toBe('DevFest Warsaw 2026 Concierge');
    const conciergeCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/concierge'),
    );
    expect(conciergeCalls).toHaveLength(0);
  });

  it('clears conflict warnings when unsaving an overlapping session and updates Saved view', async () => {
    globalThis.fetch = mockBootstrapFetch();
    setSessionFavorite('CFP-021', true);
    setSessionFavorite('INVITED-004', true);

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    // Open overview (contains both CFP-021 and INVITED-004 opening block cards)
    root
      .querySelector<HTMLFormElement>('.launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flushRender(element);

    expect(root.querySelectorAll('.conflict-warning')).toHaveLength(2);

    // Unsave INVITED-004 while on overview -> remaining CFP-021 conflict must clear
    const invitedCard = root.querySelector<HTMLElement>(
      'article.session-card[data-session-id="INVITED-004"]',
    )!;
    invitedCard.querySelector<HTMLButtonElement>('.save-btn')!.click();
    await flushRender(element);
    expect(root.querySelectorAll('.conflict-warning')).toHaveLength(0);

    // Re-add conflict and switch to Saved view -> unsave one directly inside Saved view
    invitedCard.querySelector<HTMLButtonElement>('.save-btn')!.click();
    await flushRender(element);
    root
      .querySelector<HTMLButtonElement>('.launcher-shell button[data-intent="saved-schedule"]')!
      .click();
    await flushRender(element);

    expect(root.querySelector('.callout-title')?.textContent).toContain(
      '2 saved sessions overlap in time',
    );
    root
      .querySelector<HTMLElement>('article.session-card[data-session-id="INVITED-004"] .save-btn')!
      .click();
    await flushRender(element);

    expect(root.querySelector('.callout-title')?.textContent).toBe('1 saved session ready');
    expect(root.querySelectorAll('.session-card')).toHaveLength(1);
    expect(root.querySelectorAll('.conflict-warning')).toHaveLength(0);
  });

  it('shows human-readable credit status and friendly busy fallback notice on 502', async () => {
    globalThis.fetch = mockBootstrapFetch(
      async () =>
        ({
          ok: false,
          status: 502,
          json: async () => ({ status: 'upstream-error', fallback: 'local-a2ui' }),
        }) as Response,
    );

    const element = new DevfestConcierge();
    document.body.appendChild(element);
    await flushRender(element);

    const root = element.shadowRoot!;
    root
      .querySelector<HTMLButtonElement>('.launcher-shell button[data-intent="credits-workshops"]')!
      .click();
    await flushRender(element);
    expect(root.querySelector('.credit-card .fact-value')?.textContent?.trim()).toBe(
      'Opens Nov 21 · 09:00',
    );

    const input = root.querySelector<HTMLInputElement>('#concierge-input')!;
    input.value = 'Kiedy jest lunch?';
    input.dispatchEvent(new Event('input'));
    root
      .querySelector<HTMLFormElement>('.launcher-form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await flushRender(element);

    expect(root.querySelector('.status-notice')?.textContent).toContain(
      'AI busy — showing instant programme answer.',
    );
    expect(root.querySelector('.logistics-card')).not.toBeNull();
  });

  describe('variant="floating" orbital FAB and smart handoff', () => {
    it('renders orbital FAB on non-root routes and opens modal on click', async () => {
      window.history.replaceState({}, '', '/schedule/');
      const element = new DevfestConcierge();
      element.variant = 'floating';
      document.body.appendChild(element);
      await flushRender(element);

      const root = element.shadowRoot!;
      expect(element.hasAttribute('data-fab-visible')).toBe(true);
      expect(root.querySelector('.launcher-shell')).toBeNull();
      const fab = root.querySelector<HTMLButtonElement>('.orbital-fab')!;
      expect(fab).not.toBeNull();
      expect(fab.textContent).toContain('Ask AI');

      // Click FAB to open dialog
      fab.click();
      await flushRender(element);

      const dialog = root.querySelector<HTMLDialogElement>('#concierge-dialog')!;
      expect(dialog.hasAttribute('open')).toBe(true);
      expect(element.hasAttribute('data-dialog-open')).toBe(true);
    });

    it('hides FAB when hero is visible and reveals when scrolled past', async () => {
      window.history.replaceState({}, '', '/');
      const floatingEl = new DevfestConcierge();
      floatingEl.variant = 'floating';
      document.body.appendChild(floatingEl);
      await flushRender(floatingEl);

      expect(floatingEl.hasAttribute('data-fab-visible')).toBe(false);

      // Hero reports scrolled out of view
      window.dispatchEvent(
        new CustomEvent('devfest-concierge:hero-visible', {
          detail: { visible: false },
        }),
      );
      await flushRender(floatingEl);

      expect(floatingEl.hasAttribute('data-fab-visible')).toBe(true);

      // Hero scrolls back into view
      window.dispatchEvent(
        new CustomEvent('devfest-concierge:hero-visible', {
          detail: { visible: true },
        }),
      );
      await flushRender(floatingEl);

      expect(floatingEl.hasAttribute('data-fab-visible')).toBe(false);
    });

    it('delegates request from hero to floating concierge instance', async () => {
      window.history.replaceState({}, '', '/');
      const floatingEl = new DevfestConcierge();
      floatingEl.variant = 'floating';
      document.body.appendChild(floatingEl);
      await flushRender(floatingEl);

      const heroEl = new DevfestConcierge();
      heroEl.variant = 'hero';
      document.body.appendChild(heroEl);
      await flushRender(heroEl);

      const heroRoot = heroEl.shadowRoot!;
      const floatingRoot = floatingEl.shadowRoot!;

      // Click AI track in Hero
      heroRoot
        .querySelector<HTMLButtonElement>('.launcher-shell button[data-intent="track-ai"]')!
        .click();
      await flushRender(floatingEl);
      await flushRender(heroEl);

      // Floating modal opened and handled the request
      const floatingDialog = floatingRoot.querySelector<HTMLDialogElement>('#concierge-dialog')!;
      expect(floatingDialog.hasAttribute('open')).toBe(true);
      expect(floatingRoot.querySelector('.surface-title')?.textContent).toBe('AI & Agents Track');

      // Hero does not render an unused dialog
      expect(heroRoot.querySelector<HTMLDialogElement>('#concierge-dialog')).toBeNull();
    });

    it('auto-closes dialog on route navigation', async () => {
      window.history.replaceState({}, '', '/sessions/CFP-021/');
      const floatingEl = new DevfestConcierge();
      floatingEl.variant = 'floating';
      document.body.appendChild(floatingEl);
      await flushRender(floatingEl);

      floatingEl.openAndFocus();
      await flushRender(floatingEl);

      const dialog = floatingEl.shadowRoot!.querySelector<HTMLDialogElement>('#concierge-dialog')!;
      expect(dialog.hasAttribute('open')).toBe(true);

      // Simulate client router location changed
      window.dispatchEvent(new CustomEvent('vaadin-router-location-changed'));
      await flushRender(floatingEl);

      expect(dialog.hasAttribute('open')).toBe(false);
    });
  });

  describe('voice input UI', () => {
    const originalSpeechRecognition = (window as unknown as Record<string, unknown>)[
      'SpeechRecognition'
    ];

    beforeEach(() => {
      (window as unknown as Record<string, unknown>)['SpeechRecognition'] = class {
        continuous = false;
        interimResults = false;
        lang = 'en-US';
        start = jest.fn();
        stop = jest.fn();
        abort = jest.fn();
      };
    });

    afterEach(() => {
      (window as unknown as Record<string, unknown>)['SpeechRecognition'] =
        originalSpeechRecognition;
    });

    it('renders mic button and toggles language between PL and EN', async () => {
      const element = new DevfestConcierge();
      document.body.appendChild(element);
      await flushRender(element);

      const root = element.shadowRoot!;
      const micBtn = root.querySelector<HTMLButtonElement>('.mic-btn')!;
      expect(micBtn).not.toBeNull();
      expect(micBtn.getAttribute('aria-label')).toContain('Voice dictation');

      // Open dialog to check language pill
      element.openAndFocus();
      await flushRender(element);

      const plBtn = root.querySelector<HTMLButtonElement>('.lang-toggle-btn.is-active')!;
      expect(plBtn.textContent?.trim()).toBe('PL');

      // Click EN
      const enBtn = Array.from(root.querySelectorAll<HTMLButtonElement>('.lang-toggle-btn')).find(
        (b) => b.textContent?.trim() === 'EN',
      )!;
      enBtn.click();
      await flushRender(element);

      expect(enBtn.classList.contains('is-active')).toBe(true);
    });
  });
});
