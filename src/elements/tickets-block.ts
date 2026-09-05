import { Pending, Success } from '@abraham/remotedata';
import { computed, customElement, property } from '@polymer/decorators';
import '@material/web/button/filled-button.js';
import { html, PolymerElement } from '@polymer/polymer';
import { Ticket } from '../models/ticket';
import { RootState } from '../store';
import { ReduxMixin } from '../store/mixin';
import { initialTicketsState } from '../store/tickets/state';
import { buyTicket, contentLoaders, eveneaEmbed, ticketsBlock } from '../utils/data';
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
          padding-top: 76px;
          padding-bottom: 64px;
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
          margin: 32px 0 24px;
        }

        .ticket-item {
          margin: 16px 8px;
          min-height: 300px;
          border: 1px solid var(--divider-color);
          width: 100%;
          text-align: center;
          color: var(--primary-text-color);
          background-color: var(--secondary-background-color);
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
          transform: scale(1.05);
          box-shadow: var(--box-shadow-primary-color);
          border-top: 2px solid var(--default-primary-color);
          z-index: 1;
        }

        .ticket-item[in-demand]:hover {
          box-shadow: var(--box-shadow-primary-color-hover);
        }

        .ticket-item[sold-out] {
          opacity: 0.5;
          filter: grayscale(1);
          cursor: not-allowed;
        }

        .ticket-item[sold-out]:hover {
          box-shadow:
            0 0 2px 0 rgba(0, 0, 0, 0.07),
            0 2px 2px 0 rgba(0, 0, 0, 0.15);
        }

        .header {
          padding: 24px 0 0;
          font-family: var(--font-mono, monospace);
          font-size: 16px;
        }

        .content {
          padding: 0 24px;
        }

        .type-description {
          font-size: 12px;
          color: var(--secondary-text-color);
        }

        .ticket-price-wrapper {
          margin: 24px 0;
          white-space: nowrap;
        }

        .price {
          color: var(--default-primary-color);
          font-family: var(--font-mono, monospace);
          font-weight: 800;
          font-size: 40px;
        }

        .discount {
          font-size: 14px;
          color: var(--accent-color);
        }

        .sold-out {
          display: none;
          font-size: 14px;
          text-transform: uppercase;
          height: 32px;
          color: var(--secondary-text-color);
        }

        .additional-info {
          margin: 16px auto 0;
          max-width: 480px;
          font-size: 14px;
          color: var(--secondary-text-color);
          line-height: 1.6;
        }

        .actions {
          padding: 24px;
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

        /* Keep an unavailable release legible on the dark terminal surface. */
        md-filled-button[disabled] {
          --md-filled-button-disabled-container-color: #29456d;
          --md-filled-button-disabled-container-opacity: 1;
          --md-filled-button-disabled-label-text-color: var(--terminal-copy);
          --md-filled-button-disabled-label-text-opacity: 1;
          opacity: 1;
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
            transform: scale(1.15);
          }
        }
      </style>

      <div class="tickets-wrapper container">
        <h1 class="container-title">[[ticketsBlock.title]]</h1>
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
            <template is="dom-if" if="[[tickets.error]]"> Error loading tickets </template>

            <template is="dom-repeat" items="[[tickets.data]]" as="ticket">
              <a
                class="ticket-item card"
                href="#registration"
                sold-out$="[[ticket.soldOut]]"
                in-demand$="[[ticket.inDemand]]"
                on-click="onTicketTap"
                layout
                vertical
              >
                <div class="header">
                  <h4>[[ticket.name]]</h4>
                </div>
                <div class="content" layout vertical flex-auto>
                  <div class="ticket-price-wrapper">
                    <div class="price">[[ticket.currency]][[ticket.price]]</div>
                    <div class="discount">[[getDiscount(ticket)]]</div>
                  </div>
                  <div class="type-description" layout vertical flex-auto center-justified>
                    <div class="ticket-dates" hidden$="[[!ticket.starts]]">
                      [[ticket.starts]] - [[ticket.ends]]
                    </div>
                    <div class="ticket-info">[[ticket.info]]</div>
                  </div>
                </div>
                <div class="actions">
                  <template is="dom-if" if="[[ticket.soldOut]]">
                    <div class="sold-out" block>[[ticketsBlock.soldOut]]</div>
                  </template>
                  <md-filled-button hidden$="[[ticket.soldOut]]" disabled$="[[!ticket.available]]">
                    [[getButtonText(ticket.available)]]
                  </md-filled-button>
                </div>
              </a>
            </template>
          </div>
        </template>

        <div class="additional-info">*[[ticketsBlock.ticketsDetails]]</div>
        <evenea-embed id="registration"></evenea-embed>
      </div>
    `;
  }

  private ticketsBlock = ticketsBlock;
  private contentLoaders = contentLoaders.tickets;
  private showTicketCards = Boolean(eveneaEmbed.published);

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

  private onTicketTap(e: PointerEvent & { model: { ticket: Ticket } }) {
    if (e.model.ticket.soldOut || !e.model.ticket.available) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private getButtonText(available: boolean) {
    return available ? buyTicket : this.ticketsBlock.notAvailableYet;
  }
}
