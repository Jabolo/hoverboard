import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
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
  type TeamMemberInfo,
} from '../concierge/local-concierge-engine';
import { buildAgenda, type AgendaItem, type DraftAgenda } from '../utils/agenda-preview-data';
import {
  isSessionFavorite,
  setSessionFavorite,
  subscribeSessionFavorites,
} from '../utils/session-favorites';
import { isReleaseReviewHost, type PreviewSource } from '../utils/speakers-preview-data';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const CLIENT_CACHE_PREFIX = 'devfest-2026:concierge-cache:v1:';
const CLIENT_CACHE_TTL_MS = 30 * 60 * 1000;

interface QuickIntentItem {
  label: string;
  intent: ConciergeIntent;
  prompt: string;
}

const QUICK_INTENTS: ReadonlyArray<QuickIntentItem> = [
  {
    label: 'AI track',
    intent: 'track-ai',
    prompt: 'Build my non-overlapping AI & Agents track',
  },
  {
    label: 'Rooms now',
    intent: 'compare-rooms',
    prompt: 'What is happening now and how do rooms compare?',
  },
  {
    label: '$5 Credits',
    intent: 'credits-workshops',
    prompt: 'Show hands-on workshops and $5 Google Cloud credits',
  },
  {
    label: 'Venue & Wi-Fi',
    intent: 'logistics-venue',
    prompt: 'Where is the venue, Wi-Fi, and food?',
  },
  {
    label: 'Saved',
    intent: 'saved-schedule',
    prompt: 'Show my saved sessions and check for conflicts',
  },
];

const INSTANT_LOCAL_INTENTS: ReadonlySet<string> = new Set<ConciergeIntent>([
  'overview',
  'track-ai',
  'track-cloud',
  'credits-workshops',
  'compare-rooms',
  'logistics-venue',
  'saved-schedule',
]);

type SurfaceOriginLabel = 'local' | 'cached' | 'live';

interface ClientCacheEntry {
  messages: A2UIMessage[];
  expiresAt: number;
}

const memoryResponseCache = new Map<string, ClientCacheEntry>();

export function clearConciergeClientCache(): void {
  memoryResponseCache.clear();
}

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

function buildClientCacheKey(query: string, intent: string, savedIds: string[]): string {
  const sortedSaved = [...savedIds].sort().join(',');
  return `${query.toLowerCase().trim()}|${intent.toLowerCase().trim()}|${sortedSaved}`;
}

