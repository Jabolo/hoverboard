import { speakersPreview } from '../utils/speakers-preview';
import { Initialized, Success } from '@abraham/remotedata';
import { computed, customElement, property } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@polymer/paper-icon-button';
import '@polymer/paper-progress';
import { html, PolymerElement } from '@polymer/polymer';
import '@power-elements/lazy-image';
import '../components/hero/simple-hero';
import '../components/text-truncate';
import '../components/speaker-affiliations';
import '../elements/content-loader';
import '../elements/filter-menu';
import '../elements/previous-speakers-block';
import '../elements/shared-styles';
import { Filter } from '../models/filter';
import { FilterGroup, FilterGroupKey } from '../models/filter-group';
import { SpeakerWithTags } from '../models/speaker';
import { router } from '../router';
import { RootState, store } from '../store';
import { selectFilters } from '../store/filters/selectors';
import { ReduxMixin } from '../store/mixin';
import { selectFilterGroups } from '../store/sessions/selectors';
import { fetchSpeakers } from '../store/speakers/actions';
import { selectFilteredSpeakers } from '../store/speakers/selectors';
import { initialSpeakersState } from '../store/speakers/state';
import { contentLoaders, heroSettings } from '../utils/data';
import '../utils/icons';
import { updateMetadata } from '../utils/metadata';

@customElement('speakers-page')
export class SpeakersPage extends ReduxMixin(PolymerElement) {
  private speakersPreview = speakersPreview;

  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment positioning">
        :host {
          display: block;
          height: 100%;
          background: var(--primary-background-color);
        }

        .container {
          padding-top: 32px;
          padding-bottom: 32px;
          display: grid;
          grid-template-columns: 1fr;
          grid-gap: 16px;
        }

        .empty-state {
          margin: 0;
          padding: 40px 32px;
          border: 1px solid var(--terminal-line);
          border-radius: var(--border-radius);
          color: var(--secondary-text-color);
          background: var(--secondary-background-color);
          text-align: center;
        }

        .container.empty-state-container {
          max-width: 760px;
          margin: 32px auto;
          grid-template-columns: minmax(0, 1fr);
        }

