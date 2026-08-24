/**
 * A `StateStore` over a networked key-value service. D60.
 *
 * D59 deployed SG to a serverless endpoint and measured the consequence: the
 * statistical layer never engaged, because `memoryStore` is process-local and every
 * cold start discarded accumulated trust. `sqliteStore` does not help there either —
 * the filesystem is as ephemeral as the process. Durability on serverless means a
 * store that lives somewhere else, which means the network.
 *
 * ## Zero dependencies, still
 *
 * This talks HTTP through the global `fetch` rather than importing a Redis client.
 * That is not only about the dependency count (D7): a TCP connection pool is the
 * wrong shape for a function that may be frozen mid-request, and the managed KV
 * services that serverless platforms actually offer — Upstash Redis, Vercel KV,
 * Cloudflare KV — all expose an HTTP API for exactly that reason.
 *
 * ## The transport is injected, so this is not one vendor's adapter
 *
 * `kvStore` holds the *model* concerns: JSON encoding, millisecond precision,
 * freezing what it returns, and never reinterpreting an opaque key. A `KvTransport`
 * holds the *service* concerns. `upstashTransport` is provided because it is what
 * Upstash and Vercel KV both speak; anything else needs three functions.
 */
import { DEFAULT_RETENTION_HOURS } from '../core/policy.ts';
import type { StateStore } from '../core/store.ts';
import { isExpired, type EntityState } from '../core/trust.ts';

/**
 * The three operations a KV service has to offer.
 *
 * Deliberately narrower than the `StateStore` it backs: no sweep, no size, no
 * iteration. A networked store cannot scan keys cheaply, and it does not need to —
 * `ttlSeconds` lets the service reclaim space, and expiry remains a read-time
 * decision (D6).
 */
export type KvTransport = {
  /** Raw stored string, or `undefined` if the key is absent. */
  get(key: string): Promise<string | undefined>;
  /** Store a string. `ttlSeconds`, when given, is a space bound and never a correctness one. */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
};

export type KvStoreOptions = {
  readonly transport: KvTransport;
  readonly retentionHours?: number;

  /**
   * Prefix for every key, so SG's state cannot collide with the host's own data in
   * a shared namespace. Joined with `:` — and the entity reference itself is never
   * altered beyond that, because D1 makes it opaque.
   */
  readonly keyPrefix?: string;

  /**
   * What to do when the transport throws or times out.
   *
   * `true` (the default) reads a failure as a cold start and swallows a failed
   * write. The reasoning is D9: the guard is advisory, so a KV outage must not take
   * down the host's request path with it. The cost is stated rather than hidden —
   * an attacker who can make your KV unreachable resets every entity to `unknown`,
   * which is the most permissive state the trust dimension has.
   *
   * What survives that attack is the invariant layer: a proven violation reaches
   * `RESTRICT` with no history at all (D15), so fail-open degrades the statistical
   * dimension and not the provable one.
   *
   * `false` propagates, for a host that would rather fail the request than trust an
   * entity it has forgotten.
   */
  readonly failOpen?: boolean;

  /**
   * Called on every transport failure. Present because a fail-open store that is
   * silently failing open is indistinguishable from one that is working, and that
   * is how a deployment discovers months later that trust never accumulated.
   */
  readonly onError?: (error: unknown, operation: 'get' | 'set' | 'del', key: string) => void;
};

export type KvStore = StateStore;

/**
 * Build a `StateStore` on a KV transport.
 *
 * Prove it before trusting it. The conformance kit (D8) is the point of the store
 * contract existing, and a networked store is exactly where the subtle mistakes
 * live:
 *
 *     import { checkStoreConformance, assertConformant } from '@fachryxyf/scorpio-guard';
 *     assertConformant(await checkStoreConformance(() => kvStore({ transport })));
 */
