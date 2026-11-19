import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ThemedElement } from '../components/themed-element';
import {
  ALLOWED_A2UI_COMPONENTS,
  A2UIMessageProcessor,
  type A2UIComponentNode,
  type A2UIMessage,
  type SurfaceState,
} from '../concierge/a2ui-protocol';
import {
  computeSavedConflicts,
  generateLocalConciergeMessages,
  type ConciergeIntent,
  type LocalConciergeRequest,
} from '../concierge/local-concierge-engine';
import { buildAgenda, type AgendaItem, type DraftAgenda } from '../utils/agenda-preview-data';
import {
  isSessionFavorite,
  setSessionFavorite,
  subscribeSessionFavorites,
} from '../utils/session-favorites';
import { isReleaseReviewHost, type PreviewSource } from '../utils/speakers-preview-data';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const QUICK_INTENTS: ReadonlyArray<{ label: string; intent: ConciergeIntent; prompt: string }> = [
  {
    label: 'Build AI & Agents track',
    intent: 'track-ai',
    prompt: 'Build my non-overlapping AI & Agents track',
  },
  {
    label: 'Happening now & rooms',
    intent: 'compare-rooms',
    prompt: 'What is happening now and how do rooms compare?',
  },
  {
    label: 'Workshops & $5 Cloud credits',
    intent: 'credits-workshops',
    prompt: 'Show hands-on workshops and $5 Google Cloud credits',
  },
  {
    label: 'Cloud & Backend track',
    intent: 'track-cloud',
    prompt: 'Build a Cloud & Backend track',
  },
  {
    label: 'Venue, Wi-Fi & food',
    intent: 'logistics-venue',
    prompt: 'Where is the venue, Wi-Fi, and food?',
  },
  {
    label: 'My saved sessions',
    intent: 'saved-schedule',
    prompt: 'Show my saved sessions and check for conflicts',
  },
];

function isHostedPreviewHostname(hostname: string): boolean {
  return !LOCAL_HOSTS.has(hostname) && isReleaseReviewHost(hostname);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      item !== null && typeof item === 'object' && !Array.isArray(item),
  );
}

@customElement('devfest-concierge')
export class DevfestConcierge extends ThemedElement {
  @state() private query = '';
  @state() private activeIntent: string = 'overview';
  @state() private isLoading = false;
  @state() private statusNotice = '';
  @state() private inspectOpen = false;
  @state() private creditStatus = 'checking';
  @state() private dataReady = false;
  @state() private renderTick = 0;

