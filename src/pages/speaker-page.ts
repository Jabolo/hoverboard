import { speakersPreview } from '../utils/speakers-preview';
import { Initialized, Success } from '@abraham/remotedata';
import { computed, customElement, observe, property } from '@polymer/decorators';
import '@polymer/iron-icon';
import '@polymer/paper-progress';
import { html, PolymerElement } from '@polymer/polymer';
import '@power-elements/lazy-image';
import { RouterLocation } from '@vaadin/router';
import '../components/hero/simple-hero';
import '../components/speaker-affiliations';
import '../components/markdown/short-markdown';
import '../elements/content-loader';
import '../elements/previous-speakers-block';
import '../elements/shared-styles';
import { SpeakerWithTags } from '../models/speaker';
import { router } from '../router';
import { RootState, store } from '../store';
import { ReduxMixin } from '../store/mixin';
import { fetchSpeakers } from '../store/speakers/actions';
import { selectSpeaker } from '../store/speakers/selectors';
import { initialSpeakersState, SpeakersState } from '../store/speakers/state';
import { speakerDetails } from '../utils/data';
import '../utils/icons';
import { updateImageMetadata } from '../utils/metadata';
import { getVariableColor } from '../utils/styles';

@customElement('speaker-page')
export class SpeakerPage extends ReduxMixin(PolymerElement) {
  private speakersPreview = speakersPreview;

  static get template() {
    return html`
      <style include="shared-styles flex flex-alignment positioning">
        :host {
          background: var(--primary-background-color);
          box-shadow: var(--box-shadow);
          color: var(--primary-text-color);
          display: block;
          height: 100%;
          margin: 0;
          width: 100%;
        }

        .content {
          position: relative;
          font-size: 15px;
          line-height: 1.87;
        }

        .photo {
          margin-right: 16px;
          --lazy-image-width: 96px;
          --lazy-image-height: 96px;
          --lazy-image-fit: cover;
          width: var(--lazy-image-width);
          height: var(--lazy-image-height);
          overflow: hidden;
          border-radius: 50%;
          background-color: var(--contrast-additional-background-color);
          transform: translateZ(0);
          flex-shrink: 0;
        }

        .name {
          color: var(--terminal-copy, var(--primary-text-color));
          font-family: var(--font-mono, monospace);
          font-weight: 700;
          line-height: 1.2;
        }

        .professional-role {
          margin-top: 8px;
          color: var(--terminal-copy, var(--primary-text-color));
          font-size: 16px;
          font-weight: 600;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .professional-company {
          margin-top: 2px;
          color: var(--terminal-green);
          font-size: 16px;
          font-weight: 600;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .professional-highlight {
          margin: 24px 0 16px;
          max-width: 65ch;
          color: var(--terminal-copy);
          font-size: 16px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .subtitle {
          margin-top: 8px;
          font-size: 13px;
          color: var(--terminal-muted);
          font-family: var(--font-mono, monospace);
        }

        .badge:not(:last-of-type)::after {
          margin-left: -4px;
          content: ',';
        }

        .section {
          cursor: pointer;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .star-rating {
          display: inline-block;
          vertical-align: middle;
        }

        .meta-info {
          line-height: 1.6;
        }

        .description {
          margin: 24px 0 32px;
          max-width: 700px;
        }

        .action {
          margin-right: 16px;
          color: var(--secondary-text-color);
          cursor: pointer;
          user-select: none;
        }

        .action iron-icon {
          margin-right: 4px;
          --iron-icon-width: 18px;
          --iron-icon-height: 18px;
        }

        .additional-sections {
          margin-top: 32px;
        }

        .section {
          margin-top: 16px;
          display: block;
          padding: 16px;
          border: 1px solid var(--divider-color);
          border-radius: var(--border-radius);
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          transition: border-color var(--animation);
        }

        .section:hover {
          border-color: var(--google-blue);
        }

        .section-photo {
          margin-right: 16px;
          width: 48px;
          height: 48px;
          background-color: var(--secondary-background-color);
          border-radius: 50%;
          overflow: hidden;
          transform: translateZ(0);
        }

        .section-primary-text {
          margin-bottom: 4px;
          line-height: 1.2;
        }

        .section-secondary-text {
          font-size: 12px;
          line-height: 1;
        }

        .panel-role {
          margin: 4px 0 8px;
          color: var(--terminal-green, var(--primary-text-color));
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
        }

        paper-progress {
          width: 100%;
          --paper-progress-active-color: var(--default-primary-color);
          --paper-progress-secondary-color: var(--default-primary-color);
        }
      </style>

      <simple-hero page="speakers" hide-description$="[[speakersPreview]]">
        <div class="dialog-container header-content" layout horizontal center>
          <lazy-image class="photo" src="[[speaker.photoUrl]]" alt="[[speaker.name]]"></lazy-image>
          <div>
            <h2 class="name" flex>[[speaker.name]]</h2>
            <template is="dom-if" if="[[speaker.title]]">
              <div class="professional-role">[[speaker.title]]</div>
            </template>
            <template is="dom-if" if="[[speaker.company]]">
              <div class="professional-company">[[speaker.company]]</div>
            </template>
            <template is="dom-if" if="[[subtitle]]">
              <div class="subtitle">[[subtitle]]</div>
            </template>
          </div>
        </div>
      </simple-hero>

      <paper-progress indeterminate hidden$="[[contentLoaderVisibility]]"></paper-progress>

      <content-loader
        class="container"
        card-padding="32px"
        card-height="400px"
        horizontal-position="50%"
        border-radius="4px"
        box-shadow="var(--box-shadow)"
        items-count="1"
        hidden$="[[contentLoaderVisibility]]"
      ></content-loader>

      <div class="container content">
        <template
          is="dom-if"
          if="[[professionalHighlight(speaker.shortBio, speaker.title, speaker.company)]]"
        >
          <p class="professional-highlight">
            [[professionalHighlight(speaker.shortBio, speaker.title, speaker.company)]]
          </p>
        </template>
        <speaker-affiliations
          company="[[speaker.company]]"
          logo-url="[[speaker.companyLogoUrl]]"
          logo-background="[[speaker.companyLogoBackground]]"
          badges="[[speaker.badges]]"
          align="start"
        ></speaker-affiliations>

        <template is="dom-if" if="[[speaker.bio]]">
          <short-markdown class="description" content="[[speaker.bio]]"></short-markdown>
        </template>

        <div class="actions" layout horizontal>
          <template is="dom-repeat" items="[[speaker.socials]]" as="social">
            <a class="action" href$="[[social.link]]" target="_blank" rel="noopener noreferrer">
              <iron-icon icon="hoverboard:[[social.icon]]"></iron-icon>
            </a>
          </template>
        </div>

        <div class="additional-sections" hidden$="[[!speaker.sessions.length]]">
          <h3>[[speakerDetails.sessions]]</h3>

          <template is="dom-repeat" items="[[speaker.sessions]]" as="session">
            <a href$="[[sessionUrl(session.id)]]" class="section">
              <div layout horizontal center>
                <div class="section-details" flex>
                  <div class="section-primary-text">[[session.title]]</div>
                  <template is="dom-if" if="[[panelRole(session.id, speaker.sessionRoles)]]">
                    <div class="panel-role">[[panelRole(session.id, speaker.sessionRoles)]]</div>
                  </template>
                  <div class="section-secondary-text" hidden$="[[!session.dateReadable]]">
                    [[session.dateReadable]], [[session.startTime]] - [[session.endTime]]
                  </div>
                  <div class="section-secondary-text" hidden$="[[!session.track.title]]">
                    [[session.track.title]]
                  </div>
                  <div class="tags" hidden$="[[!session.tags.length]]">
                    <template is="dom-repeat" items="[[session.tags]]" as="tag">
                      <span class="tag" style$="color: [[getVariableColor(tag)]]">[[tag]]</span>
                    </template>
                  </div>
                </div>
              </div>
            </a>
          </template>
        </div>
      </div>

      <previous-speakers-block></previous-speakers-block>

      <footer-block></footer-block>
    `;
  }

