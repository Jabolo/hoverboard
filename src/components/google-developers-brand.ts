import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('google-developers-brand')
export class GoogleDevelopersBrand extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
      max-width: 100%;
    }

    a {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      min-height: 44px;
      padding: 9px 14px;
      border-radius: 5px;
      background: #fff;
    }

    a:focus-visible {
      outline: 3px solid var(--google-blue, #4285f4);
      outline-offset: 3px;
    }

    img {
      display: block;
      width: var(--google-developers-brand-width, 190px);
      max-width: 100%;
      height: auto;
    }
  `;

  override render() {
    return html`<a href="https://developers.google.com/" target="_blank" rel="noopener noreferrer">
      <img src="/images/logos/google-for-developers.svg" alt="Google for Developers" />
    </a>`;
  }
}
