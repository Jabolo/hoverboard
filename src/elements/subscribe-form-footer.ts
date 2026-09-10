import { Failure, Initialized, Success } from '@abraham/remotedata';
import { computed, customElement, property } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@material/web/button/filled-button.js';
import '@material/web/checkbox/checkbox.js';
import '@polymer/paper-input/paper-input';
import { PaperInputElement } from '@polymer/paper-input/paper-input';
import { html, PolymerElement } from '@polymer/polymer';
import { RootState, store } from '../store';
import { ReduxMixin } from '../store/mixin';
import { subscribe } from '../store/subscribe/actions';
import { initialSubscribeState, SubscribeState } from '../store/subscribe/state';
import { subscribeBlock } from '../utils/data';
import '../utils/icons';
import './shared-styles';

@customElement('subscribe-form-footer')
export class SubscribeFormFooter extends ReduxMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment positioning">
        :host {
          --paper-input-container-color: var(--footer-text-color);
          --paper-input-container-focus-color: var(--default-primary-color);
          --paper-input-container-input-color: var(--footer-text-color);
        }

        paper-input {
          padding-bottom: 0;
        }

        paper-input,
        .form-content {
          width: 100%;
        }

        .consent {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          width: 100%;
          margin: 10px 0;
          color: var(--footer-text-color);
          font-size: 12px;
          line-height: 1.45;
        }

        .consent md-checkbox {
          flex: 0 0 auto;
          margin-top: -8px;
        }

        .consent-error {
          width: 100%;
          color: var(--google-yellow);
          font-size: 12px;
        }

        paper-input-container input,
        paper-input-container label {
          font-size: 14px;
        }

        iron-icon {
          margin-bottom: 5px;
        }
      </style>

      <div class="form-content" layout vertical center>
        <paper-input
          id="emailInput"
          on-touchend="_focus"
          type="email"
          label="[[subscribeBlock.yourEmail]]"
          value="{{email}}"
          required
          auto-validate$="[[validate]]"
          error-message="[[subscribeBlock.emailRequired]]"
          autocomplete="email"
          name="email"
          disabled="[[subscribed.data]]"
        >
          <iron-icon
            icon="hoverboard:checked"
            slot="suffix"
            hidden$="[[!subscribed.data]]"
          ></iron-icon>
        </paper-input>
        <label class="consent">
          <md-checkbox
            checked="{{consentGiven}}"
            aria-label="[[subscribeBlock.consentLabel]]"
            on-change="consentChanged"
          ></md-checkbox>
          <span>[[subscribeBlock.consentLabel]]</span>
        </label>
        <div class="consent-error" hidden$="[[!consentError]]">
          [[subscribeBlock.consentRequired]]
        </div>
        <md-filled-button on-click="subscribe" disabled$="[[disabled]]" layout self-end>
          [[ctaLabel]]
        </md-filled-button>
      </div>
    `;
  }

  private subscribeBlock = subscribeBlock;

  @property({ type: Object })
  subscribed: SubscribeState = initialSubscribeState;
  @property({ type: String })
  email = '';
  @property({ type: Boolean })
  consentGiven = false;
  @property({ type: Boolean })
  private consentError = false;

  @property({ type: Boolean })
  private validate = false;

  override stateChanged(state: RootState) {
    this.subscribed = state.subscribed;
  }

  private subscribe() {
    this.validate = true;
    const emailInput = this.shadowRoot!.querySelector<PaperInputElement>('#emailInput');

    if (!this.consentGiven) {
      this.consentError = true;
      return;
    }

    if ((this.initialized || this.failure) && emailInput?.validate()) {
      store.dispatch(subscribe({ email: this.email, consentGiven: true }));
    }
  }

  private consentChanged() {
    if (this.consentGiven) {
      this.consentError = false;
    }
  }

  @computed('subscribed')
  private get ctaLabel() {
    return this.subscribed instanceof Success
      ? this.subscribeBlock.subscribed
      : this.subscribeBlock.subscribe;
  }

  @computed('email', 'consentGiven', 'subscribed')
  private get disabled() {
    return !this.email || !this.consentGiven || this.subscribed instanceof Success;
  }

  @computed('subscribed')
  private get failure() {
    return this.subscribed instanceof Failure;
  }

  @computed('subscribed')
  private get initialized() {
    return this.subscribed instanceof Initialized;
  }
}
