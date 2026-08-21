/**
 * A durable `StateStore` on `node:sqlite`. D8, closing the D44 debt.
 *
 * The in-memory default is process-local: it resets on restart and is invisible to
 * other instances, so a cold start silently discards accumulated trust. D20 claims
 * a serverless guard is fully functional, and that claim was only true of the
 * decision path — not of its memory. This store makes it true of both.
 *
 * Chosen over Redis or a SQL server because `node:sqlite` is in the standard
 * library: the zero-dependency promise survives, and an adopter needs no
 * infrastructure to get durability. Separate entry point (`./sqlite`) rather than
 * part of the core, because D12 keeps `src/core/` free of platform APIs — the same
 * model still runs in a browser.
 *
 * Not a replacement for Redis in a multi-host deployment: SQLite is one file on
 * one filesystem. It covers restart durability and multi-process sharing on a
 * single host, which is what a serverless-style or PM2-style deployment actually
 * hits first.
 */
import { DatabaseSync } from 'node:sqlite';

import { DEFAULT_RETENTION_HOURS } from '../core/policy.ts';
import type { StateStore } from '../core/store.ts';
import { isExpired, type EntityState } from '../core/trust.ts';

export type SqliteStoreOptions = {
  /** File path, or `':memory:'` for a durable-shaped store with no file. */
  readonly path?: string;
  readonly retentionHours?: number;
  /** Table name, in case the host already owns the database. */
  readonly table?: string;
};

export type SqliteStore = StateStore & {
  /** Delete expired rows now. Returns how many were removed. */
  sweep(now: number): number;
  /** Retained entities, expired rows included until swept. */
  size(): number;
  close(): void;
};

/**
 * Open (or create) a SQLite-backed store.
 *
 * The state is stored as one JSON column rather than as typed columns. The window
 * (D36) is a variable-length array and the trust fields are floats whose exact
 * values matter (the conformance kit checks precision) — normalising that into
 * rows would buy queryability that D1 says nothing needs, since the entity key is
 * opaque and there is nothing to query by.
 */
export function sqliteStore(options: SqliteStoreOptions = {}): SqliteStore {
  const retentionHours = options.retentionHours ?? DEFAULT_RETENTION_HOURS;
  const table = options.table ?? 'sg_trust_state';
  assertPlainIdentifier(table);

  const db = new DatabaseSync(options.path ?? ':memory:');
  // WAL so a second process reading does not block the one writing. Harmless for
  // `:memory:`, where SQLite ignores it.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS ${table} (
    entity TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    last_meaningful_update INTEGER NOT NULL
  )`);

  const selectOne = db.prepare(`SELECT state FROM ${table} WHERE entity = ?`);
  const upsert = db.prepare(
    `INSERT INTO ${table} (entity, state, last_meaningful_update) VALUES (?, ?, ?)
     ON CONFLICT(entity) DO UPDATE SET
       state = excluded.state,
       last_meaningful_update = excluded.last_meaningful_update`,
  );
  const deleteOne = db.prepare(`DELETE FROM ${table} WHERE entity = ?`);
  const countAll = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`);
  const selectStale = db.prepare(
    `SELECT entity, state FROM ${table} WHERE last_meaningful_update <= ?`,
  );

  return {
    get: async (entity) => {
      const row = selectOne.get(entity) as { state: string } | undefined;
      if (!row) return undefined;
      // Frozen, like the memory store: a caller must not be able to mutate stored
      // state without going through `set`. Enforced by the conformance kit.
      return Object.freeze(JSON.parse(row.state) as EntityState);
    },

    set: async (entity, state) => {
      upsert.run(entity, JSON.stringify(state), state.lastMeaningfulUpdate);
    },

    delete: async (entity) => {
      deleteOne.run(entity);
    },

    sweep: (now) => {
      // Filter in JS rather than in SQL: `isExpired` is the single definition of
      // the retention boundary (D6), and duplicating it as a WHERE clause is how
      // two stores start disagreeing about when state dies. The timestamp bound
      // keeps the candidate set small.
      const horizonMs = retentionHours * 3_600_000;
      const candidates = selectStale.all(now - horizonMs) as Array<{
        entity: string;
        state: string;
      }>;

      let removed = 0;
      for (const row of candidates) {
        if (!isExpired(JSON.parse(row.state) as EntityState, now, retentionHours)) continue;
        deleteOne.run(row.entity);
        removed += 1;
      }
      return removed;
    },

    size: () => Number((countAll.get() as { n: number }).n),

    close: () => db.close(),
  };
}

/**
 * A table name reaches SQL by interpolation — `node:sqlite` parameters bind
 * values, not identifiers — so it is validated rather than trusted. Everything
 * else in this file is a bound parameter.
 */
function assertPlainIdentifier(name: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`unsafe table name: ${name}`);
  }
}
