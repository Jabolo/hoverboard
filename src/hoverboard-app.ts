import { Success } from '@abraham/remotedata';
import '@polymer/app-layout/app-drawer-layout/app-drawer-layout';
import '@polymer/app-layout/app-drawer/app-drawer';
import { AppDrawerElement } from '@polymer/app-layout/app-drawer/app-drawer';
import '@polymer/app-layout/app-header-layout/app-header-layout';
import '@polymer/app-layout/app-header/app-header';
import '@polymer/app-layout/app-toolbar/app-toolbar';
import { computed, customElement, property, query } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@polymer/iron-selector/iron-selector';
import { html, PolymerElement } from '@polymer/polymer';
import {
  setPassiveTouchGestures,
  setRemoveNestedTemplates,
  setSuppressTemplateNotifications,
} from '@polymer/polymer/lib/utils/settings';
import './components/snack-bar';
import './components/cookie-consent';
import './elements/dialogs/feedback-dialog';
import './elements/dialogs/signin-dialog';
import './elements/dialogs/subscribe-dialog';
import './elements/dialogs/video-dialog';
import './elements/footer-block';
import './elements/header-toolbar';
import './elements/shared-styles';
import { selectRouteName, startRouter } from './router';
import { RootState, store } from './store';
import { onUser } from './store/auth/actions';
import { queueSnackbar } from './store/snackbars';
import { fetchTickets } from './store/tickets/actions';
import { initialTicketsState } from './store/tickets/state';
import { OpenedChanged } from './utils/app-drawer';
import {
  buyTicket,
  dates,
  eveneaEmbed,
  location,
  navigation,
  offlineMessage,
  signInProviders,
  ticketingPreview,
} from './utils/data';
import './utils/icons';
import './utils/media-query';
import { Stickied } from './utils/stickied';
import { scrollToElement } from './utils/scrolling';

setPassiveTouchGestures(true);
setRemoveNestedTemplates(true);
setSuppressTemplateNotifications(true);

@customElement('hoverboard-app')
export class HoverboardApp extends PolymerElement {
  static get template() {
    return html`
      <style include="shared-styles flex flex-reverse flex-alignment positioning">
        :host {
          display: block;
          position: relative;
          min-height: 100%;
          height: 100%;
          background: var(--terminal-background);
          color: var(--primary-text-color);
          --paper-menu-button-dropdown-background: var(--primary-background-color);
          --app-drawer-content-container: {
            display: flex;
            flex-direction: column;
            background: var(--terminal-panel);
            color: var(--primary-text-color);
          };
        }

        .skip-link {
          position: fixed;
          z-index: 10;
          top: 12px;
          left: 12px;
          transform: translateY(-180%);
          padding: 10px 14px;
          border: 2px solid var(--google-yellow);
          background: var(--terminal-background);
          color: var(--terminal-copy);
          font-family: var(--font-mono);
          font-weight: 700;
          text-decoration: none;
          transition: transform 0.2s ease-out;
        }

        .skip-link:focus {
          transform: translateY(0);
        }

        app-drawer {
          background: var(--terminal-panel);
          color: var(--primary-text-color);
        }

        app-drawer app-toolbar {
          padding: 28px 24px 24px;
          background: var(--terminal-panel);
          border-bottom: 1px solid var(--divider-color);
        }

        app-drawer .toolbar-logo {
          width: 176px;
          height: 98px;
          object-fit: contain;
        }

        app-drawer .dates {
          margin-top: 24px;
          color: var(--terminal-green);
          font-family: var(--font-mono);
          font-size: 22px;
          line-height: 0.95;
        }

        app-drawer .location {
          margin-top: 4px;
          font-family: var(--font-mono);
          font-size: 15px;
          color: var(--secondary-text-color);
        }

        .drawer-list {
          padding: 16px 0;
          display: block;
          background: var(--terminal-panel);
        }

        .drawer-list a {
          display: block;
          border-left: 3px solid transparent;
          color: var(--primary-text-color);
          font-family: var(--font-mono);
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          outline: 0;
          transition:
            color var(--animation),
            background-color var(--animation),
            border-color var(--animation);
        }

        app-drawer a {
          padding: 12px 24px;
        }

        .drawer-list a.selected {
          border-left-color: var(--google-green);
          background: rgb(126 242 165 / 8%);
          color: var(--terminal-green);
          font-weight: 700;
        }

        app-toolbar {
          height: auto;
        }

        .toolbar-logo {
          --lazy-image-width: 240px;
          --lazy-image-height: 40px;
          --lazy-image-fit: contain;
          width: min(240px, 100%);
          height: 40px;
        }

        app-header-layout {
          margin-top: -1px;
        }

        app-header.remove-shadow::before {
          opacity: 0;
        }

        main {
          background-color: var(--terminal-background);
          min-height: 100%;
          height: 100%;
        }

        .drawer-content iron-icon {
          --iron-icon-width: 14px;
          margin-left: 6px;
        }

        // Look for copies of this
        .bottom-drawer-link {
          padding: 16px 24px;
          cursor: pointer;
        }

        @media (min-width: 640px) {
          app-toolbar {
            padding: 0 36px;
            height: initial;
          }
        }
      </style>

      <a class="skip-link" href="#main-content" on-click="handleSkipToContent"
        >Skip to main content</a
      >

      <app-drawer-layout drawer-width="300px" force-narrow fullbleed>
        <app-drawer id="drawer" slot="drawer" opened="{{drawerOpened}}" swipe-open>
          <app-toolbar layout vertical start>
            <img
              class="toolbar-logo"
              src="/images/logos/devfest-2026-wordmark-dark.svg"
              alt="DevFest 2026"
            />
            <h2 class="dates">[[dates]]</h2>
            <h3 class="location">[[shortLocation]]</h3>
          </app-toolbar>

          <div class="drawer-content" layout vertical justified flex>
            <iron-selector
              class="drawer-list"
              selected="[[routeName]]"
              attr-for-selected="path"
              selected-class="selected"
              role="navigation"
              aria-label="Primary navigation"
            >
              <template is="dom-repeat" items="[[navigation]]" as="nav">
                <a
                  href="[[nav.permalink]]"
                  path="[[nav.route]]"
                  on-click="closeDrawer"
                  aria-current$="[[getAriaCurrent(routeName, nav.route)]]"
                >
                  [[nav.label]]
                </a>
              </template>
            </iron-selector>

            <div>
              <app-install></app-install>

              <a
                class="bottom-drawer-link"
                href$="[[registrationUrl]]"
                on-click="scrollToRegistration"
                hidden$="[[!ticketUrl]]"
                layout
                horizontal
                center
              >
                <span>[[registrationActionLabel]]</span>
                <iron-icon icon="hoverboard:open-in-new"></iron-icon>
              </a>
            </div>
          </div>
        </app-drawer>

        <app-header-layout id="headerLayout" fullbleed>
          <app-header id="header" slot="header" condenses fixed>
            <header-toolbar drawer-opened="{{drawerOpened}}"></header-toolbar>
          </app-header>

          <main id="main-content" tabindex="-1"></main>
        </app-header-layout>
      </app-drawer-layout>

      <feedback-dialog></feedback-dialog>
      <signin-dialog></signin-dialog>
      <subscribe-dialog></subscribe-dialog>
      <video-dialog></video-dialog>

      <cookie-consent></cookie-consent>

      <snack-bar></snack-bar>
    `;
  }

