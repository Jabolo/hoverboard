import { css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
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
  getScheduleTimeSlot,
  isTimeSensitiveQuery,
  type ConciergeIntent,
  type LocalConciergeRequest,
  type TeamMemberInfo,
} from '../concierge/local-concierge-engine';
import {
  detectVoiceSupport,
  VoiceInputController,
  type VoiceInputState,
  type VoiceLanguage,
  type VoiceSupportKind,
} from '../concierge/voice-input-controller';
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
const LIVE_TIME_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

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

function formatCreditStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Open now';
    case 'upcoming':
      return 'Opens Nov 21 · 09:00';
    case 'closed':
      return 'Window closed';
    case 'claimed':
      return 'Claimed';
    case 'preview-unavailable':
      return 'Preview only';
    case 'checking':
      return 'Checking…';
    default:
      return 'Check on-site';
  }
}

function formatAiModelLabel(source?: string): string {
  switch (source) {
    case 'gemini-4-hydrogen':
      return 'Gemini 4';
    case 'gemini-3.6-flash':
      return 'Gemini 3.6 Flash';
    case 'gemini-3.1-flash-lite':
      return 'Gemini 3.1 Flash-Lite';
    case 'gemini-3.5-flash-lite':
      return 'Gemini AI';
    default:
      return 'Gemini AI';
  }
}

function buildClientCacheKey(
  query: string,
  intent: string,
  savedIds: string[],
  now: number,
  creditStatus: string,
): string {
  const sortedSaved = [...savedIds].sort().join(',');
  let key = `${query.toLowerCase().trim()}|${intent.toLowerCase().trim()}|${sortedSaved}`;
  if (isTimeSensitiveQuery(query, intent)) {
    const slot = getScheduleTimeSlot(now);
    key += `|slot=${slot.slotKey}`;
  }
  if (intent === 'credits-workshops' || /credit/i.test(query)) {
    key += `|credit=${creditStatus}`;
  }
  return key;
}

