import type { EntityState } from './trust.ts';

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

/**
 * In-memory store. The default, and a real implementation rather than a stub.
 *
 * ponytail: process-local and unbounded, which is correct for a single process
 * and wrong for anything else. Retention (D6) bounds it in practice only for
 * entities that are read again; state that is never touched again is never
 * visited, so it is never dropped.
 * Upgrade path: a persistent store, plus a periodic sweep for storage reclaim.
 * Sweeping is not needed for correctness — expiry is enforced on read.
 */
export function memoryStore(): StateStore & { size(): number } {
  const states = new Map<string, EntityState>();

  return {
    get: async (entity) => states.get(entity),
    set: async (entity, state) => {
      states.set(entity, state);
    },
    delete: async (entity) => {
      states.delete(entity);
    },
    size: () => states.size,
  };
}
