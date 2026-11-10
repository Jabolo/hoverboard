import { customElement, property } from '@polymer/decorators';
import { html, PolymerElement } from '@polymer/polymer';
import { Day } from '../models/day';
import { RootState, store } from '../store';
import { ReduxMixin } from '../store/mixin';
import { selectLocalFavoritesSchedule } from '../store/schedule/selectors';
import { isSessionFavorite, subscribeSessionFavorites } from '../utils/session-favorites';
import './schedule-day';
import './shared-styles';

@customElement('my-schedule')
export class MySchedule extends ReduxMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment">
        :host {
          display: block;
        }

        .date {
          margin: 16px;
          font-size: 24px;
        }

        .date:not(:first-of-type) {
          margin-top: 64px;
        }

        @media (min-width: 640px) {
          .date {
            margin-left: 64px;
            font-size: 32px;
          }
        }
      </style>

      <template is="dom-repeat" items="[[featuredSchedule]]" as="day">
        <div class="date">[[day.dateReadable]]</div>

        <schedule-day name$="[[day.date]]" day="[[day]]" only-featured></schedule-day>
      </template>
    `;
  }

  @property({ type: Array })
  private featuredSchedule: Day[] = [];
  private unsubscribeFavorites: (() => void) | undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.unsubscribeFavorites = subscribeSessionFavorites(() =>
      this.stateChanged(store.getState()),
    );
  }

  override disconnectedCallback() {
    this.unsubscribeFavorites?.();
    this.unsubscribeFavorites = undefined;
    super.disconnectedCallback();
  }

  override stateChanged(state: RootState) {
    this.featuredSchedule = selectLocalFavoritesSchedule(state, isSessionFavorite);
  }
}