function computeClientCacheExpiresAt(query: string, intent: string, now: number): number {
  if (!isTimeSensitiveQuery(query, intent)) {
    return now + CLIENT_CACHE_TTL_MS;
  }
  const slot = getScheduleTimeSlot(now);
  if (slot.phase === 'live' && slot.nextBoundaryAt !== null) {
    return Math.min(now + LIVE_TIME_CLIENT_CACHE_TTL_MS, slot.nextBoundaryAt);
  }
  if (slot.phase === 'pre-event' && slot.nextBoundaryAt !== null) {
    return Math.min(now + CLIENT_CACHE_TTL_MS, slot.nextBoundaryAt);
  }
  return now + CLIENT_CACHE_TTL_MS;
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

function writeClientCache(key: string, messages: A2UIMessage[], expiresAt: number): void {
  const entry: ClientCacheEntry = { messages, expiresAt };
  memoryResponseCache.set(key, entry);
  try {
    window.sessionStorage.setItem(`${CLIENT_CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Ignore quota errors
  }
}

@customElement('devfest-concierge')
export class DevfestConcierge extends ThemedElement {
  @property({ type: String, reflect: true }) variant: 'band' | 'hero' | 'floating' = 'band';

  @state() private query = '';
  @state() private activeIntent = '';
  @state() private activeQuery = '';
  @state() private isLoading = false;
  @state() private statusNotice = '';
  @state() private originLabel: SurfaceOriginLabel = 'local';
  @state() private creditStatus = 'checking';
  @state() private dataReady = false;
  @state() private dialogOpen = false;
  @state() private isFabVisible = false;
  @state() private voiceState: VoiceInputState = 'idle';
  @state() private voiceLanguage: VoiceLanguage = 'pl-PL';
  @state() private voiceNotice = '';
  @state() private renderTick = 0;

  @query('#concierge-dialog')
  private dialogEl?: HTMLDialogElement;

  private readonly processor = new A2UIMessageProcessor();
  private agendaItems: AgendaItem[] = [];
  private programme: PreviewSource = { speakers: {}, sessions: {} };
  private teamMembers: TeamMemberInfo[] = [];
  private unsubscribeFavorites: (() => void) | undefined;
  private liveRefreshTimer: number | undefined;
  private spotlightRaf: number | undefined;
  private pendingSpotPoint: { target: HTMLElement; x: number; y: number } | null = null;
  private returnFocusEl: HTMLElement | null = null;
  private surfaceTransitionTick = 0;
  private requestCounter = 0;
  private voiceController?: VoiceInputController;
  private voiceSupport: VoiceSupportKind = 'unsupported';
  private heroObserver: IntersectionObserver | undefined;

  static override get styles() {
    return [
      ...super.styles,
      css`
        @property --_beam-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 135deg;
        }

        @keyframes concierge-beam {
          to {
            --_beam-angle: 495deg;
          }
        }

        @keyframes launcher-dot-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgb(126 242 165 / 45%);
          }
          50% {
            box-shadow: 0 0 0 4px rgb(126 242 165 / 0%);
          }
        }

        @keyframes a2ui-materialize {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes loading-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @keyframes spinner-rotate {
          to {
            transform: rotate(360deg);
          }
        }

        ::selection {
          background: rgb(126 242 165 / 24%);
          color: var(--_copy);
        }

        :host {
          display: block;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          color-scheme: dark;
          container-type: inline-size;
          text-align: left;
          font-size: 16px;
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

        :host([variant='hero']) {
          background: transparent;
          border-bottom: 0;
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

        :host([variant='hero']) .launcher-shell {
          max-width: none;
          padding: 0;
        }

        .launcher-frame {
          position: relative;
          overflow: hidden;
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

        .launcher-frame > * {
          position: relative;
          z-index: 1;
        }

        :host([variant='hero']) .launcher-frame {
          padding: 10px 12px;
          border: 1px solid transparent;
          background:
            linear-gradient(rgb(10 21 37 / 92%), rgb(10 21 37 / 92%)) padding-box,
            conic-gradient(
                from var(--_beam-angle, 135deg),
                rgb(38 61 94 / 75%) 0deg,
                rgb(76 141 247 / 85%) 70deg,
                rgb(126 242 165 / 92%) 115deg,
                rgb(38 61 94 / 75%) 185deg,
                rgb(38 61 94 / 75%) 360deg
              )
              border-box;
          box-shadow: 0 18px 42px -12px rgb(0 0 0 / 55%);
          backdrop-filter: blur(8px);
          animation: concierge-beam 10s linear infinite;
        }

        @media (hover: hover) and (pointer: fine) {
          :host([variant='hero']) .launcher-frame::before {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            opacity: 0;
            transition: opacity 200ms ease-out;
            background: radial-gradient(
              260px circle at var(--_spot-x, 50%) var(--_spot-y, 0%),
              rgb(76 141 247 / 13%),
              transparent 72%
            );
          }

          :host([variant='hero']) .launcher-frame:hover::before,
          :host([variant='hero']) .launcher-frame:focus-within::before {
            opacity: 1;
          }
        }

        .launcher-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgb(38 61 94 / 55%);
        }

        .launcher-brand {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
          color: var(--_copy);
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 700;
        }

        .launcher-dot {
          width: 7px;
          height: 7px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: var(--_green);
          animation: launcher-dot-pulse 2.6s ease-out infinite;
        }

        .launcher-meta-group {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex: 0 0 auto;
        }

        .launcher-meta {
          flex: 0 0 auto;
          color: var(--_muted);
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          white-space: nowrap;
        }

        .shortcut-kbd {
          display: none;
          padding: 1px 5px;
          border: 1px solid var(--_line);
          border-radius: 4px;
          background: var(--_bg);
          color: var(--_muted);
          font-family: var(--font-mono, monospace);
          font-size: 10px;
          line-height: 1.3;
        }

        @media (hover: hover) and (pointer: fine) {
          .shortcut-kbd {
            display: inline-flex;
            align-items: center;
          }
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
          caret-color: var(--_green);
          font: inherit;
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          outline: none;
        }

        input::placeholder {
          color: var(--_muted);
          opacity: 0.85;
        }

        @media (pointer: coarse), (any-pointer: coarse), (max-width: 811px) {
          input {
            font-size: 16px;
          }
        }

        button {
          font: inherit;
          color: inherit;
        }

        .btn-icon {
          width: 14px;
          height: 14px;
          flex: 0 0 auto;
        }

        .spinner-icon {
          width: 14px;
          height: 14px;
          flex: 0 0 auto;
          animation: spinner-rotate 0.8s linear infinite;
        }

        .go-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
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
          transition:
            background-color 140ms ease,
            transform 100ms ease;
        }

        .go-btn:active:not(:disabled) {
          transform: scale(0.97);
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

        @container (max-width: 30.25rem) {
          .chip-strip {
            padding-inline-end: 22px;
            -webkit-mask-image: linear-gradient(
              to right,
              #000 0,
              #000 calc(100% - 24px),
              transparent 100%
            );
            mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 24px), transparent 100%);
          }
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

        @container (min-width: 30.26rem) {
          .chip-strip {
            gap: 6px;
          }

          .intent-chip {
            padding: 0 10px;
          }
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
          opacity: 0;
          transform: translateY(28px);
          transition:
            opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
            overlay 280ms allow-discrete,
            display 280ms allow-discrete;
        }

        dialog.concierge-dialog[open] {
          opacity: 1;
          transform: translateY(0);
        }

        @starting-style {
          dialog.concierge-dialog[open] {
            opacity: 0;
            transform: translateY(28px);
          }
        }

        dialog.concierge-dialog::backdrop {
          background: rgb(4 8 15 / 0%);
          backdrop-filter: blur(0px);
          transition:
            background-color 220ms ease-out,
            backdrop-filter 220ms ease-out,
            overlay 220ms allow-discrete,
            display 220ms allow-discrete;
        }

        dialog.concierge-dialog[open]::backdrop {
          background: rgb(4 8 15 / 72%);
          backdrop-filter: blur(6px);
        }

        @starting-style {
          dialog.concierge-dialog[open]::backdrop {
            background: rgb(4 8 15 / 0%);
            backdrop-filter: blur(0px);
          }
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
          box-shadow: 0 -12px 36px -6px rgb(0 0 0 / 50%);
          overflow: hidden;
        }

        @media (min-width: 640px) {
          dialog.concierge-dialog {
            margin: auto;
            width: min(760px, calc(100vw - 32px));
            max-width: 760px;
            max-height: 82dvh;
            transform: scale(0.96) translateY(8px);
            transition-duration: 220ms;
          }

          dialog.concierge-dialog[open] {
            transform: scale(1) translateY(0);
          }

          @starting-style {
            dialog.concierge-dialog[open] {
              opacity: 0;
              transform: scale(0.96) translateY(8px);
            }
          }

          .dialog-panel {
            max-height: 82dvh;
            border: 1px solid var(--_line);
            border-radius: 12px;
            box-shadow: 0 24px 60px -12px rgb(0 0 0 / 60%);
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

        .dialog-body::-webkit-scrollbar {
          width: 6px;
        }

        .dialog-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .dialog-body::-webkit-scrollbar-thumb {
          background: var(--_line);
          border-radius: 999px;
        }

        .loading-surface {
          display: grid;
          gap: 10px;
          padding: 12px;
          border: 1px solid var(--_line);
          border-radius: 8px;
          background: var(--_bg);
        }

        .loading-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          color: var(--_green);
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          font-weight: 700;
        }

        .loading-bar {
          height: 14px;
          border-radius: 4px;
          background: linear-gradient(
            90deg,
            rgb(38 61 94 / 35%) 0%,
            rgb(76 141 247 / 28%) 50%,
            rgb(38 61 94 / 35%) 100%
          );
          background-size: 200% 100%;
          animation: loading-shimmer 1.4s ease-in-out infinite;
        }

        .loading-bar.short {
          width: 68%;
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

        .surface-node {
          min-width: 0;
          animation: a2ui-materialize 240ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
          animation-delay: calc(var(--_idx, 0) * 35ms);
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
          gap: 6px;
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
          transition:
            border-color 140ms ease,
            background-color 140ms ease,
            transform 100ms ease;
        }

        .save-btn:active {
          transform: scale(0.96);
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
          text-underline-offset: 4px;
          text-decoration-thickness: 1.5px;
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

        .compare-col {
          display: grid;
          gap: 6px;
          align-content: start;
          padding: 12px;
          border: 1px solid var(--_line);
          border-radius: 8px;
          background: var(--_bg);
        }

        .credit-card,
        .logistics-card {
          padding: 14px 0 0;
          border: 0;
          border-top: 1px solid var(--_line);
          border-radius: 0;
          background: transparent;
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
          text-underline-offset: 4px;
          text-decoration-thickness: 1.5px;
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
          padding: 10px 12px;
          border: 1px solid var(--_line);
          border-radius: 6px;
          background: var(--_bg);
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
          text-underline-offset: 4px;
          text-decoration-thickness: 1.5px;
        }

        .workshop-time {
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          color: var(--_green);
          font-variant-numeric: tabular-nums;
        }

        .card-links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .jump-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
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
          gap: 6px;
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

        /* Floating persistent FAB */
        :host([variant='floating']) {
          position: fixed;
          right: 18px;
          bottom: calc(18px + var(--countdown-offset, 0px) + env(safe-area-inset-bottom, 0px));
          z-index: 900;
          font-family: var(--font-mono, monospace);
          pointer-events: none;
        }

        :host([variant='floating']) .orbital-fab {
          pointer-events: auto;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          height: 48px;
          padding: 0 16px 0 12px;
          border: 1px solid transparent;
          border-radius: 9999px;
          background:
            linear-gradient(rgb(11 19 32 / 94%), rgb(11 19 32 / 94%)) padding-box,
            conic-gradient(
                from var(--_beam-angle, 135deg),
                var(--_blue, #4285f4),
                var(--_green, #34a853),
                var(--_yellow, #fbbc04),
                var(--_blue, #4285f4)
              )
              border-box;
          box-shadow:
            0 8px 24px rgb(4 8 15 / 55%),
            0 0 0 1px rgb(255 255 255 / 8%),
            inset 0 1px 0 rgb(255 255 255 / 15%);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          color: #fff;
          cursor: pointer;
          user-select: none;
          transform: scale(0.8) translateY(12px);
          opacity: 0;
          visibility: hidden;
          transition:
            opacity 260ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 280ms cubic-bezier(0.16, 1, 0.3, 1),
            visibility 280ms allow-discrete;
          animation: concierge-beam-spin 6s linear infinite;
        }

        :host([variant='floating'][data-fab-visible]) .orbital-fab {
          opacity: 1;
          visibility: visible;
          transform: scale(1) translateY(0);
        }

        :host([variant='floating'][data-dialog-open]) .orbital-fab {
          opacity: 0;
          visibility: hidden;
          transform: scale(0.8) translateY(12px);
          pointer-events: none;
        }

        .fab-spark-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
        }

        .fab-pulse-ring {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 1.5px solid var(--_green, #7ef2a5);
          opacity: 0.7;
          animation: fab-sonar 2.6s ease-out infinite;
        }

        @keyframes fab-sonar {
          0% {
            transform: scale(0.85);
            opacity: 0.8;
          }
          60% {
            transform: scale(1.6);
            opacity: 0;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }

        .fab-spark-svg {
          width: 18px;
          height: 18px;
          fill: var(--_green, #7ef2a5);
          filter: drop-shadow(0 0 6px rgb(126 242 165 / 65%));
        }

        .fab-label {
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #fff;
        }

        .fab-kbd {
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgb(255 255 255 / 20%);
          background: rgb(255 255 255 / 8%);
          font-size: 11px;
          color: var(--_copy-sub, #9fb0c7);
        }

        @media (max-width: 639px) {
          :host([variant='floating']) {
            right: 14px;
            bottom: calc(14px + var(--countdown-offset, 0px) + env(safe-area-inset-bottom, 0px));
          }

          :host([variant='floating']) .orbital-fab {
            width: 52px;
            height: 52px;
            min-width: 52px;
            min-height: 52px;
            padding: 0;
            justify-content: center;
          }

          .fab-label,
          .fab-kbd {
            display: none;
          }
        }

        /* Voice input mic button */
        .mic-btn {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          min-width: 36px;
          min-height: 36px;
          margin-inline-end: 4px;
          padding: 0;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          color: var(--_copy-sub, #9fb0c7);
          cursor: pointer;
          transition:
            color 160ms ease,
            border-color 160ms ease,
            background-color 160ms ease;
        }

        .mic-btn:hover {
          color: var(--_green, #7ef2a5);
          background: rgb(126 242 165 / 10%);
        }

        .mic-btn:focus-visible {
          outline: 2px solid var(--_yellow, #fbbc04);
          outline-offset: 2px;
        }

        .mic-btn.is-listening {
          color: var(--_green, #7ef2a5);
          border-color: var(--_green, #7ef2a5);
          background: rgb(126 242 165 / 16%);
          box-shadow: 0 0 10px rgb(126 242 165 / 35%);
        }

        .mic-btn.is-transcribing {
          color: var(--_blue, #4285f4);
          border-color: var(--_blue, #4285f4);
          background: rgb(66 133 244 / 14%);
        }

        .mic-icon {
          width: 18px;
          height: 18px;
        }

        /* 4-bar animated equalizer */
        .eq-bars {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 2.5px;
          width: 20px;
          height: 18px;
        }

        .eq-bar {
          width: 2.5px;
          border-radius: 2px;
          background: currentColor;
          animation: eq-pulse 0.8s ease-in-out infinite alternate;
        }

        .bar-1 {
          height: 6px;
          animation-delay: 0.1s;
        }
        .bar-2 {
          height: 16px;
          animation-delay: 0.3s;
        }
        .bar-3 {
          height: 11px;
          animation-delay: 0.2s;
        }
        .bar-4 {
          height: 7px;
          animation-delay: 0.4s;
        }

        @keyframes eq-pulse {
          0% {
            transform: scaleY(0.4);
          }
          100% {
            transform: scaleY(1.3);
          }
        }

        @media (pointer: coarse) {
          .mic-btn {
            width: 44px;
            height: 44px;
            min-width: 44px;
            min-height: 44px;
          }
        }

        .voice-status-bar {
          margin: 6px 0 2px;
          padding: 6px 10px;
          border-radius: 4px;
          background: rgb(126 242 165 / 10%);
          border: 1px solid rgb(126 242 165 / 25%);
          color: var(--_green, #7ef2a5);
          font-size: 12px;
          font-family: var(--font-mono, monospace);
        }

        .lang-pill-wrap {
          display: inline-flex;
          align-items: center;
          padding: 2px;
          border-radius: 4px;
          border: 1px solid var(--_line, rgb(255 255 255 / 10%));
          background: var(--_raised, #131d2e);
          gap: 2px;
          margin-inline-start: 8px;
        }

        .lang-toggle-btn {
          border: 0;
          border-radius: 3px;
          padding: 2px 6px;
          background: transparent;
          color: var(--_copy-sub, #9fb0c7);
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .lang-toggle-btn.is-active {
          background: var(--_blue, #4285f4);
          color: #fff;
        }

        @media (prefers-reduced-motion: reduce) {
          :host([variant='hero']) .launcher-frame,
          .launcher-dot,
          .loading-bar,
          .surface-node,
          .spinner-icon,
          :host([variant='floating']) .orbital-fab,
          .fab-pulse-ring,
          .eq-bar {
            animation: none;
          }

          .fab-pulse-ring {
            display: none;
          }

          dialog.concierge-dialog,
          dialog.concierge-dialog::backdrop,
          :host([variant='hero']) .launcher-frame::before,
          .go-btn,
          .save-btn,
          :host([variant='floating']) .orbital-fab {
            transition: none;
          }
        }
      `,
    ];
  }

  private initVoice(): void {
    this.voiceSupport = detectVoiceSupport();
    if (this.voiceSupport !== 'unsupported') {
      this.voiceController = new VoiceInputController({
        lang: this.voiceLanguage,
        onTranscript: (transcript: string, isFinal: boolean) => {
          this.query = transcript;
          this.voiceNotice = isFinal ? 'Voice captured. Edit or tap Ask.' : 'Listening…';
          const inputId = this.dialogOpen ? '#concierge-dialog-input' : '#concierge-input';
          const inputEl = this.shadowRoot?.querySelector<HTMLInputElement>(inputId);
          inputEl?.focus();
        },
        onStateChange: (state: VoiceInputState) => {
          this.voiceState = state;
          if (state === 'listening') {
            this.voiceNotice = 'Listening… speak your query now';
          } else if (state === 'transcribing') {
            this.voiceNotice = 'Transcribing voice with Gemini…';
          }
        },
        onError: (err: string) => {
          this.voiceNotice = err;
        },
      });
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.initVoice();

    if (this.variant === 'floating') {
      window.addEventListener('devfest-concierge:hero-visible', this.onHeroVisibleEvent);
      window.addEventListener('devfest-concierge:request', this.onConciergeRequestEvent);
      window.addEventListener('vaadin-router-location-changed', this.onLocationChanged);
      window.addEventListener('keydown', this.onGlobalKeydown);
      this.isFabVisible = typeof window !== 'undefined' && window.location.pathname !== '/';
    } else {
      window.addEventListener('keydown', this.onGlobalKeydown);
    }

    this.toggleAttribute('data-dialog-open', this.dialogOpen);
    this.toggleAttribute('data-fab-visible', this.isFabVisible);

    this.unsubscribeFavorites = subscribeSessionFavorites(() => {
      this.syncFavoritesIntoActiveSurface();
    });
    void this.bootstrapData();
  }

  override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    if (this.variant === 'hero' && typeof IntersectionObserver !== 'undefined') {
      const frame = this.shadowRoot?.querySelector('.launcher-frame');
      if (frame) {
        this.heroObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              window.dispatchEvent(
                new CustomEvent('devfest-concierge:hero-visible', {
                  detail: { visible: entry.isIntersecting },
                }),
              );
            }
          },
          { threshold: 0.15 },
        );
        this.heroObserver.observe(frame);
      }
    }
  }

  override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    const props = changedProperties as Map<string, unknown>;
    if (props.has('dialogOpen')) {
      this.toggleAttribute('data-dialog-open', this.dialogOpen);
    }
    if (props.has('isFabVisible')) {
      this.toggleAttribute('data-fab-visible', this.isFabVisible);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onGlobalKeydown);
    if (this.variant === 'floating') {
      window.removeEventListener('devfest-concierge:hero-visible', this.onHeroVisibleEvent);
      window.removeEventListener('devfest-concierge:request', this.onConciergeRequestEvent);
      window.removeEventListener('vaadin-router-location-changed', this.onLocationChanged);
    }
    if (this.variant === 'hero') {
      this.heroObserver?.disconnect();
      this.heroObserver = undefined;
      window.dispatchEvent(
        new CustomEvent('devfest-concierge:hero-visible', {
          detail: { visible: false },
        }),
      );
    }
    this.voiceController?.cancel();
    if (this.spotlightRaf !== undefined) {
      window.cancelAnimationFrame(this.spotlightRaf);
      this.spotlightRaf = undefined;
    }
    this.pendingSpotPoint = null;
    this.clearLiveRefreshTimer();
    this.unsubscribeFavorites?.();
    this.unsubscribeFavorites = undefined;
  }

  private readonly onHeroVisibleEvent = (e: Event): void => {
    const visible = Boolean((e as CustomEvent<{ visible?: boolean }>).detail?.visible);
    this.isFabVisible = !visible;
  };

  private readonly onConciergeRequestEvent = (e: Event): void => {
    e.preventDefault();
    const custom = e as CustomEvent<{
      query?: string;
      intent?: string;
      forceAi?: boolean;
      trigger?: HTMLElement;
    }>;
    if (custom.detail) {
      if (custom.detail.trigger) {
        this.returnFocusEl = custom.detail.trigger;
      }
      void this.runConciergeRequest(
        custom.detail.query || '',
        custom.detail.intent,
        custom.detail.forceAi,
      );
    }
  };

  private readonly onLocationChanged = (): void => {
    if (this.dialogOpen) {
      this.closeDialog();
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      this.isFabVisible = true;
    }
  };

  private readonly onGlobalKeydown = (event: KeyboardEvent): void => {
    const isCmdK =
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'k';
    if (isCmdK) {
      event.preventDefault();
      this.openAndFocus();
      return;
    }

    if (
      event.key === '/' &&
      !this.dialogOpen &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      const target = event.composedPath()[0];
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      this.openAndFocus();
    }
  };

  private readonly onLauncherPointerMove = (event: PointerEvent): void => {
    if (this.variant !== 'hero' || event.pointerType !== 'mouse') return;
    const frame = event.currentTarget;
    if (!(frame instanceof HTMLElement)) return;
    const rect = frame.getBoundingClientRect();
    this.pendingSpotPoint = {
      target: frame,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    if (this.spotlightRaf === undefined) {
      this.spotlightRaf = window.requestAnimationFrame(() => {
        this.spotlightRaf = undefined;
        const point = this.pendingSpotPoint;
        this.pendingSpotPoint = null;
        if (!point || !this.isConnected) return;
        point.target.style.setProperty('--_spot-x', `${Math.round(point.x)}px`);
        point.target.style.setProperty('--_spot-y', `${Math.round(point.y)}px`);
      });
    }
  };

  private clearLiveRefreshTimer(): void {
    if (this.liveRefreshTimer !== undefined) {
      window.clearTimeout(this.liveRefreshTimer);
      this.liveRefreshTimer = undefined;
    }
  }

  private scheduleLiveRefreshIfNeeded(): void {
    this.clearLiveRefreshTimer();
    if (!(
      this.dialogOpen &&
      this.originLabel === 'local' &&
      this.activeIntent === 'compare-rooms'
    )) {
      return;
    }
    const { nextBoundaryAt } = getScheduleTimeSlot(Date.now());
    if (nextBoundaryAt === null) return;
    const delta = nextBoundaryAt - Date.now();
    if (delta <= 0 || delta > 24 * 60 * 60 * 1000) return;

    this.liveRefreshTimer = window.setTimeout(
      () => {
        this.liveRefreshTimer = undefined;
        if (!this.isConnected || !this.dialogOpen || this.activeIntent !== 'compare-rooms') {
          return;
        }
        this.renderLocalSurface(this.activeQuery, 'compare-rooms');
        this.scheduleLiveRefreshIfNeeded();
      },
      Math.max(1000, delta + 250),
    );
  }

  public openAndFocus(initialIntent?: string): void {
    if (this.variant !== 'floating') {
      const chip = initialIntent
        ? QUICK_INTENTS.find((c) => c.intent === initialIntent)
        : undefined;
      const delegated = !window.dispatchEvent(
        new CustomEvent('devfest-concierge:request', {
          bubbles: true,
          cancelable: true,
          detail: {
            query: chip?.prompt ?? '',
            intent: initialIntent,
            trigger: this.shadowRoot?.querySelector('#concierge-input') || this,
          },
        }),
      );
      if (delegated) {
        return;
      }
    }

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

  private captureReturnFocus(): void {
    if (this.dialogOpen) return;
    let active: Element | null = document.activeElement;
    while (active && active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      active !== document.documentElement &&
      !this.dialogEl?.contains(active)
    ) {
      this.returnFocusEl = active;
    }
  }

  private restoreReturnFocus(): void {
    const target = this.returnFocusEl;
    this.returnFocusEl = null;
    if (!target?.isConnected) return;
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) {
      target.focus({ preventScroll: true });
    }
  }

  private openDialog(): void {
    this.captureReturnFocus();
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
    this.clearLiveRefreshTimer();
    const dialog = this.dialogEl;
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    this.restoreReturnFocus();
  };

  private readonly onDialogClose = (): void => {
    this.dialogOpen = false;
    this.clearLiveRefreshTimer();
    this.restoreReturnFocus();
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
        if (node.component === 'ComparisonGrid') {
          for (const col of asRecordArray(node.props['columns'])) {
            const colSid = asString(col['sessionId']);
            if (colSid && isSessionFavorite(colSid)) {
              ids.add(colSid);
            }
          }
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

    if (this.activeIntent === 'saved-schedule' && this.originLabel === 'local') {
      this.renderLocalSurface(this.activeQuery, 'saved-schedule', false);
      return;
    }

    const savedIds = this.getSavedSessionIds();
    const savedSessions: Record<string, boolean> = {};
    const computedConflicts = computeSavedConflicts(this.agendaItems, savedIds);
    const conflicts: Record<string, string> = {};

    for (const item of this.agendaItems) {
      savedSessions[item.id] = isSessionFavorite(item.id);
      conflicts[item.id] = computedConflicts[item.id] ?? '';
    }
    for (const node of surface.componentsById.values()) {
      const sid = asString(node.props['sessionId']);
      if (sid) {
        savedSessions[sid] = isSessionFavorite(sid);
        conflicts[sid] = computedConflicts[sid] ?? '';
      }
      if (node.component === 'ComparisonGrid') {
        for (const col of asRecordArray(node.props['columns'])) {
          const colSid = asString(col['sessionId']);
          if (colSid) {
            savedSessions[colSid] = isSessionFavorite(colSid);
            conflicts[colSid] = computedConflicts[colSid] ?? '';
          }
        }
      }
    }

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

  private renderLocalSurface(query: string, intent?: string, animate = true): void {
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
    if (animate) {
      this.surfaceTransitionTick++;
    }
    this.renderTick++;
    this.scheduleLiveRefreshIfNeeded();
  }

  private async runConciergeRequest(
    queryText: string,
    intent?: string,
    forceAi = false,
  ): Promise<void> {
    const trimmed = queryText.trim();
    if (this.variant !== 'floating') {
      const delegated = !window.dispatchEvent(
        new CustomEvent('devfest-concierge:request', {
          bubbles: true,
          cancelable: true,
          detail: {
            query: trimmed,
            intent,
            forceAi,
            trigger: this.shadowRoot?.querySelector('#concierge-input') || this,
          },
        }),
      );
      if (delegated) {
        return;
      }
    }

    this.query = trimmed;
    this.activeIntent = intent ?? 'custom';
    this.activeQuery = trimmed || (intent ?? 'overview');
    this.statusNotice = '';
    this.clearLiveRefreshTimer();
    this.openDialog();

    if (!trimmed && !intent) {
      this.renderLocalSurface('', 'overview');
      return;
    }

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
    const cacheKey = buildClientCacheKey(
      trimmed,
      intent ?? '',
      savedSessionIds,
      now,
      this.creditStatus,
    );
    const cached = readClientCache(cacheKey, now);
    if (cached) {
      this.surfaceTransitionTick++;
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
          const expiresAt = computeClientCacheExpiresAt(trimmed, intent ?? '', now);
          writeClientCache(cacheKey, messages, expiresAt);
          this.surfaceTransitionTick++;
          this.processor.processBatch(messages);
          this.syncFavoritesIntoActiveSurface();
          this.originLabel = payload.cached ? 'cached' : 'live';
          this.isLoading = false;
          return;
        }
      }

      if (response.status === 429) {
        this.statusNotice = 'Rate limit reached — running on Grounded Local A2UI Engine';
      } else {
        this.statusNotice = 'Live AI temporarily busy — showing grounded local A2UI answer';
      }
      this.renderLocalSurface(trimmed, intent);
    } catch {
      if (reqId !== this.requestCounter || !this.isConnected) return;
      this.statusNotice = 'Live AI temporarily busy — showing grounded local A2UI answer';
      this.renderLocalSurface(trimmed, intent);
    } finally {
      if (reqId === this.requestCounter) {
        this.isLoading = false;
      }
    }
  }

  private readonly onSubmit = (event: Event): void => {
    event.preventDefault();
    if (!this.query.trim()) {
      if (!this.processor.getActiveSurface()) {
        this.renderLocalSurface('', 'overview');
      }
      this.openAndFocus();
      return;
    }
    void this.runConciergeRequest(this.query, undefined, true);
  };

  private readonly onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.query = input.value;
  };

  private async toggleVoiceInput(e?: Event, targetInputId?: string): Promise<void> {
    e?.preventDefault();
    e?.stopPropagation();
    if (!this.voiceController) return;

    if (this.voiceState === 'listening') {
      this.voiceController.stop();
    } else {
      if (targetInputId) {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>(`#${targetInputId}`);
        input?.focus({ preventScroll: true });
      }
      await this.voiceController.start();
    }
  }

  private toggleVoiceLanguage(lang: VoiceLanguage): void {
    this.voiceLanguage = lang;
    this.voiceController?.setLanguage(lang);
    this.requestUpdate();
  }

  private readonly scrollToAnchor = (event: Event, selector: string): void => {
    let target = document.querySelector<HTMLElement>(selector);
    if (!target) {
      const rootNode = this.getRootNode();
      if (rootNode instanceof ShadowRoot || rootNode instanceof Document) {
        target = rootNode.querySelector<HTMLElement>(selector);
      }
    }
    if (target) {
      event.preventDefault();
      this.closeDialog();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (window.location.pathname !== '/') {
      this.closeDialog();
      window.location.href = `/${selector}`;
    }
  };

  private renderArrowRightIcon() {
    return html`
      <svg class="btn-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3 8h10M9 4l4 4-4 4"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  private renderExternalArrowIcon() {
    return html`
      <svg class="btn-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M6 3h7v7M13 3L5 11"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  private renderBookmarkIcon(saved: boolean) {
    return html`
      <svg class="btn-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M4 2.5h8v11l-4-2.8-4 2.8v-11z"
          fill=${saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  private renderSpinnerIcon() {
    return html`
      <svg class="spinner-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle
          cx="8"
          cy="8"
          r="5.5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-dasharray="22 12"
          stroke-linecap="round"
        />
      </svg>
    `;
  }

  private renderSurfaceNode(
    node: A2UIComponentNode,
    surface: SurfaceState,
    suppressedTitle = '',
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
          ${repeat(
            [this.surfaceTransitionTick],
            (tick) => tick,
            () => html`
              <div class="surface-children">
                ${children.map((child, idx) => {
                  const prevChild = idx > 0 ? children[idx - 1] : undefined;
                  const prevTitle =
                    prevChild?.component === 'CalloutBanner'
                      ? asString(prevChild.props['title'])
                      : '';
                  return html`<div class="surface-node" style="--_idx: ${idx}">
                    ${this.renderSurfaceNode(child, surface, prevTitle)}
                  </div>`;
                })}
              </div>
            `,
          )}
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
                        ${this.renderBookmarkIcon(selected)}
                        <span>${selected ? 'Saved' : 'Save'}</span>
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
        const showHeading = Boolean(title) && title !== suppressedTitle;
        const columns = asRecordArray(node.props['columns']);

        return html`
          <section class="comparison-wrap">
            ${showHeading ? html`<h3>${title}</h3>` : nothing}
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
                const colConflict = colSessionId
                  ? this.processor.resolveBinding<string>(
                      `conflicts.${colSessionId}`,
                      '',
                      surface.surfaceId,
                    )
                  : '';

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
                              ${this.renderBookmarkIcon(colSaved)}
                              <span>${colSaved ? 'Saved' : 'Save'}</span>
                            </button>
                          `
                        : nothing
                    }
                    ${
                      colConflict
                        ? html`<p class="conflict-warning" role="status">
                            Schedule conflict: ${colConflict}
                          </p>`
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
                <span class="fact-value">${formatCreditStatusLabel(this.creditStatus)}</span>
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
                <span>Go to $5 Cloud Credit Claim</span>
                ${this.renderArrowRightIcon()}
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
                        <span>Google Maps Directions</span>
                        ${this.renderExternalArrowIcon()}
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
                <span>${isTeamLink ? 'Meet the organizing team' : 'Plan your visit'}</span>
                ${this.renderArrowRightIcon()}
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
    const aiModelLabel = formatAiModelLabel(surface?.source);
    const isLiveRoomsClock = this.originLabel === 'local' && this.activeIntent === 'compare-rooms';
    const isLiveOrCached =
      this.originLabel === 'live' || this.originLabel === 'cached' || isLiveRoomsClock;
    const sourceBadgeText =
      this.originLabel === 'live'
        ? `Live · ${aiModelLabel}`
        : this.originLabel === 'cached'
          ? `Cached · ${aiModelLabel}`
          : isLiveRoomsClock
            ? 'Live · Local Clock'
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

    if (this.variant === 'floating') {
      return html`
        ${this.renderFloatingFab()}
        ${this.renderDialog(
          isLiveOrCached,
          sourceBadgeText,
          canUpgradeToAi,
          inspectorJson,
          rootNode,
          surface,
        )}
      `;
    }

    return html`
      ${this.renderLauncherShell()}
      ${this.renderDialog(
        isLiveOrCached,
        sourceBadgeText,
        canUpgradeToAi,
        inspectorJson,
        rootNode,
        surface,
      )}
    `;
  }

  private renderFloatingFab() {
    return html`
      <button
        type="button"
        class="orbital-fab"
        aria-label="Ask DevFest AI Concierge"
        aria-haspopup="dialog"
        @click=${() => this.openAndFocus()}
      >
        <span class="fab-spark-wrap" aria-hidden="true">
          <span class="fab-pulse-ring"></span>
          <svg class="fab-spark-svg" viewBox="0 0 24 24">
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
          </svg>
        </span>
        <span class="fab-label">Ask AI</span>
        <kbd class="fab-kbd" aria-hidden="true">⌘K</kbd>
      </button>
    `;
  }

  private renderVoiceMicButton(targetInputId: string) {
    if (this.voiceSupport === 'unsupported') return nothing;
    const isListening = this.voiceState === 'listening';
    const isTranscribing = this.voiceState === 'transcribing';
    const title = isListening
      ? 'Listening… tap to stop'
      : isTranscribing
        ? 'Transcribing audio with Gemini…'
        : 'Voice dictation (Speak your query)';

    return html`
      <button
        type="button"
        class="mic-btn ${isListening ? 'is-listening' : ''} ${isTranscribing ? 'is-transcribing' : ''}"
        aria-label=${title}
        title=${title}
        @click=${(e: Event) => void this.toggleVoiceInput(e, targetInputId)}
      >
        ${
          isListening
            ? html`
                <span class="eq-bars" aria-hidden="true">
                  <span class="eq-bar bar-1"></span>
                  <span class="eq-bar bar-2"></span>
                  <span class="eq-bar bar-3"></span>
                  <span class="eq-bar bar-4"></span>
                </span>
              `
            : isTranscribing
              ? this.renderSpinnerIcon()
              : html`
                  <svg class="mic-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                      fill="currentColor"
                    />
                    <path
                      d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                `
        }
      </button>
    `;
  }

  private renderLauncherShell() {
    return html`
      <section class="launcher-shell" aria-label="DevFest Concierge" data-tick=${this.renderTick}>
        <div class="launcher-frame" @pointermove=${this.onLauncherPointerMove}>
          ${
            this.variant === 'hero'
              ? html`
                  <div class="launcher-header">
                    <span class="launcher-brand">
                      <span class="launcher-dot" aria-hidden="true"></span>
                      <span>devfest-concierge</span>
                    </span>
                    <span class="launcher-meta-group">
                      <span class="launcher-meta">Instant + AI</span>
                      <kbd class="shortcut-kbd" aria-hidden="true">⌘K</kbd>
                    </span>
                  </div>
                `
              : nothing
          }
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
              ${this.renderVoiceMicButton('concierge-input')}
            </div>
            <button
              type="submit"
              class="go-btn"
              aria-label=${this.isLoading ? 'Sending query' : 'Ask concierge'}
              ?disabled=${this.isLoading}
            >
              ${
                this.isLoading
                  ? this.renderSpinnerIcon()
                  : html`<span>Ask</span>${this.renderArrowRightIcon()}`
              }
            </button>
          </form>

          ${this.renderChipStrip()}
        </div>
      </section>
    `;
  }

  private renderDialog(
    isLiveOrCached: boolean,
    sourceBadgeText: string,
    canUpgradeToAi: boolean,
    inspectorJson: string,
    rootNode?: A2UIComponentNode,
    surface?: SurfaceState,
  ) {
    return html`
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
              ${
                this.voiceSupport === 'web-speech'
                  ? html`
                      <div class="lang-pill-wrap" title="Speech language">
                        <button
                          type="button"
                          class="lang-toggle-btn ${this.voiceLanguage === 'pl-PL' ? 'is-active' : ''}"
                          @click=${() => this.toggleVoiceLanguage('pl-PL')}
                        >
                          PL
                        </button>
                        <button
                          type="button"
                          class="lang-toggle-btn ${this.voiceLanguage === 'en-US' ? 'is-active' : ''}"
                          @click=${() => this.toggleVoiceLanguage('en-US')}
                        >
                          EN
                        </button>
                      </div>
                    `
                  : nothing
              }
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
                ${this.renderVoiceMicButton('concierge-dialog-input')}
              </div>
              <button
                type="submit"
                class="go-btn"
                aria-label=${this.isLoading ? 'Sending query' : 'Ask concierge'}
                ?disabled=${this.isLoading}
              >
                ${
                  this.isLoading
                    ? this.renderSpinnerIcon()
                    : html`<span>Ask</span>${this.renderArrowRightIcon()}`
                }
              </button>
            </form>
            ${
              this.voiceNotice
                ? html`<div class="voice-status-bar" role="status" aria-live="polite">
                    ${this.voiceNotice}
                  </div>`
                : nothing
            }
            ${this.renderChipStrip()}
          </div>

          <div class="dialog-body" role="region" aria-live="polite" aria-label="Concierge output">
            ${
              this.statusNotice
                ? html`<p class="status-notice" role="status">${this.statusNotice}</p>`
                : nothing
            }
            ${
              this.isLoading
                ? html`
                    <div class="loading-surface" role="status" aria-live="polite">
                      <p class="loading-status">
                        ${this.renderSpinnerIcon()}
                        <span>Synthesizing grounded A2UI surface…</span>
                      </p>
                      <div class="loading-bar"></div>
                      <div class="loading-bar short"></div>
                    </div>
                  `
                : surface && rootNode
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
                        <span>Ask Gemini AI to customize</span>
                        ${this.renderArrowRightIcon()}
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