export function kvStore(options: KvStoreOptions): KvStore {
  const { transport } = options;
  const retentionHours = options.retentionHours ?? DEFAULT_RETENTION_HOURS;
  const failOpen = options.failOpen ?? true;
  const prefix = options.keyPrefix ?? 'sg';

  /**
   * The entity reference is opaque (D1), so it is used as-is rather than trimmed,
   * lower-cased, or hashed. Two references that differ must stay distinct, and the
   * conformance kit checks precisely that with keys containing spaces, slashes,
   * colons and braces.
   *
   * Which is also why `upstashTransport` sends commands in a JSON body rather than
   * in the URL path: a key containing `/` or a space is not a path segment.
   */
  const keyFor = (entity: string) => `${prefix}:${entity}`;

  /**
   * TTL is set beyond the retention horizon on purpose.
   *
   * Retention has one definition — `isExpired` (D6) — and a service-side expiry
   * that fired first would become a second one, disagreeing with every other store
   * about when state dies. So the TTL is a generous upper bound whose only job is
   * reclaiming space, exactly as `sweep` is in the memory store.
   */
  const ttlSeconds = Math.ceil(retentionHours * 3600 * 1.5);

  function handle(error: unknown, operation: 'get' | 'set' | 'del', key: string): void {
    options.onError?.(error, operation, key);
    if (!failOpen) throw error;
  }

  return {
    get: async (entity) => {
      const key = keyFor(entity);
      let raw: string | undefined;
      try {
        raw = await transport.get(key);
      } catch (error) {
        handle(error, 'get', key);
        // Fail-open: absent state is a cold start, which the guard already models
        // as a well-defined condition rather than as an error.
        return undefined;
      }
      if (raw === undefined || raw === null || raw === '') return undefined;

      let parsed: EntityState;
      try {
        parsed = JSON.parse(raw) as EntityState;
      } catch (error) {
        // A value that is not our JSON is not our value. Treating it as a cold
        // start is safer than throwing on every request for one poisoned key.
        handle(error, 'get', key);
        return undefined;
      }

      if (!isEntityState(parsed)) {
        handle(new Error('stored value is not an EntityState'), 'get', key);
        return undefined;
      }

      // Frozen, like every other store: a caller must not be able to change trust
      // state without going through `set`. Enforced by the conformance kit, which
      // caught the reference implementation failing this.
      return Object.freeze({ ...parsed, window: Object.freeze([...parsed.window]) });
    },

    set: async (entity, state) => {
      const key = keyFor(entity);
      try {
        // JSON preserves IEEE-754 doubles exactly, which the conformance kit's
        // precision check depends on — a fixed-precision column would quietly
        // change every trust value it held.
        await transport.set(key, JSON.stringify(state), ttlSeconds);
      } catch (error) {
        handle(error, 'set', key);
      }
    },

    delete: async (entity) => {
      const key = keyFor(entity);
      try {
        await transport.del(key);
      } catch (error) {
        handle(error, 'del', key);
      }
    },
  };
}

/** Shape check, so a foreign value in a shared namespace cannot be read as trust state. */
function isEntityState(value: unknown): value is EntityState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<EntityState>;
  return (
    typeof candidate.a === 'number' &&
    typeof candidate.b === 'number' &&
    typeof candidate.lastSeen === 'number' &&
    typeof candidate.lastMeaningfulUpdate === 'number' &&
    Array.isArray(candidate.window)
  );
}

export type UpstashTransportOptions = {
  /** REST endpoint, e.g. `https://eu1-xxx.upstash.io`. Vercel KV exposes the same shape. */
  readonly url: string;
  readonly token: string;
  /** Abort a request that hangs. A store that never answers is worse than one that fails. */
  readonly timeoutMs?: number;
  /** Injectable for tests. Defaults to the global `fetch`. */
  readonly fetch?: typeof globalThis.fetch;
};

/**
 * A `KvTransport` for Upstash Redis and Vercel KV.
 *
 * Commands go in a JSON body rather than in the URL path, which is the one detail
 * that matters for correctness here: `POST /get/<key>` breaks on an entity
 * reference containing a slash or a space, and D1 permits both. The body form has
 * no such constraint, so the key stays opaque.
 */
export function upstashTransport(options: UpstashTransportOptions): KvTransport {
  const doFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 2000;
  const base = options.url.replace(/\/+$/, '');

  if (typeof doFetch !== 'function') {
    throw new Error('no fetch available: pass one in options.fetch');
  }

  async function command(args: readonly (string | number)[]): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(base, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(args),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`kv transport: HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { result?: unknown; error?: string };
      if (payload.error) throw new Error(`kv transport: ${payload.error}`);
      return payload.result;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: async (key) => {
      const result = await command(['GET', key]);
      return typeof result === 'string' ? result : undefined;
    },
    set: async (key, value, ttlSeconds) => {
      const args: (string | number)[] = ['SET', key, value];
      if (ttlSeconds !== undefined) args.push('EX', ttlSeconds);
      await command(args);
    },
    del: async (key) => {
      await command(['DEL', key]);
    },
  };
}

/**
 * An in-process `KvTransport`, for running the conformance kit and for tests.
 *
 * Not a store: it is the *transport* the store sits on, so exercising `kvStore`
 * against it proves the encoding, key handling and freezing without needing a
 * network. What it cannot prove is anything about the network itself, which is
 * stated rather than implied.
 */
export function memoryTransport(): KvTransport & { size(): number } {
  const values = new Map<string, string>();
  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value);
    },
    del: async (key) => {
      values.delete(key);
    },
    size: () => values.size,
  };
}
