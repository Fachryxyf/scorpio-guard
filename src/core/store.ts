import { DEFAULT_RETENTION_HOURS } from './policy.ts';
import { isExpired, type EntityState } from './trust.ts';

/**
 * Trust state persistence. D8.
 *
 * Deliberately three operations over an opaque key. D1 makes the entity
 * reference opaque to SG, so there is nothing to query by — which keeps this
 * implementable on top of a Map, Redis, or a single SQL table without any of
 * them needing to understand the model.
 *
 * Async throughout (D10), because the caller may be talking to a network store
 * and the read path is where lazy decay (D3) and lazy expiry (D6) happen anyway.
 */
export type StateStore = {
  /** Stored state, or `undefined` if this entity has none. */
  get(entity: string): Promise<EntityState | undefined>;

  set(entity: string, state: EntityState): Promise<void>;

  /**
   * Remove state for one entity. Used both by retention expiry (D6) and by the
   * host-facing purge primitive (D22) — the same operation, different trigger.
   */
  delete(entity: string): Promise<void>;
};

export type MemoryStoreOptions = {
  /**
   * Drop expired entries once this many writes have happened. Amortised, so no
   * timer is held and nothing keeps the process alive.
   *
   * Sweeping is about reclaiming memory, never about correctness: expiry is
   * enforced on read (D6), so a swept and an unswept store answer identically.
   */
  readonly sweepEvery?: number;
  readonly retentionHours?: number;

  /**
   * Hard cap on retained entities. When exceeded after a sweep, the entities
   * furthest past their last meaningful update are dropped first.
   *
   * Present because an unbounded map is a denial-of-service surface: an attacker
   * who can mint fresh references can grow it without limit, and D1 guarantees SG
   * cannot tell minted references from legitimate new ones. Dropping state is
   * safe in a way that running out of memory is not — a dropped entity returns as
   * `unknown`, which D40 already treats as a well-defined state.
   */
  readonly maxEntities?: number;
};

export type MemoryStore = StateStore & {
  size(): number;
  /** Drop expired entries now. Returns how many were removed. */
  sweep(now: number): number;
};

export const DEFAULT_SWEEP_EVERY = 512;

/**
 * In-memory store. The default, and a real implementation rather than a stub.
 *
 * ponytail: process-local, so it resets on restart and is not shared across
 * instances. Correct for one process; wrong for serverless or multi-instance
 * deployments, where a cold start silently discards all accumulated trust.
 * Upgrade path: a Redis or SQL store behind the same three-method interface.
 */
export function memoryStore(options: MemoryStoreOptions = {}): MemoryStore {
  const states = new Map<string, EntityState>();
  const sweepEvery = options.sweepEvery ?? DEFAULT_SWEEP_EVERY;
  const retentionHours = options.retentionHours ?? DEFAULT_RETENTION_HOURS;
  const maxEntities = options.maxEntities;
  let writesSinceSweep = 0;

  function sweep(now: number): number {
    let removed = 0;
    for (const [entity, state] of states) {
      if (isExpired(state, now, retentionHours)) {
        states.delete(entity);
        removed += 1;
      }
    }

    if (maxEntities !== undefined && states.size > maxEntities) {
      // Oldest meaningful update first: the least evidence to lose.
      const staleFirst = [...states.entries()].sort(
        (a, b) => a[1].lastMeaningfulUpdate - b[1].lastMeaningfulUpdate,
      );
      for (const [entity] of staleFirst.slice(0, states.size - maxEntities)) {
        states.delete(entity);
        removed += 1;
      }
    }

    return removed;
  }

  return {
    get: async (entity) => states.get(entity),

    set: async (entity, state) => {
      states.set(entity, state);
      writesSinceSweep += 1;
      if (writesSinceSweep >= sweepEvery) {
        writesSinceSweep = 0;
        // `lastSeen` on the state just written is the freshest clock reading
        // available here; the store deliberately holds no Clock of its own.
        sweep(state.lastSeen);
      }
    },

    delete: async (entity) => {
      states.delete(entity);
    },

    size: () => states.size,
    sweep,
  };
}
