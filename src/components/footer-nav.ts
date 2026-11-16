import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { codeOfConduct, organizer } from '../utils/data';
import { ThemedElement } from '../components/themed-element';
import './google-developers-brand';

@customElement('footer-nav')
export class FooterNav extends ThemedElement {
  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          margin: 18px 20px 0;
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

        .credits {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0 6px;
          margin: 0 0 6px;
          font-size: 12px;
        }

        .linkedin {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          padding: 0;
        }

        .linkedin svg {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }

        a:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: 3px;
          border-radius: 2px;
        }

        .footer-brands {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 18px;
        }

        google-developers-brand {
          --google-developers-brand-width: 155px;
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
        <div class="footer-brands">
          <a href="/" title="GDG DevFest Warsaw 2026">
            <img
              class="footer-logo"
              src="/images/logos/devfest-2026-wordmark-dark.svg"
              alt="DevFest 2026"
            /> </a
          ><google-developers-brand></google-developers-brand>
        </div>

        <div class="copyright">
          <p class="credits">
            <span
              >Made by
              <a
                class="author"
                href="https://michaljablonski.dev/"
                target="_blank"
                rel="noopener noreferrer"
                >Michał Jabłoński</a
              ></span
            >
            <a
              class="linkedin"
              href="https://www.linkedin.com/in/m-jab/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Michał Jabłoński on LinkedIn (opens in a new tab)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
                />
              </svg>
            </a>
            <span
              >· based on
              <a
                href="https://github.com/gdg-x/hoverboard"
                target="_blank"
                rel="noopener noreferrer"
                >Project Hoverboard</a
              ></span
            >
          </p>
          <a class="coc" href="/coc">${this.codeOfConduct}</a> ·
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
