import { Success } from '@abraham/remotedata';
import '@polymer/app-layout/app-drawer-layout/app-drawer-layout';
import '@polymer/app-layout/app-drawer/app-drawer';
import { AppDrawerElement } from '@polymer/app-layout/app-drawer/app-drawer';
import '@polymer/app-layout/app-header/app-header';
import '@polymer/app-layout/app-toolbar/app-toolbar';
import { computed, customElement, property, query } from '@polymer/decorators';
import '@polymer/iron-selector/iron-selector';
import { html, PolymerElement } from '@polymer/polymer';
import {
  setPassiveTouchGestures,
  setRemoveNestedTemplates,
  setSuppressTemplateNotifications,
} from '@polymer/polymer/lib/utils/settings';
import './components/snack-bar';
import './components/sticky-countdown';
import './components/cookie-consent';
import './elements/devfest-concierge';
import './elements/footer-block';
import './elements/header-toolbar';
import './elements/shared-styles';

import { selectRouteName, startRouter } from './router';
import { RootState, store } from './store';
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
import { isAgendaPreviewEnabled } from './utils/agenda-preview-mode';

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
          position: relative;
          padding: 28px 24px 24px;
          background: var(--terminal-panel);
          border-bottom: 1px solid var(--divider-color);
        }

        app-drawer .toolbar-logo {
          width: 176px;
          height: 98px;
          object-fit: contain;
        }

        .drawer-close {
          position: absolute;
          top: 12px;
          right: 12px;
          display: grid;
          width: 48px;
          height: 48px;
          place-items: center;
          border: 0;
          border-radius: 4px;
          background: transparent;
          color: var(--primary-text-color);
          cursor: pointer;
        }

        .drawer-close:hover {
          background: rgb(255 255 255 / 8%);
        }

        .drawer-close:focus-visible,
        .drawer-list a:focus-visible {
          outline: 3px solid var(--google-blue);
          outline-offset: -3px;
        }

        .drawer-close svg {
          width: 24px;
          height: 24px;
        }

        app-drawer .drawer-google {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          margin-top: 12px;
          padding: 8px 12px;
          border-radius: 5px;
          background: #fff;
        }

        .drawer-google img {
          display: block;
          width: 170px;
          height: auto;
        }

        .drawer-google:focus-visible {
          outline: 3px solid var(--google-blue);
          outline-offset: 3px;
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
          display: flex;
          align-items: center;
          min-height: 44px;
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

        .drawer-list a[hidden] {
          display: none;
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

        .drawer-list a[href='/y2k/'] {
          color: #eaf87f;
          background: #342448;
          border-left: 3px solid #eaf87f;
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

        .header-layout {
          position: relative;
          z-index: 0;
          min-height: 100%;
          padding-top: 69px;
        }

        #header {
          position: fixed;
          top: 0;
          right: 0;
          left: 0;
          z-index: 2;
        }

        app-header.remove-shadow::before {
          opacity: 0;
        }

        main {
          background-color: var(--terminal-background);
          min-height: 100%;
          height: 100%;
        }

        sticky-countdown[active] ~ cookie-consent,
        sticky-countdown[active] ~ devfest-concierge {
          --countdown-offset: 64px;
        }

        app-drawer-layout:has(~ sticky-countdown[active]) {
          --footer-countdown-space: calc(80px + env(safe-area-inset-bottom));
        }

        cookie-consent[dialog-open] ~ devfest-concierge {
          display: none !important;
        }

        @media (max-width: 480px) {
          sticky-countdown[active] ~ cookie-consent,
          sticky-countdown[active] ~ devfest-concierge {
            --countdown-offset: 76px;
          }

          app-drawer-layout:has(~ sticky-countdown[active]) {
            --footer-countdown-space: calc(100px + env(safe-area-inset-bottom));
          }
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
        <app-drawer
          id="drawer"
          slot="drawer"
          opened="{{drawerOpened}}"
          swipe-open
          on-opened-changed="toggleDrawer"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          aria-hidden$="[[getDrawerAriaHidden(drawerOpened)]]"
        >
          <app-toolbar layout vertical start>
            <button
              class="drawer-close"
              type="button"
              aria-label="Close navigation menu"
              on-click="closeDrawer"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2" />
              </svg>
            </button>
            <img
              class="toolbar-logo"
              src="/images/logos/devfest-2026-wordmark-dark.svg"
              alt="DevFest 2026"
              width="2417"
              height="282"
            />
            <a
              class="drawer-google"
              href="https://developers.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Google for Developers"
            >
              <img
                src="/images/logos/google-for-developers.svg"
                alt="Google for Developers"
                width="432"
                height="64"
              />
            </a>
            <div class="dates">[[dates]]</div>
            <div class="location">[[shortLocation]]</div>
          </app-toolbar>

          <div class="drawer-content" layout vertical justified flex>
            <nav aria-label="Primary navigation">
              <iron-selector
                class="drawer-list"
                selected="[[routeName]]"
                attr-for-selected="path"
                selected-class="selected"
              >
                <template is="dom-repeat" items="[[priorityNavigation]]" as="nav">
                  <a
                    href="[[nav.permalink]]"
                    path="[[nav.route]]"
                    on-click="closeDrawer"
                    aria-current$="[[getAriaCurrent(routeName, nav.route)]]"
                  >
                    [[nav.label]]
                  </a>
                </template>
                <a href="/#visit" path="visit" on-click="scrollToVisit">Getting here</a>
                <a
                  href$="[[registrationUrl]]"
                  on-click="scrollToRegistration"
                  hidden$="[[!ticketUrl]]"
                >
                  [[registrationActionLabel]]
                </a>
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
            </nav>

            <div>
              <app-install></app-install>
            </div>
          </div>
        </app-drawer>

        <div id="headerLayout" class="header-layout">
          <app-header id="header" condenses fixed>
            <header-toolbar drawer-opened="{{drawerOpened}}"></header-toolbar>
          </app-header>

          <main id="main-content" tabindex="-1"></main>
        </div>
      </app-drawer-layout>

      <feedback-dialog></feedback-dialog>
      <signin-dialog></signin-dialog>
      <subscribe-dialog></subscribe-dialog>
      <video-dialog></video-dialog>

      <sticky-countdown></sticky-countdown>
      <cookie-consent hidden$="[[hideAgendaPreviewConsent(routeName)]]"></cookie-consent>
      <devfest-concierge id="global-concierge" variant="floating"></devfest-concierge>

      <snack-bar></snack-bar>
    `;
  }

  private dates = dates;
  private buyTicket = buyTicket;
  private registrationActionLabel = eveneaEmbed.requiresAccessCode ? ticketingPreview : buyTicket;
  private priorityNavigation = navigation.filter((item) => item.route === 'schedule');
  private navigation = navigation.filter((item) => item.route !== 'schedule');
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
    this.handleKeydown = this.handleKeydown.bind(this);
    this.addEventListener('registration-request', this.scrollToRegistration);
    window.addEventListener('element-sticked', (event) => this.toggleHeaderShadow(event));
    window.addEventListener('offline', () => store.dispatch(queueSnackbar(offlineMessage)));
    window.addEventListener('keydown', this.handleKeydown);
    this.drawer.addEventListener('opened-changed', (event) => this.toggleDrawer(event));
    store.dispatch(fetchTickets);
  }

  override ready() {
    super.ready();
    console.log('Hoverboard is ready!');
    this.removeAttribute('unresolved');
    startRouter(this.main);
    // Authentication is independent of the initial page shell. Load it after
    // the router starts so Firebase Auth does not block the first render.
    void import('./store/auth/actions').then(({ onUser }) => onUser());
  }

  override disconnectedCallback() {
    this.removeEventListener('registration-request', this.scrollToRegistration);
    window.removeEventListener('keydown', this.handleKeydown);
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
    } else if (!wasOpened && e.detail.value) {
      requestAnimationFrame(() => {
        const firstLink = this.drawer?.querySelector<HTMLElement>('.drawer-list a');
        firstLink?.focus();
      });
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    if (this.drawerOpened) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.closeDrawer();
        return;
      }
      if (e.key === 'Tab') {
        this.trapDrawerFocus(e);
      }
    }
  }

  private trapDrawerFocus(e: KeyboardEvent) {
    const drawer = this.drawer;
    if (!drawer) return;
    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.closest('[hidden]') && element.getClientRects().length > 0);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const active = (this.shadowRoot?.activeElement || document.activeElement) as HTMLElement;
    if (e.shiftKey) {
      if (active === first || !focusable.includes(active)) {
        e.preventDefault();
        last?.focus();
      }
    } else {
      if (active === last || !focusable.includes(active)) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  private getDrawerAriaHidden(opened: boolean): string {
    return opened ? 'false' : 'true';
  }

  private restoreMenuFocus() {
    requestAnimationFrame(() => {
      const headerToolbar = this.shadowRoot?.querySelector('header-toolbar');
      const menuBtn = headerToolbar?.shadowRoot?.querySelector<HTMLElement>(
        'paper-icon-button[icon="hoverboard:menu"]',
      );
      menuBtn?.focus();
    });
  }

  private handleSkipToContent(e: Event) {
    e.preventDefault();
    if (this.main) {
      this.main.setAttribute('tabindex', '-1');
      this.main.focus();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.main.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  }

  private scrollToRegistration(e: Event) {
    const homePage = this.main.querySelector('home-page') as HTMLElement | null;
    const ticketsBlock = (homePage?.shadowRoot?.querySelector('#tickets') ||
      homePage?.shadowRoot?.querySelector('#registration')) as HTMLElement | null;

    this.closeDrawer();

    if (!ticketsBlock) {
      if (
        window.location.pathname !== '/' ||
        (window.location.hash !== '#tickets' && window.location.hash !== '#registration')
      ) {
        window.location.href = '/#tickets';
      }
      return;
    }

    e.preventDefault();
    scrollToElement(ticketsBlock);
  }

  private scrollToVisit(e: Event) {
    const homePage = this.main.querySelector('home-page') as HTMLElement | null;
    const visitBlock = homePage?.shadowRoot?.querySelector('#visit');
    this.closeDrawer();
    if (visitBlock) {
      e.preventDefault();
      scrollToElement(visitBlock);
    }
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
    return this.ticketUrl ? '/#tickets' : '';
  }

  private getAriaCurrent(routeName: string, navRoute: string): string | undefined {
    return routeName === navRoute ? 'page' : undefined;
  }

  private hideAgendaPreviewConsent(routeName: string): boolean {
    return routeName === 'schedule' && isAgendaPreviewEnabled(window.location.hostname);
  }
}
