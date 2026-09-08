import { Success } from '@abraham/remotedata';
import '@polymer/app-layout/app-toolbar/app-toolbar';
import { computed, customElement, observe, property } from '@polymer/decorators';
import '@material/web/button/filled-button.js';
import '@polymer/paper-icon-button';
import '@polymer/paper-menu-button';
import '@polymer/paper-tabs';
import { html, PolymerElement } from '@polymer/polymer';
import { Hero } from '../models/hero';
import { selectRouteName } from '../router';
import { RootState } from '../store';
import { signOut as signOutAction } from '../store/auth/actions';
import { closeDialog, openSigninDialog } from '../store/dialogs/actions';
import { selectIsDialogOpen } from '../store/dialogs/selectors';
import { DIALOG } from '../store/dialogs/types';
import { ReduxMixin } from '../store/mixin';
import { initialTicketsState, TicketsState } from '../store/tickets/state';
import { initialUiState } from '../store/ui/state';
import { initialUserState } from '../store/user/state';
import {
  buyTicket,
  disabledSchedule,
  eveneaEmbed,
  navigation,
  signIn,
  signOut as signOutText,
  ticketingPreview,
  title,
} from '../utils/data';
import './notification-toggle';
import './shared-styles';

export const HEADER_HEIGHT = 76;

