import test from 'node:test';
import assert from 'node:assert/strict';

import type { Clock } from './clock.ts';
import { createGuard } from './guard.ts';
import { DEFAULT_RETENTION_HOURS, DEFAULT_WEIGHTS } from './policy.ts';
import { memoryStore } from './store.ts';
import { transitionGraph } from './transitions.ts';

const HOUR = 3_600_000;

/** A clock the test drives, so decay and retention are deterministic. D11. */
function fakeClock(start = 0): Clock & { advance(hours: number): void } {
  let current = start;
  return {
    now: () => current,
    advance: (hours) => {
      current += hours * HOUR;
    },
  };
}

const checkout = transitionGraph({
  id: 'checkout-order',
  scope: 'checkout',
  strength: 'hard',
  allowed: [
    { from: 'cart', to: 'address' },
    { from: 'address', to: 'payment' },
  ],
});

test('D5/D21: a first-time visitor experiences nothing', async () => {
  const guard = createGuard({ clock: fakeClock() });
  const result = await guard.evaluate({ entity: 'visitor-1' });

  assert.equal(result.coldStart, true);
  assert.equal(result.trust.stage, 'unknown');
  assert.equal(result.decision, 'ALLOW', 'lack of evidence is not evidence of distrust');
  assert.match(result.trace.join(' '), /cold start/);
});

test('D5: an unknown entity can still be treated on independent grounds', async () => {
  // The epistemic ceiling silences the trust dimension; it does not silence a
  // proven violation, which arrives on its own authority.
  const guard = createGuard({ clock: fakeClock(), invariants: [checkout] });

  const result = await guard.evaluate({
    entity: 'visitor-1',
    observation: { scope: 'checkout', data: { from: 'cart', to: 'payment' } },
  });

  assert.equal(result.trust.stage, 'unknown');
  assert.equal(result.trust.decision, 'ALLOW', 'trust alone asks for nothing');
  assert.equal(result.decision, 'RESTRICT', 'the hard violation still decides');
});

test('D4: attributed evidence accumulates across calls', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock });

  let last = await guard.evaluate({ entity: 'e1', observation: { evidence: { positive: 'weak' } } });
  assert.ok(last.trust.mean > 0.5, 'positive evidence must raise the mean');

  for (let i = 0; i < 5; i += 1) {
    last = await guard.evaluate({ entity: 'e1', observation: { evidence: { positive: 'weak' } } });
  }
  assert.equal(last.trust.band, 'trusted');
  assert.equal(last.decision, 'ALLOW');
  assert.equal(last.coldStart, false);
});

test('D3: trust decays over real elapsed time, back toward unknown', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock });

  for (let i = 0; i < 8; i += 1) {
    await guard.evaluate({ entity: 'e1', observation: { evidence: { positive: 'strong' } } });
  }
  const trusted = await guard.evaluate({ entity: 'e1' });
  assert.equal(trusted.trust.band, 'trusted');

  clock.advance(96);
  const faded = await guard.evaluate({ entity: 'e1' });
  assert.ok(faded.trust.mean < trusted.trust.mean, 'silence must reduce accumulated trust');
  assert.ok(faded.trust.mean > 0.5, 'and must not overshoot into distrust');
});

test('D6: state past the retention horizon is deleted and starts cold', async () => {
  const clock = fakeClock();
  const store = memoryStore();
  const guard = createGuard({ clock, store });

  await guard.evaluate({ entity: 'e1', observation: { evidence: { positive: 'strong' } } });
  assert.equal(store.size(), 1);

  clock.advance(DEFAULT_RETENTION_HOURS + 1);
  const revived = await guard.evaluate({ entity: 'e1' });

  assert.equal(revived.coldStart, true, 'expired state must read as cold start');
  assert.equal(revived.trust.mean, 0.5, 'and must return to the prior exactly');
});

test('D32: an undeclared scope produces no violations', async () => {
  const guard = createGuard({ clock: fakeClock(), invariants: [checkout] });

  const result = await guard.evaluate({
    entity: 'e1',
    observation: { scope: 'navigation', data: { from: 'cart', to: 'confirm' } },
  });

  assert.equal(result.violations.length, 0);
  assert.equal(result.hardViolated, false);
  assert.match(result.trace.join(' '), /unknown, not forbidden/);
});

