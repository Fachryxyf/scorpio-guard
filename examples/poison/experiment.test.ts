/**
 * The poisoning experiment, asserted.
 *
 * Each test is one row of the table in docs/POISONING.md. They exist so that a policy
 * change which makes patience cheaper cannot pass review by looking reasonable: the
 * price is a number here, and it moves when the policy moves.
 *
 * Nothing here claims detection. The guard answers how much evidence it needs, and the
 * experiment is a price list, not a detector.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { REGULAR, irregular, runPoison } from './experiment.ts';

test('an entity with no history is treated after three strong negatives', async () => {
  const row = await runPoison(0, REGULAR);

  assert.equal(row.negativesToTreatment, 3, 'the baseline the attack is measured against');
  assert.equal(row.decision, 'INCREASE_FRICTION');
});

test('a script with constant gaps stops buying latency at five negatives', async () => {
  const twelve = await runPoison(24, REGULAR);
  const fortyEight = await runPoison(48, REGULAR);

  assert.equal(twelve.negativesToTreatment, 5);
  assert.equal(fortyEight.negativesToTreatment, 5, 'spending twice as much buys nothing');
  assert.ok(fortyEight.trustAfterPositives < 1, 'the discounted positives never saturate trust');
});

test('a script with jittered gaps buys latency in proportion to what it spends', async () => {
  assert.equal((await runPoison(12, irregular())).negativesToTreatment, 8);
  assert.equal((await runPoison(24, irregular())).negativesToTreatment, 16);
  assert.equal((await runPoison(48, irregular())).negativesToTreatment, 31);
});

test('the difference between the two pacings is the discount, not the pacing itself', async () => {
  const discounted = await runPoison(24, REGULAR);
  const undiscounted = await runPoison(24, REGULAR, { guard: { discountRegularPositives: false } });
  const jittered = await runPoison(24, irregular(), { guard: { discountRegularPositives: false } });

  assert.equal(discounted.negativesToTreatment, 5);
  assert.equal(undiscounted.negativesToTreatment, 16, 'turn the discount off and regularity stops mattering');
  assert.equal(jittered.negativesToTreatment, undiscounted.negativesToTreatment);
});

test('D73: the price of one extra tolerated negative is about one and a half positives', async () => {
  const fortyEight = await runPoison(48, irregular());
  const baseline = await runPoison(0, REGULAR);

  const extra = fortyEight.negativesToTreatment - baseline.negativesToTreatment;
  const price = fortyEight.positives / extra;

  assert.equal(extra, 28);
  assert.equal(Number(price.toFixed(2)), 1.71, 'against an attacker who removes the pacing tell');
});
