import '@material/web/button/filled-button.js';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import { cfpBlock } from '../utils/data';

@customElement('cfp-block')
export class CfpBlock extends ThemedElement {
  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          border-bottom: 1px solid var(--divider-color);
          background: var(--terminal-panel);
        }

        .container {
          position: relative;
          display: grid;
          gap: 28px;
          padding-top: 76px;
          padding-bottom: 64px;
        }

        .kicker {
          position: absolute;
          top: 28px;
          left: 16px;
          color: var(--google-yellow);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .content {
          max-width: 620px;
        }

        h2 {
          margin: 0;
          color: var(--primary-text-color);
          font-family: var(--font-mono, monospace);
          font-size: clamp(30px, 5vw, 52px);
          letter-spacing: -0.025em;
          line-height: 1.02;
        }

        p {
          margin: 18px 0 0;
          color: var(--secondary-text-color);
          font-size: 17px;
          line-height: 1.7;
        }

        .facts {
          display: grid;
          gap: 10px;
          margin: 26px 0 0;
          padding: 0;
          list-style: none;
        }

        .fact {
          display: flex;
          align-items: baseline;
          gap: 10px;
          color: var(--terminal-copy);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          line-height: 1.4;
        }

        .fact::before {
          color: var(--terminal-green);
          content: '✓';
          font-weight: 800;
        }

        .action-panel {
          align-self: end;
          padding: 24px;
          border: 1px solid rgb(126 242 165 / 46%);
          border-radius: 10px;
          background: rgb(126 242 165 / 7%);
        }

        md-filled-button {
          width: 100%;
          --md-filled-button-container-color: var(--google-green);
          --md-filled-button-label-text-color: #06101a;
          --md-filled-button-container-height: 48px;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        md-filled-button[disabled] {
          --md-filled-button-disabled-container-color: var(--google-green);
          --md-filled-button-disabled-container-opacity: 1;
          --md-filled-button-disabled-label-text-color: #06101a;
          --md-filled-button-disabled-label-text-opacity: 1;
        }

        .note {
          margin: 14px 0 0;
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.5;
          text-align: center;
        }

        @media (min-width: 720px) {
          .container {
            grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
            gap: clamp(32px, 6vw, 88px);
          }

          .action-panel {
            margin-bottom: 4px;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <section class="container" aria-labelledby="cfp-title">
        <span class="kicker">${cfpBlock.kicker}</span>
        <div class="content">
          <h2 id="cfp-title">${cfpBlock.title}</h2>
          <p>${cfpBlock.description}</p>
          <ul class="facts" aria-label="Call for Papers details">
            <li class="fact">${cfpBlock.openTo}</li>
            <li class="fact">${cfpBlock.formats}</li>
            <li class="fact">${cfpBlock.platform}</li>
          </ul>
        </div>

        <div class="action-panel">
          <md-filled-button disabled aria-describedby="cfp-note">${cfpBlock.cta}</md-filled-button>
          <p class="note" id="cfp-note">${cfpBlock.note}</p>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cfp-block': CfpBlock;
  }
}
