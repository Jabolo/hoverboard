// import { PropertyValues } from '@lit/reactive-element';
import '@power-elements/lazy-image';
import { css, html, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { setHeroSettings } from '../../store/ui/actions';
import { ThemedElement } from '../themed-element';

@customElement('hero-block')
export class HeroBlock extends ThemedElement {
  @property({ type: String, attribute: 'background-image' })
  backgroundImage = '';
  @property({ type: String, attribute: 'background-color' })
  backgroundColor = '#fff';
  @property({ type: String, attribute: 'font-color' })
  fontColor = '#000';
  @property({ type: Boolean, attribute: 'hide-logo' })
  hideLogo = false;

  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          margin-top: -56px;
          display: block;
          border-bottom: 1px solid var(--divider-color);
        }

        .hero-block {
          height: 100%;
          position: relative;
          overflow: hidden;
          background: var(--terminal-background);
          color: inherit;
        }



        .hero-block::before {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            124deg,
            transparent 0 48px,
            rgb(66 133 244 / 8%) 48px 50px,
            transparent 50px 112px
          );
          content: '';
          pointer-events: none;
        }

        .hero-block::after {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 2;
          height: 4px;
          background: linear-gradient(
            90deg,
            var(--google-blue) 0 25%,
            var(--google-green) 25% 50%,
            var(--google-yellow) 50% 75%,
            var(--google-red) 75%
          );
          content: '';
        }

        :host([background-image]) .hero-block {
          background: var(--hero-background, var(--terminal-background));
        }

        .hero-overlay {
          background: linear-gradient(90deg, rgb(7 12 20 / 86%), rgb(7 12 20 / 58%));
          opacity: 0;
          transition: opacity 0.3s;
          position: absolute;
        }

        .hero-overlay[show] {
          opacity: 1;
        }

        .hero-image {
          opacity: 0.38;
          filter: saturate(0.8) contrast(1.05);
          transition: background-color 0.3s;
          position: absolute;
          --lazy-image-fit: cover;
        }

        .container {
          padding: 0;
          width: 100%;
          height: unset;
          z-index: 0;
          position: unset;
        }

        .hero-content {
          padding: 80px 32px 32px;
          position: relative;
          z-index: 1;
        }

        div ::slotted(.hero-command) {
          display: inline-flex;
          margin: 0 0 20px;
          padding: 8px 12px;
          border: 1px solid var(--google-green);
          border-radius: 4px;
          background: rgb(7 12 20 / 55%);
          color: var(--terminal-green);
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        div ::slotted(.hero-title) {
          margin: 30px 0;
          color: inherit;
          font-family: var(--heading-font-family);
          font-size: clamp(40px, 9vw, 84px);
          font-weight: 800;
          letter-spacing: -0.05em;
          line-height: 0.95;
          text-transform: uppercase;
        }

        div ::slotted(.hero-description) {
          margin-bottom: 30px;
          max-width: 600px;
          color: var(--terminal-muted);
          font-size: 16px;
          line-height: 1.65;
        }

        @media (min-width: 812px) {
          :host {
            margin-top: -64px;
          }

          .hero-content {
            padding-top: 120px;
            padding-bottom: 60px;
          }
        }
      `,
    ];
  }

  override render() {
    return html`
      <div
        class="hero-block"
        style="${styleMap({ color: this.fontColor, '--hero-background': this.backgroundColor })}"
        layout
        start
        vertical
        center-justified
      >
        ${this.backgroundImage && this.image}
        <div class="hero-overlay" ?show="${!!this.backgroundImage}" fit></div>
        <div class="container">
          <div class="hero-content">
            <slot></slot>
          </div>
        </div>
      </div>
      <slot name="bottom"></slot>
    `;
  }

  private get image() {
    return html`
      <lazy-image
        class="hero-image"
        src="${this.backgroundImage}"
        alt=""
        role="presentation"
        style="${styleMap({ backgroundColor: this.backgroundColor })}"
        fit
      ></lazy-image>
    `;
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    setHeroSettings({
      backgroundImage: this.backgroundImage,
      backgroundColor: this.backgroundColor,
      fontColor: this.fontColor,
      hideLogo: this.hideLogo,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hero-block': HeroBlock;
  }
}
