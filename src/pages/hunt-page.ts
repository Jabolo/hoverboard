import { Router, type RouterLocation } from '@vaadin/router';
import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { ThemedElement } from '../components/themed-element';
import {
  getHuntProgress,
  hasHuntPerfect,
  HUNT_STORAGE_KEY,
  huntCardPath,
  huntGroups,
  huntStorageAvailable,
  normalizeHuntCode,
  rememberHuntCard,
  requestHuntCard,
  type EarnedHuntCard,
  type HuntCard,
  type HuntGroup,
  type HuntProgressEntry,
  type HuntResult,
} from '../hunt/hunt-store.js';
import { huntStyles } from '../hunt/hunt-styles.js';
import '../hunt/signal-game.js';
import { huntSiteLinks } from '../hunt/site-links.js';
import { bindAlbumMotion, enableAlbumMotion, scratch } from '../hunt/scratch.js';
import { INCLUDE_SITE_TITLE, updateMetadata } from '../utils/metadata';
import '../elements/footer-block';

type CardView =
  | { status: 'loading' | 'future' | 'expired' | 'invalid' | 'unavailable' }
  | { status: 'open'; card: HuntCard; foil: HTMLElement }
  | { status: 'earned'; card: EarnedHuntCard };

const messages = {
  loading: ['Opening card…', 'Checking the card link.'],
  future: ['This card opens later', 'Try the same link when its event window begins.'],
  expired: [
    'This card has expired',
    'Its event window has ended. You can still open cards you collected earlier.',
  ],
  invalid: ['Card not found', 'Check the link or try entering the code again in My Collection.'],
  unavailable: ['Couldn’t open this card', 'Check your connection and try again.'],
};

const fallbackLabels: Readonly<Record<string, string>> = {
  web: 'Web Relics',
  play: 'Play Files',
  venue: 'Field Finds',
  mystery: 'Mystery',
  preview: 'Preview cards',
};

@customElement('hunt-page')
export class HuntPage extends ThemedElement {
  static override get styles() {
    return [...super.styles, huntStyles];
  }

  @state() private token: string | undefined;
  @state() private groups: HuntGroup[] | null | undefined;
  @state() private progress: HuntProgressEntry[] = [];
  @state() private cardView: CardView = { status: 'loading' };
  @state() private codeError = '';
  @state() private revealIssue = '';
  @state() private storageAvailable = true;
  @state() private albumMotion = 'idle';
  @state() private replay:
    { card: EarnedHuntCard; foil: HTMLElement; revealed: boolean } | undefined;
  private routeRequest?: AbortController;
  private unbindAlbumMotion?: () => void;
  private replayTrigger: HTMLElement | undefined;
  private readonly phoneInput =
    navigator.maxTouchPoints > 0 || window.matchMedia('(any-pointer: coarse)').matches;

  override connectedCallback() {
    super.connectedCallback();
    this.refreshProgress();
    window.addEventListener('storage', this.onStorage);
  }

  override disconnectedCallback() {
    this.routeRequest?.abort();
    window.removeEventListener('storage', this.onStorage);
    super.disconnectedCallback();
  }

