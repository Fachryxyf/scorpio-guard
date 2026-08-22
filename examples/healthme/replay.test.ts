import test from 'node:test';
import assert from 'node:assert/strict';

import { replayAll, replayPersona } from './replay.ts';
import {
  ADVERSARY_PERSONAS,
  LEGITIMATE_PERSONAS,
  churningBruteForce,
  jitteredBruteForce,
  scriptedBruteForce,
  slowPoisoner,
} from './personas.ts';

/**
 * The central constraint, as an assertion. D45.
 *
 * The design states false positives are unacceptable at product scale; this is
 * what that means operationally — no persona built from HealthMe's own honest
 * usage may ever be advised anything a user would feel.
 */
test('D45: no legitimate persona is ever given friction', async () => {
  const results = await replayAll(LEGITIMATE_PERSONAS);

  const offenders = results
    .filter((result) => result.falsePositive)
    .map((result) => `${result.persona} was advised ${result.worst} at step ${result.worstAtStep}`);

  assert.deepEqual(offenders, []);
  assert.equal(results.length, 5, 'all legitimate personas must actually run');
});

test('D45: every adversary persona costs something', async () => {
  const results = await replayAll(ADVERSARY_PERSONAS);

  const walkedThrough = results
    .filter((result) => result.walkedThrough)
    .map((result) => `${result.persona} never got past ${result.worst}`);

  assert.deepEqual(walkedThrough, []);
});

test('D45: a fixed sleep and uniform jitter are equally unconvincing', async () => {
  // The design notes claim the tell is the shape of the randomness rather than the
  // delay. If jitter bought an attacker anything, this is where it would show.
  const [fixed] = await replayAll([scriptedBruteForce(30)]);
  const [jittered] = await replayAll([jitteredBruteForce(30)]);

  assert.equal(jittered!.worst, fixed!.worst);
  assert.ok(
    jittered!.worstAtStep! <= fixed!.worstAtStep! + 2,
    'uniform jitter should not meaningfully delay escalation',
  );
});

test('D46: the slow poisoner is caught, and how long it takes is recorded', async () => {
  const result = await replayPersona(slowPoisoner(10, 40));

  const abuseStart = result.records.findIndex((record) => record.event.startsWith('abuse'));
  assert.ok(abuseStart > 0, 'the honest phase must come first');

  const abuse = result.records.slice(abuseStart);
  const untilFelt = abuse.findIndex(
    (record) => record.advice !== 'ALLOW' && record.advice !== 'OBSERVE',
  );

  // Earned trust does buy an attacker a head start, which is the cost of having a
  // memory at all. What matters is that it is bounded and small relative to the
  // ten days of honest traffic that paid for it.
  assert.ok(untilFelt > 0, 'trust earned honestly is not instantly forfeited');
  assert.ok(
    untilFelt <= 12,
    `abuse went unfelt for ${untilFelt} calls after ten honest days; decay is too slow`,
  );
  assert.equal(result.worst, 'RESTRICT');
});

/**
 * Identity churn is recorded as an open problem. This measures it rather than
 * asserting it away — the number is the finding.
 */
test('D45: churning identities defeats accumulation, and the floor is two requests', async () => {
  const churned = await replayAll(churningBruteForce(30, 3));
  const escalated = churned.filter(
    (result) => result.worst !== 'ALLOW' && result.worst !== 'OBSERVE',
  );

  // Three attempts per identity is enough for the second one to be felt, so churn
  // does not make an attacker free — it caps what one identity costs them.
  assert.equal(escalated.length, churned.length);

  // One attempt per identity is the actual hole: nothing accumulates, because
  // nothing is asked twice. No amount of trust modelling fixes that; it is the
  // root-of-trust problem, and it belongs to the host.
  const singleUse = await replayAll(churningBruteForce(30, 1));
  const everFelt = singleUse.filter(
    (result) => result.worst !== 'ALLOW' && result.worst !== 'OBSERVE',
  );
  assert.equal(everFelt.length, 0, 'recorded, not fixed: see D1.1 and the open problems');
});

test('D45: the honest daily user reaches established trust without ever being touched', async () => {
  const result = await replayPersona(LEGITIMATE_PERSONAS[0]!);

  assert.equal(result.persona, 'daily-ritual');
  assert.equal(result.finalStage, 'established');
  assert.ok(result.finalMean > 0.8, `two weeks of honest use only reached ${result.finalMean}`);
  assert.ok(result.worst === 'ALLOW' || result.worst === 'OBSERVE');

  // And the diversity signal believes it, which is what lets escalation exist at
  // all for this entity later.
  assert.equal(result.records.at(-1)!.diversity, true);
});
