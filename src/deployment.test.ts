/**
 * Two rows of the deployment matrix, exercised. M1.4, and the state half of D20:
 * a serverless guard is only fully functional if its trust survives the process.
 *
 * The point is not that the stores work, which the conformance kit already proves. The
 * point is that a *second process* sees what the first one learned, because that is the
 * sentence the deployment guide asks a reader to trust.
 */
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { createGuard } from './core/guard.ts';
import { kvStore, memoryTransport } from './store/kv.ts';
import { sqliteStore } from './store/sqlite.ts';

test('deployment: two processes on one host share trust through one file', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sg-deployment-'));
  const path = join(directory, 'trust.db');
  const first = sqliteStore({ path });
  const second = sqliteStore({ path });

  try {
    const writer = createGuard({ store: first });
    const reader = createGuard({ store: second });

    const cold = await writer.evaluate({
      entity: 'shared-entity',
      observation: { evidence: { negative: 'strong' } },
    });
    assert.equal(cold.coldStart, true, 'the first process starts cold, by definition');

    const warm = await reader.evaluate({ entity: 'shared-entity' });
    assert.equal(warm.coldStart, false, 'the second handle is not a cold start');
    assert.ok(warm.trust.mass > 2, 'the evidence written by the first process is visible');
  } finally {
    first.close();
    second.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('deployment: a new process over serverless KV does not start cold', async () => {
  const transport = memoryTransport();
  const onError = (): void => {};

  // Two guards, two store instances: what a second function invocation looks like.
  const before = createGuard({ store: kvStore({ transport, onError }) });
  const after = createGuard({ store: kvStore({ transport, onError }) });

  await before.evaluate({ entity: 'shared-entity', observation: { evidence: { negative: 'strong' } } });
  const seen = await after.evaluate({ entity: 'shared-entity' });

  assert.equal(seen.coldStart, false, 'the remote state outlived the process that wrote it');
  assert.ok(seen.trust.mass > 2, 'and it carries the evidence, not just a row');
});

test('deployment: an unreachable KV degrades the statistical dimension only', async () => {
  const reported: string[] = [];
  const unreachable = {
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

  const guard = createGuard({
    store: kvStore({ transport: unreachable, onError: (_error, operation) => reported.push(operation) }),
    invariants: [
      {
        id: 'token-unissued',
        class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
        strength: 'hard',
        scope: 'login',
        holds: (observation) => (observation as { issued?: boolean }).issued !== false,
      },
    ],
  });

  const degraded = await guard.evaluate({ entity: 'anything', observation: { scope: 'page' } });
  assert.equal(degraded.decision, 'ALLOW', 'no history means no accusation');
  assert.ok(reported.length >= 2, 'the outage is reported, not swallowed');

  const proven = await guard.evaluate({
    entity: 'anything',
    observation: { scope: 'login', data: { issued: false } },
  });
  assert.equal(proven.decision, 'RESTRICT', 'proof does not need the store at all');
});
