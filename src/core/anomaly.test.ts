import test from 'node:test';
import assert from 'node:assert/strict';

import type { BehaviorFeatures } from './behavior.ts';
import { DEFAULT_REFERENCE, anomalyConcurs, anomalyScore } from './anomaly.ts';

/** A feature vector, with unremarkable defaults the test overrides per case. */
function features(overrides: Partial<BehaviorFeatures> = {}): BehaviorFeatures {
  return {
    count: 12,
    distinctScopes: 5,
    scopeEntropy: 0.8,
    interArrivalCv: 1.1,
    meanGapMs: 45_000,
    immediateRepeatRatio: 0.1,
    ...overrides,
  };
}

test('D18: a window below the minimum is unscored, not scored zero', () => {
  const scored = anomalyScore(features({ count: 3 }));

  assert.equal(scored.score, undefined, 'too little behavior to describe');
  assert.equal(scored.dominant, undefined);
  assert.equal(anomalyConcurs(features({ count: 3 })), undefined);
});

test('D18: varied human-shaped behavior scores near zero', () => {
  const scored = anomalyScore(features());

  assert.notEqual(scored.score, undefined);
  assert.ok(scored.score! < 0.1, `expected a low score, got ${scored.score}`);
  assert.equal(anomalyConcurs(features()), true);
});

test('D18: browsing more diversely than the reference is not anomalous', () => {
  // One-sided: exceeding the reference on a "higher is better" feature must not
  // register as distance. A symmetric metric would report this as unusual.
  const scored = anomalyScore(
    features({ scopeEntropy: 1, interArrivalCv: 3, distinctScopes: 20 }),
  );

  assert.equal(scored.score, 0);
});

test('D18: uniform gaps dominate the score, because shape is hardest to fake', () => {
  const scored = anomalyScore(features({ interArrivalCv: 0 }));

  assert.equal(scored.dominant, 'interArrivalCv');
  assert.ok(scored.score! > 0, 'a fixed-interval client is measurably unusual');
});

test('D18: monotonous single-scope automation scores high and withholds concurrence', () => {
  const scored = anomalyScore(
    features({
      distinctScopes: 1,
      scopeEntropy: 0,
      interArrivalCv: 0.01,
      immediateRepeatRatio: 1,
    }),
  );

  assert.ok(scored.score! > 0.8, `expected a high score, got ${scored.score}`);
  assert.equal(anomalyConcurs(features({
    distinctScopes: 1,
    scopeEntropy: 0,
    interArrivalCv: 0.01,
    immediateRepeatRatio: 1,
  })), false);
});

test('D18: the score is bounded to [0,1]', () => {
  const worst = anomalyScore(
    features({
      distinctScopes: 0,
      scopeEntropy: 0,
      interArrivalCv: 0,
      immediateRepeatRatio: 1,
    }),
  );

  assert.ok(worst.score! >= 0 && worst.score! <= 1);
});

test('D18: the reference profile is policy, not law', () => {
  const behavior = features({ interArrivalCv: 0.5 });

  const againstDefault = anomalyScore(behavior).score!;
  const againstLenient = anomalyScore(behavior, {
    reference: { ...DEFAULT_REFERENCE, interArrivalCv: 0.4 },
  }).score!;

  assert.ok(
    againstLenient < againstDefault,
    'lowering the expectation must lower the distance',
  );
});

test('D18: every contribution is attributable to one feature', () => {
  const scored = anomalyScore(features({ scopeEntropy: 0 }));

  assert.equal(scored.dominant, 'scopeEntropy');
  assert.ok(scored.contributions.scopeEntropy > 0);
  assert.equal(scored.contributions.interArrivalCv, 0, 'an untouched feature contributes nothing');
});
