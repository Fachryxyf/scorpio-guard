import test from 'node:test';
import assert from 'node:assert/strict';

import type { Clock } from './clock.ts';
import { createGuard } from './guard.ts';
import { DEFAULT_RETENTION_HOURS, DEFAULT_WEIGHTS } from './policy.ts';
import { memoryStore } from './store.ts';
import { WEAK_SIGNALS } from './signals.ts';
import { transitionGraph } from './transitions.ts';
import type { Invariant } from './constraints.ts';

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

/**
 * A value the application itself issued. D41, `issuance`: a token the system
 * never handed out cannot have come from a legitimate client.
 */
const issued = new Set(['issued-a', 'issued-b']);

const unissued: Invariant = {
  id: 'lookup.token-was-issued',
  class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
  strength: 'hard',
  scope: 'lookup',
  holds: (observation) => {
    const token = (observation as { token?: unknown }).token;
    return typeof token !== 'string' || issued.has(token);
  },
};

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

test('D36/D37: the guard derives diversity from the entity own window', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock });

  // Mechanical: same scope, fixed interval, sustained negatives.
  let mechanical;
  for (let i = 0; i < 12; i += 1) {
    mechanical = await guard.evaluate({
      entity: 'bot',
      observation: { scope: 'search', evidence: { negative: 'strong' } },
    });
    clock.advance(1);
  }

  assert.equal(mechanical?.behavior.interArrivalCv, 0, 'fixed intervals must read zero variation');
  assert.equal(mechanical?.diversity, false);
  assert.equal(mechanical?.trust.uncertainty, 'low');
  assert.equal(mechanical?.decision, 'INCREASE_FRICTION', 'volume alone must not unlock escalation');
  assert.match(mechanical?.trace.join(' ') ?? '', /diversity withheld/);
});

test('D36: a small window leaves diversity undetermined rather than false', async () => {
  const guard = createGuard({ clock: fakeClock() });
  const result = await guard.evaluate({ entity: 'e1', observation: { scope: 'home' } });

  assert.equal(result.diversity, undefined);
  assert.equal(result.behavior.count, 1);
  assert.match(result.trace.join(' '), /diversity undetermined/);
});

test('D36: the observation window is bounded per entity', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock, windowSize: 5 });

  for (let i = 0; i < 12; i += 1) {
    await guard.evaluate({ entity: 'e1', observation: { scope: `s-${i}` } });
    clock.advance(1);
  }
  const result = await guard.evaluate({ entity: 'e1', observation: { scope: 'last' } });
  assert.equal(result.behavior.count, 5);
});

test('D22: forgetting an entity discards its behavioral window too', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock });

  for (let i = 0; i < 10; i += 1) {
    await guard.evaluate({ entity: 'e1', observation: { scope: 'search' } });
    clock.advance(1);
  }
  await guard.forget('e1');

  const returning = await guard.evaluate({ entity: 'e1', observation: { scope: 'search' } });
  assert.equal(returning.behavior.count, 1, 'no behavioral history may survive a purge');
  assert.equal(returning.diversity, undefined);
});

test('D37: a host verdict overrides the computed diversity signal', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock });

  for (let i = 0; i < 12; i += 1) {
    await guard.evaluate({
      entity: 'e1',
      observation: { scope: 'search', evidence: { negative: 'strong' } },
      anomalyConcurs: true,
    });
    clock.advance(1);
  }
  const result = await guard.evaluate({ entity: 'e1', anomalyConcurs: true });

  assert.equal(result.diversity, true);
  assert.equal(result.decision, 'BLOCK');
});

test('D42: weak signals become negative mass and cannot escalate on their own', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock });

  // Every published signal at once, on an entity with no history.
  const result = await guard.evaluate({
    entity: 'signalled',
    observation: { signals: WEAK_SIGNALS.map((signal) => signal.id) },
  });

  assert.equal(
    result.decision,
    'ALLOW',
    'measurement alone must not reach a treatment; the epistemic stage still binds',
  );
  assert.match(result.trace.join(' '), /weak signal\(s\) contribute/);
});

