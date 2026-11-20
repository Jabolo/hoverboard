import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('hunt-clue')
export class HuntClue extends LitElement {
  @property() href = '/hunt/';
  @property() label = 'Found something?';
  @property() hint = 'Open a holographic card';
  @property() glyph = '✦';
  static override styles = css`
    :host {
      display: block;
      margin: 18px 0;
      max-width: 600px;
    }
    a {
      display: flex;
      gap: 16px;
      align-items: center;
      min-height: 64px;
      padding: 16px 20px;
      color: #fff8ec;
      background: linear-gradient(120deg, #332344, #211830);
      border: 1px solid #a38ab8;
      border-radius: 12px;
      text-decoration: none;
      font-family: 'Trebuchet MS', sans-serif;
      box-shadow: 0 5px 0 #120b20;
    }
    a:hover {
      border-color: #eaf87f;
      background: #3c2b50;
    }
    a:focus-visible {
      outline: 3px solid #eaf87f;
      outline-offset: 4px;
    }
    .glyph {
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      flex-shrink: 0;
      border-radius: 8px;
      border: 1px solid #eaf87f;
      color: #261934;
      font-size: 25px;
      background: linear-gradient(135deg, #ecf9ce, #d8d4ff, #f8cce9);
    }
    .accent {
      display: inline-block;
      margin-bottom: 4px;
      padding: 2px 7px;
      border-radius: 4px;
      background: #eaf87f;
      color: #21193a;
      font: 700 12px/1.2 monospace;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    strong {
      display: block;
      font-size: 18px;
      line-height: 1.3;
    }
    small {
      display: block;
      color: #e5d8f3;
      margin-top: 5px;
      font-size: 13px;
      line-height: 1.4;
    }
    .arrow {
      color: #eaf87f;
      margin-left: auto;
      font-size: 22px;
    }
    @media (max-width: 420px) {
      a {
        padding: 14px 12px;
        gap: 10px;
      }
      .glyph {
        width: 40px;
        height: 44px;
      }
    }
  `;
  override render() {
    return html`<a href=${this.href} aria-label=${this.label}
      ><span class="glyph" aria-hidden="true">${this.glyph}</span
      ><span
        ><span class="accent" aria-hidden="true">Card Hunt</span><strong>${this.label}</strong
        ><small>${this.hint}</small></span
      ><span class="arrow" aria-hidden="true">↗</span></a
    >`;
  }
}
