import { css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { hasUnsupportedTags, unsupportedHtmlTags } from '../../utils/markdown';
import { ThemedElement } from '../themed-element';

marked.use(gfmHeadingId());

export class Markdown extends ThemedElement {
  static override get styles() {
    return [
      ...super.styles,
      css`
        .markdown-html {
          color: var(--terminal-copy);
          font-size: 16px;
          line-height: 1.75;
        }

        .markdown-html h2,
        .markdown-html h3,
        .markdown-html h4 {
          color: var(--terminal-copy);
          font-family: var(--font-mono, monospace);
          letter-spacing: 0.01em;
        }

        .markdown-html h2 {
          margin: 48px 0 20px;
          color: var(--google-blue);
          font-size: clamp(22px, 4vw, 32px);
          text-transform: uppercase;
        }

        .markdown-html h3 {
          margin: 32px 0 12px;
          color: var(--google-green);
          font-size: 20px;
        }

        .markdown-html h4 {
          margin: 24px 0 8px;
          font-size: 16px;
        }

        .markdown-html p,
        .markdown-html ul,
        .markdown-html ol {
          color: var(--terminal-muted);
        }

        .markdown-html a {
          color: var(--google-blue);
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
        }

        .markdown-html blockquote {
          margin: 24px 0;
          padding: 12px 16px;
          border-left: 3px solid var(--google-yellow);
          background: var(--terminal-panel);
          color: var(--terminal-copy);
        }

        .markdown-html code,
        .markdown-html pre {
          font-family: var(--font-mono, monospace);
        }

        .markdown-html code {
          padding: 2px 5px;
          border: 1px solid var(--terminal-line);
          border-radius: 3px;
          background: var(--terminal-panel);
          color: var(--google-yellow);
        }

        .markdown-html pre {
          overflow-x: auto;
          padding: 16px;
          border: 1px solid var(--terminal-line);
          border-radius: var(--border-radius);
          background: var(--terminal-panel);
          color: var(--terminal-copy);
        }

        .markdown-html pre code {
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
        }

        .markdown-html table {
          width: 100%;
          border-collapse: collapse;
          overflow: hidden;
          border: 1px solid var(--terminal-line);
          background: var(--terminal-panel);
        }

        .markdown-html th,
        .markdown-html td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--terminal-line);
          text-align: left;
        }

        .markdown-html th {
          color: var(--google-green);
          font-family: var(--font-mono, monospace);
          text-transform: uppercase;
        }

        @media (max-width: 640px) {
          .markdown-html {
            font-size: 15px;
            line-height: 1.65;
          }
        }
      `,
    ];
  }

  @property()
  content: string = '';

  get document(): DocumentFragment {
    const template = document.createElement('template');
    // Override type as no async extensions are in use
    template.innerHTML = marked.parse(this.content) as string;
    if (hasUnsupportedTags(template.content)) {
      console.warn(`Invalid Markedown contains some of the following tags ${unsupportedHtmlTags}`);
      // TODO: Enable
      // Markdown wraps content in <p> which can not contain <div>s.
      // template.innerHTML = 'Invalid Markedown contains `div` tags.';
    }
    return this.addTargets(template.content);
  }

  override render() {
    return html`<div class="markdown-html">${this.document}</div>`;
  }

  protected addTargets(markdown: DocumentFragment): DocumentFragment {
    markdown.querySelectorAll('a').forEach((element) => {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    });
    return markdown;
  }

  private hasDiv(document: DocumentFragment) {
    return document.querySelector('div') !== null;
  }
}
