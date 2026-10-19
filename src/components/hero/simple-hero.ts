import { css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { heroSettings } from '../../utils/data';
import { ThemedElement } from '../themed-element';
import './hero-block';

type HeroKeys = keyof typeof heroSettings;
type SimpleHeroKeys = Extract<
  HeroKeys,
  | 'coc'
  | 'blog'
  | 'faq'
  | 'notFound'
  | 'previousSpeakers'
  | 'privacy'
  | 'schedule'
  | 'speakers'
  | 'team'
>;

interface Description {
  description: string;
}

interface Title {
  title: string;
}

const hasDescription = (setting: Description | {}): setting is Description => {
  return 'description' in setting;
};

const hasTitle = (setting: Title | {}): setting is Title => {
  return 'title' in setting;
};

@customElement('simple-hero')
export class SimpleHero extends ThemedElement {
  static override get styles() {
    return [
      ...super.styles,
      css`
        hero-block {
          height: auto;
        }
      `,
    ];
  }

  @property()
  page: SimpleHeroKeys = 'notFound';

  @property({ type: String })
  heading = '';

  @property({ type: Boolean, attribute: 'hide-description' })
  hideDescription = false;

  private renderDescription() {
    if (!this.hideDescription && hasDescription(heroSettings[this.page])) {
      return html`<p class="hero-description">
        ${(heroSettings[this.page] as Description).description}
      </p>`;
    } else {
      return nothing;
    }
  }

  private renderTitle() {
    if (this.heading) return html`<h1 class="hero-title">${this.heading}</h1>`;
    if (hasTitle(heroSettings[this.page])) {
      return html`<h1 class="hero-title">${(heroSettings[this.page] as Title).title}</h1>`;
    } else {
      return nothing;
    }
  }

  override render() {
    return html`
      <hero-block
        background-color="${heroSettings[this.page].background.color}"
        font-color="${heroSettings[this.page].fontColor}"
      >
        <div class="hero-command">&gt; route --page=${this.page}</div>
        ${this.renderTitle()} ${this.renderDescription()}

        <slot></slot>
      </hero-block>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'simple-hero': SimpleHero;
  }
}
