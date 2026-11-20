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
        :host {
          display: block;
          min-height: 80vh;
        }

        img {
          width: 100%;
        }

        .content-wrapper {
          border-top: 1px solid var(--terminal-line);
          border-bottom: 1px solid var(--terminal-line);
          background-color: var(--terminal-panel);
          width: 100%;
        }

        .toc-details {
          width: 100%;
        }

        .toc-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-height: 44px;
          cursor: pointer;
          list-style: none;
          padding: 12px 16px;
          color: var(--terminal-copy);
        }

        .toc-summary::-webkit-details-marker {
          display: none;
        }

        .toc-summary:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: -2px;
        }

        .toc-label {
          margin: 0;
          color: var(--terminal-copy);
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
        }

        .toc-count {
          color: var(--terminal-muted);
          font-size: 13px;
          font-weight: 400;
          margin-left: 6px;
        }

        .toc-chevron {
          width: 16px;
          height: 16px;
          color: var(--terminal-muted);
          flex-shrink: 0;
          transition: transform 150ms ease;
        }

        .toc-details[open] .toc-chevron {
          transform: rotate(180deg);
        }

        .content {
          display: grid;
          grid-template-columns: 1fr;
          gap: 4px 28px;
          padding: 4px 16px 20px;
          margin: 0;
          list-style: none;
        }

        .col {
          min-width: 0;
          margin: 0;
          padding: 0;
          font-size: 14px;
          line-height: 1.45;
        }

        .col-heading {
          display: inline-flex;
          align-items: center;
          min-height: 36px;
          padding: 4px 0;
          color: var(--terminal-copy);
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
        }

        .col-heading:hover,
        .col-heading:focus-visible {
          color: var(--terminal-green);
          text-decoration: underline;
          text-underline-offset: 0.2em;
        }

        .col-content {
          display: block;
          padding: 4px 0 4px 14px;
          color: var(--terminal-muted);
          line-height: 1.45;
          font-size: 13px;
          text-decoration: none;
        }

        .col-content:hover,
        .col-content:focus-visible {
          color: var(--terminal-copy);
          text-decoration: underline;
          text-underline-offset: 0.2em;
        }

        @media (min-width: 640px) {
          .toc-summary {
            padding: 14px 18px 8px;
          }

          .content,
          .markdown-text,
          .markdown-wrapper {
            padding: 0 18px;
          }

          .content {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 4px 32px;
            padding-top: 4px;
            padding-bottom: 24px;
          }
        }

        @media (min-width: 812px) {
          .toc-summary {
            padding: 14px 40px 8px;
          }

          .content,
          .markdown-text,
          .markdown-wrapper {
            padding: 0 40px;
          }

          .content {
            padding-top: 4px;
            padding-bottom: 24px;
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
      <li class="col">
        <a
          class="col-heading"
          href="${window.location.pathname}#${headerId}"
          @click="${() => this.scrollToId(headerId)}"
          router-ignore
        >
          ${header?.textContent ?? headerId}
        </a>
        ${subheaderIds.map((subheaderId) => this.renderSubheader(subheaderId))}
      </li>
    `;
  }

  private get renderToc() {
    const topicCount = this.headers.length;
    return html`
      <nav class="content-wrapper" aria-label="On this page">
        <div class="container">
          <details class="toc-details" ?open="${this.isDesktop}">
            <summary class="toc-summary">
              <span class="toc-label"
                >On this page<span class="toc-count">(${topicCount})</span></span
              >
              <svg
                class="toc-chevron"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </summary>
            <ul class="content">
              ${Object.keys(this.headerIds).map((headerId) =>
                this.renderHeader(headerId, this.headerIds[headerId]!),
              )}
            </ul>
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
