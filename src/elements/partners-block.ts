import { Failure, Initialized, Pending, Success } from '@abraham/remotedata';
import { computed, customElement, property } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@material/web/button/text-button.js';
import { html, PolymerElement } from '@polymer/polymer';
import '@power-elements/lazy-image';
import { RootState } from '../store';
import { ReduxMixin } from '../store/mixin';
import { PartnerGroupsState, selectPartnerGroups } from '../store/partners';
import { loading, partnersBlock } from '../utils/data';
import { visiblePartnerGroups } from '../utils/partner-groups';
import '../utils/icons';
import './shared-styles';

@customElement('partners-block')
export class PartnersBlock extends ReduxMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment">
        :host {
          display: block;
          border-bottom: 1px solid var(--divider-color);
          background: var(--primary-background-color);
        }

        .container {
          position: relative;
          padding-top: 76px;
          padding-bottom: 56px;
        }

        .container::before {
          position: absolute;
          top: 28px;
          left: 16px;
          color: var(--google-blue);
          content: '> partners --network';
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .block-title {
          margin: 28px 0 16px;
          color: var(--google-yellow);
          font-family: var(--font-mono, monospace);
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .logos-wrapper {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
          grid-gap: 16px;
          max-width: 800px;
        }

        .logo-item {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 24px;
          padding: 28px;
          min-height: 160px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--terminal-panel);
          transition:
            border-color var(--animation),
            box-shadow var(--animation),
            transform var(--animation);
        }

        .logo-item:hover,
        .logo-item:focus-visible {
          border-color: var(--google-blue);
          outline: 2px solid var(--google-blue);
          outline-offset: 3px;
        }

        .logo-img {
          --lazy-image-width: 100%;
          --lazy-image-height: 88px;
          --lazy-image-fit: contain;
          width: var(--lazy-image-width);
          height: var(--lazy-image-height);
        }

        .cta-button {
          margin-top: 24px;
          color: var(--default-primary-color);
        }

        .partner-contact {
          max-width: 800px;
          margin: 12px 0 0;
          color: var(--primary-text-color);
          font-size: 15px;
          line-height: 1.6;
        }

        .partner-contact a {
          overflow-wrap: anywhere;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .empty-state {
          margin: 24px 0;
          padding: 18px 20px;
          border: 1px solid var(--terminal-line);
          border-radius: var(--border-radius);
          background: var(--terminal-panel);
          color: var(--terminal-muted);
          font-family: var(--font-mono, monospace);
          font-size: 14px;
          line-height: 1.5;
        }

        .partner-description {
          margin: 0;
          color: var(--primary-text-color);
          font-size: 15px;
          line-height: 1.6;
        }
      </style>

      <div class="container">
        <h2 class="container-title">[[partnersBlock.title]]</h2>

        <template is="dom-if" if="[[pending]]">
          <p>[[loading]]</p>
        </template>
        <template is="dom-if" if="[[failure]]">
          <p>Error loading partners.</p>
        </template>

        <template is="dom-repeat" items="[[visibleGroups]]" as="block">
          <h3 class="block-title">[[block.title]]</h3>
          <div class="logos-wrapper">
            <template is="dom-repeat" items="[[block.items]]" as="logo">
              <a
                class="logo-item"
                href$="[[logo.url]]"
                title$="[[logo.name]]"
                target="_blank"
                rel="noopener noreferrer"
              >
                <lazy-image
                  class="logo-img"
                  src="[[logo.logoUrl]]"
                  alt="[[logo.name]]"
                ></lazy-image>
                <template is="dom-if" if="[[logo.description]]">
                  <p class="partner-description">[[logo.description]]</p>
                </template>
              </a>
            </template>
          </div>
        </template>

        <p class="empty-state" role="status" hidden$="[[!empty]]">
          Partner announcements will appear here as commitments are confirmed.
        </p>

        <md-text-button
          class="cta-button animated icon-right"
          href="mailto:partnership@gdgwarsaw.pl?subject=DevFest%20Warsaw%202026%20partnership"
        >
          <span>[[partnersBlock.button]]</span>
          <iron-icon icon="hoverboard:arrow-right-circle"></iron-icon>
        </md-text-button>
        <p class="partner-contact">
          Interested in partnering with DevFest Warsaw 2026? Email
          <a href="mailto:partnership@gdgwarsaw.pl">partnership@gdgwarsaw.pl</a>
          or contact Michał directly at
          <a href="mailto:michal@gdgwarsaw.pl">michal@gdgwarsaw.pl</a>.
        </p>
      </div>
    `;
  }

  private loading = loading;
  private partnersBlock = partnersBlock;

  @property({ type: Object })
  partners: PartnerGroupsState = new Initialized();

  @computed('partners')
  get pending() {
    return this.partners instanceof Pending;
  }

  @computed('partners')
  get failure() {
    return this.partners instanceof Failure;
  }

  @computed('visibleGroups')
  get empty() {
    return this.visibleGroups?.length === 0;
  }

  @computed('partners')
  get visibleGroups() {
    return visiblePartnerGroups(this.partners instanceof Success ? this.partners.data : []);
  }

  override stateChanged(state: RootState) {
    this.partners = selectPartnerGroups(state);
  }
}
