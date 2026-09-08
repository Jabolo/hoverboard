import { Failure, Initialized, Pending, Success } from '@abraham/remotedata';
import { computed, customElement, observe, property } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@material/web/button/text-button.js';
import { html, PolymerElement } from '@polymer/polymer';
import '@power-elements/lazy-image';
import { RootState, store } from '../store';
import { closeDialog, openSubscribeDialog } from '../store/dialogs/actions';
import { ReduxMixin } from '../store/mixin';
import { PartnerGroupsState, selectPartnerGroups } from '../store/partners';
import { addPotentialPartner } from '../store/potential-partners/actions';
import {
  initialPotentialPartnersState,
  PotentialPartnersState,
} from '../store/potential-partners/state';
import { queueSnackbar } from '../store/snackbars';
import { loading, partnersBlock } from '../utils/data';
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
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          grid-gap: 16px;
          max-width: 800px;
        }

        .logo-item {
          padding: 20px 28px;
          min-height: 96px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--terminal-panel);
          transition:
            border-color var(--animation),
            box-shadow var(--animation),
            transform var(--animation);
        }

        .logo-item:hover {
          border-color: var(--google-blue);
          box-shadow: 0 0 20px rgba(66, 133, 244, 0.28);
          transform: translateY(-2px);
        }

        .logo-img {
          --lazy-image-width: 100%;
          --lazy-image-height: 56px;
          --lazy-image-fit: contain;
          width: var(--lazy-image-width);
          height: var(--lazy-image-height);
        }

        .cta-button {
          margin-top: 24px;
          color: var(--default-primary-color);
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

        @media (min-width: 640px) {
          .logos-wrapper {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (min-width: 812px) {
          .logos-wrapper {
            grid-template-columns: repeat(5, 1fr);
          }
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

        <template is="dom-repeat" items="[[partners.data]]" as="block">
          <h3 class="block-title">[[block.title]]</h3>
          <div class="logos-wrapper">
            <template is="dom-repeat" items="[[block.items]]" as="logo">
              <a
                class="logo-item"
                href$="[[logo.url]]"
                title$="[[logo.name]]"
                target="_blank"
                rel="noopener noreferrer"
                layout
                horizontal
                center-center
              >
                <lazy-image
                  class="logo-img"
                  src="[[logo.logoUrl]]"
                  alt="[[logo.name]]"
                ></lazy-image>
              </a>
            </template>
          </div>
        </template>

        <p class="empty-state" role="status" hidden$="[[!empty]]">
          Partner announcements will appear here as commitments are confirmed.
        </p>

        <md-text-button class="cta-button animated icon-right" on-click="addPotentialPartner">
          <span>[[partnersBlock.button]]</span>
          <iron-icon icon="hoverboard:arrow-right-circle"></iron-icon>
        </md-text-button>
      </div>
    `;
  }

  private loading = loading;
  private partnersBlock = partnersBlock;

  @property({ type: Object })
  potentialPartners = initialPotentialPartnersState;
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

  @computed('partners')
  get empty() {
    return this.partners instanceof Success && this.partners.data.length === 0;
  }

  override stateChanged(state: RootState) {
    this.partners = selectPartnerGroups(state);
    this.potentialPartners = state.potentialPartners;
  }

  private addPotentialPartner() {
    openSubscribeDialog({
      title: this.partnersBlock.form.title,
      submitLabel: this.partnersBlock.form.submitLabel,
      firstFieldLabel: this.partnersBlock.form.fullName,
      secondFieldLabel: this.partnersBlock.form.companyName,
      submit: (data) => store.dispatch(addPotentialPartner(data)),
    });
  }

  @observe('potentialPartners')
  private onPotentialPartners(potentialPartners: PotentialPartnersState) {
    if (potentialPartners instanceof Success) {
      closeDialog();
      store.dispatch(queueSnackbar(this.partnersBlock.toast));
    }
  }
}
