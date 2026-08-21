import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkStoreConformance } from '../core/conformance.ts';
import { createGuard } from '../core/guard.ts';
import { applyEvidence, freshState } from '../core/trust.ts';
import { sqliteStore } from './sqlite.ts';

const HOUR = 3_600_000;

test('D8: the SQLite store passes the published conformance kit', async () => {
  const opened: Array<{ close(): void }> = [];
  const results = await checkStoreConformance(() => {
    const store = sqliteStore();
    opened.push(store);
    return store;
  });

  const failed = results.filter((result) => !result.passed);
  assert.deepEqual(
    failed.map((result) => `${result.name}: ${result.detail}`),
    [],
  );
  assert.ok(results.length >= 11, 'the kit should have run every check');

  for (const store of opened) store.close();
});

test('D44: trust survives a restart, which the memory store cannot do', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sg-sqlite-'));
  const path = join(dir, 'trust.db');

  try {
    const first = sqliteStore({ path });
    const clock = { now: () => 1_000_000 };
    const guard = createGuard({ store: first, clock });

    for (let i = 0; i < 4; i += 1) {
      await guard.evaluate({
        entity: 'returning',
        observation: { scope: `s${i}`, evidence: { positive: 'strong' } },
      });
    }
    const before = await guard.evaluate({ entity: 'returning' });
    first.close();

    // A new process would do exactly this: open the same file, know nothing else.
    const second = sqliteStore({ path });
    const resumed = createGuard({ store: second, clock });
    const after = await resumed.evaluate({ entity: 'returning' });

    assert.equal(after.coldStart, false, 'state should have survived the reopen');
    assert.equal(after.trust.mean, before.trust.mean);
    assert.equal(after.trust.stage, before.trust.stage);
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('D6: sweeping deletes exactly what the retention boundary already hides', async () => {
  const store = sqliteStore({ retentionHours: 24 });
  const start = 0;

  // One entity with real evidence, one that only ever looked around.
  await store.set('meaningful', applyEvidence(freshState(start), { positive: 2 }, start));
  await store.set('idle', freshState(start));
  assert.equal(store.size(), 2);

  // The store is not the enforcer: `get` returns what was written, and the guard
  // applies the boundary on load (D6). Sweeping is about reclaiming the row.
  const later = start + 25 * HOUR;
  assert.notEqual(await store.get('meaningful'), undefined);

  assert.equal(store.sweep(later), 2);
  assert.equal(store.size(), 0);
  assert.equal(await store.get('meaningful'), undefined, 'a swept row is gone');

  // And a guard reading a swept entity sees a cold start rather than an error.
  const guard = createGuard({ store, clock: { now: () => later } });
  const result = await guard.evaluate({ entity: 'meaningful' });
  assert.equal(result.coldStart, true);
  store.close();
});

test('a table name is validated rather than interpolated blindly', () => {
  assert.throws(() => sqliteStore({ table: 'sg_state; DROP TABLE sg_state' }), /unsafe table name/);
  const fine = sqliteStore({ table: 'custom_state' });
  fine.close();
});