test('D14/D16: a hard violation escalates past the uncertainty ceiling', async () => {
  const guard = createGuard({ clock: fakeClock(), invariants: [checkout] });

  const result = await guard.evaluate({
    entity: 'e1',
    observation: { scope: 'checkout', data: { from: 'cart', to: 'payment' } },
  });

  assert.equal(result.hardViolated, true);
  assert.equal(result.decision, 'RESTRICT');
  // The proof did not become trust mass. D15.
  assert.equal(result.trust.mean, 0.5);
  assert.match(result.trace.join(' '), /ceiling bypassed/);
});

test('D15: a hard violation never becomes decaying trust mass', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock, invariants: [checkout] });

  for (let i = 0; i < 3; i += 1) {
    await guard.evaluate({
      entity: 'e1',
      observation: { scope: 'checkout', data: { from: 'cart', to: 'payment' } },
    });
  }
  const after = await guard.evaluate({ entity: 'e1' });
  assert.equal(after.trust.mean, 0.5, 'proof must leave the distribution untouched');
});

test('D38: a soft violation becomes strong negative trust mass', async () => {
  const navigation = transitionGraph({
    id: 'navigation-order',
    scope: 'navigation',
    strength: 'soft',
    allowed: [{ from: 'home', to: 'search' }],
  });
  const guard = createGuard({ clock: fakeClock(), invariants: [navigation] });

  const result = await guard.evaluate({
    entity: 'e1',
    observation: { scope: 'navigation', data: { from: 'home', to: 'admin' } },
  });

  assert.equal(result.hardViolated, false);
  assert.ok(result.trust.mean < 0.5, 'soft violations must move the distribution');
  assert.match(result.trace.join(' '), new RegExp(`${DEFAULT_WEIGHTS.strong} negative mass`));
});

test('D37: escalation is withheld without anomaly concurrence, granted with it', async () => {
  const clock = fakeClock();
  const withheld = createGuard({ clock });
  const conceded = createGuard({ clock: fakeClock() });

  for (let i = 0; i < 6; i += 1) {
    await withheld.evaluate({ entity: 'e1', observation: { evidence: { negative: 'strong' } } });
    await conceded.evaluate({
      entity: 'e1',
      observation: { evidence: { negative: 'strong' } },
      anomalyConcurs: true,
    });
  }

  const a = await withheld.evaluate({ entity: 'e1' });
  const b = await conceded.evaluate({ entity: 'e1', anomalyConcurs: true });

  assert.equal(a.trust.uncertainty, 'low');
  assert.equal(a.decision, 'INCREASE_FRICTION', 'no anomaly data means no full escalation');
  assert.equal(b.decision, 'BLOCK', 'concurrence unlocks the decision space');
});

test('D22: forget removes state, and the entity returns as unknown', async () => {
  const store = memoryStore();
  const guard = createGuard({ clock: fakeClock(), store });

  for (let i = 0; i < 6; i += 1) {
    await guard.evaluate({ entity: 'e1', observation: { evidence: { positive: 'strong' } } });
  }
  assert.equal(store.size(), 1);

  await guard.forget('e1');
  assert.equal(store.size(), 0);

  const returning = await guard.evaluate({ entity: 'e1' });
  assert.equal(returning.coldStart, true);
  assert.equal(returning.trust.mean, 0.5);
});

test('D23: every evaluation explains itself', async () => {
  const guard = createGuard({ clock: fakeClock(), invariants: [checkout] });

  const result = await guard.evaluate({
    entity: 'e1',
    observation: { scope: 'checkout', data: { from: 'cart', to: 'payment' } },
    context: { endpoint: '/pay', sensitivity: 'high' },
  });

  assert.ok(result.trace.length > 0);
  assert.ok(result.trace.some((line) => line.startsWith('trust:')));
  assert.deepEqual(result.context, { endpoint: '/pay', sensitivity: 'high' });
});

test('D2: context does not partition state — trust is global per entity', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock });

  await guard.evaluate({
    entity: 'e1',
    observation: { evidence: { positive: 'strong' } },
    context: { endpoint: '/a' },
  });
  const other = await guard.evaluate({ entity: 'e1', context: { endpoint: '/b' } });

  assert.equal(other.coldStart, false, 'a different context must not reset state');
  assert.ok(other.trust.mean > 0.5);
});

test('D10: the guard is usable concurrently for distinct entities', async () => {
  const guard = createGuard({ clock: fakeClock() });

  const results = await Promise.all(
    ['a', 'b', 'c'].map((entity) =>
      guard.evaluate({ entity, observation: { evidence: { positive: 'weak' } } }),
    ),
  );

  assert.deepEqual(results.map((r) => r.entity), ['a', 'b', 'c']);
  assert.ok(results.every((r) => r.coldStart));
});
