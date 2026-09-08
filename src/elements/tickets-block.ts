import { Pending, Success } from '@abraham/remotedata';
import { computed, customElement, property } from '@polymer/decorators';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import { html, PolymerElement } from '@polymer/polymer';
import { Ticket } from '../models/ticket';
import { RootState, store } from '../store';
import { ReduxMixin } from '../store/mixin';
import { fetchTickets } from '../store/tickets/actions';
import { initialTicketsState } from '../store/tickets/state';
import {
  buyTicket,
  contentLoaders,
  eveneaEmbed,
  ticketingPreview,
  ticketsBlock,
} from '../utils/data';
import '../utils/icons';
import './content-loader';
import './evenea-embed';
import './shared-styles';

@customElement('tickets-block')
export class TicketsBlock extends ReduxMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment positioning">
        :host {
          display: block;
          border-bottom: 1px solid var(--divider-color);
          background: var(--primary-background-color);
        }

        .tickets-wrapper {
          position: relative;
          padding-top: 64px;
          padding-bottom: 48px;
          text-align: center;
        }

        .tickets-wrapper::before {
          position: absolute;
          top: 28px;
          left: 16px;
          color: var(--google-yellow);
          content: '> tickets --show';
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .tickets {
          margin: 24px 0 18px;
        }

        .ticket-item {
          margin: 10px 6px;
          min-height: 280px;
          border: 1px solid var(--divider-color);
          width: 100%;
          text-align: center;
          color: var(--primary-text-color);
          background-color: var(--secondary-background-color);
          border-radius: var(--border-radius, 8px);
          position: relative;
          transition:
            border-color var(--animation),
            box-shadow var(--animation),
            transform var(--animation);
        }

        .ticket-item:hover {
          border-color: var(--google-blue);
          box-shadow: var(--box-shadow-primary-color);
          transform: translateY(-3px);
        }

        .ticket-item[in-demand] {
          transform: scale(1.02);
          box-shadow: var(--box-shadow-primary-color);
          border-top: 2px solid var(--default-primary-color);
          z-index: 1;
        }

        .ticket-item[in-demand]:hover {
          box-shadow: var(--box-shadow-primary-color-hover);
        }

        /* Unavailable & Sold-out: grayed out and no animation */
        .ticket-item[unavailable],
        .ticket-item[sold-out] {
          opacity: 0.38;
          filter: grayscale(1);
          cursor: not-allowed;
          pointer-events: none;
          transform: none !important;
          box-shadow: none !important;
          border-color: var(--divider-color) !important;
          transition: none !important;
        }

        .ticket-item[unavailable]:hover,
        .ticket-item[sold-out]:hover {
          transform: none !important;
          box-shadow: none !important;
          border-color: var(--divider-color) !important;
        }

        /* Supporter Tier Styling */
        .ticket-item[tier="supporter"] {
          border-color: rgba(52, 168, 83, 0.45);
          background: linear-gradient(180deg, rgba(52, 168, 83, 0.09) 0%, var(--secondary-background-color) 45%);
        }

        .ticket-item[tier="supporter"]:hover {
          border-color: var(--google-green);
          box-shadow: 0 0 20px rgba(52, 168, 83, 0.35);
          transform: translateY(-4px);
        }

        .ticket-item[tier="supporter"] .price {
          color: var(--google-green);
        }

        .ticket-item[tier="supporter"] md-filled-button {
          --md-filled-button-container-color: var(--google-green);
          --md-filled-button-hover-container-color: #2b8a44;
        }

        /* Patron Tier Styling */
        .ticket-item[tier="patron"] {
          border-color: rgba(251, 188, 4, 0.55);
          background: linear-gradient(180deg, rgba(251, 188, 4, 0.12) 0%, var(--secondary-background-color) 45%);
        }

        .ticket-item[tier="patron"]:hover {
          border-color: var(--google-yellow);
          box-shadow: 0 0 24px rgba(251, 188, 4, 0.45);
          transform: translateY(-4px);
        }

        .ticket-item[tier="patron"] .price {
          color: var(--google-yellow);
        }

        .ticket-item[tier="patron"] md-filled-button {
          --md-filled-button-container-color: #e3a600;
          --md-filled-button-hover-container-color: #c99300;
        }

        .badge-slot {
          min-height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }

        .badge-pill {
          display: inline-block;
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .badge-pill[tier="supporter"] {
          background: rgba(52, 168, 83, 0.15);
          color: var(--google-green);
          border: 1px solid rgba(52, 168, 83, 0.4);
        }

        .badge-pill[tier="patron"] {
          background: rgba(251, 188, 4, 0.15);
          color: var(--google-yellow);
          border: 1px solid rgba(251, 188, 4, 0.5);
        }

        .badge-pill[tier="early-bird"] {
          background: rgba(66, 133, 244, 0.15);
          color: var(--google-blue);
          border: 1px solid rgba(66, 133, 244, 0.4);
        }

        .subtext-slot {
          min-height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 4px;
        }

        .impact-subtext {
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 700;
        }

        .impact-subtext[tier="supporter"] {
          color: var(--google-green);
        }

        .impact-subtext[tier="patron"] {
          color: var(--google-yellow);
        }

        .community-impact-note {
          max-width: 780px;
          margin: 28px auto 12px;
          padding: 16px 20px;
          background: rgba(251, 188, 4, 0.07);
          border: 1px solid rgba(251, 188, 4, 0.35);
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.55;
          color: var(--primary-text-color);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 14px;
          text-align: left;
        }

        .community-impact-note .impact-icon {
          font-size: 22px;
          line-height: 1.2;
          flex-shrink: 0;
        }

        .community-impact-note .impact-text {
          flex: 1;
        }

        .community-impact-note .impact-title {
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          font-weight: 800;
          color: var(--google-yellow);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .community-impact-note .impact-desc {
          color: var(--secondary-text-color);
          font-size: 13px;
        }

        .community-impact-note .patron-promise {
          display: block;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed rgba(251, 188, 4, 0.25);
          color: var(--terminal-green);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
        }

        .community-impact-note .patron-promise strong {
          color: var(--google-yellow);
        }

        .header {
          padding: 16px 8px 0;
          font-family: var(--font-mono, monospace);
          font-size: 16px;
        }

        .header h4 {
          margin: 4px 0 0;
          font-size: 16px;
          font-weight: 700;
        }

        .content {
          padding: 0 16px;
        }

        .type-description {
          font-size: 12px;
          color: var(--secondary-text-color);
        }

        .ticket-dates {
          font-weight: 600;
          color: var(--primary-text-color);
          font-size: 11px;
          letter-spacing: 0.02em;
          margin-bottom: 4px;
        }

        .ticket-info {
          line-height: 1.45;
          margin-top: 4px;
        }

        .ticket-price-wrapper {
          margin: 12px 0;
          white-space: nowrap;
        }

        .price {
          color: var(--default-primary-color);
          font-family: var(--font-mono, monospace);
          font-weight: 800;
          font-size: 30px;
        }

        .discount {
          font-size: 14px;
          color: var(--accent-color);
        }

        .sold-out {
          display: block;
          font-size: 14px;
          text-transform: uppercase;
          height: 32px;
          color: var(--secondary-text-color);
        }

        .actions {
          padding: 16px;
          position: relative;
        }

        md-filled-button {
          --md-filled-button-container-color: var(--google-blue);
          --md-filled-button-hover-container-color: var(--terminal-green);
          --md-filled-button-label-text-color: #fff;
          --md-filled-button-hover-label-text-color: #06101a;
          --md-filled-button-container-height: 46px;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        md-filled-button[disabled] {
          --md-filled-button-disabled-container-color: rgba(255, 255, 255, 0.08);
          --md-filled-button-disabled-container-opacity: 1;
          --md-filled-button-disabled-label-text-color: rgba(255, 255, 255, 0.4);
          --md-filled-button-disabled-label-text-opacity: 1;
          opacity: 0.8;
          pointer-events: none;
        }

        .tickets-placeholder {
          display: grid;
          width: 100%;
        }

        @media (min-width: 640px) {
          .tickets-placeholder {
            grid-template-columns: repeat(auto-fill, 200px);
          }

          .ticket-item {
            max-width: 200px;
          }

          .ticket-item[in-demand] {
            transform: scale(1.02);
          }
        }
      </style>

      <div class="tickets-wrapper container">
        <h2 class="container-title">[[ticketsBlock.title]]</h2>
        <content-loader
          class="tickets-placeholder"
          card-padding="24px"
          card-height="216px"
          border-radius="var(--border-radius)"
          title-top-position="32px"
          title-height="42px"
          title-width="70%"
          load-from="-70%"
          load-to="130%"
          animation-time="1s"
          items-count="[[contentLoaders.itemsCount]]"
          hidden$="[[!showTicketLoader]]"
        >
        </content-loader>

        <template is="dom-if" if="[[showTicketCards]]">
          <div class="tickets" layout horizontal wrap center-justified>
            <template is="dom-if" if="[[tickets.error]]">
              <div class="ticket-error" role="alert">
                Unable to load tickets.
                <md-outlined-button on-click="retryTickets">Try again</md-outlined-button>
              </div>
            </template>

            <template is="dom-repeat" items="[[tickets.data]]" as="ticket">
              <div
                class="ticket-item card"
                sold-out$="[[ticket.soldOut]]"
                unavailable$="[[!ticket.available]]"
                in-demand$="[[ticket.inDemand]]"
                tier$="[[getTicketTier(ticket)]]"
                layout
                vertical
              >
                <div class="header">
                  <div class="badge-slot">
                    <template is="dom-if" if="[[getBadgeText(ticket)]]">
                      <div class="badge-pill" tier$="[[getTicketTier(ticket)]]">
                        [[getBadgeText(ticket)]]
                      </div>
                    </template>
                  </div>
                  <h4>[[ticket.name]]</h4>
                </div>
                <div class="content" layout vertical flex-auto>
                  <div class="ticket-price-wrapper">
                    <div class="price">[[ticket.currency]][[ticket.price]]</div>
                    <div class="subtext-slot">
                      <template is="dom-if" if="[[getDiscount(ticket)]]">
                        <div class="discount">[[getDiscount(ticket)]]</div>
                      </template>
                      <template is="dom-if" if="[[getImpactSubtext(ticket)]]">
                        <div class="impact-subtext" tier$="[[getTicketTier(ticket)]]">
                          [[getImpactSubtext(ticket)]]
                        </div>
                      </template>
                    </div>
                  </div>
                  <div class="type-description" layout vertical flex-auto center-justified>
                    <div class="ticket-dates" hidden$="[[!hasTicketDates(ticket)]]">
                      [[formatTicketDates(ticket)]]
                    </div>
                    <div class="ticket-info">[[ticket.info]]</div>
                  </div>
                </div>
                <div class="actions">
                  <template is="dom-if" if="[[ticket.soldOut]]">
                    <div class="sold-out" block>[[ticketsBlock.soldOut]]</div>
                  </template>
                  <md-filled-button
                    hidden$="[[ticket.soldOut]]"
                    disabled$="[[!ticket.available]]"
                    on-click="onTicketTap"
                  >
                    [[getButtonText(ticket.available)]]
                  </md-filled-button>
                </div>
              </div>
            </template>
          </div>

          <div class="community-impact-note">
            <span class="impact-icon">💛</span>
            <div class="impact-text">
              <div class="impact-title">100% Non-Profit Community Event — Organized by Volunteers</div>
              <div class="impact-desc">
                DevFest Warsaw is run by the community, for the community. All organizers and speakers donate their time pro bono. Supporter (250 zł) and Patron (500 zł) tickets directly fund venue, stage production, and tech workshop gear.
                <span class="patron-promise">⭐ <strong>Patron Ticket Promise:</strong> Guaranteed personal or company name recognition on our opening keynote intro slide!</span>
              </div>
            </div>
          </div>
        </template>

        <evenea-embed id="registration-form"></evenea-embed>
      </div>
    `;
  }

  private ticketsBlock = ticketsBlock;
  private contentLoaders = contentLoaders.tickets;
  private showTicketCards = Boolean(eveneaEmbed.published);
  private availableTicketAction = eveneaEmbed.requiresAccessCode ? ticketingPreview : buyTicket;

  @property({ type: Object })
  tickets = initialTicketsState;

  override stateChanged(state: RootState) {
    this.tickets = state.tickets;
  }

  @computed('tickets')
  private get pending() {
    return this.tickets instanceof Pending;
  }

  @computed('tickets')
  private get showTicketLoader() {
    return this.showTicketCards && this.pending;
  }

  private getTicketTier(ticket: Ticket): string {
    const name = (ticket?.name || '').toLowerCase();
    if (name.includes('patron')) return 'patron';
    if (name.includes('supporter')) return 'supporter';
    if (name.includes('early')) return 'early-bird';
    return 'regular';
  }

  private getBadgeText(ticket: Ticket): string {
    const tier = this.getTicketTier(ticket);
    if (tier === 'patron') return '⭐ Keynote Slide Sponsor';
    if (tier === 'supporter') return '💛 Community Supporter';
    if (tier === 'early-bird') return '⚡ Early Bird';
    return '';
  }

  private getImpactSubtext(ticket: Ticket): string {
    const tier = this.getTicketTier(ticket);
    if (tier === 'supporter') return 'Non-profit event backer';
    if (tier === 'patron') return 'Opening slide thank-you';
    return '';
  }

  private hasTicketDates(ticket: Ticket): boolean {
    return Boolean(ticket && (ticket.ends || ticket.starts));
  }

  private formatTicketDates(ticket: Ticket): string {
    if (!ticket) return '';
    // If ticket is available, omit "Available now" and only show the deadline
    if (ticket.available) {
      return ticket.ends ? `Until ${ticket.ends}` : '';
    }
    // If ticket is not available yet and has a future start date
    if (ticket.starts && ticket.starts !== 'Available now') {
      return ticket.ends ? `${ticket.starts} – ${ticket.ends}` : `Opens ${ticket.starts}`;
    }
    return ticket.ends ? `Until ${ticket.ends}` : '';
  }

  private getDiscount(ticket: Ticket) {
    if (!(this.tickets instanceof Success)) {
      return '';
    }
    const primaryTicket = this.tickets.data.find((ticket) => ticket.primary);
    if (!primaryTicket) {
      return '';
    }
    const maxPrice = primaryTicket && primaryTicket.price;
    if (!ticket.regular || ticket.primary || ticket.soldOut || !maxPrice) {
      return '';
    }
    const discount = String(Math.round(100 - (ticket.price * 100) / maxPrice));
    return this.ticketsBlock.save.replace('${discount}', discount);
  }

  private onTicketTap(e: Event & { model: { ticket: Ticket } }) {
    if (e.model.ticket.soldOut || !e.model.ticket.available) {
      return;
    }
    this.shadowRoot?.querySelector('#registration-form')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  private retryTickets() {
    store.dispatch(fetchTickets);
  }

  private getButtonText(available: boolean) {
    return available ? this.availableTicketAction : this.ticketsBlock.notAvailableYet;
  }
}
