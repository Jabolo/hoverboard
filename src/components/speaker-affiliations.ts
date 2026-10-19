import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '@polymer/iron-icon';
import type { Badge } from '../models/badge';
import '../utils/icons';

/** Company affiliation and community recognition are independent, and may coexist. */
@customElement('speaker-affiliations')
export class SpeakerAffiliations extends LitElement {
  @property({ type: String }) company = '';
  @property({ type: String, attribute: 'logo-url' }) logoUrl = '';
  @property({ type: String, attribute: 'logo-background' }) logoBackground = 'light';
  @property({ type: Array }) badges: Badge[] = [];
  @property({ type: String, reflect: true }) align = 'center';
  @property({ type: Boolean, reflect: true }) compact = false;

  static override styles = css`
    :host {
      display: block;
      max-width: 100%;
    }
    .affiliations {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
    }
    :host([align='start']) .affiliations {
      justify-content: flex-start;
    }
    .company-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 128px;
      height: 40px;
      padding: 8px 12px;
      border-radius: 4px;
      background: #fff;
    }
    .company-mark.dark {
      background: var(--terminal-panel, #10233f);
      border: 1px solid var(--terminal-line, #28435e);
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .company-name,
    .recognition {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--terminal-copy, #eaf2ff);
      font-family: var(--font-body, Arial, sans-serif);
      font-size: 13px;
      line-height: 1.35;
      text-align: left;
    }
    .company-name {
      font-weight: 600;
    }
    .recognition {
      padding: 6px 8px;
      border: 1px solid var(--terminal-line, #28435e);
      border-radius: 4px;
    }
    iron-icon {
      flex-shrink: 0;
      color: var(--google-blue, #4285f4);
      --iron-icon-width: 18px;
      --iron-icon-height: 18px;
    }
    :host([compact]) .company-mark {
      width: 104px;
      height: 32px;
      padding: 6px 10px;
    }
    :host([compact]) .recognition {
      font-size: 12px;
      padding: 4px 6px;
    }
  `;

  override render() {
    const badges = this.badges || [];
    if (!this.company && !badges.length) return nothing;
    return html`
      <div class="affiliations" role="group" aria-label="Company and community recognition">
        ${
          this.company
            ? this.logoUrl
              ? html`<span class="company-mark ${this.logoBackground === 'dark' ? 'dark' : ''}">
                  <img src=${this.logoUrl} alt=${`${this.company} logo`} />
                </span>`
              : html`<span class="company-name">${this.company}</span>`
            : nothing
        }
        ${badges.map(
          (badge) => html`
            <span class="recognition" title=${badge.description}>
              <iron-icon icon=${`hoverboard:${badge.name}`} aria-hidden="true"></iron-icon>
              <span>${badge.name === 'gde' ? 'Google Developer Expert' : badge.description}</span>
            </span>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'speaker-affiliations': SpeakerAffiliations;
  }
}
