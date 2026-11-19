export type A2UIComponentType =
  | 'SurfaceContainer'
  | 'CalloutBanner'
  | 'SessionCard'
  | 'ComparisonGrid'
  | 'CreditGuideCard'
  | 'LogisticsCard'
  | 'ActionChipRow';

export const ALLOWED_A2UI_COMPONENTS: ReadonlySet<A2UIComponentType> = new Set<A2UIComponentType>([
  'SurfaceContainer',
  'CalloutBanner',
  'SessionCard',
  'ComparisonGrid',
  'CreditGuideCard',
  'LogisticsCard',
  'ActionChipRow',
]);

export type A2UISurfaceSource = 'gemini-4-hydrogen' | 'local-engine';

export interface A2UIComponentNode {
  id: string;
  component: A2UIComponentType;
  parentId?: string | null;
  children?: string[];
  props: Record<string, unknown>;
  bindings?: Record<string, string>;
}

export type A2UIMessage =
  | {
      type: 'createSurface';
      surfaceId: string;
      title: string;
      source: A2UISurfaceSource;
      timestamp: number;
    }
  | {
      type: 'updateDataModel';
      surfaceId: string;
      data: Record<string, unknown>;
    }
  | {
      type: 'updateComponents';
      surfaceId: string;
      rootId: string;
      components: A2UIComponentNode[];
    }
  | {
      type: 'deleteSurface';
      surfaceId: string;
    };

export interface SurfaceState {
  surfaceId: string;
  title: string;
  source: A2UISurfaceSource;
  rootId: string | null;
  componentsById: Map<string, A2UIComponentNode>;
  dataModel: Record<string, unknown>;
  messages: A2UIMessage[];
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeRecord(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (UNSAFE_KEYS.has(key)) continue;
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMergeRecord(existing, value);
    } else if (isPlainObject(value)) {
      result[key] = deepMergeRecord({}, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function readPath(root: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  const segments = path.split('.').filter((segment) => segment.length > 0);
  if (segments.length === 0) return undefined;

  let current: unknown = root;
  for (const segment of segments) {
    if (UNSAFE_KEYS.has(segment)) return undefined;
    if (!isPlainObject(current)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

export class A2UIMessageProcessor {
  private readonly surfaces = new Map<string, SurfaceState>();
  private activeSurfaceId: string | null = null;

  process(message: A2UIMessage): void {
    switch (message.type) {
      case 'createSurface': {
        const state: SurfaceState = {
          surfaceId: message.surfaceId,
          title: message.title,
          source: message.source,
          rootId: null,
          componentsById: new Map<string, A2UIComponentNode>(),
          dataModel: {},
          messages: [message],
        };
        this.surfaces.set(message.surfaceId, state);
        this.activeSurfaceId = message.surfaceId;
        break;
      }
      case 'updateDataModel': {
        const surface = this.surfaces.get(message.surfaceId);
        if (!surface) return;
        surface.messages.push(message);
        surface.dataModel = deepMergeRecord(surface.dataModel, message.data);
        break;
      }
      case 'updateComponents': {
        const surface = this.surfaces.get(message.surfaceId);
        if (!surface) return;
        surface.messages.push(message);
        surface.rootId = message.rootId;
        for (const node of message.components) {
          if (!ALLOWED_A2UI_COMPONENTS.has(node.component)) {
            continue;
          }
          surface.componentsById.set(node.id, node);
        }
        break;
      }
      case 'deleteSurface': {
        this.surfaces.delete(message.surfaceId);
        if (this.activeSurfaceId === message.surfaceId) {
          const remaining = Array.from(this.surfaces.keys());
          this.activeSurfaceId = remaining.length > 0 ? remaining[remaining.length - 1]! : null;
        }
        break;
      }
    }
  }

  processBatch(messages: A2UIMessage[]): void {
    for (const message of messages) {
      this.process(message);
    }
  }

  getSurface(surfaceId: string): SurfaceState | undefined {
    return this.surfaces.get(surfaceId);
  }

  getActiveSurface(): SurfaceState | undefined {
    if (!this.activeSurfaceId) return undefined;
    return this.surfaces.get(this.activeSurfaceId);
  }

  resolveBinding<T>(path: string, fallback: T, surfaceId?: string): T;
  resolveBinding<T>(surfaceId: string, path: string, fallback: T): T;
  resolveBinding<T>(arg1: string, arg2: T | string, arg3?: T | string): T {
    let targetSurfaceId: string | null;
    let path: string;
    let fallback: T;

    if (arg3 === undefined) {
      targetSurfaceId = this.activeSurfaceId;
      path = arg1;
      fallback = arg2 as T;
    } else if (typeof arg3 === 'string' && this.surfaces.has(arg3)) {
      targetSurfaceId = arg3;
      path = arg1;
      fallback = arg2 as T;
    } else if (this.surfaces.has(arg1)) {
      targetSurfaceId = arg1;
      path = String(arg2);
      fallback = arg3 as T;
    } else if (typeof arg2 === 'string' && arg2.includes('.') && !arg1.includes('.')) {
      targetSurfaceId = arg1;
      path = arg2;
      fallback = arg3 as T;
    } else if (typeof arg3 === 'string' && arg1.includes('.') && !arg3.includes('.')) {
      targetSurfaceId = arg3;
      path = arg1;
      fallback = arg2 as T;
    } else {
      targetSurfaceId = arg1;
      path = String(arg2);
      fallback = arg3 as T;
    }

    if (!targetSurfaceId) return fallback;
    const surface = this.surfaces.get(targetSurfaceId);
    if (!surface) return fallback;

    const resolved = readPath(surface.dataModel, path);
    return resolved === undefined ? fallback : (resolved as T);
  }
}