test('D42: weak signals do move trust once evidence exists to interpret', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock, store: memoryStore() });

  for (let i = 0; i < 5; i += 1) {
    await guard.evaluate({
      entity: 'drifting',
      observation: { scope: `s${i}`, evidence: { positive: 'strong' } },
    });
    clock.advance(1);
  }

  const before = await guard.evaluate({ entity: 'drifting' });
  clock.advance(1);
  const after = await guard.evaluate({
    entity: 'drifting',
    observation: { signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_UNINTERACTED_INPUT'] },
  });

  assert.ok(
    after.trust.mean < before.trust.mean,
    'observed signals should lower the mean, not merely be logged',
  );
});

test('D42: an invented signal id is ignored rather than treated as suspicious', async () => {
  const guard = createGuard({ clock: fakeClock() });
  const result = await guard.evaluate({
    entity: 'inventive',
    observation: { signals: ['SIG_NOT_IN_THE_CATALOGUE'] },
  });

  assert.doesNotMatch(result.trace.join(' '), /weak signal\(s\) contribute/);
});

test('D41: per-class advice applies, and the strongest violated class wins', async () => {
  const clock = fakeClock();
  const guard = createGuard({
    clock,
    invariants: [checkout, unissued],
    policy: { hardViolationDecision: { IMPOSSIBLE_UNISSUED_REFERENCE: 'BLOCK' } },
  });

  const jump = await guard.evaluate({
    entity: 'jumper',
    observation: { scope: 'checkout', data: { from: 'cart', to: 'confirm' } },
  });
  assert.equal(jump.decision, 'RESTRICT', 'an unlisted class falls back to the default');

  const forged = await guard.evaluate({
    entity: 'forger',
    observation: { scope: 'lookup', data: { token: 'never-issued' } },
  });
  assert.equal(forged.decision, 'BLOCK', 'the declared per-class advice applies');
});

test('D49: farming ceiling raises decision for high-velocity entity', async () => {
  const clock = fakeClock(1_000_000);
  const guard = createGuard({
    clock,
    velocity: { maxObsPerHour: 10, minWindowSpanMs: 60_000 },
    windowSize: 20,
  });

  // Build up a window that spans > 1 minute with many observations
  for (let i = 0; i < 15; i++) {
    clock.advance(1 / 60); // 1 minute each
    await guard.evaluate({
      entity: 'farmer',
      observation: { scope: 'checkout', evidence: { positive: 'strong' } },
    });
  }

  // After sustained high velocity, the entity should hit INCREASE_FRICTION
  const result = await guard.evaluate({
    entity: 'farmer',
    observation: { scope: 'checkout', evidence: { positive: 'strong' } },
  });

  // Mean is high (lots of positive evidence), but velocity ceiling should fire
  assert.equal(result.farming, true);
  assert.ok(
    result.trace.some((t) => t.includes('velocity exceeded') || t.includes('farming ceiling')),
    'trace should mention farming'
  );
});

test('D18: every evaluation reports an anomaly score without it driving the decision', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock });

  // Below the classifier's minimum window: unscored, not scored zero.
  const first = await guard.evaluate({ entity: 'visitor', observation: { scope: 'home' } });
  assert.equal(first.anomaly.score, undefined);

  for (let i = 0; i < 6; i += 1) {
    clock.advance(0.25);
    await guard.evaluate({ entity: 'visitor', observation: { scope: `scope-${i % 3}` } });
  }

  const scored = await guard.evaluate({ entity: 'visitor', observation: { scope: 'home' } });
  assert.notEqual(scored.anomaly.score, undefined, 'the score is reported once the window fills');
  assert.match(scored.trace.join(' '), /anomaly score .*reported only/);
});

test('D18: the classifier can replace the threshold conjunction for D37 concurrence', async () => {
  const clock = fakeClock();
  const guard = createGuard({ clock, useAnomalyClassifier: true });

  // One scope, fixed interval: monotonous by both readings.
  for (let i = 0; i < 8; i += 1) {
    clock.advance(1);
    await guard.evaluate({ entity: 'robot', observation: { scope: 'poll' } });
  }

  const result = await guard.evaluate({ entity: 'robot', observation: { scope: 'poll' } });

  assert.equal(result.diversity, false, 'the classifier withholds concurrence');
  assert.ok(result.anomaly.score! > 0.5);
  assert.match(result.trace.join(' '), /drives concurrence/);
});
