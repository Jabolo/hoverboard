import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { codeOfConduct, organizer } from '../utils/data';
import { ThemedElement } from '../components/themed-element';

@customElement('footer-nav')
export class FooterNav extends ThemedElement {
  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          margin: 0 20px;
        }

        .nav-inline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .footer-logo {
          display: block;
          width: 200px;
          height: auto;
          object-fit: contain;
          margin: 0;
          padding: 0;
        }

        .copyright {
          padding: 0;
          margin: 0;
          text-align: left;
        }

        .coc {
          display: inline-flex;
        }

        a {
          color: var(--footer-text-color);
          padding-bottom: 2px;
          text-decoration: none;
        }

        a:hover {
          text-decoration: underline;
        }

        @media (min-width: 768px) {
          :host {
            margin: 15px 0;
          }
        }

        @media (min-width: 505px) {
          .copyright {
            text-align: right;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <div class="nav-inline">
        <a href="/" title="GDG DevFest Warsaw 2026">
          <img
            class="footer-logo"
            src="/images/logos/devfest-2026-wordmark-dark.svg"
            alt="DevFest 2026"
          />
        </a>

        <div class="copyright">
          Based on
          <a href="https://github.com/gdg-x/hoverboard" target="_blank" rel="noopener noreferrer"
            >Project Hoverboard</a
          >
          · <a class="coc" href="/coc">${this.codeOfConduct}</a> ·
          <a class="coc" href="/privacy">Privacy &amp; newsletter</a>
        </div>
      </div>
    `;
  }

  @property({ type: Object })
  private organizer = organizer;

  @property()
  private codeOfConduct = codeOfConduct;
}
