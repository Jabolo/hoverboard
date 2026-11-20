import { type RouterLocation } from '@vaadin/router';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type AccessState = 'loading' | 'locked' | 'unavailable' | 'unlocked';

// The server is the authority: cached or malformed responses never grant access.
export async function requestHuntAccess(code?: string, signal?: AbortSignal): Promise<AccessState> {
  try {
    const response = await fetch('/api/hunt/access', {
      method: code === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: signal ?? null,
      ...(code === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }),
    });
    const data = await response.json();
    if (response.ok && data?.status === 'unlocked') return 'unlocked';
    if ((response.ok || response.status === 401) && data?.status === 'locked') return 'locked';
  } catch {
    // Network failures, including offline mode, fail closed.
  }
  return 'unavailable';
}

@customElement('hunt-access-page')
export class HuntAccessPage extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .gate {
      box-sizing: border-box;
      min-height: 60vh;
      display: grid;
      place-items: center;
      padding: 5rem 1.25rem;
      background: #101128;
      color: #fff;
      font-family: sans-serif;
    }
    .panel {
      width: min(100%, 28rem);
    }
    h1 {
      font-size: 2rem;
      line-height: 1.15;
    }
    p {
      line-height: 1.5;
    }
    label {
      display: block;
      margin: 1.5rem 0 0.5rem;
      font-weight: 700;
    }
    input,
    button {
      box-sizing: border-box;
      font: inherit;
      min-height: 48px;
      border-radius: 6px;
    }
    input {
      width: 100%;
      padding: 0.7rem;
      border: 2px solid #a2a4bd;
      background: white;
      color: #111;
    }
    button {
      margin-top: 1rem;
      padding: 0.7rem 1.25rem;
      border: 0;
      background: #ffcf41;
      color: #171228;
      font-weight: 700;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: wait;
    }
    :focus-visible {
      outline: 3px solid #ffcf41;
      outline-offset: 3px;
    }
    .error {
      color: #ffd0c9;
    }
  `;

  @state() private access: AccessState = 'loading';
  @state() private busy = false;
  @state() private error = '';
  private location?: RouterLocation;
  private request?: AbortController;
  private generation = 0;
  private pollTimer: ReturnType<typeof setTimeout> | undefined;

  onAfterEnter(location: RouterLocation) {
    this.location = location;
    void this.check();
  }

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hunt-access-expired', this.onAccessExpired);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private readonly onAccessExpired = () => {
    void this.check();
  };

  private readonly onVisibilityChange = () => {
    if (!this.isConnected || this.access === 'unlocked') return;
    if (document.hidden) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    } else if (!this.busy && (this.access === 'locked' || this.access === 'unavailable')) {
      void this.check(undefined, true);
    }
  };

  override disconnectedCallback() {
    window.removeEventListener('hunt-access-expired', this.onAccessExpired);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.generation++;
    clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
    this.request?.abort();
    super.disconnectedCallback();
  }

  private schedulePoll() {
    clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
    if (!this.isConnected || document.hidden) return;
    this.pollTimer = setTimeout(() => void this.check(undefined, true), 20_000);
  }

  private async check(code?: string, polling = false) {
    clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    const generation = ++this.generation;
    if (!polling) this.error = '';
    if (code === undefined && !polling) {
      this.busy = false;
      this.access = 'loading';
    } else if (code !== undefined) this.busy = true;
    const result = await requestHuntAccess(code, request.signal);
    if (generation !== this.generation || request.signal.aborted) return;
    this.busy = false;
    if (result === 'unlocked') {
      try {
        await this.loadPage();
      } catch {
        if (generation === this.generation) this.access = 'unavailable';
        return;
      }
      if (generation !== this.generation || request.signal.aborted) return;
      this.access = 'unlocked';
      await this.updateComplete;
      const child = this.renderRoot.querySelector('hunt-page') as
        (HTMLElement & { onAfterEnter: (location: RouterLocation) => void }) | null;
      if (child && this.location) child.onAfterEnter(this.location);
    } else if (result === 'locked') {
      this.access = 'locked';
      if (polling && this.error.startsWith('Connection interrupted')) this.error = '';
      if (code !== undefined) this.error = 'That code was not accepted. Please try again.';
      this.schedulePoll();
      if (!polling) {
        await this.updateComplete;
        this.renderRoot.querySelector<HTMLInputElement>('#access-code')?.focus();
      }
    } else if (polling) {
      this.error = 'Connection interrupted. We will keep checking.';
      this.schedulePoll();
    } else {
      this.access = 'unavailable';
      this.schedulePoll();
    }
  }

  async loadPage() {
    if (this.location?.pathname.startsWith('/y2k')) await import('./y2k-page.js');
    else await import('./hunt-page.js');
  }

  private readonly submit = (event: Event) => {
    event.preventDefault();
    if (this.busy) return;
    const input = this.renderRoot.querySelector<HTMLInputElement>('#access-code');
    const code = input?.value ?? '';
    if (!code) return;
    if (input) input.value = '';
    void this.check(code);
  };

  override render() {
    if (this.access === 'unlocked') {
      return this.location?.pathname.startsWith('/y2k')
        ? html`<y2k-page></y2k-page>`
        : html`<hunt-page></hunt-page>`;
    }
    return html`<main class="gate">
      <div class="panel">
        ${
          this.access === 'loading'
            ? html`<p role="status">Checking access…</p>`
            : this.access === 'unavailable'
              ? html`<h1>Access is temporarily unavailable</h1>
                  <p>Check your connection and try again.</p>
                  <button type="button" @click=${() => this.check()}>Try again</button>`
              : html`<h1>Please wait… still connecting to the year 2000</h1>
                  <p>The dial-up modem is doing its best.</p>
                  <p>
                    Our Y2K surprise goes live on Saturday, 21 November at 08:00 Warsaw time. This
                    page will open automatically; refresh if it stays stuck.
                  </p>
                  <p>Have an organizer access code? You can enter it below.</p>
                  <form @submit=${this.submit}>
                    <label for="access-code">Organizer access code</label>
                    <input
                      id="access-code"
                      type="password"
                      autocomplete="off"
                      required
                      ?disabled=${this.busy}
                      aria-describedby=${this.error ? 'access-error' : nothing}
                    />
                    ${this.error ? html`<p class="error" id="access-error" role="alert">${this.error}</p>` : nothing}
                    <button type="submit" ?disabled=${this.busy}>
                      ${this.busy ? 'Checking…' : 'Continue'}
                    </button>
                  </form>`
        }
      </div>
    </main>`;
  }
}
