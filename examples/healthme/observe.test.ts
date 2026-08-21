import test from 'node:test';
import assert from 'node:assert/strict';

import type { Clock } from '../../src/core/clock.ts';
import { API_SCOPE, UNLOCK_SCOPE } from './invariants.ts';
import { createObserver } from './observe.ts';

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

/**
 * The claim most at risk, per D34: a legitimate user must never be given friction.
 * If this fails, the thresholds in D36 or D40 are wrong, and it is better to learn
 * that here than after an adopter ships.
 */
test('a legitimate user unlocking normally is never escalated', async () => {
  const clock = fakeClock();
  const observer = createObserver({ clock });

  // Someone opening the app each morning for a week and typing their PIN.
  for (let day = 0; day < 7; day += 1) {
    await observer.observe({
      entity: 'session-legit',
      event: 'lock screen submitted',
      scope: UNLOCK_SCOPE,
      data: { from: 'locked', to: 'attempting' },
      hostDid: 'allowed',
    });
    clock.advance(0.02);

    await observer.observe({
      entity: 'session-legit',
      event: 'unlock succeeded',
      scope: UNLOCK_SCOPE,
      data: { from: 'attempting', to: 'unlocked' },
      hostDid: 'allowed',
      evidence: { positive: 'weak' },
    });
    clock.advance(24);
  }

  for (const record of observer.records()) {
    assert.ok(
      record.advice === 'ALLOW' || record.advice === 'OBSERVE',
      `legitimate traffic was advised ${record.advice} at "${record.event}"`,
    );
  }
  assert.equal(observer.disagreements().length, 0);
});

test('a forged API call with no unlock is caught, where HealthMe allows it', async () => {
  const observer = createObserver({ clock: fakeClock() });

  // HealthMe's own defences pass this: the origin header is right, and the IP
  // limit resets on cold start. Nothing in the app notices there was no unlock.
  const assessment = await observer.observe({
    entity: 'session-forged',
    event: 'POST /api/chat',
    scope: API_SCOPE,
    data: { state: 'locked', unlockedThisSession: false },
    hostDid: 'allowed',
  });

  assert.equal(assessment.hardViolated, true);
  assert.equal(assessment.decision, 'RESTRICT');
  assert.equal(observer.disagreements().length, 1, 'this is the gap worth reporting');
});

test('the guard does not punish session restore, which HealthMe relies on', async () => {
  const observer = createObserver({ clock: fakeClock() });

  const assessment = await observer.observe({
    entity: 'session-restore',
    event: 'auto-unlock from sessionStorage',
    scope: API_SCOPE,
    data: { state: 'unlocked', unlockedThisSession: true, vaultLoaded: true },
    hostDid: 'allowed',
  });

  assert.equal(assessment.hardViolated, false);
  assert.equal(assessment.decision, 'ALLOW');
});

test('three wrong PINs: HealthMe locks out for five minutes, the guard does not', async () => {
  const clock = fakeClock();
  const observer = createObserver({ clock });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await observer.observe({
      entity: 'session-fatfinger',
      event: `failed attempt ${attempt + 1}`,
      scope: UNLOCK_SCOPE,
      data: { from: 'attempting', to: 'locked' },
      hostDid: attempt < 2 ? 'rejected' : 'locked-out',
      evidence: { negative: 'weak' },
    });
    clock.advance(0.01);
  }

  const last = observer.records().at(-1)!;
  assert.equal(last.hostDid, 'locked-out');
  assert.ok(
    last.advice === 'ALLOW' || last.advice === 'OBSERVE' || last.advice === 'INCREASE_FRICTION',
    `the guard escalated to ${last.advice} on three mistyped PINs`,
  );
  // Three weak negatives is n = 3.5: developing, not established. Not enough to
  // act on autonomously, which is the intended difference from a 3-strike rule.
  assert.equal(last.stage, 'developing');
});

test('sustained scripted attempts do accumulate, unlike a counter that resets', async () => {
  const clock = fakeClock();
  const observer = createObserver({ clock });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await observer.observe({
      entity: 'session-scripted',
      event: `scripted attempt ${attempt + 1}`,
      scope: UNLOCK_SCOPE,
      data: { from: 'attempting', to: 'locked', state: 'attempting', fieldPopulated: true, interactions: 0 },
      hostDid: 'rejected',
      evidence: { negative: 'strong' },
    });
    clock.advance(0.02);
  }

  const last = observer.records().at(-1)!;
  assert.equal(last.stage, 'established');
  // Mechanical timing means diversity withholds, so escalation stops at friction
  // rather than reaching BLOCK. Recorded, since it is D37 working as designed.
  assert.equal(last.advice, 'INCREASE_FRICTION');
});

test('the summary reports pairs of host outcome against guard advice', async () => {
  const observer = createObserver({ clock: fakeClock() });

  await observer.observe({
    entity: 'e1',
    event: 'forged call',
    scope: API_SCOPE,
    data: { state: 'locked', unlockedThisSession: false },
    hostDid: 'allowed',
  });

  const summary = observer.summary();
  assert.equal(summary.observed, 1);
  assert.equal(summary.disagreements, 1);
  assert.deepEqual(Object.keys(summary.pairs), ['allowed vs RESTRICT']);
});
