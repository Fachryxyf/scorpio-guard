/**
 * Erasure and retention, proved against every store that ships. D1.2, D6, D22, H15.
 *
 * "Deletion is a requirement" is easy to write and easy to get subtly wrong: a store
 * that hides an expired row instead of removing it answers every read correctly and
 * still holds the data, and a guard that rewrites state without clearing the old one
 * leaves the previous mass behind. So the checks here are not about what `get` returns
 * only. They count what is left underneath, per store, after a forget and after the
 * retention horizon.
 *
 * What no test in this repository can prove is the part outside it: a host that keeps
 * its own request log, or an observer that writes its own records. Those are named in
 * `docs/ROADMAP.md` under H15 rather than pretended here.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createGuard } from './guard.ts';
import { memoryStore, type StateStore } from './store.ts';
import { applyEvidence, freshState } from './trust.ts';
import { kvStore, memoryTransport } from '../store/kv.ts';
import { sqliteStore } from '../store/sqlite.ts';

const HOUR = 3_600_000;

type Candidate = {
  readonly name: string;
  readonly store: StateStore;
  /** What is actually left underneath: rows in SQLite, keys in the KV, entries in the map. */
  readonly count: () => number;
  readonly close: () => void;
};

/**
 * Every store that ships, each one counted through its own storage rather than through
 * the store interface: a store could satisfy `get` while keeping the row.
 */
function candidates(): Candidate[] {
  const memory = memoryStore();
  const sqlite = sqliteStore();
  const transport = memoryTransport();
  const kv = kvStore({
    transport,
    onError: function () {
      // The state machine is what is under test here; D62's witness is tested elsewhere.
    },
  });

  return [
    {
      name: 'memory',
      store: memory,
      count: function () {
        return memory.size();
      },
      close: function () {
        return undefined;
      },
    },
    {
      name: 'sqlite',
      store: sqlite,
      count: function () {
        return sqlite.size();
      },
      close: function () {
        sqlite.close();
      },
    },
    {
      name: 'kv',
      store: kv,
      count: function () {
        return transport.size();
      },
      close: function () {
        return undefined;
      },
    },
  ];
}

test('D69: forgetting one entity leaves no residue in any shipped store', async () => {
  for (const candidate of candidates()) {
    try {
      const guard = createGuard({ store: candidate.store });
      const weakPositive = { scope: 'home', evidence: { positive: 'weak' as const } };
      const weakNegative = { scope: 'home', evidence: { negative: 'weak' as const } };

      await guard.evaluate({ entity: 'e1', observation: weakPositive });
      await guard.evaluate({ entity: 'e2', observation: weakNegative });
      assert.equal(candidate.count(), 2, candidate.name + ': both entities should be stored');

      const neighbour = await candidate.store.get('e2');
      assert.ok(neighbour !== undefined);

      await guard.forget('e1');

      assert.equal(
        await candidate.store.get('e1'),
        undefined,
        candidate.name + ': the forgotten entity still reads',
      );
      assert.equal(
        candidate.count(),
        1,
        candidate.name + ': the record survived the forget, so the store hid it instead of deleting it',
      );
      assert.deepEqual(
        await candidate.store.get('e2'),
        neighbour,
        candidate.name + ': forgetting one entity changed another',
      );

      // Back as a stranger: a fresh prior, not the state that was erased. D22, D40.
      const again = await guard.evaluate({ entity: 'e1' });
      assert.equal(again.trust.stage, 'unknown');
      assert.equal(again.coldStart, true);
    } finally {
      candidate.close();
    }
  }
});

test('D69: the retention horizon erases the state, it does not merely hide it', async () => {
  for (const candidate of candidates()) {
    try {
      let now = 1_700_000_000_000;
      const guard = createGuard({
        store: candidate.store,
        clock: {
          now: function () {
            return now;
          },
        },
        policy: { retentionHours: 1 },
      });

      await guard.evaluate({
        entity: 'e1',
        observation: { scope: 'home', evidence: { positive: 'weak' } },
      });
      const before = await candidate.store.get('e1');
      assert.ok(before !== undefined);
      assert.notEqual(before.a, 0, candidate.name + ': the first observation should have moved the mass');

      now += 2 * HOUR;
      const after = await guard.evaluate({ entity: 'e1' });
      assert.equal(after.coldStart, true);

      const stored = await candidate.store.get('e1');
      assert.ok(stored !== undefined, candidate.name + ': the fresh state should have been written');
      assert.equal(stored.a, 0, candidate.name + ': the old positive mass survived the horizon');
      assert.equal(stored.b, 0, candidate.name + ': the old negative mass survived the horizon');
      assert.equal(
        candidate.count(),
        1,
        candidate.name + ': a second record was created instead of replacing the expired one',
      );
    } finally {
      candidate.close();
    }
  }
});

test('D69: a decision event carries no identity by default, so the log holds nothing to erase', async () => {
  const events: Record<string, unknown>[] = [];
  const guard = createGuard({
    store: memoryStore(),
    onAssessment: function (event) {
      events.push(event as unknown as Record<string, unknown>);
    },
  });

  const entity = 'user-42-with-an-address';
  await guard.evaluate({
    entity,
    observation: { scope: 'home', evidence: { positive: 'weak' } },
  });
  await guard.forget(entity);

  assert.equal(events.length, 1, 'one evaluation, one event');
  const event = events[0];
  assert.ok(event !== undefined);
  assert.equal(
    Object.prototype.hasOwnProperty.call(event, 'entity'),
    false,
    'the event carried the entity reference, so forgetting the store would not forget the log',
  );
  assert.equal(
    JSON.stringify(event).includes(entity),
    false,
    'the entity reference reached the event under another name',
  );
});

test('H15: forgetting an entity that never existed is not an error and changes nothing', async () => {
  const store = memoryStore();
  const guard = createGuard({ store });
  await guard.evaluate({
    entity: 'e1',
    observation: { scope: 'home', evidence: { positive: 'weak' } },
  });
  const before = await store.get('e1');

  await guard.forget('never-seen');
  await guard.forget('never-seen');

  assert.deepEqual(await store.get('e1'), before);
  assert.equal(store.size(), 1);
});

test('H15: overwriting state leaves one record, not a history of versions', async () => {
  // A store that appends versions would answer `get` correctly and grow forever, which
  // is a retention hole that no read-side test can see.
  const store = memoryStore();
  let state = freshState(0);
  for (let i = 1; i <= 20; i += 1) {
    state = applyEvidence(state, { positive: 1 }, i * 1000);
    await store.set('e1', state);
  }
  assert.equal(store.size(), 1);

  // Twenty accumulated observations, decayed across the second between each of them.
  const stored = await store.get('e1');
  assert.ok(stored !== undefined);
  assert.ok(Math.abs(stored.a - 20) < 0.01, 'expected the sum of twenty observations, got ' + stored.a);
});