  private readonly processor = new A2UIMessageProcessor();
  private agendaItems: AgendaItem[] = [];
  private programme: PreviewSource = { speakers: {}, sessions: {} };
  private unsubscribeFavorites: (() => void) | undefined;
  private requestCounter = 0;

  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          background: var(--primary-background-color, #070c14);
          border-bottom: 1px solid var(--divider-color, #263d5e);
          color: var(--terminal-copy, #eaf2ff);
        }

        * {
          box-sizing: border-box;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .shell {
          max-width: 1216px;
          margin: 0 auto;
          padding: 36px 24px;
        }

        .concierge-frame {
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 10px;
          background: var(--terminal-panel, #0d1727);
          overflow: hidden;
          box-shadow: 0 18px 42px rgb(0 0 0 / 28%);
        }

        .topbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px 16px;
          min-height: 48px;
          padding: 8px 16px;
          border-bottom: 1px solid var(--terminal-line, #263d5e);
          background: var(--terminal-panel-raised, #112039);
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .dots {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-right: 4px;
        }

        .dots i {
          display: block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--google-red, #ea4335);
        }

        .dots i:nth-child(2) {
          background: var(--google-yellow, #fbbc04);
        }

        .dots i:nth-child(3) {
          background: var(--google-green, #34a853);
        }

        .file-title {
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          font-weight: 700;
          color: var(--terminal-copy, #eaf2ff);
        }

        .source-badge {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 2px 10px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 999px;
          background: rgb(76 141 247 / 12%);
          color: var(--terminal-blue, #4c8df7);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
        }

        .source-badge.is-live {
          border-color: rgb(126 242 165 / 45%);
          background: rgb(126 242 165 / 12%);
          color: var(--terminal-green, #7ef2a5);
        }

        .inspect-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 14px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 6px;
          background: var(--terminal-panel, #0d1727);
          color: var(--terminal-copy, #eaf2ff);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition:
            background-color 0.2s ease,
            border-color 0.2s ease;
        }

        .inspect-btn:hover {
          background: var(--contrast-additional-background-color, #172a45);
          border-color: var(--terminal-blue, #4c8df7);
        }

        .inspect-btn[aria-expanded='true'] {
          border-color: var(--terminal-green, #7ef2a5);
          color: var(--terminal-green, #7ef2a5);
        }

        .controls {
          padding: 18px 16px 16px;
          border-bottom: 1px solid var(--terminal-line, #263d5e);
          background: var(--terminal-panel, #0d1727);
        }

        .prompt-form {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: stretch;
        }

        .input-wrap {
          display: flex;
          align-items: center;
          flex: 1 1 320px;
          min-height: 46px;
          padding: 0 12px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 6px;
          background: var(--primary-background-color, #070c14);
        }

        .input-wrap:focus-within {
          border-color: var(--terminal-green, #7ef2a5);
          outline: 2px solid rgb(126 242 165 / 30%);
          outline-offset: 1px;
        }

        .prompt-prefix {
          flex: 0 0 auto;
          margin-right: 10px;
          color: var(--terminal-green, #7ef2a5);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          font-weight: 700;
          user-select: none;
        }

        #concierge-input {
          width: 100%;
          min-width: 0;
          min-height: 44px;
          border: 0;
          background: transparent;
          color: var(--terminal-copy, #eaf2ff);
          font-family: var(--font-mono, monospace);
          font-size: 14px;
        }

        #concierge-input::placeholder {
          color: var(--terminal-muted, #9bb0d0);
          opacity: 1;
        }

        #concierge-input:focus {
          outline: none;
        }

        .run-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 0 20px;
          border: 1px solid var(--google-blue-strong, #1967d2);
          border-radius: 6px;
          background: var(--google-blue-strong, #1967d2);
          color: #fff;
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .run-btn:hover:not(:disabled) {
          background: var(--google-blue, #4285f4);
        }

        .run-btn:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .chip-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .intent-chip,
        .action-chip {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding: 6px 14px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 6px;
          background: var(--terminal-panel-raised, #112039);
          color: var(--terminal-copy, #eaf2ff);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          text-align: left;
          transition:
            border-color 0.2s ease,
            background-color 0.2s ease;
        }

        .intent-chip:hover,
        .action-chip:hover {
          border-color: var(--terminal-blue, #4c8df7);
          background: var(--contrast-additional-background-color, #172a45);
        }

        .intent-chip[aria-pressed='true'] {
          border-color: var(--terminal-green, #7ef2a5);
          background: rgb(126 242 165 / 12%);
          color: var(--terminal-green, #7ef2a5);
        }

        .status-notice {
          margin: 12px 0 0;
          padding: 10px 12px;
          border: 1px solid rgb(251 215 118 / 45%);
          border-radius: 6px;
          background: rgb(251 215 118 / 10%);
          color: var(--terminal-yellow, #fbd776);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          line-height: 1.5;
        }

        .inspector {
          padding: 16px;
          border-bottom: 1px solid var(--terminal-line, #263d5e);
          background: var(--primary-background-color, #070c14);
        }

        .inspector-heading {
          margin: 0 0 10px;
          color: var(--terminal-muted, #9bb0d0);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
        }

        .inspector pre {
          margin: 0;
          max-height: 340px;
          overflow: auto;
          padding: 12px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 6px;
          background: var(--terminal-panel, #0d1727);
          color: var(--terminal-green, #7ef2a5);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          line-height: 1.5;
        }

        .surface-region {
          padding: 20px 16px 24px;
        }

        .surface-header {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px 16px;
          margin-bottom: 18px;
        }

        .surface-title {
          margin: 0;
          font-size: clamp(20px, 2.6vw, 26px);
          line-height: 1.2;
          color: var(--terminal-copy, #eaf2ff);
        }

        .surface-subtitle {
          margin: 4px 0 0;
          color: var(--terminal-muted, #9bb0d0);
          font-size: 14px;
          line-height: 1.5;
        }

        .surface-children {
          display: grid;
          gap: 16px;
        }

        .callout {
          padding: 14px 16px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 8px;
          background: var(--terminal-panel-raised, #112039);
        }

        .callout.tone-success {
          border-color: rgb(126 242 165 / 40%);
          background: rgb(126 242 165 / 8%);
        }

        .callout.tone-warning {
          border-color: rgb(251 215 118 / 45%);
          background: rgb(251 215 118 / 8%);
        }

        .callout-title {
          margin: 0;
          font-size: 16px;
          line-height: 1.35;
          color: var(--terminal-copy, #eaf2ff);
        }

        .callout-body {
          margin: 6px 0 0;
          max-width: 72ch;
          color: var(--terminal-muted, #9bb0d0);
          font-size: 14px;
          line-height: 1.55;
        }

        .session-card {
          display: grid;
          gap: 10px;
          padding: 16px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 8px;
          background: var(--primary-background-color, #070c14);
        }

        .session-top {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px 12px;
        }

        .session-badges {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
        }

        .badge-time {
          color: var(--terminal-green, #7ef2a5);
          font-variant-numeric: tabular-nums;
        }

        .badge-room {
          padding: 2px 8px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 4px;
          color: var(--terminal-blue, #4c8df7);
        }

        .badge-kind {
          color: var(--terminal-muted, #9bb0d0);
        }

        .save-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 14px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 6px;
          background: var(--terminal-panel-raised, #112039);
          color: var(--terminal-copy, #eaf2ff);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .save-btn:hover {
          border-color: var(--terminal-blue, #4c8df7);
        }

        .save-btn[aria-pressed='true'] {
          border-color: var(--terminal-green, #7ef2a5);
          background: rgb(126 242 165 / 14%);
          color: var(--terminal-green, #7ef2a5);
        }

        .session-title {
          margin: 0;
          font-size: 18px;
          line-height: 1.35;
        }

        .session-title a {
          color: var(--terminal-copy, #eaf2ff);
          text-decoration: underline;
          text-underline-color: rgb(155 176 208 / 40%);
          text-underline-offset: 4px;
        }

        .session-title a:hover {
          color: var(--terminal-green, #7ef2a5);
        }

        .session-speakers {
          margin: 0;
          color: var(--terminal-muted, #9bb0d0);
          font-size: 14px;
          line-height: 1.45;
        }

        .session-reason {
          margin: 0;
          color: var(--terminal-copy, #eaf2ff);
          font-size: 14px;
          line-height: 1.5;
        }

        .conflict-warning {
          margin: 0;
          padding: 8px 10px;
          border: 1px solid rgb(255 123 114 / 50%);
          border-radius: 6px;
          background: rgb(255 123 114 / 10%);
          color: var(--terminal-red, #ff7b72);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          line-height: 1.45;
        }

        .comparison-wrap h3,
        .credit-card h3,
        .logistics-card h3,
        .chip-row-wrap h3 {
          margin: 0 0 12px;
          font-size: 16px;
          color: var(--terminal-copy, #eaf2ff);
        }

        .comparison-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 12px;
        }

        .compare-col {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 14px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 8px;
          background: var(--primary-background-color, #070c14);
        }

        .compare-badge {
          align-self: flex-start;
          padding: 2px 8px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 4px;
          color: var(--terminal-blue, #4c8df7);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
        }

        .compare-heading {
          margin: 0;
          font-size: 16px;
          line-height: 1.35;
        }

        .compare-heading a {
          color: var(--terminal-copy, #eaf2ff);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .compare-meta,
        .compare-summary,
        .compare-best {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--terminal-muted, #9bb0d0);
        }

        .compare-meta {
          font-family: var(--font-mono, monospace);
          font-variant-numeric: tabular-nums;
          color: var(--terminal-green, #7ef2a5);
        }

        .compare-best strong {
          color: var(--terminal-copy, #eaf2ff);
        }

        .compare-actions {
          margin-top: auto;
          padding-top: 6px;
        }

        .credit-card,
        .logistics-card {
          padding: 16px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 8px;
          background: var(--primary-background-color, #070c14);
        }

        .credit-facts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .fact-box {
          padding: 10px 12px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 6px;
          background: var(--terminal-panel, #0d1727);
        }

        .fact-label {
          display: block;
          color: var(--terminal-muted, #9bb0d0);
          font-size: 12px;
          margin-bottom: 2px;
        }

        .fact-value {
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          font-weight: 700;
          color: var(--terminal-green, #7ef2a5);
          font-variant-numeric: tabular-nums;
        }

        .credit-steps {
          margin: 0 0 14px;
          padding-left: 20px;
          color: var(--terminal-copy, #eaf2ff);
          font-size: 14px;
          line-height: 1.6;
        }

        .workshop-list {
          display: grid;
          gap: 8px;
          margin: 0 0 14px;
          padding: 0;
          list-style: none;
        }

        .workshop-item {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 6px 12px;
          padding: 10px 12px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 6px;
          background: var(--terminal-panel, #0d1727);
        }

        .workshop-item a {
          color: var(--terminal-copy, #eaf2ff);
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .workshop-time {
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          color: var(--terminal-green, #7ef2a5);
          font-variant-numeric: tabular-nums;
        }

        .logistics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .logistics-item {
          padding: 10px 12px;
          border: 1px solid var(--terminal-line, #263d5e);
          border-radius: 6px;
          background: var(--terminal-panel, #0d1727);
        }

        .logistics-label {
          display: block;
          color: var(--terminal-muted, #9bb0d0);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          margin-bottom: 4px;
        }

        .logistics-value {
          display: block;
          color: var(--terminal-copy, #eaf2ff);
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
        }

        .logistics-detail {
          display: block;
          margin-top: 4px;
          color: var(--terminal-muted, #9bb0d0);
          font-size: 13px;
          line-height: 1.45;
        }

        .card-links {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .jump-link {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding: 0 16px;
          border: 1px solid var(--google-blue, #4285f4);
          border-radius: 6px;
          color: var(--terminal-copy, #eaf2ff);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }

        .jump-link:hover {
          background: rgb(66 133 244 / 15%);
        }

        a:focus-visible,
        button:focus-visible {
          outline: 2px solid var(--terminal-green, #7ef2a5);
          outline-offset: 2px;
        }

        @media (max-width: 640px) {
          .shell {
            padding: 24px 16px;
          }

          .run-btn {
            width: 100%;
          }
        }
      `,
    ];
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribeFavorites = subscribeSessionFavorites(() => {
      this.syncFavoritesIntoActiveSurface();
    });
    void this.bootstrapData();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribeFavorites?.();
    this.unsubscribeFavorites = undefined;
  }

  public openAndFocus(initialIntent?: string): void {
    if (typeof this.scrollIntoView === 'function') {
      this.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('#concierge-input');
    input?.focus({ preventScroll: true });
    if (initialIntent) {
      const chip = QUICK_INTENTS.find((c) => c.intent === initialIntent);
      void this.runConciergeRequest(chip?.prompt ?? initialIntent, initialIntent);
    }
  }

  private getSavedSessionIds(): string[] {
    const ids = new Set<string>();
    for (const item of this.agendaItems) {
      if (isSessionFavorite(item.id)) {
        ids.add(item.id);
      }
    }
    const surface = this.processor.getActiveSurface();
    if (surface) {
      for (const node of surface.componentsById.values()) {
        const sid = asString(node.props['sessionId']);
        if (sid && isSessionFavorite(sid)) {
          ids.add(sid);
        }
      }
    }
    return [...ids];
  }

  private syncFavoritesIntoActiveSurface(): void {
    const surface = this.processor.getActiveSurface();
    if (!surface) {
      this.renderTick++;
      return;
    }

    const savedIds = this.getSavedSessionIds();
    const savedSessions: Record<string, boolean> = {};
    for (const item of this.agendaItems) {
      savedSessions[item.id] = isSessionFavorite(item.id);
    }
    for (const node of surface.componentsById.values()) {
      const sid = asString(node.props['sessionId']);
      if (sid) {
        savedSessions[sid] = isSessionFavorite(sid);
      }
    }
    const conflicts = computeSavedConflicts(this.agendaItems, savedIds);

    this.processor.process({
      type: 'updateDataModel',
      surfaceId: surface.surfaceId,
      data: {
        savedSessions,
        conflicts,
      },
    });
    this.renderTick++;
  }

  private async bootstrapData(): Promise<void> {
    const isHostedPreview = isHostedPreviewHostname(window.location.hostname);
    if (isHostedPreview) {
      this.creditStatus = 'preview-unavailable';
    }

    try {
      const [agendaRes, programmeRes] = await Promise.all([
        fetch('/data/agenda-2026.json', { cache: 'no-store' }),
        fetch('/data/programme-2026.json', { cache: 'no-store' }),
      ]);
      if (agendaRes.ok && programmeRes.ok) {
        const draft = (await agendaRes.json()) as DraftAgenda;
        const prog = (await programmeRes.json()) as PreviewSource;
        this.programme = prog;
        this.agendaItems = buildAgenda(draft, prog);
      }
    } catch {
      // Keep empty fallback arrays if offline.
    }

    if (!isHostedPreview) {
      try {
        const creditRes = await fetch('/api/cloud-credit', { cache: 'no-store' });
        if (creditRes.ok) {
          const creditData = (await creditRes.json()) as { status?: string };
          if (creditData.status) {
            this.creditStatus = creditData.status;
          }
        } else {
          this.creditStatus = 'unavailable';
        }
      } catch {
        this.creditStatus = 'unavailable';
      }
    }

    this.dataReady = true;
    this.renderLocalSurface('', 'overview');
  }

  private renderLocalSurface(query: string, intent?: string): void {
    const req: LocalConciergeRequest = {
      query,
      ...(intent ? { intent } : {}),
      agendaItems: this.agendaItems,
      programme: this.programme,
      savedSessionIds: this.getSavedSessionIds(),
      creditStatus: this.creditStatus,
      now: Date.now(),
    };
    const messages = generateLocalConciergeMessages(req);
    this.processor.processBatch(messages);
    this.renderTick++;
  }

  private async runConciergeRequest(queryText: string, intent?: string): Promise<void> {
    const trimmed = queryText.trim();
    this.query = trimmed;
    this.activeIntent = intent ?? 'custom';
    this.statusNotice = '';

    const isHostedPreview = isHostedPreviewHostname(window.location.hostname);
    if (isHostedPreview) {
      this.renderLocalSurface(trimmed, intent);
      return;
    }

    const reqId = ++this.requestCounter;
    this.isLoading = true;

    try {
      const response = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          ...(intent ? { intent } : {}),
          savedSessionIds: this.getSavedSessionIds(),
          now: Date.now(),
        }),
      });

      if (reqId !== this.requestCounter || !this.isConnected) return;

      if (response.ok) {
        const payload = (await response.json()) as { messages?: unknown };
        if (Array.isArray(payload.messages) && payload.messages.length > 0) {
          this.processor.processBatch(payload.messages as A2UIMessage[]);
          this.syncFavoritesIntoActiveSurface();
          this.isLoading = false;
          return;
        }
      }

      if (response.status === 429) {
        this.statusNotice = 'Rate limit reached — running on Grounded Local A2UI Engine';
      }
      this.renderLocalSurface(trimmed, intent);
    } catch {
      if (reqId !== this.requestCounter || !this.isConnected) return;
      this.renderLocalSurface(trimmed, intent);
    } finally {
      if (reqId === this.requestCounter) {
        this.isLoading = false;
      }
    }
  }

  private readonly onSubmit = (event: Event): void => {
    event.preventDefault();
    void this.runConciergeRequest(this.query);
  };

  private readonly onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.query = input.value;
  };

  private readonly onToggleInspect = (): void => {
    this.inspectOpen = !this.inspectOpen;
  };

  private readonly scrollToAnchor = (event: Event, selector: string): void => {
    const rootNode = this.getRootNode();
    if (!(rootNode instanceof ShadowRoot || rootNode instanceof Document)) return;
    const target = rootNode.querySelector<HTMLElement>(selector);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  private renderSurfaceNode(
    node: A2UIComponentNode,
    surface: SurfaceState,
  ): TemplateResult | typeof nothing {
    if (!ALLOWED_A2UI_COMPONENTS.has(node.component)) {
      return nothing;
    }

    switch (node.component) {
      case 'SurfaceContainer': {
        const title = asString(node.props['title'], surface.title);
        const subtitle = asString(node.props['subtitle']);
        const children = (node.children ?? [])
          .map((childId) => surface.componentsById.get(childId))
          .filter((child): child is A2UIComponentNode => Boolean(child));

        return html`
          <div class="surface-header">
            <div>
              <h2 class="surface-title">${title}</h2>
              ${subtitle ? html`<p class="surface-subtitle">${subtitle}</p>` : nothing}
            </div>
          </div>
          <div class="surface-children">
            ${children.map((child) => this.renderSurfaceNode(child, surface))}
          </div>
        `;
      }

      case 'CalloutBanner': {
        const tone = asString(node.props['tone'], 'info');
        const title = asString(node.props['title']);
        const body = asString(node.props['body']);
        const toneClass =
          tone === 'success' ? 'tone-success' : tone === 'warning' ? 'tone-warning' : 'tone-info';

        return html`
          <div class="callout ${toneClass}">
            ${title ? html`<h3 class="callout-title">${title}</h3>` : nothing}
            ${body ? html`<p class="callout-body">${body}</p>` : nothing}
          </div>
        `;
      }

      case 'SessionCard': {
        const sessionId = asString(node.props['sessionId']);
        const title = asString(node.props['title']);
        const start = asString(node.props['start']);
        const end = asString(node.props['end']);
        const space = asString(node.props['space']);
        const kind = asString(node.props['kind']);
        const speakers = asStringArray(node.props['speakers']);
        const href = asString(node.props['href'], sessionId ? `/sessions/${sessionId}/` : '');
        const reason = asString(node.props['reason']);

        const savedPath = node.bindings?.['saved'] ?? asString(node.props['bindSavedPath']);
        const selected = savedPath
          ? this.processor.resolveBinding<boolean>(
              savedPath,
              isSessionFavorite(sessionId),
              surface.surfaceId,
            )
          : isSessionFavorite(sessionId);

        const conflictPath =
          node.bindings?.['conflict'] ?? asString(node.props['bindConflictPath']);
        const conflictText = conflictPath
          ? this.processor.resolveBinding<string>(conflictPath, '', surface.surfaceId)
          : '';

        const timeRange = end ? `${start}–${end}` : start;

        return html`
          <article class="session-card" data-session-id=${sessionId}>
            <div class="session-top">
              <div class="session-badges">
                ${timeRange ? html`<span class="badge-time">${timeRange}</span>` : nothing}
                ${space ? html`<span class="badge-room">${space}</span>` : nothing}
                ${kind ? html`<span class="badge-kind">${kind}</span>` : nothing}
              </div>
              ${
                sessionId
                  ? html`
                      <button
                        type="button"
                        class="save-btn"
                        aria-pressed=${selected ? 'true' : 'false'}
                        @click=${() => {
                          setSessionFavorite(sessionId, !selected);
                        }}
                      >
                        ${selected ? 'Saved' : 'Save'}
                      </button>
                    `
                  : nothing
              }
            </div>
            <h3 class="session-title">
              ${href ? html`<a href=${href}>${title}</a>` : html`${title}`}
            </h3>
            ${
              speakers.length
                ? html`<p class="session-speakers">${speakers.join(', ')}</p>`
                : nothing
            }
            ${reason ? html`<p class="session-reason">${reason}</p>` : nothing}
            ${
              conflictText
                ? html`<p class="conflict-warning" role="status">
                    Schedule conflict: ${conflictText}
                  </p>`
                : nothing
            }
          </article>
        `;
      }

      case 'ComparisonGrid': {
        const title = asString(node.props['title']);
        const columns = asRecordArray(node.props['columns']);

        return html`
          <section class="comparison-wrap">
            ${title ? html`<h3>${title}</h3>` : nothing}
            <div class="comparison-grid">
              ${columns.map((col) => {
                const colBadge = asString(col['badge']);
                const colHeading = asString(col['heading']);
                const colTime = asString(col['time']);
                const colSpeakers = asString(col['speakers']);
                const colSummary = asString(col['summary']);
                const colBestFor = asString(col['bestFor']);
                const colHref = asString(col['href']);
                const colSessionId = asString(col['sessionId']);
                const colSaved = colSessionId ? isSessionFavorite(colSessionId) : false;

                return html`
                  <div class="compare-col">
                    ${colBadge ? html`<span class="compare-badge">${colBadge}</span>` : nothing}
                    <h4 class="compare-heading">
                      ${colHref ? html`<a href=${colHref}>${colHeading}</a>` : html`${colHeading}`}
                    </h4>
                    ${colTime ? html`<p class="compare-meta">${colTime}</p>` : nothing}
                    ${colSpeakers ? html`<p class="compare-summary">${colSpeakers}</p>` : nothing}
                    ${colSummary ? html`<p class="compare-summary">${colSummary}</p>` : nothing}
                    ${
                      colBestFor
                        ? html`<p class="compare-best"><strong>Best for:</strong> ${colBestFor}</p>`
                        : nothing
                    }
                    ${
                      colSessionId
                        ? html`
                            <div class="compare-actions">
                              <button
                                type="button"
                                class="save-btn"
                                aria-pressed=${colSaved ? 'true' : 'false'}
                                @click=${() => {
                                  setSessionFavorite(colSessionId, !colSaved);
                                }}
                              >
                                ${colSaved ? 'Saved' : 'Save'}
                              </button>
                            </div>
                          `
                        : nothing
                    }
                  </div>
                `;
              })}
            </div>
          </section>
        `;
      }

      case 'CreditGuideCard': {
        const title = asString(node.props['title'], '$5 Google Cloud Credits');
        const claimWindow = asString(node.props['claimWindow'], '09:00–19:00 Warsaw time');
        const validity = asString(node.props['validity'], '12 hours after claiming');
        const poolSize = asString(node.props['poolSize'], '330 credits');
        const steps = asStringArray(node.props['steps']);
        const workshops = asRecordArray(node.props['workshops']);

        return html`
          <section class="credit-card">
            <h3>${title}</h3>
            <div class="credit-facts">
              <div class="fact-box">
                <span class="fact-label">Live Status</span>
                <span class="fact-value">${this.creditStatus}</span>
              </div>
              <div class="fact-box">
                <span class="fact-label">Claim Window</span>
                <span class="fact-value">${claimWindow}</span>
              </div>
              <div class="fact-box">
                <span class="fact-label">Validity</span>
                <span class="fact-value">${validity}</span>
              </div>
              <div class="fact-box">
                <span class="fact-label">Pool</span>
                <span class="fact-value">${poolSize}</span>
              </div>
            </div>
            ${
              steps.length
                ? html`
                    <ol class="credit-steps">
                      ${steps.map((step) => html`<li>${step}</li>`)}
                    </ol>
                  `
                : nothing
            }
            ${
              workshops.length
                ? html`
                    <ul class="workshop-list">
                      ${workshops.map((ws) => {
                        const wsTitle = asString(ws['title']);
                        const wsTime = asString(ws['time']);
                        const wsHref = asString(ws['href']);
                        return html`
                          <li class="workshop-item">
                            ${wsHref ? html`<a href=${wsHref}>${wsTitle}</a>` : html`<span>${wsTitle}</span>`}
                            ${wsTime ? html`<span class="workshop-time">${wsTime}</span>` : nothing}
                          </li>
                        `;
                      })}
                    </ul>
                  `
                : nothing
            }
            <div class="card-links">
              <a
                class="jump-link"
                href="/#cloud-credit"
                @click=${(e: Event) => this.scrollToAnchor(e, '#cloud-credit')}
              >
                Go to $5 Cloud Credit Claim →
              </a>
            </div>
          </section>
        `;
      }

      case 'LogisticsCard': {
        const title = asString(node.props['title'], 'Practical Information');
        const items = asRecordArray(node.props['items']);
        const directionsUrl = asString(node.props['directionsUrl']);
        const visitAnchor = asString(node.props['visitAnchor'], '/#visit');

        return html`
          <section class="logistics-card">
            <h3>${title}</h3>
            <div class="logistics-grid">
              ${items.map(
                (item) => html`
                  <div class="logistics-item">
                    <span class="logistics-label">${asString(item['label'])}</span>
                    <span class="logistics-value">${asString(item['value'])}</span>
                    ${
                      asString(item['detail'])
                        ? html`<span class="logistics-detail">${asString(item['detail'])}</span>`
                        : nothing
                    }
                  </div>
                `,
              )}
            </div>
            <div class="card-links">
              ${
                directionsUrl
                  ? html`
                      <a
                        class="jump-link"
                        href=${directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Google Maps Directions ↗
                      </a>
                    `
                  : nothing
              }
              <a
                class="jump-link"
                href=${visitAnchor}
                @click=${(e: Event) => this.scrollToAnchor(e, '#visit')}
              >
                Plan your visit →
              </a>
            </div>
          </section>
        `;
      }

      case 'ActionChipRow': {
        const label = asString(node.props['label'], 'Explore more');
        const chips = asRecordArray(node.props['chips']);

        return html`
          <div class="chip-row-wrap">
            <h3>${label}</h3>
            <div class="chip-bar">
              ${chips.map((chip) => {
                const chipLabel = asString(chip['label']);
                const chipPrompt = asString(chip['prompt'], chipLabel);
                const chipIntent = asString(chip['intent']);
                return html`
                  <button
                    type="button"
                    class="action-chip"
                    @click=${() => void this.runConciergeRequest(chipPrompt, chipIntent || undefined)}
                  >
                    ${chipLabel}
                  </button>
                `;
              })}
            </div>
          </div>
        `;
      }
    }
  }

  override render() {
    const surface = this.processor.getActiveSurface();
    const isLiveSource = surface?.source === 'gemini-4-hydrogen';
    const sourceBadgeText = isLiveSource
      ? 'A2UI · Gemini 4 Hydrogen (Medium)'
      : 'A2UI · Grounded Local Engine';

    const rootNode =
      surface && surface.rootId ? surface.componentsById.get(surface.rootId) : undefined;

    const inspectorJson = surface
      ? JSON.stringify(
          {
            surfaceId: surface.surfaceId,
            source: surface.source,
            rootId: surface.rootId,
            dataModel: surface.dataModel,
            components: [...surface.componentsById.values()],
            messages: surface.messages,
          },
          null,
          2,
        )
      : '{}';

    return html`
      <section class="shell" aria-label="DevFest Concierge" data-tick=${this.renderTick}>
        <div class="concierge-frame">
          <div class="topbar">
            <div class="topbar-left">
              <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="file-title">devfest-concierge.a2ui</span>
              <span class="source-badge ${isLiveSource ? 'is-live' : ''}">${sourceBadgeText}</span>
            </div>
            <button
              type="button"
              class="inspect-btn"
              aria-expanded=${this.inspectOpen ? 'true' : 'false'}
              aria-controls="a2ui-inspector"
              @click=${this.onToggleInspect}
            >
              Inspect A2UI JSON
            </button>
          </div>

          <div class="controls">
            <form class="prompt-form" @submit=${this.onSubmit}>
              <label class="sr-only" for="concierge-input">Ask DevFest Concierge</label>
              <div class="input-wrap">
                <span class="prompt-prefix" aria-hidden="true">$ ask</span>
                <input
                  id="concierge-input"
                  type="text"
                  .value=${this.query}
                  @input=${this.onInput}
                  placeholder="Ask about talks, AI track, $5 Cloud credits, rooms, or venue…"
                />
              </div>
              <button type="submit" class="run-btn" ?disabled=${this.isLoading}>
                ${this.isLoading ? 'Running…' : 'Run →'}
              </button>
            </form>

            <div class="chip-bar" role="group" aria-label="Quick concierge intents">
              ${QUICK_INTENTS.map(
                (item) => html`
                  <button
                    type="button"
                    class="intent-chip"
                    data-intent=${item.intent}
                    aria-pressed=${this.activeIntent === item.intent ? 'true' : 'false'}
                    @click=${() => void this.runConciergeRequest(item.prompt, item.intent)}
                  >
                    ${item.label}
                  </button>
                `,
              )}
            </div>

            ${
              this.statusNotice
                ? html`<p class="status-notice" role="status">${this.statusNotice}</p>`
                : nothing
            }
          </div>

          ${
            this.inspectOpen
              ? html`
                  <div id="a2ui-inspector" class="inspector">
                    <p class="inspector-heading">Active A2UI Surface Payload</p>
                    <pre><code>${inspectorJson}</code></pre>
                  </div>
                `
              : nothing
          }

          <div
            class="surface-region"
            role="region"
            aria-live="polite"
            aria-label="Concierge output"
          >
            ${
              surface && rootNode
                ? this.renderSurfaceNode(rootNode, surface)
                : this.dataReady
                  ? html`<p class="surface-subtitle">
                      Ask a question or pick a quick intent above.
                    </p>`
                  : html`<p class="surface-subtitle">Loading grounded programme surface…</p>`
            }
          </div>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devfest-concierge': DevfestConcierge;
  }
}