  private dates = dates;
  private buyTicket = buyTicket;
  private registrationActionLabel = eveneaEmbed.requiresAccessCode ? ticketingPreview : buyTicket;
  private navigation = navigation;
  private shortLocation = location.short;

  @query('#drawer')
  drawer!: AppDrawerElement;
  @query('main')
  main!: HTMLElement;
  @query('#header')
  header!: HTMLElement;

  @property({ type: Object })
  tickets = initialTicketsState;

  @property({ type: Boolean })
  private drawerOpened = false;
  @property({ type: Array })
  private providerUrls = signInProviders.allowedProvidersUrl;
  @property({ type: String })
  private routeName = 'home';

  stateChanged(state: RootState) {
    this.tickets = state.tickets;
    this.routeName = selectRouteName(window.location.pathname);
  }

  constructor() {
    super();
    store.subscribe(() => this.stateChanged(store.getState()));
  }

  override connectedCallback() {
    super.connectedCallback();
    this.scrollToRegistration = this.scrollToRegistration.bind(this);
    this.addEventListener('registration-request', this.scrollToRegistration);
    window.addEventListener('element-sticked', (event) => this.toggleHeaderShadow(event));
    window.addEventListener('offline', () => store.dispatch(queueSnackbar(offlineMessage)));
    this.drawer.addEventListener('opened-changed', (event) => this.toggleDrawer(event));
    store.dispatch(fetchTickets);
  }

  override ready() {
    super.ready();
    console.log('Hoverboard is ready!');
    this.removeAttribute('unresolved');
    startRouter(this.main);
    onUser();
  }

  override disconnectedCallback() {
    this.removeEventListener('registration-request', this.scrollToRegistration);
    super.disconnectedCallback();
  }

  closeDrawer() {
    this.drawerOpened = false;
    this.restoreMenuFocus();
  }

  private toggleHeaderShadow(e: CustomEvent<Stickied>) {
    this.header.classList.toggle('remove-shadow', e.detail.sticked);
  }

  private toggleDrawer(e: CustomEvent<OpenedChanged>) {
    const wasOpened = this.drawerOpened;
    this.drawerOpened = e.detail.value;
    if (wasOpened && !e.detail.value) {
      this.restoreMenuFocus();
    }
  }

  private restoreMenuFocus() {
    const headerToolbar = this.shadowRoot?.querySelector('header-toolbar');
    const menuBtn = headerToolbar?.shadowRoot?.querySelector<HTMLElement>(
      'paper-icon-button[icon="hoverboard:menu"]',
    );
    menuBtn?.focus();
  }

  private handleSkipToContent(e: Event) {
    e.preventDefault();
    if (this.main) {
      this.main.setAttribute('tabindex', '-1');
      this.main.focus();
      this.main.scrollIntoView({ behavior: 'smooth' });
    }
  }

  private scrollToRegistration(e: Event) {
    const homePage = this.main.querySelector('home-page') as HTMLElement | null;
    const ticketsBlock = homePage?.shadowRoot?.querySelector('#registration');

    this.closeDrawer();

    if (!ticketsBlock) {
      if (window.location.pathname !== '/' || window.location.hash !== '#registration') {
        window.location.href = '/#registration';
      }
      return;
    }

    e.preventDefault();
    scrollToElement(ticketsBlock);
  }

  @computed('tickets')
  private get ticketUrl(): string {
    if (this.tickets instanceof Success && this.tickets.data.length > 0) {
      const availableTicket = this.tickets.data.find((ticket) => ticket.available);
      return availableTicket?.url || '';
    } else {
      return '';
    }
  }

  @computed('tickets')
  private get registrationUrl(): string {
    return this.ticketUrl ? '/#registration' : '';
  }

  private getAriaCurrent(routeName: string, navRoute: string): string | undefined {
    return routeName === navRoute ? 'page' : undefined;
  }
}