  private speakerDetails = speakerDetails;

  @property({ type: Object })
  speaker: SpeakerWithTags | undefined;
  @property({ type: Object })
  speakers = initialSpeakersState;

  @property({ type: String })
  private speakerId: string | undefined;
  @property({ type: String, computed: 'computeJoin(speaker.country, speaker.pronouns)' })
  private subtitle: string = '';

  override stateChanged(state: RootState) {
    super.stateChanged(state);
    this.speakers = state.speakers;
  }

  override connectedCallback() {
    super.connectedCallback();

    if (this.speakers instanceof Initialized) {
      store.dispatch(fetchSpeakers);
    }
  }

  onAfterEnter(location: RouterLocation) {
    this.speakerId = location.params?.['id']?.toString();
  }

  @computed('speaker')
  get contentLoaderVisibility() {
    return !!this.speaker;
  }

  @observe('speakers', 'speakerId')
  onSpeakersAndSpeakerId(speakers: SpeakersState, speakerId: string) {
    if (speakerId && speakers instanceof Success) {
      this.speaker = selectSpeaker(store.getState(), speakerId);
      if (!this.speaker) {
        router.render('/404');
      } else {
        updateImageMetadata(this.speaker.name, this.speaker.bio, {
          image: this.speaker.photoUrl,
          imageAlt: this.speaker.name,
        });
      }
    }
  }

  private computeJoin(...values: string[]) {
    return values.filter(Boolean).join(' • ');
  }

  private panelRole(sessionId: string, roles?: Record<string, 'Moderator' | 'Panellist'>) {
    if (sessionId !== 'PANEL-01') return '';
    const role = roles?.[sessionId];
    return role === 'Moderator' ? 'Panel moderator' : role === 'Panellist' ? 'Panellist' : '';
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

  private getVariableColor(value: string) {
    return getVariableColor(this as unknown as PolymerElement, value);
  }

  sessionUrl(id: string) {
    return router.urlForName('session-page', { id });
  }
}