@customElement('header-toolbar')
export class HeaderToolbar extends ReduxMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment positioning">
        :host {
          --iron-icon-fill-color: currentColor;
          display: block;
          z-index: 1;
          border-bottom: 1px solid var(--divider-color);
          background-color: var(--primary-background-color);
          transition:
            background-color var(--animation),
            border-bottom-color var(--animation),
            color var(--animation);
          color: var(--primary-text-color);
          font-family: var(--font-mono);
        }

        :host([transparent]) {
          --iron-icon-fill-color: var(--hero-font-color, '#fff');
          background-color: transparent;
          border-bottom-color: transparent;
          color: var(--hero-font-color, '#fff');
          text-shadow: 0 1px 18px rgb(0 0 0 / 38%);
        }

        :host([transparent]) .toolbar-brand {
          color: var(--hero-font-color, #fff);
        }

        app-toolbar {
          margin: 0 auto;
          min-height: 68px;
          padding: 0 16px;
          height: auto;
          max-width: var(--max-container-width);
        }

        .toolbar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: inherit;
          text-decoration: none;
        }

        .toolbar-logo {
          display: block;
          width: 38px;
          height: 30px;
          object-fit: contain;
        }

        .toolbar-title {
          color: inherit;
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.045em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .nav-items {
          --paper-tabs-selection-bar-color: var(--terminal-green);
          --paper-tabs: {
            height: 64px;
          };
        }

        .nav-item a,
        .signin-tab {
          padding: 0 14px;
          color: inherit;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .nav-item a:hover,
        .signin-tab:hover {
          color: var(--terminal-green);
        }

        paper-icon-button {
          color: inherit;
        }

        .profile-image {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-position: center;
          background-size: cover;
        }

        .dropdown-panel {
          padding: 24px;
          max-width: 300px;
          background: var(--terminal-panel);
          font-size: 16px;
          color: var(--primary-text-color);
        }

        .dropdown-panel p {
          margin-top: 0;
        }

        .dropdown-panel .panel-actions {
          margin: 0 -16px -16px 0;
        }

        .profile-details .profile-image {
          margin-right: 16px;
          width: 48px;
          height: 48px;
        }

        .profile-name,
        .profile-email {
          font-size: 14px;
          display: block;
          white-space: nowrap;
          color: var(--secondary-text-color);
        }

        .profile-action {
          display: inline-block;
          margin-top: 4px;
          border: 0;
          padding: 0;
          background: transparent;
          font: inherit;
          text-transform: uppercase;
          color: var(--terminal-green);
          font-size: 14px;
          cursor: pointer;
        }

        md-filled-button iron-icon {
          margin-right: 8px;
          --iron-icon-fill-color: var(--hero-font-color);
        }

        .buy-button {
          margin-top: 12px;
          --md-filled-button-container-color: var(--google-blue);
          --md-filled-button-hover-container-color: var(--terminal-green);
          --md-filled-button-label-text-color: #fff;
          --md-filled-button-hover-label-text-color: #06101a;
          --md-filled-button-container-height: 42px;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        @media (min-width: 640px) {
          app-toolbar {
            padding: 0 36px;
            height: initial;
          }
        }
      </style>

      <app-toolbar class="header">
        <div>
          <paper-icon-button
            icon="hoverboard:menu"
            hidden$="[[viewport.isLaptopPlus]]"
            aria-label="Open navigation menu"
            on-click="openDrawer"
          ></paper-icon-button>
        </div>
        <div layout horizontal center flex>
          <a class="toolbar-brand" href="/" title="[[logoTitle]]">
            <img class="toolbar-logo" src="/images/logos/gdg.svg" alt="Google Developer Groups" />
            <span class="toolbar-title">GDG Warsaw</span>
          </a>
        </div>

        <paper-tabs
          class="nav-items"
          selected="[[routeName]]"
          attr-for-selected="name"
          hidden$="[[!viewport.isLaptopPlus]]"
          role="navigation"
          noink
        >
          <template is="dom-repeat" items="[[navigation]]" as="nav">
            <paper-tab name="[[nav.route]]" class="nav-item" link tabindex="-1">
              <a href="[[nav.permalink]]" layout vertical center-center>[[nav.label]]</a>
            </paper-tab>
          </template>

          <paper-tab
            class="signin-tab"
            on-click="signIn"
            link
            hidden$="[[shouldHideAccountEntry(signedIn, hasAttendeeAgenda)]]"
          >
            [[signInText]]
          </paper-tab>

          <md-filled-button
            class="buy-button"
            href$="[[registrationUrl]]"
            on-click="requestRegistration"
            hidden$="[[!ticketUrl]]"
          >
            [[registrationActionLabel]]
          </md-filled-button>
        </paper-tabs>

        <notification-toggle hidden$="[[!hasAttendeeAgenda]]"></notification-toggle>

        <paper-menu-button
          class="auth-menu"
          hidden$="[[!signedIn]]"
          vertical-align="top"
          horizontal-align="right"
          no-animations
          layout
          horizontal
          center-center
        >
          <div
            class="profile-image"
            slot="dropdown-trigger"
            style$="background-image: url('[[user.data.photoURL]]')"
          ></div>
          <div class="dropdown-panel profile-details" slot="dropdown-content" layout horizontal>
            <div
              class="profile-image"
              slot="dropdown-trigger"
              self-center
              style$="background-image: url('[[user.data.photoURL]]')"
            ></div>
            <div layout vertical center-justified>
              <span class="profile-name">[[user.data.displayName]]</span>
              <span class="profile-email">[[user.data.email]]</span>
              <button class="profile-action" type="button" on-click="signOut">
                [[signOutText]]
              </button>
            </div>
          </div>
        </paper-menu-button>

        <paper-icon-button
          icon="hoverboard:account"
          aria-label="Sign in"
          on-click="signIn"
          hidden$="[[isAccountIconHidden(signedIn, viewport.isLaptopPlus, hasAttendeeAgenda)]]"
        ></paper-icon-button>
      </app-toolbar>
    `;
  }

  private logoTitle = title;
  private signInText = signIn;
  private navigation = navigation;
  private signOutText = signOutText;
  private buyTicket = buyTicket;
  private hasAttendeeAgenda = !disabledSchedule;
  private registrationActionLabel = eveneaEmbed.requiresAccessCode ? ticketingPreview : buyTicket;

  @property({ type: Boolean, notify: true })
  drawerOpened: boolean = false;
  @property({ type: Object })
  tickets: TicketsState = initialTicketsState;

  @property({ type: Object })
  private viewport = initialUiState.viewport;
  @property({ type: Object })
  private heroSettings = initialUiState.heroSettings;
  @property({ type: Boolean })
  private signedIn = false;
  @property({ type: Object })
  private user = initialUserState;
  @property({ type: Boolean, reflectToAttribute: true })
  private transparent = false;
  @property({ type: String })
  private routeName = '';
  @property({ type: Boolean })
  private isDialogOpen = false;

  override stateChanged(state: RootState) {
    this.user = state.user;
    this.signedIn = state.user instanceof Success;
    this.tickets = state.tickets;
    this.heroSettings = state.ui.heroSettings;
    this.viewport = state.ui.viewport;
    this.routeName = selectRouteName(window.location.pathname);
    this.isDialogOpen = selectIsDialogOpen(state, DIALOG.SIGNIN);
  }

  override connectedCallback() {
    super.connectedCallback();
    this.onScroll = this.onScroll.bind(this);
    window.addEventListener('scroll', this.onScroll);
    this.onScroll();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('scroll', this.onScroll);
  }

  private openDrawer() {
    this.drawerOpened = true;
  }

  private signIn() {
    openSigninDialog();
  }

  private signOut() {
    signOutAction();
  }

  private requestRegistration(e: Event) {
    if (window.location.pathname !== '/') return;
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('registration-request', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onScroll() {
    this.transparent = document.documentElement.scrollTop === 0;
  }

  @observe('signedIn')
  private onSignedIn() {
    if (this.isDialogOpen) {
      closeDialog();
    }
  }

  private shouldHideAccountEntry(signedIn: boolean, hasAttendeeAgenda: boolean) {
    return signedIn || !hasAttendeeAgenda;
  }

  private isAccountIconHidden(
    signedIn: boolean,
    isTabletPlus: boolean,
    hasAttendeeAgenda: boolean,
  ) {
    return signedIn || isTabletPlus || !hasAttendeeAgenda;
  }

  @computed('tickets')
  private get ticketUrl() {
    if (this.tickets instanceof Success && this.tickets.data.length > 0) {
      const availableTicket = this.tickets.data.find((ticket) => ticket.available);
      return availableTicket?.url || '';
    } else {
      return '';
    }
  }

  @computed('tickets')
  private get registrationUrl() {
    return this.ticketUrl ? '/#registration' : '';
  }

  @observe('heroSettings')
  private onHeroSettings(settings: Hero) {
    if (!settings) return;
    this.updateStyles({
      '--hero-font-color': settings.fontColor || '',
      '--hero-logo-opacity': settings.hideLogo ? '0' : '1',
      '--hero-logo-color': settings.backgroundImage ? '#fff' : 'var(--default-primary-color)',
    });
  }
}
