/**
 * What the guard cannot protect, because the root of trust is the entity key.
 *
 * D1.1 says the root of trust sits outside the library; D72 turns that into rules a
 * host can follow and into numbers a host can price. Everything below is a property
 * of the shipped code, not a hypothetical: the key is the only thing that decides
 * whose history is whose, so a host that lets the client pick the key hands the
 * client the history too.
 *
 * The guide this backs is docs/ROOT-OF-TRUST.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import type { Clock } from './clock.ts';
import { severity } from './decision.ts';
import { createGuard } from './guard.ts';
import { memoryStore } from './store.ts';
import type { Invariant } from './constraints.ts';

const HOUR = 3_600_000;

function fakeClock(start = 0): Clock & { advance(hours: number): void } {
  let current = start;
  return {
    now: () => current,
    advance: (hours) => {
      current += hours * HOUR;
    },
  };
}

const distrust = { evidence: { negative: 'strong' } } as const;
const trust = { evidence: { positive: 'strong' } } as const;

test('D72: one key change discards six observations of distrust', async () => {
  const store = memoryStore();
  const guard = createGuard({ store });

  let assessed = await guard.evaluate({ entity: 'client-a', observation: distrust });
  for (let i = 0; i < 5; i += 1) {
    assessed = await guard.evaluate({ entity: 'client-a', observation: distrust });
  }
  assert.equal(assessed.decision, 'INCREASE_FRICTION', 'six observations of distrust are enough');

  const rotated = await guard.evaluate({ entity: 'client-a-2' });
  assert.equal(rotated.decision, 'ALLOW', 'the history of client-a does not follow the traffic');
  assert.equal(rotated.trust.mean, 0.5, 'a rotated key starts at the prior, not at the distrust it earned');

  assert.equal(store.size(), 2, 'two keys, two states: the library has no other way to link them');
});

test('D72: atonement costs more than rotation', async () => {
  const guard = createGuard();

  for (let i = 0; i < 6; i += 1) {
    await guard.evaluate({ entity: 'client-a', observation: distrust });
  }

  let needed = 0;
  let assessed = await guard.evaluate({ entity: 'client-a' });
  while (assessed.decision !== 'ALLOW' && needed < 60) {
    needed += 1;
    assessed = await guard.evaluate({ entity: 'client-a', observation: trust });
  }

  assert.equal(needed, 26, 'measured: 26 observations of good behavior, against one changed string');
  assert.equal(Number(assessed.trust.mean.toFixed(3)), 0.803);
});

test('D72: a shared key hands one visitor history to every visitor', async () => {
  const guard = createGuard();

  for (let i = 0; i < 6; i += 1) {
    await guard.evaluate({ entity: 'shared', observation: distrust });
  }

  const guest = await guard.evaluate({ entity: 'shared' });
  assert.equal(guest.decision, 'INCREASE_FRICTION', 'a legitimate visitor behind a shared key inherits the distrust');

  const own = await guard.evaluate({ entity: 'own-key' });
  assert.equal(own.decision, 'ALLOW', 'the same visitor with its own key is untouched');
});

test('D72: a client that picks its own key never crosses into friction', async () => {
  const store = memoryStore();
  const guard = createGuard({ store });

  const decisions: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const assessed = await guard.evaluate({ entity: 'key-' + i, observation: distrust });
    decisions.push(assessed.decision);
  }

  assert.deepEqual(new Set(decisions), new Set(['OBSERVE']), 'ten keys with one violation each stay at OBSERVE');
  assert.equal(store.size(), 10, 'and they cost ten states, so rotation is not free for the host either');
  assert.ok(severity('OBSERVE') < severity('INCREASE_FRICTION'));
});

test('D72: waiting is a rotation strategy, so retention is part of the key policy', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock, policy: { retentionHours: 1 } });

  for (let i = 0; i < 6; i += 1) {
    await guard.evaluate({ entity: 'client-a', observation: distrust });
  }
  assert.equal((await guard.evaluate({ entity: 'client-a' })).decision, 'INCREASE_FRICTION');

  clock.advance(2);
  const after = await guard.evaluate({ entity: 'client-a' });

  assert.equal(after.decision, 'ALLOW', 'past retention the entity is new again');
  assert.ok(after.trace.some((line) => line.includes('cold start')), 'the trace says why');
});

test('D72: proof is not rotation-proof, and that is the one thing rotation cannot erase', async () => {
  const never: Invariant = {
    id: 'root-of-trust.unissued',
    class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
    strength: 'hard',
    scope: 'login',
    holds: () => false,
  };
  const guard = createGuard({ invariants: [never] });

  const first = await guard.evaluate({ entity: 'client-a', observation: { scope: 'login', data: {} } });
  const rotated = await guard.evaluate({ entity: 'client-b', observation: { scope: 'login', data: {} } });

  assert.equal(first.decision, 'RESTRICT', 'a hard violation needs no history');
  assert.equal(rotated.decision, 'RESTRICT', 'and no key change helps, because the proof is in the request');
});
