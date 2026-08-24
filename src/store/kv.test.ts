import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { assertConformant, checkStoreConformance } from '../core/conformance.ts';
import { applyEvidence, freshState, type EntityState } from '../core/trust.ts';
import { kvStore, memoryTransport, upstashTransport, type KvTransport } from './kv.ts';

test('D60: the KV store satisfies the store contract', async () => {
  // The whole point of D8 existing: a networked store proves itself against the
  // same checks as the reference, or it is not usable.
  assertConformant(await checkStoreConformance(() => kvStore({ transport: memoryTransport() })));
});

test('D60: state is namespaced so it cannot collide with the host own data', async () => {
  const transport = memoryTransport();
  const store = kvStore({ transport, keyPrefix: 'trust' });
  await store.set('e1', freshState(0));

  const raw = await transport.get('trust:e1');
  assert.ok(raw, 'state must be stored under the prefixed key');
  assert.equal(await transport.get('e1'), undefined, 'the unprefixed key must not be written');
});

test('D1: an opaque entity reference is not reinterpreted by the store', async () => {
  // Keys that differ must stay distinct even when they contain characters a
  // path-based transport would mangle.
  const transport = memoryTransport();
  const store = kvStore({ transport });
  const keys = ['a', 'A', 'a ', ' a', 'a/b', 'a:b', '{"a":1}'];

  for (const [index, key] of keys.entries()) {
    await store.set(key, applyEvidence(freshState(0), { positive: index + 1 }, 0));
  }
  for (const [index, key] of keys.entries()) {
    const found = await store.get(key);
    assert.ok(found, `${JSON.stringify(key)} did not round-trip`);
    assert.equal(found.a, index + 1, `${JSON.stringify(key)} collided`);
  }
});

test('D60: a transport failure reads as a cold start rather than an exception', async () => {
  // D9: the guard is advisory, so a KV outage must not take the host request path
  // down with it. Fail-open degrades the statistical dimension only.
  const failing: KvTransport = {
    get: async () => {
      throw new Error('unreachable');
    },
    set: async () => {
      throw new Error('unreachable');
    },
    del: async () => {
      throw new Error('unreachable');
    },
  };

  const seen: string[] = [];
  const store = kvStore({
    transport: failing,
    onError: (_error, operation) => seen.push(operation),
  });

  assert.equal(await store.get('e1'), undefined, 'a failed read is a cold start');
  await store.set('e1', freshState(0));
  await store.delete('e1');

  // Silently failing open is indistinguishable from working, which is how a
  // deployment discovers months later that trust never accumulated.
  assert.deepEqual(seen, ['get', 'set', 'del'], 'every failure must be reported');
});

test('D60: failOpen false propagates, for a host that would rather fail the request', async () => {
  const failing: KvTransport = {
    get: async () => {
      throw new Error('unreachable');
    },
    set: async () => {},
    del: async () => {},
  };

  const store = kvStore({ transport: failing, failOpen: false });
  await assert.rejects(() => store.get('e1'), /unreachable/);
});

test('D60: a foreign value in a shared namespace is not read as trust state', async () => {
  const transport = memoryTransport();
  const store = kvStore({ transport });

  await transport.set('sg:e1', 'not json at all');
  assert.equal(await store.get('e1'), undefined, 'unparseable values read as absent');

  await transport.set('sg:e2', JSON.stringify({ hello: 'world' }));
  assert.equal(await store.get('e2'), undefined, 'a wrong-shaped object reads as absent');
});

test('D6: the service TTL is a space bound, never the retention boundary', async () => {
  // Retention has exactly one definition — isExpired. A service-side expiry that
  // fired first would become a second one, disagreeing with every other store.
  const seen: Array<number | undefined> = [];
  const transport: KvTransport = {
    get: async () => undefined,
    set: async (_key, _value, ttlSeconds) => {
      seen.push(ttlSeconds);
    },
    del: async () => {},
  };

  await kvStore({ transport, retentionHours: 168 }).set('e1', freshState(0));
  assert.ok(seen[0] !== undefined, 'a TTL must be set so the service can reclaim space');
  assert.ok(
    seen[0]! > 168 * 3600,
    `TTL ${seen[0]}s must exceed the retention horizon so isExpired decides first`,
  );
});

test('D60: float precision survives the encoding', async () => {
  // Decayed mass is rarely a round number, and a store that changes it quietly
  // changes every trust value it holds.
  const state: EntityState = {
    a: 0.1234567890123,
    b: 7.006492321624085e-3,
    lastSeen: 1_700_000_000_123,
    lastMeaningfulUpdate: 1_700_000_000_123,
    window: [{ at: 1_700_000_000_123, scope: 'a/b c' }],
  };

  const store = kvStore({ transport: memoryTransport() });
  await store.set('precise', state);
  const found = await store.get('precise');

  assert.ok(found);
  assert.equal(found.a, state.a);
  assert.equal(found.b, state.b);
  assert.equal(found.lastSeen, state.lastSeen, 'millisecond precision is required');
  assert.equal(found.window[0]!.scope, 'a/b c');
});

test('D60: the upstash transport sends the key in the body, not the path', async () => {
  // POST /get/<key> breaks on a reference containing a slash or a space, and D1
  // permits both. This is the detail that keeps the key opaque.
  const calls: Array<{ url: string; body: unknown }> = [];
  const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ result: null }), { status: 200 });
  }) as unknown as typeof globalThis.fetch;

  const transport = upstashTransport({
    url: 'https://example.upstash.io/',
    token: 'test-token',
    fetch: fakeFetch,
  });

  await transport.get('sg:a/b c');
  assert.equal(calls[0]!.url, 'https://example.upstash.io', 'trailing slash is normalised away');
  assert.deepEqual(calls[0]!.body, ['GET', 'sg:a/b c'], 'the key travels in the body');
});

test('D60: the upstash transport surfaces an error response rather than storing junk', async () => {
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ error: 'WRONGPASS' }), { status: 200 })) as unknown as typeof globalThis.fetch;

  const transport = upstashTransport({ url: 'https://x.upstash.io', token: 'bad', fetch: fakeFetch });
  await assert.rejects(() => transport.get('k'), /WRONGPASS/);
});

test('D60: a hung transport is abandoned rather than waited on', async () => {
  const fakeFetch = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof globalThis.fetch;

  const transport = upstashTransport({
    url: 'https://x.upstash.io',
    token: 't',
    timeoutMs: 10,
    fetch: fakeFetch,
  });

  await assert.rejects(() => transport.get('k'), /abort/i);
});
