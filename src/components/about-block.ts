import '@material/web/button/text-button.js';
import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { openVideoDialog } from '../store/ui/actions';
import { aboutBlock } from '../utils/data';
import { ThemedElement } from './themed-element';

@customElement('about-block')
export class AboutBlock extends ThemedElement {
  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          border-bottom: 1px solid var(--divider-color);
          background: var(--primary-background-color);
        }

        .container {
          position: relative;
          padding-top: 76px;
          padding-bottom: 56px;
          display: grid;
          grid-gap: 32px;
          grid-template-columns: 1fr;
        }

        .container::before {
          position: absolute;
          top: 28px;
          left: 16px;
          color: var(--terminal-green);
          content: '> about --event';
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        p {
          color: var(--secondary-text-color);
          line-height: 1.7;
        }

        .statistics-block {
          width: 100%;
          display: grid;
          grid-gap: 32px 16px;
          grid-template-columns: repeat(2, 1fr);
        }

        .item {
          padding: 16px 12px 14px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--secondary-background-color);
        }

        .numbers {
          color: var(--google-green);
          font-family: var(--font-mono, monospace);
          font-size: 40px;
          font-weight: 800;
        }

        .numbers::after {
          content: '';
          display: block;
          height: 2px;
          width: 64px;
          background-color: var(--default-primary-color);
        }

        .label {
          margin-top: 4px;
          color: var(--secondary-text-color);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        md-text-button {
          --md-text-button-label-text-color: var(--google-blue);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .cta-arrow {
          margin-left: 8px;
          color: currentColor;
          font-size: 18px;
          line-height: 1;
        }

        @media (min-width: 640px) {
          .content {
            grid-gap: 64px;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          }

          .statistics-block {
            grid-gap: 32px;
          }

          .numbers {
            font-size: 56px;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <div class="container">
        <div>
          <h2 class="container-title">${aboutBlock.title}</h2>
          <p>${aboutBlock.callToAction.featuredSessions.description}</p>
          <a
            href="${aboutBlock.callToAction.featuredSessions.link}"
            target="${aboutBlock.callToAction.featuredSessions.link.startsWith('http') ? '_blank' : nothing}"
            rel="${aboutBlock.callToAction.featuredSessions.link.startsWith('http') ? 'noopener noreferrer' : nothing}"
          >
            <md-text-button class="animated icon-right" trailing-icon>
              <span class="cta-label">${aboutBlock.callToAction.featuredSessions.label}</span>
              <span class="cta-arrow" slot="icon" aria-hidden="true">→</span>
            </md-text-button>
          </a>

          ${
            aboutBlock.callToAction.howItWas.youtubeId
              ? html`
                  <p>${aboutBlock.callToAction.howItWas.description}</p>
                  <md-text-button
                    class="animated icon-right"
                    @click="${() => this.playVideo()}"
                    trailing-icon
                  >
                    <span>${aboutBlock.callToAction.howItWas.label}</span>
                    <span class="cta-arrow" slot="icon" aria-hidden="true">→</span>
                  </md-text-button>
                `
              : nothing
          }
        </div>

        <div class="statistics-block">
          <div class="item">
            <div class="numbers">${aboutBlock.statisticsBlock.attendees.number}</div>
            <div class="label">${aboutBlock.statisticsBlock.attendees.label}</div>
          </div>

          <div class="item">
            <div class="numbers">${aboutBlock.statisticsBlock.days.number}</div>
            <div class="label">${aboutBlock.statisticsBlock.days.label}</div>
          </div>

          <div class="item">
            <div class="numbers">${aboutBlock.statisticsBlock.sessions.number}</div>
            <div class="label">${aboutBlock.statisticsBlock.sessions.label}</div>
          </div>

          <div class="item">
            <div class="numbers">${aboutBlock.statisticsBlock.tracks.number}</div>
            <div class="label">${aboutBlock.statisticsBlock.tracks.label}</div>
          </div>
        </div>
      </div>
    `;
  }

  private playVideo() {
    openVideoDialog({
      title: aboutBlock.callToAction.howItWas.label,
      youtubeId: aboutBlock.callToAction.howItWas.youtubeId,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'about-block': AboutBlock;
  }
}
