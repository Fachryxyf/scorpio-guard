import test from 'node:test';
import assert from 'node:assert/strict';

import { memoryStore } from './store.ts';
import { applyEvidence, freshState } from './trust.ts';

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
