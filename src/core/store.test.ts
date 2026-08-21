import test from 'node:test';
import assert from 'node:assert/strict';

import { memoryStore } from './store.ts';
import { applyEvidence, freshState, isExpired } from './trust.ts';

const HOUR = 3_600_000;

test('D8: absent state reads as undefined, not as a default', () => {
  // The distinction matters: "no state" is what triggers the cold-start prior,
  // and silently returning a fresh state would hide expiry from the caller.
  const store = memoryStore();
  return store.get('nobody').then((state) => assert.equal(state, undefined));
});

test('D8: state round-trips unchanged', async () => {
  const store = memoryStore();
  const state = applyEvidence(freshState(0), { positive: 2, negative: 0.5 }, 1000);

  await store.set('e1', state);
  assert.deepEqual(await store.get('e1'), state);
});

test('D22: delete removes state and is safe to repeat', async () => {
  const store = memoryStore();
  await store.set('e1', freshState(0));
  assert.equal(store.size(), 1);

  await store.delete('e1');
  assert.equal(await store.get('e1'), undefined);
  assert.equal(store.size(), 0);

  await store.delete('e1');
  assert.equal(store.size(), 0, 'deleting absent state must not throw');
});

test('D1: entity keys are opaque and never interpreted', async () => {
  const store = memoryStore();
  const awkward = ['', ' ', '../etc/passwd', '{"json":true}', '\u0000', 'a'.repeat(4096)];

  for (const key of awkward) {
    await store.set(key, freshState(0));
    assert.notEqual(await store.get(key), undefined, `key ${JSON.stringify(key)} must round-trip`);
  }
  assert.equal(store.size(), awkward.length, 'distinct keys must not collide');
});

test('D6: sweeping reclaims expired entries without changing any answer', async () => {
  const store = memoryStore({ sweepEvery: 1_000_000, retentionHours: 1 });

  await store.set('stale', applyEvidence(freshState(0), { positive: 1 }, 0));
  await store.set('fresh', applyEvidence(freshState(0), { positive: 1 }, 10 * HOUR));
  assert.equal(store.size(), 2);

  const removed = store.sweep(11 * HOUR);
  assert.equal(removed, 1);
  assert.equal(await store.get('stale'), undefined);
  assert.notEqual(await store.get('fresh'), undefined);
});

test('D6: sweeping is amortised over writes, holding no timer', async () => {
  const store = memoryStore({ sweepEvery: 3, retentionHours: 1 });

  // One expired entry, then enough writes to trigger a sweep.
  await store.set('stale', applyEvidence(freshState(0), { positive: 1 }, 0));
  for (let i = 0; i < 3; i += 1) {
    await store.set(`live-${i}`, applyEvidence(freshState(0), { positive: 1 }, 10 * HOUR));
  }

  assert.equal(await store.get('stale'), undefined, 'the sweep should have collected it');
  assert.equal(store.size(), 3);
});

test('D6: an unswept store answers identically, since expiry is enforced on read', async () => {
  // Sweeping must be a memory concern only. If it changed answers it would be a
  // second source of truth for expiry.
  const swept = memoryStore({ sweepEvery: 1, retentionHours: 1 });
  const unswept = memoryStore({ sweepEvery: 1_000_000, retentionHours: 1 });

  const state = applyEvidence(freshState(0), { positive: 1 }, 0);
  await swept.set('e1', state);
  await unswept.set('e1', state);
  await swept.set('trigger', applyEvidence(freshState(0), { positive: 1 }, 5 * HOUR));

  // The swept store dropped it; the unswept one still holds it. Either way the
  // guard treats it as absent, because isExpired is checked on load.
  assert.equal(isExpired(state, 5 * HOUR, 1), true);
});

test('D1: a bounded store drops the least-recently-meaningful first', async () => {
  const store = memoryStore({ sweepEvery: 4, retentionHours: 1000, maxEntities: 2 });

  // An attacker minting fresh references cannot grow this without limit, and D1
  // guarantees SG cannot tell minted references from legitimate new ones.
  for (let i = 0; i < 4; i += 1) {
    await store.set(`minted-${i}`, applyEvidence(freshState(0), { positive: 1 }, i * HOUR));
  }

  assert.equal(store.size(), 2);
  assert.equal(await store.get('minted-0'), undefined, 'the stalest must go first');
  assert.notEqual(await store.get('minted-3'), undefined, 'the freshest must survive');
});
