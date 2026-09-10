import { Success } from '@abraham/remotedata';
import { computed, customElement, property } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@material/web/button/text-button.js';
import { html, PolymerElement } from '@polymer/polymer';
import { DialogData } from '../models/dialog-form';
import { RootState, store } from '../store';
import { openSubscribeDialog } from '../store/dialogs/actions';
import { ReduxMixin } from '../store/mixin';
import { subscribe } from '../store/subscribe/actions';
import { initialSubscribeState, SubscribeState } from '../store/subscribe/state';
import { initialUiState } from '../store/ui/state';
import { initialUserState } from '../store/user/state';
import { subscribeBlock } from '../utils/data';
import '../utils/icons';
import './shared-styles';

@customElement('subscribe-block')
export class SubscribeBlock extends ReduxMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment">
        :host {
          display: flex;
          width: 100%;
          position: relative;
          border-bottom: 1px solid var(--divider-color);
          background: var(--terminal-panel-raised);
          color: var(--terminal-copy);
          padding: 16px 0;
        }

        :host::before {
          position: absolute;
          top: 0;
          right: 0;
          left: 0;
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

        .description {
          font-size: 24px;
          line-height: 1.5;
          margin: 0 0 16px;
        }

        md-text-button {
          color: var(--terminal-green);
          --md-text-button-label-text-color: var(--terminal-green);
          --md-text-button-hover-label-text-color: var(--terminal-copy);
        }

        md-text-button[disabled] {
          background: var(--terminal-panel-raised);
          color: var(--terminal-green);
        }

        @media (min-width: 640px) {
          :host {
            padding: 32px 0;
          }

          .description {
            font-size: 32px;
            margin: 0 0 24px;
            text-align: center;
          }
        }
      </style>

      <div class="container" layout vertical center$="[[viewport.isTabletPlus]]">
        <div class="description">[[subscribeBlock.callToAction.description]]</div>
        <div class="cta-button">
          <md-text-button
            class="animated icon-right"
            disabled$="[[subscribed.data]]"
            on-click="subscribe"
          >
            <span class="cta-label">[[ctaLabel]]</span>
            <iron-icon icon$="hoverboard:[[ctaIcon]]"></iron-icon>
          </md-text-button>
        </div>
      </div>
    `;
  }

  private subscribeBlock = subscribeBlock;

  @property({ type: Object })
  subscribed: SubscribeState = initialSubscribeState;

  @property({ type: Object })
  private user = initialUserState;
  @property({ type: Object })
  private viewport = initialUiState.viewport;

  override stateChanged(state: RootState) {
    this.subscribed = state.subscribed;
    this.user = state.user;
    this.viewport = state.ui.viewport;
  }

  @computed('subscribed')
  private get ctaIcon() {
    return this.subscribed instanceof Success ? 'checked' : 'arrow-right-circle';
  }

  @computed('subscribed')
  private get ctaLabel() {
    return this.subscribed instanceof Success
      ? this.subscribeBlock.subscribed
      : this.subscribeBlock.callToAction.label;
  }

  private subscribe() {
    let userData = {
      firstFieldValue: '',
      secondFieldValue: '',
    };

    if (this.user instanceof Success) {
      const name = this.user.data.displayName?.split(' ') || ['', ''];
      userData = {
        firstFieldValue: name[0] || '',
        secondFieldValue: name[1] || '',
      };
    }

    openSubscribeDialog({
      title: this.subscribeBlock.formTitle,
      submitLabel: this.subscribeBlock.subscribe,
      firstFieldLabel: this.subscribeBlock.firstName,
      secondFieldLabel: this.subscribeBlock.lastName,
      firstFieldValue: userData.firstFieldValue,
      secondFieldValue: userData.secondFieldValue,
      submit: (data) => this.subscribeAction(data),
    });
  }

  private subscribeAction(data: DialogData) {
    store.dispatch(subscribe(data));
  }
}