        .speaker {
          position: relative;
          padding: 32px 24px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--primary-background-color);
          text-align: center;
          transition:
            border-color var(--animation),
            box-shadow var(--animation),
            transform var(--animation);
        }

        .speaker-link {
          display: block;
          color: inherit;
          text-decoration: none;
        }

        .speaker:hover {
          border-color: var(--google-blue);
          box-shadow: var(--box-shadow-primary-color);
          transform: translateY(-3px);
        }

        .photo {
          display: inline-block;
          --lazy-image-width: 128px;
          --lazy-image-height: 128px;
          --lazy-image-fit: cover;
          width: var(--lazy-image-width);
          height: var(--lazy-image-height);
          background-color: var(--secondary-background-color);
          border: 2px solid var(--google-blue);
          border-radius: 50%;
          overflow: hidden;
          transform: translateZ(0);
        }

        .description {
          color: var(--primary-text-color);
        }

        .name {
          margin-top: 8px;
          color: var(--terminal-copy, var(--primary-text-color));
          font-family: var(--font-mono, monospace);
          font-weight: 700;
          line-height: 1;
        }

        .professional-role {
          margin-top: 8px;
          color: var(--terminal-copy, var(--primary-text-color));
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .professional-company {
          margin-top: 2px;
          color: var(--terminal-green);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .professional-highlight {
          margin: 12px 0 0;
          color: var(--terminal-muted);
          font-size: 14px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .origin {
          margin-top: 4px;
          color: var(--terminal-muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .contacts {
          margin-top: 16px;
        }

        .social-icon {
          --paper-icon-button: {
            padding: 6px;
            width: 32px;
            height: 32px;
          }
          color: var(--secondary-text-color);
        }

        paper-progress {
          width: 100%;
          --paper-progress-active-color: var(--default-primary-color);
          --paper-progress-secondary-color: var(--default-primary-color);
        }

        @media (min-width: 640px) {
          .container {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 812px) {
          .container {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .container {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      </style>

      <simple-hero page="speakers"></simple-hero>

      <paper-progress indeterminate hidden$="[[contentLoaderVisibility]]"></paper-progress>

      <template is="dom-if" if="[[showFilters]]">
        <filter-menu
          filter-groups="[[filterGroups]]"
          selected-filters="[[selectedFilters]]"
          results-count="[[speakersToRender.length]]"
        ></filter-menu>
      </template>

      <content-loader
        class="container"
        card-padding="32px"
        card-height="400px"
        avatar-size="128px"
        avatar-circle="64px"
        horizontal-position="50%"
        border-radius="4px"
        box-shadow="var(--box-shadow)"
        items-count="[[contentLoaders.speakers.itemsCount]]"
        hidden$="[[contentLoaderVisibility]]"
      ></content-loader>

      <div class="container" hidden$="[[showEmptyState]]">
        <template is="dom-repeat" items="[[speakersToRender]]" as="speaker">
          <div class="speaker card">
            <a class="speaker-link" href$="[[speakerUrl(speaker.id)]]">
              <lazy-image
                class="photo"
                src="[[speaker.photoUrl]]"
                alt="[[speaker.name]]"
              ></lazy-image>

              <div class="description">
                <h2 class="name">[[speaker.name]]</h2>
                <template is="dom-if" if="[[speaker.title]]">
                  <div class="professional-role">[[speaker.title]]</div>
                </template>
                <template is="dom-if" if="[[speaker.company]]">
                  <div class="professional-company">[[speaker.company]]</div>
                </template>
                <template
                  is="dom-if"
                  if="[[professionalHighlight(speaker.shortBio, speaker.title, speaker.company)]]"
                >
                  <p class="professional-highlight">
                    [[professionalHighlight(speaker.shortBio, speaker.title, speaker.company)]]
                  </p>
                </template>
                <template is="dom-if" if="[[speaker.country]]">
                  <div class="origin">[[speaker.country]]</div>
                </template>

                <speaker-affiliations
                  company="[[speaker.company]]"
                  logo-url="[[speaker.companyLogoUrl]]"
                  logo-background="[[speaker.companyLogoBackground]]"
                  badges="[[speaker.badges]]"
                ></speaker-affiliations>
              </div>
            </a>

            <div class="contacts">
              <template is="dom-repeat" items="[[speaker.socials]]" as="social">
                <a href$="[[social.link]]" target="_blank" rel="noopener noreferrer">
                  <paper-icon-button
                    class="social-icon"
                    icon="hoverboard:{{social.icon}}"
                    aria-label="Open [[speaker.name]] on [[social.icon]]"
                  ></paper-icon-button>
                </a>
              </template>
            </div>
          </div>
        </template>
      </div>

      <template is="dom-if" if="[[showEmptyState]]">
        <div class="container empty-state-container">
          <p class="empty-state">[[emptyMessage(speakersPreview)]]</p>
        </div>
      </template>

      <previous-speakers-block></previous-speakers-block>

      <footer-block></footer-block>
    `;
  }

  private professionalHighlight(shortBio = '', title = '', company = '') {
    const normalize = (value: string) =>
      value
        .trim()
        .toLocaleLowerCase()
        .replace(/[\s,|·–—-]+/g, ' ');
    const highlight = shortBio.trim();
    const repeated = [title, company, `${title} at ${company}`, `${title} ${company}`].map(
      normalize,
    );
    return highlight && !repeated.includes(normalize(highlight)) ? highlight : '';
  }

  private emptyMessage(preview: boolean) {
    return preview
      ? 'Confirmed speaker preview unavailable.'
      : 'Speaker profiles and sessions will appear here as the programme is confirmed. Got a project, hard lesson, or experiment to share?';
  }

  private heroSettings = heroSettings.speakers;
  private contentLoaders = contentLoaders;

  @property({ type: Object })
  speakers = initialSpeakersState;

  @property({ type: Array })
  private filterGroups: FilterGroup[] = [];
  @property({ type: Array })
  private selectedFilters: Filter[] = [];
  @property({ type: Array })
  private speakersToRender: SpeakerWithTags[] = [];

  override connectedCallback() {
    super.connectedCallback();
    updateMetadata(this.heroSettings.title, this.heroSettings.metaDescription);

    if (this.speakers instanceof Initialized) {
      store.dispatch(fetchSpeakers);
    }
  }

  override stateChanged(state: RootState) {
    super.stateChanged(state);
    this.speakers = state.speakers;
    this.filterGroups = selectFilterGroups(state, [FilterGroupKey.tags]);
    this.selectedFilters = selectFilters(state);
    this.speakersToRender = selectFilteredSpeakers(state);
  }

  @computed('speakers')
  get contentLoaderVisibility() {
    return this.speakers instanceof Success;
  }

  @computed('speakers')
  get showEmptyState() {
    return this.speakers instanceof Success && this.speakers.data.length === 0;
  }

  @computed('speakers')
  get showFilters() {
    return this.speakers instanceof Success && this.speakers.data.length > 0;
  }

  speakerUrl(id: string) {
    return router.urlForName('speaker-page', { id });
  }
}