function readClientCache(key: string, now: number): A2UIMessage[] | null {
  const mem = memoryResponseCache.get(key);
  if (mem) {
    if (mem.expiresAt > now) return mem.messages;
    memoryResponseCache.delete(key);
  }
  try {
    const raw = window.sessionStorage.getItem(`${CLIENT_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientCacheEntry;
    if (parsed && Array.isArray(parsed.messages) && parsed.expiresAt > now) {
      memoryResponseCache.set(key, parsed);
      return parsed.messages;
    }
    window.sessionStorage.removeItem(`${CLIENT_CACHE_PREFIX}${key}`);
  } catch {
    // sessionStorage unavailable
  }
  return null;
}

function writeClientCache(key: string, messages: A2UIMessage[], now: number): void {
  const entry: ClientCacheEntry = { messages, expiresAt: now + CLIENT_CACHE_TTL_MS };
  memoryResponseCache.set(key, entry);
  try {
    window.sessionStorage.setItem(`${CLIENT_CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Ignore quota errors
  }
}

@customElement('devfest-concierge')
export class DevfestConcierge extends ThemedElement {
  @state() private query = '';
  @state() private activeIntent = '';
  @state() private activeQuery = '';
  @state() private isLoading = false;
  @state() private statusNotice = '';
  @state() private originLabel: SurfaceOriginLabel = 'local';
  @state() private creditStatus = 'checking';
  @state() private dataReady = false;
  @state() private dialogOpen = false;
  @state() private renderTick = 0;

  @query('#concierge-dialog')
  private dialogEl?: HTMLDialogElement;

  private readonly processor = new A2UIMessageProcessor();
  private agendaItems: AgendaItem[] = [];
  private programme: PreviewSource = { speakers: {}, sessions: {} };
  private teamMembers: TeamMemberInfo[] = [];
  private unsubscribeFavorites: (() => void) | undefined;
  private requestCounter = 0;

  static override get styles() {
    return [
      ...super.styles,
      css`
        :host {
          display: block;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          color-scheme: dark;
          container-type: inline-size;
          --_bg: var(--primary-background-color, #070c14);
          --_panel: var(--terminal-panel, #0d1727);
          --_raised: var(--terminal-panel-raised, #112039);
          --_line: var(--terminal-line, #263d5e);
          --_green: var(--terminal-green, #7ef2a5);
          --_blue: var(--terminal-blue, #8cb5ff);
          --_copy: var(--terminal-copy, #eaf2ff);
          --_muted: var(--terminal-muted, #9bb0d0);
          --_target: 36px;
          background: var(--_bg);
          border-bottom: 1px solid var(--divider-color, var(--_line));
          color: var(--_copy);
        }

        @media (pointer: coarse) {
          :host {
            --_target: 44px;
          }
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

        /* Compact 1-bar inline launcher */
        .launcher-shell {
          width: 100%;
          max-width: 1216px;
          min-width: 0;
          margin: 0 auto;
          padding: 10px 16px;
        }

        .launcher-frame {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 8px;
          width: 100%;
          min-width: 0;
          padding: 10px 12px;
          border: 1px solid var(--_line);
          border-radius: 10px;
          background: var(--_panel);
        }

        .launcher-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: center;
          width: 100%;
          min-width: 0;
        }

        .input-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          min-block-size: var(--_target);
          padding: 0 10px;
          border: 1px solid var(--_line);
          border-radius: 6px;
          background: var(--_bg);
        }

        .input-wrap:focus-within {
          border-color: var(--_green);
        }

        .prompt-prefix {
          flex: 0 0 auto;
          color: var(--_green);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        input {
          flex: 1 1 auto;
          min-width: 0;
          border: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          outline: none;
        }

        input::placeholder {
          color: var(--_muted);
          opacity: 0.85;
        }

        button {
          font: inherit;
          color: inherit;
        }

        .go-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-block-size: var(--_target);
          min-inline-size: var(--_target);
          padding: 0 14px;
          border: 0;
          border-radius: 6px;
          background: var(--google-blue-strong, #1a56db);
          color: #fff;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
        }

        .go-btn:hover:not(:disabled) {
          background: var(--google-blue, #4285f4);
        }

        .go-btn:disabled {
          opacity: 0.65;
          cursor: default;
        }

        .chip-strip {
          display: flex;
          flex-wrap: nowrap;
          gap: 8px;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          overflow-x: auto;
          scroll-snap-type: x proximity;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .chip-strip::-webkit-scrollbar {
          display: none;
        }

        .intent-chip {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          min-block-size: var(--_target);
          padding: 0 12px;
          border: 1px solid var(--_line);
          border-radius: 6px;
          background: var(--_raised);
          color: var(--_copy);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          scroll-snap-align: start;
          cursor: pointer;
        }

        .intent-chip:hover {
          border-color: var(--_blue);
        }

        .intent-chip[aria-pressed='true'] {
          border-color: var(--_green);
          background: rgb(126 242 165 / 12%);
          color: var(--_green);
        }

        @container (min-width: 56rem) {
          .launcher-shell {
            padding: 12px 24px;
          }

          .launcher-frame {
            padding: 12px 14px;
          }
        }

        /* On-demand A2UI native <dialog closedby="any"> */
        dialog.concierge-dialog {
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--_copy);
          margin: auto 0 0;
          width: 100%;
          max-width: 100%;
          max-height: 88dvh;
          overflow: visible;
        }

        dialog.concierge-dialog::backdrop {
          background: rgb(4 8 15 / 72%);
          backdrop-filter: blur(4px);
        }

        .dialog-panel {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-height: 88dvh;
          border: 0;
          border-top: 1px solid var(--_line);
          border-radius: 16px 16px 0 0;
          background: var(--_panel);
          box-shadow: 0 -12px 36px rgb(0 0 0 / 45%);
          overflow: hidden;
        }

        @media (min-width: 640px) {
          dialog.concierge-dialog {
            margin: auto;
            width: min(760px, calc(100vw - 32px));
            max-width: 760px;
            max-height: 82dvh;
          }

          .dialog-panel {
            max-height: 82dvh;
            border: 1px solid var(--_line);
            border-radius: 12px;
            box-shadow: 0 24px 60px rgb(0 0 0 / 55%);
          }
        }

        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          border-bottom: 1px solid var(--_line);
          background: var(--_raised);
        }

        .header-title-group {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .dialog-title {
          margin: 0;
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          font-weight: 700;
          color: var(--_copy);
        }

        .source-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border: 1px solid var(--_line);
          border-radius: 999px;
          background: rgb(76 141 247 / 12%);
          color: var(--_blue);
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 700;
        }

        .source-badge.is-live {
          border-color: rgb(126 242 165 / 45%);
          background: rgb(126 242 165 / 12%);
          color: var(--_green);
        }

        .close-btn {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border: 1px solid var(--_line);
          border-radius: 6px;
          background: var(--_panel);
          color: var(--_copy);
          cursor: pointer;
        }

        .close-btn:hover {
          border-color: var(--_blue);
        }

        .close-btn svg {
          width: 18px;
          height: 18px;
        }

        .dialog-controls {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 8px;
          min-width: 0;
          padding: 10px 14px;
          border-bottom: 1px solid var(--_line);
          background: var(--_panel);
        }

        .dialog-body {
          flex: 1 1 auto;
          overflow-y: auto;
          min-width: 0;
          scrollbar-width: thin;
          scrollbar-color: var(--_line) transparent;
          padding: 14px 14px max(16px, env(safe-area-inset-bottom, 0px));
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-content: start;
          gap: 14px;
        }

        .status-notice {
          margin: 0;
          padding: 8px 10px;
          border: 1px solid rgb(251 188 4 / 45%);
          border-radius: 6px;
          background: rgb(251 188 4 / 10%);
          color: var(--terminal-yellow, #fde68a);
          font-size: 13px;
          line-height: 1.4;
        }

        .surface-title {
          margin: 0;
          font-family: var(--font-mono, monospace);
          font-size: clamp(18px, 3vw, 22px);
          line-height: 1.25;
          text-wrap: balance;
          color: var(--_copy);
        }

        .surface-subtitle {
          margin: 4px 0 0;
          color: var(--_muted);
          font-size: 13px;
          line-height: 1.45;
          text-wrap: pretty;
        }

        .surface-children {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          min-width: 0;
          gap: 12px;
        }

        .callout {
          padding: 12px;
          border: 1px solid var(--_line);
          border-radius: 8px;
          background: var(--_raised);
        }

        .callout.tone-success {
          border-color: rgb(126 242 165 / 45%);
          background: rgb(126 242 165 / 8%);
        }

        .callout.tone-warning {
          border-color: rgb(251 188 4 / 45%);
          background: rgb(251 188 4 / 8%);
        }

        .callout-title {
          margin: 0 0 4px;
          font-size: 15px;
          font-weight: 700;
          text-wrap: balance;
          color: var(--_copy);
        }

        .callout-body {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          text-wrap: pretty;
          color: var(--_muted);
        }

        .session-card {
          padding: 12px;
          border: 1px solid var(--_line);
          border-radius: 8px;
          background: var(--_bg);
          display: grid;
          gap: 6px;
        }

        .session-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .session-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
        }

        .badge-time {
          color: var(--_green);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .badge-room {
          padding: 2px 6px;
          border: 1px solid rgb(76 141 247 / 40%);
          border-radius: 4px;
          color: var(--_blue);
        }

        .badge-kind {
          color: var(--_muted);
        }

        .save-btn {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-block-size: var(--_target);
          padding: 0 12px;
          border: 1px solid var(--_line);
          border-radius: 6px;
          background: var(--_raised);
          color: var(--_copy);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .save-btn[aria-pressed='true'] {
          border-color: var(--_green);
          background: rgb(126 242 165 / 14%);
          color: var(--_green);
        }

        .session-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.35;
          text-wrap: balance;
        }

        .session-title a {
          color: var(--_copy);
          text-decoration: underline;
          text-underline-offset: 3px;
          overflow-wrap: anywhere;
        }

        .session-title a:hover {
          color: var(--_green);
        }

        .session-speakers,
        .session-reason {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          text-wrap: pretty;
          color: var(--_muted);
        }

        .conflict-warning {
          margin: 4px 0 0;
          padding: 6px 8px;
          border: 1px solid rgb(251 188 4 / 45%);
          border-radius: 6px;
          background: rgb(251 188 4 / 10%);
          color: var(--terminal-yellow, #fde68a);
          font-size: 12px;
          line-height: 1.4;
        }

        .comparison-wrap h3,
        .credit-card h3,
        .logistics-card h3,
        .chip-row-wrap h3 {
          margin: 0 0 8px;
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          color: var(--_green);
          text-wrap: balance;
        }

        .comparison-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }

        @container (min-width: 38rem) {
          .comparison-grid {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
        }

        .compare-col,
        .credit-card,
        .logistics-card {
          padding: 12px;
          border: 1px solid var(--_line);
          border-radius: 8px;
          background: var(--_bg);
        }

        .compare-col {
          display: grid;
          gap: 6px;
          align-content: start;
        }

        .compare-badge {
          justify-self: start;
          padding: 2px 6px;
          border: 1px solid var(--_line);
          border-radius: 4px;
          background: var(--_raised);
          color: var(--_blue);
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 700;
        }

        .compare-heading {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.35;
          text-wrap: balance;
        }

        .compare-heading a {
          color: var(--_copy);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .compare-meta {
          margin: 0;
          color: var(--_green);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-variant-numeric: tabular-nums;
        }

        .compare-summary,
        .compare-best {
          margin: 0;
          color: var(--_muted);
          font-size: 13px;
          line-height: 1.45;
          text-wrap: pretty;
        }

        .compare-best strong {
          color: var(--_copy);
        }

        .credit-facts,
        .logistics-grid {
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
          margin-bottom: 10px;
        }

        .fact-box,
        .logistics-item {
          padding: 8px 10px;
          border: 1px solid var(--_line);
          border-radius: 6px;
          background: var(--_panel);
        }

        .fact-label,
        .logistics-label {
          display: block;
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          color: var(--_muted);
        }

        .fact-value,
        .logistics-value {
          display: block;
          margin-top: 2px;
          font-size: 13px;
          font-weight: 700;
          color: var(--_copy);
          font-variant-numeric: tabular-nums;
        }

        .logistics-detail {
          display: block;
          margin-top: 3px;
          font-size: 12px;
          color: var(--_muted);
          overflow-wrap: anywhere;
        }

        .credit-steps,
        .workshop-list {
          margin: 0 0 10px;
          padding-left: 18px;
          display: grid;
          gap: 4px;
          font-size: 13px;
          color: var(--_copy);
        }

        .workshop-list {
          list-style: none;
          padding-left: 0;
        }

        .workshop-item {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 6px;
          padding: 6px 0;
          border-top: 1px solid var(--_line);
        }

        .workshop-item a {
          color: var(--_blue);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .workshop-time {
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          color: var(--_green);
        }

        .card-links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .jump-link {
          display: inline-flex;
          align-items: center;
          min-block-size: var(--_target);
          padding: 0 12px;
          border: 1px solid var(--google-blue, #4285f4);
          border-radius: 6px;
          color: var(--_copy);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }

        .action-chip {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          min-block-size: var(--_target);
          padding: 0 12px;
          border: 1px solid var(--_line);
          border-radius: 6px;
          background: var(--_raised);
          color: var(--_copy);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
        }

        .dialog-footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-top: 8px;
          border-top: 1px solid var(--_line);
        }

        .ai-upgrade-btn {
          display: inline-flex;
          align-items: center;
          min-block-size: var(--_target);
          padding: 0 12px;
          border: 1px solid rgb(126 242 165 / 45%);
          border-radius: 6px;
          background: rgb(126 242 165 / 10%);
          color: var(--_green);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .inspector-details {
          width: 100%;
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          color: var(--_muted);
        }

        .inspector-details summary {
          cursor: pointer;
          padding: 6px 0;
          color: var(--_muted);
          user-select: none;
        }

        .inspector-details pre {
          margin: 6px 0 0;
          max-height: 220px;
          overflow: auto;
          padding: 10px;
          border: 1px solid var(--_line);
          border-radius: 6px;
          background: #050a11;
          color: #dbeafe;
          font-size: 11px;
          line-height: 1.45;
        }

        a:focus-visible,
        button:focus-visible,
        summary:focus-visible {
          outline: 2px solid var(--_green);
          outline-offset: 2px;
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
    this.openDialog();
    if (initialIntent) {
      const chip = QUICK_INTENTS.find((c) => c.intent === initialIntent);
      void this.runConciergeRequest(chip?.prompt ?? initialIntent, initialIntent);
      return;
    }
    requestAnimationFrame(() => {
      const input = this.shadowRoot?.querySelector<HTMLInputElement>('#concierge-dialog-input');
      input?.focus({ preventScroll: true });
    });
  }

  private openDialog(): void {
    this.dialogOpen = true;
    const dialog = this.dialogEl;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  private closeDialog = (): void => {
    this.dialogOpen = false;
    const dialog = this.dialogEl;
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  };

  private readonly onDialogClose = (): void => {
    this.dialogOpen = false;
  };

  private readonly onDialogClick = (event: MouseEvent): void => {
    const dialog = this.dialogEl;
    if (!dialog || event.target !== dialog) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;
    const rect = dialog.getBoundingClientRect();
    const isDialogContent =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!isDialogContent) {
      this.closeDialog();
    }
  };

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
      data: { savedSessions, conflicts },
    });
    this.renderTick++;
  }

  private async bootstrapData(): Promise<void> {
    const isHostedPreview = isHostedPreviewHostname(window.location.hostname);
    if (isHostedPreview) {
      this.creditStatus = 'preview-unavailable';
    }

    try {
      const [agendaRes, programmeRes, teamRes] = await Promise.all([
        fetch('/data/agenda-2026.json', { cache: 'no-store' }),
        fetch('/data/programme-2026.json', { cache: 'no-store' }),
        fetch('/data/event-team.json', { cache: 'no-store' }).catch(() => null),
      ]);
      if (agendaRes.ok && programmeRes.ok) {
        const draft = (await agendaRes.json()) as DraftAgenda;
        const prog = (await programmeRes.json()) as PreviewSource;
        this.programme = prog;
        this.agendaItems = buildAgenda(draft, prog);
      }
      if (teamRes && teamRes.ok) {
        const teamJson = (await teamRes.json()) as { members?: TeamMemberInfo[] };
        if (Array.isArray(teamJson.members)) {
          this.teamMembers = teamJson.members;
        }
      }
    } catch {
      // Keep built-in fallbacks if offline.
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
      ...(this.teamMembers.length ? { teamMembers: this.teamMembers } : {}),
    };
    const messages = generateLocalConciergeMessages(req);
    this.processor.processBatch(messages);
    this.originLabel = 'local';
    this.renderTick++;
  }

  private async runConciergeRequest(
    queryText: string,
    intent?: string,
    forceAi = false,
  ): Promise<void> {
    const trimmed = queryText.trim();
    this.query = trimmed;
    this.activeIntent = intent ?? 'custom';
    this.activeQuery = trimmed || (intent ?? 'overview');
    this.statusNotice = '';
    this.openDialog();

    // Serve preset chips and quick intents instantaneously at 0 API cost unless AI personalization is requested
    if (!forceAi && intent && INSTANT_LOCAL_INTENTS.has(intent)) {
      this.renderLocalSurface(trimmed, intent);
      return;
    }

    const isHostedPreview = isHostedPreviewHostname(window.location.hostname);
    if (isHostedPreview) {
      this.renderLocalSurface(trimmed, intent);
      return;
    }

    const savedSessionIds = this.getSavedSessionIds();
    const now = Date.now();
    const cacheKey = buildClientCacheKey(trimmed, intent ?? '', savedSessionIds);
    const cached = readClientCache(cacheKey, now);
    if (cached) {
      this.processor.processBatch(cached);
      this.syncFavoritesIntoActiveSurface();
      this.originLabel = 'cached';
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
          savedSessionIds,
          now,
        }),
      });

      if (reqId !== this.requestCounter || !this.isConnected) return;

      if (response.ok) {
        const payload = (await response.json()) as { messages?: unknown; cached?: boolean };
        if (Array.isArray(payload.messages) && payload.messages.length > 0) {
          const messages = payload.messages as A2UIMessage[];
          writeClientCache(cacheKey, messages, now);
          this.processor.processBatch(messages);
          this.syncFavoritesIntoActiveSurface();
          this.originLabel = payload.cached ? 'cached' : 'live';
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
    void this.runConciergeRequest(this.query, undefined, true);
  };

  private readonly onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.query = input.value;
  };

  private readonly scrollToAnchor = (event: Event, selector: string): void => {
    const rootNode = this.getRootNode();
    if (!(rootNode instanceof ShadowRoot || rootNode instanceof Document)) return;
    const target = rootNode.querySelector<HTMLElement>(selector);
    if (target) {
      event.preventDefault();
      this.closeDialog();
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
          <div>
            <h2 class="surface-title">${title}</h2>
            ${subtitle ? html`<p class="surface-subtitle">${subtitle}</p>` : nothing}
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
                            ${
                              wsHref
                                ? html`<a href=${wsHref}>${wsTitle}</a>`
                                : html`<span>${wsTitle}</span>`
                            }
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
        const isTeamLink = visitAnchor === '/team/';

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
                @click=${(e: Event) => {
                  if (!isTeamLink) this.scrollToAnchor(e, '#visit');
                  else this.closeDialog();
                }}
              >
                ${isTeamLink ? 'View team page →' : 'Plan your visit →'}
              </a>
            </div>
          </section>
        `;
      }

      case 'ActionChipRow': {
        const label = asString(node.props['label'], 'Next step');
        const chips = asRecordArray(node.props['chips']).slice(0, 2);
        if (!chips.length) return nothing;

        return html`
          <div class="chip-row-wrap">
            <h3>${label}</h3>
            <div class="chip-strip">
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

  private renderChipStrip() {
    return html`
      <div class="chip-strip" role="group" aria-label="Instant concierge topics">
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
    `;
  }

  override render() {
    const surface = this.processor.getActiveSurface();
    const isLiveOrCached = this.originLabel === 'live' || this.originLabel === 'cached';
    const sourceBadgeText =
      this.originLabel === 'live'
        ? 'Live · Gemini 4 Hydrogen'
        : this.originLabel === 'cached'
          ? 'Cached · Gemini 4 Hydrogen'
          : 'Instant · Local A2UI';

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

    const canUpgradeToAi =
      this.originLabel === 'local' &&
      !isHostedPreviewHostname(window.location.hostname) &&
      Boolean(this.activeQuery || this.activeIntent);

    return html`
      <section class="launcher-shell" aria-label="DevFest Concierge" data-tick=${this.renderTick}>
        <div class="launcher-frame">
          <form class="launcher-form" @submit=${this.onSubmit}>
            <label class="sr-only" for="concierge-input">Ask DevFest Concierge</label>
            <div class="input-wrap">
              <span class="prompt-prefix" aria-hidden="true">$ ask</span>
              <input
                id="concierge-input"
                type="text"
                .value=${this.query}
                @input=${this.onInput}
                placeholder="Ask AI: talks, rooms, $5 credits, venue…"
              />
            </div>
            <button type="submit" class="go-btn" ?disabled=${this.isLoading}>
              ${this.isLoading ? '…' : 'Ask →'}
            </button>
          </form>

          ${this.renderChipStrip()}
        </div>
      </section>

      <dialog
        id="concierge-dialog"
        class="concierge-dialog"
        closedby="any"
        aria-labelledby="concierge-dialog-title"
        @click=${this.onDialogClick}
        @close=${this.onDialogClose}
      >
        <div class="dialog-panel">
          <header class="dialog-header">
            <div class="header-title-group">
              <h2 id="concierge-dialog-title" class="dialog-title">devfest-concierge.a2ui</h2>
              <span class="source-badge ${isLiveOrCached ? 'is-live' : ''}"
                >${sourceBadgeText}</span
              >
            </div>
            <button
              type="button"
              class="close-btn"
              aria-label="Close concierge"
              @click=${this.closeDialog}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </header>

          <div class="dialog-controls">
            <form class="launcher-form" @submit=${this.onSubmit}>
              <label class="sr-only" for="concierge-dialog-input">Ask DevFest Concierge</label>
              <div class="input-wrap">
                <span class="prompt-prefix" aria-hidden="true">$ ask</span>
                <input
                  id="concierge-dialog-input"
                  type="text"
                  .value=${this.query}
                  @input=${this.onInput}
                  placeholder="Ask AI anything about DevFest Warsaw 2026…"
                />
              </div>
              <button type="submit" class="go-btn" ?disabled=${this.isLoading}>
                ${this.isLoading ? '…' : 'Ask →'}
              </button>
            </form>
            ${this.renderChipStrip()}
          </div>

          <div class="dialog-body" role="region" aria-live="polite" aria-label="Concierge output">
            ${
              this.statusNotice
                ? html`<p class="status-notice" role="status">${this.statusNotice}</p>`
                : nothing
            }
            ${
              surface && rootNode
                ? this.renderSurfaceNode(rootNode, surface)
                : this.dataReady
                  ? html`<p class="surface-subtitle">Ask a question or pick a topic above.</p>`
                  : html`<p class="surface-subtitle">Loading grounded programme surface…</p>`
            }

            <div class="dialog-footer">
              ${
                canUpgradeToAi
                  ? html`
                      <button
                        type="button"
                        class="ai-upgrade-btn"
                        ?disabled=${this.isLoading}
                        @click=${() =>
                          void this.runConciergeRequest(
                            this.activeQuery || 'Personalize my schedule',
                            this.activeIntent || undefined,
                            true,
                          )}
                      >
                        Ask Gemini AI to customize →
                      </button>
                    `
                  : nothing
              }

              <details class="inspector-details">
                <summary>Inspect A2UI JSON</summary>
                <pre><code>${inspectorJson}</code></pre>
              </details>
            </div>
          </div>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devfest-concierge': DevfestConcierge;
  }
}
