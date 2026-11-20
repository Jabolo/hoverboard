import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { state } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import { isReleaseReviewHost } from '../utils/speakers-preview-data';

const localHosts = ['localhost', '127.0.0.1', '[::1]', '::1'];

/** Hosted review channels have no credit function; loopback can run its own test endpoint. */
export function isHostedCreditReview(hostname: string): boolean {
  return !localHosts.includes(hostname) && isReleaseReviewHost(hostname);
}

@customElement('cloud-credit-block')
export class CloudCreditBlock extends ThemedElement {
  @state() private claimState:
    'loading' | 'upcoming' | 'open' | 'closed' | 'error' | 'preview-unavailable' = 'loading';
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private readonly hostedReviewPreview = isHostedCreditReview(window.location.hostname);
  private readonly previewMode =
    localHosts.includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get('creditPreview') === 'open';

  override connectedCallback() {
    super.connectedCallback();
    void this.refreshClaimState();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this.refreshTimer);
  }

  private get endpoint() {
    return this.previewMode ? '/api/cloud-credit?preview=open' : '/api/cloud-credit';
  }

  private async refreshClaimState() {
    if (this.hostedReviewPreview) {
      this.claimState = 'preview-unavailable';
      return;
    }
    let delay = 30_000;
    try {
      const response = await fetch(this.endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error('Status unavailable');
      const data = await response.json();
      if (!['upcoming', 'open', 'closed'].includes(data.status)) throw new Error('Invalid status');
      this.claimState = data.status;
      if (
        data.status === 'upcoming' &&
        Number.isFinite(data.opensAt) &&
        Number.isFinite(data.serverTime)
      ) {
        delay = Math.min(delay, Math.max(250, data.opensAt - data.serverTime + 100));
      }
    } catch {
      this.claimState = 'error';
    }
    if (this.isConnected)
      this.refreshTimer = setTimeout(() => void this.refreshClaimState(), delay);
  }

  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          background: var(--terminal-panel-raised, #0e1a2b);
          border-bottom: 1px solid var(--divider-color, #263b56);
          color: var(--terminal-copy, #e6eefc);
        }
        section {
          display: grid;
          gap: 24px;
          max-width: 1216px;
          margin: auto;
          padding: 42px 24px;
        }
        h2 {
          margin: 0;
          font-size: clamp(26px, 3vw, 36px);
          line-height: 1.15;
          letter-spacing: -0.02em;
        }
        h2 span {
          color: var(--terminal-green, #7ef2a5);
        }
        p {
          max-width: 65ch;
          margin: 12px 0 0;
          line-height: 1.6;
        }
        .details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--terminal-line, #31445f);
        }
        .detail {
          display: grid;
          gap: 3px;
        }
        .label {
          color: var(--terminal-muted, #a8b9d1);
          font-size: 13px;
        }
        .value {
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .note {
          color: var(--terminal-muted, #a8b9d1);
          font-size: 14px;
        }
        .claim {
          margin-top: 20px;
        }
        .claim a {
          display: inline-flex;
          align-items: center;
          min-height: 48px;
          padding: 0 20px;
          border-radius: 4px;
          background: #4285f4;
          color: #fff;
          text-decoration: none;
          font-weight: 700;
        }
        .claim a:hover {
          background: #2e6fdc;
        }
        .claim a:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 3px;
        }
        .claim p {
          margin: 0;
        }
        @media (min-width: 760px) {
          section {
            grid-template-columns: minmax(0, 1fr) minmax(280px, 0.65fr);
            align-items: center;
            gap: 48px;
            padding: 54px 24px;
          }
          .details {
            grid-template-columns: 1fr;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <section aria-labelledby="credit-title">
        <div>
          <h2 id="credit-title">
            <span>$5 Google Cloud credits</span> for your next idea and workshops
          </h2>
          <p>
            Try something in Google Cloud at DevFest. Credits will be available to eligible
            attendees.
          </p>
          <p class="note">330 credits available. Eligibility and redemption conditions apply.</p>
          <div class="claim" aria-live="polite">
            ${
              this.claimState === 'open'
                ? html`<a
                      router-ignore
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Claim your $5 credit (opens in a new tab)"
                      href=${this.previewMode ? '/api/cloud-credit?claim=1&preview=open' : '/api/cloud-credit?claim=1'}
                      >Claim your $5 credit</a
                    >${this.previewMode ? html`<p class="note">Local test — Google’s claim window is not open yet.</p>` : ''}`
                : this.claimState === 'upcoming'
                  ? html`<p>Claim button opens at 09:00 on 21 November.</p>`
                  : this.claimState === 'closed'
                    ? html`<p>The claim window has closed.</p>`
                    : this.claimState === 'error'
                      ? html`<p>
                          Claim status is temporarily unavailable. Please check back shortly.
                        </p>`
                      : this.claimState === 'preview-unavailable'
                        ? html`<p>Claim status is unavailable in this preview.</p>`
                        : html`<p>Checking claim availability…</p>`
            }
          </div>
        </div>
        <div class="details" aria-label="Credit timing">
          <div class="detail">
            <span class="label">Claim window · 21 November</span
            ><span class="value">09:00–19:00 Warsaw time</span>
          </div>
          <div class="detail">
            <span class="label">Credit validity</span
            ><span class="value">12 hours after you claim it</span>
          </div>
        </div>
      </section>
    `;
  }
}
