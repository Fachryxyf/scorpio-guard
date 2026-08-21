/**
 * Conformance kit for `StateStore` implementations. D8.
 *
 * The in-memory store is the reference, but anyone writing a Redis, SQL, or KV
 * store has to reproduce behavior that is easy to get subtly wrong — and a store
 * that is subtly wrong produces a guard that is subtly wrong, silently, in
 * production.
 *
 * Shipping the contract as runnable assertions rather than prose means an
 * implementer can prove their store is usable instead of hoping. Framework-free
 * on purpose: it reports failures and lets the caller decide how to surface them,
 * so it works under `node:test`, a browser, or a bare script.
 */
import type { StateStore } from './store.ts';
import { applyEvidence, freshState, type EntityState } from './trust.ts';

export type ConformanceResult = {
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
};

/**
 * Run every contract check against a store.
 *
 * `factory` must return an **empty** store each call: several checks would
 * otherwise interfere with each other, and a store that cannot be created empty
 * cannot be tested.
 */
export async function checkStoreConformance(
  factory: () => StateStore | Promise<StateStore>,
): Promise<readonly ConformanceResult[]> {
  const results: ConformanceResult[] = [];

  async function check(name: string, body: (store: StateStore) => Promise<void>): Promise<void> {
    try {
      const store = await factory();
      await body(store);
      results.push({ name, passed: true });
    } catch (error) {
      results.push({
        name,
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await check('absent state reads as undefined', async (store) => {
    const found = await store.get('never-written');
    // Returning a fresh state here would hide expiry and cold start from the
    // guard, which decides between prior and retained state on exactly this.
    assert(found === undefined, `expected undefined for an unknown entity, got ${typeof found}`);
  });

  await check('state round-trips with every field intact', async (store) => {
    const state = applyEvidence(freshState(1000), { positive: 2, negative: 0.5 }, 5000);
    await store.set('e1', state);
    const found = await store.get('e1');

    assert(found !== undefined, 'state written then read must be present');
    assertState(found, state);
  });

  await check('numeric precision survives the round trip', async (store) => {
    // Decayed mass is rarely a round number. A store that serialises through a
    // fixed-precision column will quietly change every trust value it holds.
    const state: EntityState = {
      a: 0.1234567890123,
      b: 7.006492321624085e-3,
      lastSeen: 1_700_000_000_123,
      lastMeaningfulUpdate: 1_700_000_000_123,
      window: [],
    };
    await store.set('precise', state);
    const found = await store.get('precise');

    assert(found !== undefined, 'state must be present');
    assert(found.a === state.a, `a changed: ${found.a} !== ${state.a}`);
    assert(found.b === state.b, `b changed: ${found.b} !== ${state.b}`);
    assert(
      found.lastSeen === state.lastSeen,
      `lastSeen changed: ${found.lastSeen} !== ${state.lastSeen} — millisecond precision is required`,
    );
  });

  await check('the observation window survives, in order', async (store) => {
    const state: EntityState = {
      ...freshState(0),
      window: [
        { at: 1000, scope: 'home' },
        { at: 2000, scope: 'search' },
        { at: 3000, scope: 'home' },
      ],
    };
    await store.set('windowed', state);
    const found = await store.get('windowed');

    assert(found !== undefined, 'state must be present');
    assert(found.window.length === 3, `expected 3 observations, got ${found.window.length}`);
    // Order carries the timing features: inter-arrival variation is meaningless
    // if a store returns the window unordered.
    assert(
      found.window.every((entry, i) => entry.at === state.window[i]!.at),
      'window order must be preserved',
    );
  });

  await check('writing twice overwrites rather than appending', async (store) => {
    await store.set('e1', applyEvidence(freshState(0), { positive: 1 }, 0));
    const second = applyEvidence(freshState(0), { negative: 3 }, 100);
    await store.set('e1', second);

    const found = await store.get('e1');
    assert(found !== undefined, 'state must be present');
    assertState(found, second);
  });

  await check('delete removes state', async (store) => {
    await store.set('e1', freshState(0));
    await store.delete('e1');
    assert((await store.get('e1')) === undefined, 'deleted state must read as absent');
  });

  await check('deleting absent state is not an error', async (store) => {
    // Expiry (D6) and purge (D22) both call delete without checking first.
    await store.delete('never-existed');
    await store.delete('never-existed');
  });

  await check('entity keys are opaque and do not collide', async (store) => {
    // D1 makes the reference opaque, so a store must not normalise, trim, or
    // interpret it. Keys that differ must stay distinct.
    const keys = ['a', 'A', 'a ', ' a', 'a/b', 'a:b', 'a.b', '{"a":1}', 'x'.repeat(1024)];

    for (const [index, key] of keys.entries()) {
      await store.set(key, applyEvidence(freshState(0), { positive: index + 1 }, 0));
    }
    for (const [index, key] of keys.entries()) {
      const found = await store.get(key);
      assert(found !== undefined, `key ${JSON.stringify(key)} did not round-trip`);
      assert(
        found.a === index + 1,
        `key ${JSON.stringify(key)} collided: expected a=${index + 1}, got ${found.a}`,
      );
    }
  });

  await check('entities are isolated from one another', async (store) => {
    await store.set('e1', applyEvidence(freshState(0), { positive: 5 }, 0));
    await store.set('e2', applyEvidence(freshState(0), { negative: 5 }, 0));
    await store.delete('e1');

    const survivor = await store.get('e2');
    assert(survivor !== undefined, 'deleting one entity must not affect another');
    assert(survivor.b === 5, `e2 was altered: b=${survivor.b}`);
  });

  await check('concurrent writes to distinct entities all land', async (store) => {
    // The guard evaluates entities independently and may well do so in parallel.
    const keys = ['c1', 'c2', 'c3', 'c4', 'c5'];
    await Promise.all(
      keys.map((key, i) => store.set(key, applyEvidence(freshState(0), { positive: i + 1 }, 0))),
    );

    for (const [i, key] of keys.entries()) {
      const found = await store.get(key);
      assert(found !== undefined, `${key} was lost under concurrent writes`);
      assert(found.a === i + 1, `${key} holds the wrong state`);
    }
  });

  await check('a returned state cannot be mutated through the store', async (store) => {
    // A store handing back a live internal object lets a caller corrupt trust
    // state without going through `set`, which would make every write path a lie.
    //
    // Two ways to satisfy this, both acceptable: return a copy, or freeze what you
    // return. A frozen object throws on assignment under strict mode, which is a
    // stronger guarantee than silently ignoring the write, so it counts as a pass.
    const original = applyEvidence(freshState(0), { positive: 4 }, 0);
    await store.set('e1', original);

    const first = await store.get('e1');
    assert(first !== undefined, 'state must be present');

    try {
      (first as { a: number }).a = 999;
    } catch {
      return; // frozen, and refused the write outright
    }

    const second = await store.get('e1');
    assert(second !== undefined, 'state must still be present');
    assert(
      second.a === 4,
      `mutating a returned state changed stored state: a=${second.a}. Return a copy, or freeze it.`,
    );
  });

  return results;
}

/** Convenience: throws with a readable summary if anything failed. */
export function assertConformant(results: readonly ConformanceResult[]): void {
  const failed = results.filter((result) => !result.passed);
  if (failed.length === 0) return;

  const lines = failed.map((result) => `  - ${result.name}: ${result.detail ?? 'failed'}`);
  throw new Error(`${failed.length} of ${results.length} store checks failed:\n${lines.join('\n')}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertState(found: EntityState, expected: EntityState): void {
  for (const key of ['a', 'b', 'lastSeen', 'lastMeaningfulUpdate'] as const) {
    assert(
      found[key] === expected[key],
      `${key} did not round-trip: ${found[key]} !== ${expected[key]}`,
    );
  }
  assert(Array.isArray(found.window), 'window must be an array');
}