  onAfterEnter(location: RouterLocation) {
    this.closeReplay();
    this.token = location.params?.['token']?.toString();
    this.codeError = '';
    this.refreshProgress();
    updateMetadata(
      this.token === undefined ? 'My Collection · Y2K Card Hunt' : 'Y2K Card Hunt',
      'Find holographic cards and keep them in your personal DevFest Warsaw collection.',
      INCLUDE_SITE_TITLE.YES,
      false,
    );
    void this.loadRoute();
    void this.updateComplete.then(() => {
      this.renderRoot.querySelector<HTMLElement>('#hunt-heading')?.focus({ preventScroll: true });
    });
  }

  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.startsWith(`${HUNT_STORAGE_KEY}:`)) return;
    this.refreshProgress();
    const saved = this.findEarnedCard(normalizeHuntCode(this.token ?? ''));
    if (saved) this.cardView = { status: 'earned', card: saved };
  };

  private refreshProgress() {
    this.progress = getHuntProgress();
    this.storageAvailable = huntStorageAvailable();
  }

  private findEarnedCard(id: string) {
    const entry = this.progress.find((entry) => entry.card.id === id);
    return entry?.state === 'earned' ? entry.card : undefined;
  }

  private readonly loadRoute = async () => {
    this.routeRequest?.abort();
    this.routeRequest = new AbortController();
    const { signal } = this.routeRequest;
    this.revealIssue = '';
    if (this.token === undefined) {
      const groups = await huntGroups(signal);
      if (!signal.aborted) this.groups = groups;
      return;
    }

    this.cardView = { status: 'loading' };
    const token = normalizeHuntCode(this.token);
    const saved = this.findEarnedCard(token);
    if (saved) {
      this.cardView = { status: 'earned', card: saved };
      return;
    }
    if (!token) {
      this.cardView = { status: 'invalid' };
      return;
    }

    const result = await requestHuntCard(token, 'GET', signal);
    if (signal.aborted) return;
    this.refreshProgress();
    const earnedElsewhere = this.findEarnedCard(token);
    if (earnedElsewhere) {
      this.cardView = { status: 'earned', card: earnedElsewhere };
      return;
    }
    if (result.status === 'open') {
      rememberHuntCard(result);
      this.refreshProgress();
      this.cardView = {
        status: 'open',
        card: result.card,
        foil: scratch({
          label: 'Scratch here',
          onReveal: () => this.revealCard(result.card.id, signal),
        }),
      };
      return;
    }
    this.applyResult(result);
  };

  private applyResult(result: Exclude<HuntResult, { status: 'open' }>) {
    if (result.status === 'earned') {
      rememberHuntCard(result);
      this.refreshProgress();
    }
    this.cardView = result;
  }

  private async revealCard(id: string, signal: AbortSignal) {
    this.revealIssue = '';
    let result = await requestHuntCard(id, 'POST', signal);
    if (signal.aborted) return false;
    this.refreshProgress();
    const saved = this.findEarnedCard(id);
    if (saved) result = { status: 'earned', card: saved };
    if (result.status === 'unavailable') {
      this.revealIssue =
        'Couldn’t save your reveal. Check your connection, then tap Reveal to retry.';
      return false;
    }
    if (result.status === 'open') return false;
    this.applyResult(result);
    await this.updateComplete;
    if (!signal.aborted) {
      this.renderRoot
        .querySelector<HTMLElement>(
          result.status === 'earned' ? '#reveal-heading' : '#hunt-heading',
        )
        ?.focus();
    }
    return result.status === 'earned';
  }

  private readonly openCode = (event: SubmitEvent) => {
    event.preventDefault();
    const input = this.renderRoot.querySelector<HTMLInputElement>('#hunt-code');
    if (!input) return;
    const code = normalizeHuntCode(input.value);
    if (!code) {
      this.codeError = 'Enter the 7 letters or numbers shown with your card.';
      input.focus();
      return;
    }
    this.codeError = '';
    Router.go(huntCardPath(code));
  };

  private readonly bindAlbum = (element?: Element) => {
    this.unbindAlbumMotion?.();
    if (element instanceof HTMLElement && this.phoneInput) {
      this.unbindAlbumMotion = bindAlbumMotion(element, (motion) => {
        this.albumMotion = motion;
      });
    }
  };

  private readonly openReplay = async (card: EarnedHuntCard, event: Event) => {
    if (event.currentTarget instanceof HTMLElement) this.replayTrigger = event.currentTarget;
    this.replay = {
      card,
      foil: scratch({
        label: 'Scratch again',
        content: card.text,
        onReveal: async () => {
          if (this.replay?.card.id !== card.id) return false;
          this.replay = { ...this.replay, revealed: true };
          await this.updateComplete;
          this.renderRoot.querySelector<HTMLElement>('#replay-reveal')?.focus();
          return true;
        },
      }),
      revealed: false,
    };
    await this.updateComplete;
    const dialog = this.renderRoot.querySelector('dialog');
    if (this.isConnected && dialog?.isConnected && !dialog.open) dialog.showModal();
  };

  private readonly closeReplay = () => {
    this.renderRoot.querySelector('dialog')?.close();
    this.replay = undefined;
    this.replayTrigger?.focus({ preventScroll: true });
    this.replayTrigger = undefined;
  };

  private renderReplay() {
    const replay = this.replay;
    if (!replay) return nothing;
    return html`
      <dialog aria-labelledby="replay-title" @close=${this.closeReplay}>
        <article class="ticket replay-ticket">
          <header class="replay-header">
            <h2 id="replay-title">${replay.card.title}</h2>
            <button type="button" class="close-replay" @click=${this.closeReplay} autofocus>
              Close
            </button>
          </header>
          ${
            replay.revealed
              ? html`
                  <section class="reveal-result" aria-labelledby="replay-reveal">
                    <h3 id="replay-reveal" tabindex="-1">Collected card</h3>
                    <p>${replay.card.text}</p>
                  </section>
                `
              : replay.foil
          }
          ${
            this.token === undefined
              ? html`<a
                  class="replay-link"
                  href=${huntCardPath(replay.card.id)}
                  @click=${this.closeReplay}
                >
                  ${replay.card.game ? 'Play the mini-game' : 'Open collected card'}
                </a>`
              : nothing
          }
        </article>
      </dialog>
    `;
  }

  private renderGroups() {
    const groups: HuntGroup[] = this.groups ? [...this.groups] : [];
    for (const entry of this.progress) {
      if (!groups.some((group) => group.id === entry.card.group)) {
        groups.push({
          id: entry.card.group,
          label: fallbackLabels[entry.card.group] ?? 'Saved cards',
          count: 0,
        });
      }
    }
    return groups.map((group) => {
      const entries = this.progress.filter((entry) => entry.card.group === group.id);
      const collected = entries.filter((entry) => entry.state === 'earned').length;
      const unknown = Math.max(0, group.count - entries.length);
      return html`
        <section class="folder" data-group=${group.id}>
          <header class="folder-heading">
            <h2>${group.label}</h2>
            <p>${group.count ? `${collected} / ${group.count}` : collected} collected</p>
          </header>
          ${
            group.id !== 'mystery' && group.hint
              ? html`<p class="folder-hint">${group.hint}</p>`
              : nothing
          }
          <ul class="finds" role="list">
            ${entries.map((entry) => {
              const { card, state } = entry;
              const face = html`
                <span class="foil-art" aria-hidden="true"></span>
                <span class="find-title">${state === 'earned' ? card.title : 'Unopened card'}</span>
                <span class="find-action"
                  >${state === 'earned' ? 'Scratch again' : 'Scratch card'}</span
                >
                ${
                  state === 'earned' && hasHuntPerfect(card.id)
                    ? html`<span class="perfect-stamp">5/5 Signal</span>`
                    : nothing
                }
              `;
              return html`
                <li>
                  ${
                    entry.state === 'earned'
                      ? html`<button
                          class="find earned"
                          type="button"
                          @click=${(event: Event) => this.openReplay(entry.card, event)}
                        >
                          ${face}
                        </button>`
                      : html`<a class="find found" href=${huntCardPath(card.id)}>${face}</a>`
                  }
                </li>
              `;
            })}
            ${Array.from(
              { length: unknown },
              () => html`
                <li class="find unknown" aria-hidden="true">
                  <span class="foil-art"></span><span class="unknown-mark">?</span>
                </li>
              `,
            )}
          </ul>
          ${unknown ? html`<p class="sr-only">${unknown} undiscovered</p>` : nothing}
        </section>
      `;
    });
  }

  private renderCollection() {
    const total = this.groups?.reduce((count, group) => count + group.count, 0);
    const counted = this.progress.filter((entry) =>
      this.groups
        ? this.groups.some((group) => group.id === entry.card.group)
        : entry.card.group !== 'preview',
    );
    const earned = counted.filter((entry) => entry.state === 'earned').length;
    const found = counted.length - earned;
    return html`
      <header class="collection-header">
        <div>
          <h1 id="hunt-heading" tabindex="-1">My Collection</h1>
          <p>
            Find cards on the DevFest site and around the venue. Scratch the foil to keep each find.
          </p>
          <a class="hunt-link" href=${huntSiteLinks.activities}>Explore Y2K activities</a>
        </div>
        <section class="collection-summary" aria-labelledby="progress-heading">
          <h2 id="progress-heading">
            <strong>${earned}${total ? html`<span> / ${total}</span>` : nothing}</strong> collected
          </h2>
          ${total ? html`<progress max=${total} value=${earned} aria-label="Collection progress"></progress>` : nothing}
          <p>
            ${found} ready to
            scratch${total === undefined ? '' : ` · ${Math.max(0, total - counted.length)} undiscovered`}
          </p>
        </section>
      </header>
      <div class="collection-tools">
        <details class="code-panel">
          <summary>Enter a card code</summary>
          <form @submit=${this.openCode} novalidate>
            <label for="hunt-code">Have a card code?</label>
            <div class="code-row">
              <input
                id="hunt-code"
                name="code"
                type="text"
                autocomplete="off"
                spellcheck="false"
                autocapitalize="characters"
                aria-describedby="code-help"
                aria-invalid=${this.codeError ? 'true' : 'false'}
              />
              <button class="primary" type="submit">Open card</button>
            </div>
            <p id="code-help" role="status">
              ${this.codeError || 'Use the code shown with a QR or NFC tag to open it in this browser.'}
            </p>
          </form>
        </details>
        ${
          this.phoneInput && this.groups
            ? html`<div class="album-motion">
                <button
                  class="motion-button"
                  type="button"
                  ?disabled=${['requesting', 'waiting', 'active'].includes(this.albumMotion)}
                  @click=${enableAlbumMotion}
                >
                  ${
                    {
                      requesting: 'Requesting motion…',
                      waiting: 'Tilt your phone',
                      active: 'Tilt active',
                      denied: 'Try phone tilt again',
                      unavailable: 'Try phone tilt again',
                    }[this.albumMotion] ?? 'Enable phone tilt'
                  }
                </button>
              </div>`
            : nothing
        }
      </div>
      ${
        this.groups === undefined
          ? html`<p class="notice" role="status">Loading collection groups…</p>`
          : this.groups === null
            ? html`<div class="notice" role="status">
                Couldn’t load the hunt totals. Your saved cards are still here.
                <button type="button" class="secondary" @click=${this.loadRoute}>Retry</button>
              </div>`
            : nothing
      }
      <div class="folders" ${ref(this.bindAlbum)}>${this.renderGroups()}</div>
    `;
  }

  private renderCard() {
    const view = this.cardView;
    if (view.status === 'open' || view.status === 'earned') {
      return html`
        <article class="ticket">
          <p class="kicker">Y2K Card Hunt</p>
          <h1 id="hunt-heading" tabindex="-1">${view.card.title}</h1>
          ${
            view.status === 'open'
              ? html`${view.foil}
                  <p class="reveal-issue" role="status">${this.revealIssue}</p>`
              : html`
                  <section class="reveal-result" aria-labelledby="reveal-heading">
                    <h2 id="reveal-heading" tabindex="-1">Collected</h2>
                    <p>${view.card.text}</p>
                    <button
                      class="replay-action"
                      type="button"
                      @click=${(event: Event) => this.openReplay(view.card, event)}
                    >
                      Scratch again
                    </button>
                  </section>
                `
          }
        </article>
        ${
          view.status === 'earned' && view.card.game === 'signal'
            ? html`<hunt-signal-game .cardId=${view.card.id}></hunt-signal-game>`
            : nothing
        }
      `;
    }
    const [title, message] = messages[view.status];
    return html`
      <section class="card-status">
        <p class="kicker">Y2K Card Hunt</p>
        <h1 id="hunt-heading" tabindex="-1">${title}</h1>
        <p role="status">${message}</p>
        ${
          view.status === 'unavailable'
            ? html`<button type="button" class="primary" @click=${this.loadRoute}>
                Try again
              </button>`
            : nothing
        }
      </section>
    `;
  }

  protected override render() {
    return html`
      <div class="hunt-shell ${this.token === undefined ? 'collection' : 'card-page'}">
        ${
          this.token === undefined
            ? this.renderCollection()
            : html`<a class="hunt-link collection-link" href="/hunt/"
                  ><span aria-hidden="true">←</span> My Collection</a
                >${this.renderCard()}`
        }
        ${
          !this.storageAvailable
            ? html`<p class="notice" role="status">
                This browser couldn’t save your collection. These finds may disappear when you close
                the tab.
              </p>`
            : nothing
        }
        <footer class="hunt-credit">
          ${this.token === undefined ? html`<p>Your collection stays in this browser. Clearing site data can remove your finds.</p>` : nothing}
          <p>
            Prepared by
            <a
              href="https://www.linkedin.com/in/m-jab/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Michał Jabłoński on LinkedIn (opens in a new tab)"
              >Michał Jabłoński</a
            >. Inspired by
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/PiotrPrus/holographic-lottery-coupon-agsl"
              aria-label="Piotr Prus’s scratch card repository (opens in a new tab)"
              >Piotr Prus’s scratch card</a
            >. The Y2K Vibe Zone and DevFest Quest are separate initiatives developed by
            <strong>Viktoriia</strong>.
          </p>
        </footer>
      </div>
      ${this.renderReplay()}
      <footer-block></footer-block>
    `;
  }
}
