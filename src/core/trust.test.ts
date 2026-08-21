import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyEvidence,
  decayFactor,
  expectedTrust,
  freshState,
  isExpired,
  uncertainty,
} from './trust.ts';
import { DEFAULT_HALF_LIFE_HOURS, DEFAULT_RETENTION_HOURS, DEFAULT_WEIGHTS } from './policy.ts';

const HOUR = 3_600_000;
const H = DEFAULT_HALF_LIFE_HOURS;

/** Every numeric claim in DECISIONS.md is locked here, so a policy change surfaces as a failing test rather than a silent drift. */

function close(actual: number, expected: number, tolerance = 1e-4): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

/** Feed `n` observations spaced `intervalHours` apart, starting at t=0. */
function stream(n: number, weight: number, intervalHours: number) {
  let state = freshState(0);
  for (let i = 1; i <= n; i += 1) {
    state = applyEvidence(state, { positive: weight }, i * intervalHours * HOUR);
  }
  return state;
}

test('D2a: a fresh entity is exactly flat Beta(1,1)', () => {
  const state = freshState(0);
  close(expectedTrust(state, 0), 0.5);
  close(uncertainty(state, 0), 1 / 12);
});

test('D3: one half-life halves the evidence mass', () => {
  close(decayFactor(H * HOUR, H), 0.5);
  close(decayFactor(2 * H * HOUR, H), 0.25);
  assert.equal(decayFactor(0, H), 1);
  assert.equal(decayFactor(-1000, H), 1, 'a clock moving backwards must not amplify mass');
});

test('D3: decay is composable, so one step equals two', () => {
  const once = decayFactor(30 * HOUR, H);
  const twice = decayFactor(10 * HOUR, H) * decayFactor(20 * HOUR, H);
  close(once, twice, 1e-12);
});

test('D3: silence returns an entity to unknown, never to untrusted', () => {
  // Mass (8, 2) is a well-established entity at E[p] = 0.75.
  let state = freshState(0);
  state = applyEvidence(state, { positive: 8, negative: 2 }, 0);
  close(expectedTrust(state, 0), 0.75);

  // Figures quoted in D3.
  close(expectedTrust(state, 96 * HOUR), 0.5714);
  close(expectedTrust(state, 240 * HOUR), 0.5015);

  // The prior is a floor: it must converge to flat, not collapse past it.
  close(expectedTrust(state, 10_000 * HOUR), 0.5);
  close(uncertainty(state, 10_000 * HOUR), 1 / 12);
});

test('D3: writes decay before adding, which is what bounds mass', () => {
  // Ceiling for arrivals every T is m* = w / (1 - lambda(T)). D4.
  const intervalHours = 1;
  const weight = DEFAULT_WEIGHTS.weak;
  const ceiling = weight / (1 - decayFactor(intervalHours * HOUR, H));
  close(ceiling, 17.5635, 1e-3);

  const state = stream(400, weight, intervalHours);
  assert.ok(state.a <= ceiling + 1e-6, `mass ${state.a} must not exceed ceiling ${ceiling}`);
  close(state.a, ceiling, 1e-3);
});

test('D4: one strong evidence weighs four weak ones', () => {
  assert.equal(DEFAULT_WEIGHTS.strong / DEFAULT_WEIGHTS.weak, 4);
});

test('D4: evidence mass may not be negative', () => {
  assert.throws(() => applyEvidence(freshState(0), { positive: -1 }, 0), RangeError);
  assert.throws(() => applyEvidence(freshState(0), { negative: -1 }, 0), RangeError);
});

test('D4: a strong negative bites hardest where there is least history', () => {
  const drop = (positiveMass: number) => {
    let state = freshState(0);
    state = applyEvidence(state, { positive: positiveMass }, 0);
    const before = expectedTrust(state, 0);
    const after = expectedTrust(applyEvidence(state, { negative: DEFAULT_WEIGHTS.strong }, 0), 0);
    return before - after;
  };

  close(drop(2), 0.25);
  close(drop(8), 0.15);
  close(drop(50), 0.0363, 1e-3);

  assert.ok(drop(2) > drop(8), 'a thin history must be easier to move');
  assert.ok(drop(8) > drop(50), 'an established history must absorb a single hit');
});

test('D5: an unknown entity is capped by high uncertainty, not punished', () => {
  const state = freshState(0);
  // E[p] = 0.5 sits in the friction band, but variance is high, so D5 caps it.
  close(expectedTrust(state, 0), 0.5);
  assert.ok(uncertainty(state, 0) > 0.05, 'a fresh entity must read as high uncertainty');
});

test('D5: the trajectory that unlocks the decision space', () => {
  // Table in D5, weak positives arriving fast enough that decay is negligible.
  const expected: ReadonlyArray<readonly [number, number, number]> = [
    [0, 0.5, 0.08333],
    [3, 0.7143, 0.04535],
    [6, 0.8, 0.02667],
    [10, 0.8571, 0.01531],
    [16, 0.9, 0.00818],
  ];

  for (const [n, mean, variance] of expected) {
    let state = freshState(0);
    if (n > 0) state = applyEvidence(state, { positive: n * DEFAULT_WEIGHTS.weak }, 0);
    close(expectedTrust(state, 0), mean, 1e-3);
    close(uncertainty(state, 0), variance, 1e-4);
  }
});

test('D5: deny requires sustained negative evidence, not one observation', () => {
  let once = freshState(0);
  once = applyEvidence(once, { negative: DEFAULT_WEIGHTS.strong }, 0);
  close(expectedTrust(once, 0), 0.25);
  assert.ok(uncertainty(once, 0) > 0.02, 'one hit must not reach low uncertainty');

  let sustained = freshState(0);
  sustained = applyEvidence(sustained, { negative: 8 }, 0);
  close(expectedTrust(sustained, 0), 0.1);
  assert.ok(uncertainty(sustained, 0) <= 0.02, 'sustained negatives should reach low uncertainty');
});

test('D6: retention runs from the last meaningful update, not the last sighting', () => {
  let state = freshState(0);
  state = applyEvidence(state, { positive: DEFAULT_WEIGHTS.weak }, 0);

  const justInside = DEFAULT_RETENTION_HOURS * HOUR;
  const justOutside = justInside + 1;
  assert.equal(isExpired(state, justInside, DEFAULT_RETENTION_HOURS), false);
  assert.equal(isExpired(state, justOutside, DEFAULT_RETENTION_HOURS), true);

  // An observation carrying no evidence advances lastSeen but not the horizon.
  const touched = applyEvidence(state, {}, 100 * HOUR);
  assert.equal(touched.lastSeen, 100 * HOUR);
  assert.equal(touched.lastMeaningfulUpdate, 0);
  assert.equal(isExpired(touched, justOutside, DEFAULT_RETENTION_HOURS), true);
});

test('D6: decay alone does not converge on a bounded schedule, which is why expiry exists', () => {
  // A high-frequency entity still reads as trusted at low uncertainty a week
  // after going quiet. This is the finding that justifies a retention horizon.
  let saturated = freshState(0);
  saturated = applyEvidence(saturated, { positive: 1000, negative: 50 }, 0);

  const week = DEFAULT_RETENTION_HOURS * HOUR;
  close(expectedTrust(saturated, week), 0.8637, 1e-3);
  assert.ok(uncertainty(saturated, week) <= 0.02, 'still low uncertainty after a week');
  assert.equal(isExpired(saturated, week + 1, DEFAULT_RETENTION_HOURS), true);
});
