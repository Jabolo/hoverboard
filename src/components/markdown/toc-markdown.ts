import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { scrollToElement } from '../../utils/scrolling';
import { Markdown } from './base';

// TODO: Add copy URL to clipboard buttons on headers

type Tree = {
  [id: string]: string[];
};

@customElement('toc-markdown')
export class TocMarkdown extends Markdown {
  static override get styles() {
    return [
      ...super.styles,
      css`
        img {
          width: 100%;
        }

        .content-wrapper {
          position: relative;
          border-top: 1px solid var(--terminal-line);
          border-bottom: 1px solid var(--terminal-line);
          background-color: var(--terminal-panel);
          width: 100%;
          overflow: hidden;
        }

        .content-wrapper::before {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: linear-gradient(
            to right,
            var(--google-blue) 0 25%,
            var(--google-green) 25% 50%,
            var(--google-yellow) 50% 75%,
            var(--google-red) 75% 100%
          );
          content: '';
        }

        .toc-details {
          width: 100%;
        }

        .toc-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          list-style: none;
          padding: 18px 16px;
        }

        .toc-summary::-webkit-details-marker {
          display: none;
        }

        .toc-label {
          margin: 0;
          color: var(--terminal-green);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .toc-toggle-hint {
          color: var(--terminal-muted);
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          text-transform: uppercase;
          border: 1px solid var(--terminal-line);
          padding: 4px 8px;
          border-radius: 4px;
        }

        .content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
          gap: 12px;
          padding: 0 16px 28px;
        }

        .col {
          min-width: 0;
          margin: 0;
          padding: 14px 16px;
          border: 1px solid var(--terminal-line);
          border-radius: var(--border-radius);
          background: var(--terminal-panel-raised);
          box-shadow: inset 0 2px 0 var(--google-blue);
          font-size: 14px;
          line-height: 1.4;
          z-index: 2;
        }

        .col:nth-child(4n + 2) {
          box-shadow: inset 0 2px 0 var(--google-green);
        }

        .col:nth-child(4n + 3) {
          box-shadow: inset 0 2px 0 var(--google-yellow);
        }

        .col:nth-child(4n + 4) {
          box-shadow: inset 0 2px 0 var(--google-red);
        }

        .col-heading {
          color: inherit;
          display: block;
          font-weight: 700;
          text-decoration: none;
        }

        .col-heading:hover,
        .col-heading:focus-visible {
          color: var(--google-blue);
          text-decoration: underline;
          text-underline-offset: 0.2em;
        }

        .col-content {
          margin-top: 8px;
          color: var(--terminal-muted);
          line-height: 1.5;
          display: block;
          font-size: 13px;
        }

        @media (min-width: 640px) {
          .toc-summary {
            cursor: default;
            pointer-events: none;
            padding: 28px 18px 12px;
          }

          .toc-toggle-hint {
            display: none;
          }

          .content,
          .markdown-text,
          .markdown-wrapper {
            padding: 0 18px;
          }

          .toc-label {
            padding-right: 18px;
            padding-left: 18px;
          }

          .content {
            gap: 14px;
            padding-bottom: 32px;
          }

          .col {
            padding: 16px;
          }
        }

        @media (min-width: 812px) {
          .content,
          .markdown-text,
          .markdown-wrapper {
            padding: 0 40px;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      ${this.renderToc}

      <div class="container">
        <div class="markdown-wrapper">${this.document}</div>
      </div>
    `;
  }

  private renderSubheader(headerId: string) {
    const header = this.headers.find((header) => header.id === headerId);
    return html`
      <a
        class="col-content"
        href="${window.location.pathname}#${headerId}"
        @click="${() => this.scrollToId(headerId)}"
        router-ignore
      >
        ${header?.textContent ?? headerId}
      </a>
    `;
  }

  private renderHeader(headerId: string, subheaderIds: string[]) {
    const header = this.headers.find((header) => header.id === headerId);
    return html`
      <div class="col">
        <a
          class="col-heading"
          href="${window.location.pathname}#${headerId}"
          @click="${() => this.scrollToId(headerId)}"
          router-ignore
        >
          ${header?.textContent ?? headerId}
        </a>
        ${subheaderIds.map((subheaderId) => this.renderSubheader(subheaderId))}
      </div>
    `;
  }

  private get renderToc() {
    const topicCount = Object.keys(this.headerIds).length;
    return html`
      <nav class="content-wrapper" aria-label="On this page">
        <div class="container">
          <details class="toc-details" ?open="${this.isDesktop}">
            <summary class="toc-summary">
              <span class="toc-label">// on this page (${topicCount} topics)</span>
              <span class="toc-toggle-hint">tap to toggle</span>
            </summary>
            <div class="content">
              ${Object.keys(this.headerIds).map((headerId) =>
                this.renderHeader(headerId, this.headerIds[headerId]!),
              )}
            </div>
          </details>
        </div>
      </nav>
    `;
  }

  @state()
  private isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 640 : true;

  private handleResize = () => {
    this.isDesktop = window.innerWidth >= 640;
  };

  override connectedCallback() {
    super.connectedCallback();
    this.isDesktop = window.innerWidth >= 640;
    window.addEventListener('resize', this.handleResize);
    const [, id] = window.location.hash.split('#');
    if (id) {
      this.updateComplete.then(() => this.scrollToId(id));
    }
  }

  override disconnectedCallback() {
    window.removeEventListener('resize', this.handleResize);
    super.disconnectedCallback();
  }

  private get headers() {
    return Array.from(this.document.querySelectorAll('h2, h3'));
  }

  private get headerIds(): Tree {
    const tree: Tree = {};
    let parent: string | undefined = undefined;

    for (const header of this.headers) {
      // We care about h2 and h3 tags
      if (header.tagName === 'H2') {
        parent = header.id;
        tree[parent] = [];
      } else if (header.tagName === 'H3') {
        if (!parent || tree[parent] === undefined) {
          throw new Error('Markedown file h2 headers must be after an h3 header');
        }
        tree[parent]!.push(header.id);
      }
    }

    return tree;
  }

  private scrollToId(id: string) {
    const element = this.shadowRoot!.getElementById(id);
    if (element) {
      scrollToElement(element);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toc-markdown': TocMarkdown;
  }
}
