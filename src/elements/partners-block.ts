import { Failure, Initialized, Pending, Success } from '@abraham/remotedata';
import { computed, customElement, property, query } from '@polymer/decorators';
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

        .contact-dialog {
          box-sizing: border-box;
          width: min(580px, calc(100vw - 32px));
          max-height: calc(100dvh - 32px);
          padding: 32px;
          border: 1px solid var(--divider-color);
          border-radius: 16px;
          background: var(--primary-background-color);
          color: var(--primary-text-color);
          overflow: auto;
        }

        .contact-dialog::backdrop {
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(6px);
        }

        .dialog-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .dialog-header h2 {
          margin: 0;
          font-size: 24px;
          line-height: 1.3;
        }

        .dialog-close {
          flex: none;
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          padding: 0;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          color: var(--primary-text-color);
          background: var(--terminal-panel);
          cursor: pointer;
          font-size: 26px;
        }

        .dialog-intro {
          margin: 16px 0 24px;
          font-size: 15px;
          line-height: 1.6;
        }

        .contact-person {
          padding: 20px;
          border: 1px solid var(--divider-color);
          border-radius: 12px;
          background: var(--terminal-panel);
        }

        .contact-person-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
        }

        .contact-person-header h3 {
          margin: 0;
          font-size: 17px;
        }

        .contact-chapter {
          font-size: 12px;
          color: var(--primary-text-color);
        }

        .contact-action {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 16px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          color: var(--primary-text-color);
          text-decoration: none;
        }

        .contact-action + .contact-action {
          margin-top: 12px;
        }

        .contact-action.primary {
          border-color: var(--google-blue);
        }

        .contact-action strong {
          font-size: 14px;
        }

        .contact-action span {
          font-size: 14px;
          overflow-wrap: anywhere;
        }

        .contact-action:hover,
        .contact-action:focus-visible,
        .dialog-close:focus-visible {
          outline: 2px solid var(--google-blue);
          outline-offset: 3px;
        }

        @media (max-width: 480px) {
          .contact-dialog {
            padding: 20px;
          }

          .dialog-header h2 {
            font-size: 21px;
          }

          .contact-person {
            padding: 16px;
          }
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
          on-click="openPartnerContact"
          aria-haspopup="dialog"
          aria-controls="partnerContact"
        >
          <span>[[partnersBlock.button]]</span>
          <iron-icon icon="hoverboard:arrow-right-circle"></iron-icon>
        </md-text-button>
      </div>

      <dialog
        id="partnerContact"
        class="contact-dialog"
        aria-labelledby="partnerContactTitle"
        aria-describedby="partnerContactIntro"
        on-click="dismissPartnerBackdrop"
      >
        <div class="dialog-header">
          <h2 id="partnerContactTitle">Partner with DevFest Warsaw 2026</h2>
          <button
            class="dialog-close"
            type="button"
            aria-label="Close partnership contact"
            on-click="closePartnerContact"
            autofocus
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p id="partnerContactIntro" class="dialog-intro">
          Discuss sponsorship, prizes or community collaboration with our team. Choose a contact
          below to start the conversation.
        </p>
        <div class="contact-person">
          <div class="contact-person-header">
            <h3>Michał Jabłoński</h3>
            <span class="contact-chapter">GDG Warsaw</span>
          </div>
          <a
            class="contact-action primary"
            href="mailto:partnership@gdgwarsaw.pl?subject=DevFest%20Warsaw%202026%20partnership"
          >
            <strong>Email the partnership team ↗</strong>
            <span>partnership@gdgwarsaw.pl</span>
          </a>
          <a
            class="contact-action"
            href="mailto:michal@gdgwarsaw.pl?subject=DevFest%20Warsaw%202026%20partnership"
          >
            <strong>Contact Michał directly ↗</strong>
            <span>michal@gdgwarsaw.pl</span>
          </a>
        </div>
      </dialog>
    `;
  }

  private loading = loading;
  private partnersBlock = partnersBlock;

  @query('#partnerContact')
  private partnerContact!: HTMLDialogElement;

  private openPartnerContact() {
    this.partnerContact.showModal();
  }

  private closePartnerContact() {
    this.partnerContact.close();
  }

  private dismissPartnerBackdrop(event: MouseEvent) {
    if (event.target !== this.partnerContact) return;
    const bounds = this.partnerContact.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      this.closePartnerContact();
    }
  }

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
