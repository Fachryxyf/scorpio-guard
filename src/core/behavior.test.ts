import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DIVERSITY,
  behaviorFeatures,
  diversityConcurs,
  pushObservation,
  farmingSuspected,
  observationRate,
  positiveCredit,
  type ObservationTrace,
} from './behavior.ts';

/** Observations at fixed intervals over one scope: the shape automation produces. */
function uniform(count: number, gapMs: number, scope = 'search'): ObservationTrace[] {
  return Array.from({ length: count }, (_, i) => ({ at: i * gapMs, scope }));
}

test('D36: an empty window yields zeroed features, not NaN', () => {
  const features = behaviorFeatures([]);
  assert.equal(features.count, 0);
  assert.equal(features.scopeEntropy, 0);
  assert.equal(features.interArrivalCv, 0);
  assert.equal(features.meanGapMs, undefined);
});

test('D36: identical observations carry zero entropy and zero timing variation', () => {
  const features = behaviorFeatures(uniform(12, 1000));
  assert.equal(features.distinctScopes, 1);
  assert.equal(features.scopeEntropy, 0);
  assert.equal(features.interArrivalCv, 0);
  assert.equal(features.immediateRepeatRatio, 1);
  assert.equal(features.meanGapMs, 1000);
});

test('D36: entropy is normalised, so a fully varied window reads 1', () => {
  const varied = Array.from({ length: 8 }, (_, i) => ({ at: i * 1000, scope: `scope-${i}` }));
  assert.equal(behaviorFeatures(varied).scopeEntropy, 1);
});

test('D36: the tell is the shape of the randomness, not the delay', () => {
  // The design notes single out a flat uniform(a, b) as the giveaway. Its
  // coefficient of variation is characteristically low; bursty human timing is
  // an order of magnitude higher.
  const fixedSleep = behaviorFeatures(uniform(20, 1000)).interArrivalCv;

  const flatRandom = behaviorFeatures(
    Array.from({ length: 20 }, (_, i) => ({ at: i * 1750 + (i % 5) * 120, scope: 'search' })),
  ).interArrivalCv;

  // Bursts of fast actions separated by long pauses.
  let at = 0;
  const bursty = behaviorFeatures(
    Array.from({ length: 20 }, (_, i) => {
      at += i % 4 === 0 ? 20_000 : 300;
      return { at, scope: 'search' };
    }),
  ).interArrivalCv;

  assert.equal(fixedSleep, 0);
  assert.ok(flatRandom < DEFAULT_DIVERSITY.minInterArrivalCv, 'flat randomness must not pass');
  assert.ok(bursty > DEFAULT_DIVERSITY.minInterArrivalCv, 'human-shaped timing must pass');
});

test('D37: a window too small to judge returns undefined, not false', () => {
  const tooFew = behaviorFeatures(uniform(DEFAULT_DIVERSITY.minObservations - 1, 1000));
  assert.equal(diversityConcurs(tooFew), undefined);
});

test('D37: high-volume monotonous traffic fails the diversity condition', () => {
  // This is the farming pattern: enough observations to drive variance down,
  // while proving nothing about variety.
  const farmed = behaviorFeatures(uniform(20, 1000));
  assert.equal(diversityConcurs(farmed), false);
});

test('D37: varied scopes with human-shaped timing concur', () => {
  const scopes = ['home', 'search', 'detail', 'checkout'];
  let at = 0;
  const window = Array.from({ length: 16 }, (_, i) => {
    at += i % 3 === 0 ? 15_000 : 800;
    return { at, scope: scopes[i % scopes.length]! };
  });

  assert.equal(diversityConcurs(behaviorFeatures(window)), true);
});

test('D37: varied scopes are not enough if timing is mechanical', () => {
  const scopes = ['home', 'search', 'detail', 'checkout'];
  const window = Array.from({ length: 16 }, (_, i) => ({
    at: i * 1000,
    scope: scopes[i % scopes.length]!,
  }));

  const features = behaviorFeatures(window);
  assert.equal(features.scopeEntropy > DEFAULT_DIVERSITY.minScopeEntropy, true);
  assert.equal(diversityConcurs(features), false, 'every condition must hold, not just one');
});

test('D36: the window is bounded, dropping oldest first', () => {
  let window: readonly ObservationTrace[] = [];
  for (let i = 0; i < 30; i += 1) {
    window = pushObservation(window, { at: i * 1000, scope: `s-${i}` }, 20);
  }

  assert.equal(window.length, 20);
  assert.equal(window[0]?.scope, 's-10');
  assert.equal(window.at(-1)?.scope, 's-29');
});

test('D46: entropy measures balance, independently of how many scopes the app has', () => {
  // The same behavior — attention spread perfectly evenly over whatever exists —
  // must score the same in a two-scope app and a five-scope one. Normalising
  // against the window size made this a proxy for `distinctScopes` instead, so a
  // small application could not reach the diversity threshold at all.
  const even = (scopes: readonly string[]) =>
    behaviorFeatures(
      Array.from({ length: 20 }, (_, i) => ({ at: i * 1000, scope: scopes[i % scopes.length]! })),
    ).scopeEntropy;

  assert.equal(even(['a', 'b']), 1);
  assert.equal(even(['a', 'b', 'c', 'd', 'e']), 1);
});

test('D46: a lopsided window reads low even though two scopes were seen', () => {
  // Breadth is `distinctScopes`'s job. Entropy has to disagree with it here, or
  // one stray observation would buy a monotonous entity a diversity pass.
  const lopsided = [
    ...Array.from({ length: 19 }, (_, i) => ({ at: i * 1000, scope: 'api' })),
    { at: 20_000, scope: 'unlock' },
  ];

  const features = behaviorFeatures(lopsided);
  assert.equal(features.distinctScopes, 2);
  assert.ok(features.scopeEntropy < DEFAULT_DIVERSITY.minScopeEntropy);
  assert.equal(diversityConcurs(features), false);
});

test('D50: a rate needs enough observations before it means anything', () => {
  assert.equal(observationRate([]), undefined);
  assert.equal(observationRate([{ at: 0, scope: 'a' }]), undefined);

  const four = Array.from({ length: 4 }, (_, i) => ({ at: i * 60_000, scope: 'a' }));
  assert.equal(observationRate(four), undefined, 'four is below the default minimum');
});

test('D50: the rate is observations per hour over the window span', () => {
  // Ten observations one minute apart: nine minutes of span, so 66.7/hr.
  const window = Array.from({ length: 10 }, (_, i) => ({ at: i * 60_000, scope: 'a' }));
  assert.ok(Math.abs(observationRate(window)! - 66.67) < 0.1);
});

test('D54: a fast human is not farming, because gap shape is what separates them', () => {
  // The first falsification: a busy operator at one action per 45 seconds runs at
  // 80/hr, well past the rate threshold, and must not be touched.
  let seed = 7;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let at = 0;
  const bursty = Array.from({ length: 20 }, (_, i) => {
    at += -Math.log(1 - random()) * 45_000;
    return { at, scope: `s${i % 5}` };
  });

  assert.ok(observationRate(bursty)! > 60, 'the rate alone would fire');
  assert.equal(farmingSuspected(bursty), false, 'bursty gaps clear it');
});

test('D54: repeating one scope quickly is not farming either', () => {
  // The second falsification: HealthMe's power-user reads one scope over and over
  // and scores 0.56 on the composite anomaly measure. Narrow attention is not the
  // signal — regular timing is.
  let seed = 5;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let at = 0;
  const oneScope = Array.from({ length: 20 }, () => {
    at += -Math.log(1 - random()) * 12_000;
    return { at, scope: 'api' };
  });

  assert.ok(observationRate(oneScope)! > 60);
  assert.equal(farmingSuspected(oneScope), false, 'one feature used heavily is legitimate');
});

test('D54: a high rate with machine-regular gaps is farming', () => {
  const fixed = Array.from({ length: 20 }, (_, i) => ({ at: i * 30_000, scope: 'work' }));

  assert.equal(farmingSuspected(fixed), true);
});

test('D54: jittering a fixed sleep does not hide it', () => {
  // +-10% around 30s still reads at CV ~0.05. Escaping this means giving up the
  // regularity, and regularity is what the volume depends on.
  let seed = 3;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let at = 0;
  const jittered = Array.from({ length: 20 }, () => {
    at += 30_000 * (0.9 + random() * 0.2);
    return { at, scope: 'work' };
  });

  assert.equal(farmingSuspected(jittered), true);
});

test('D54: regular gaps at a human rate are not farming', () => {
  // Both halves are required. A slow bot is a different problem, and the diversity
  // gate of D37 is where it is read.
  const slow = Array.from({ length: 20 }, (_, i) => ({ at: i * 10 * 60_000, scope: 'work' }));

  assert.ok(observationRate(slow)! < 60);
  assert.equal(farmingSuspected(slow), false);
});

test('D50: too few observations is undetermined, not cleared', () => {
  assert.equal(farmingSuspected([]), undefined);
  assert.equal(
    farmingSuspected(Array.from({ length: 4 }, (_, i) => ({ at: i * 1000, scope: 'a' }))),
    undefined,
  );
});

test('D50: both halves of the threshold are policy', () => {
  const window = Array.from({ length: 20 }, (_, i) => ({ at: i * 45_000, scope: 'work' }));

  assert.equal(
    farmingSuspected(window, { maxObsPerHour: 200, minObservations: 8, maxInterArrivalCv: 0.25 }),
    false,
    'raising the rate bar catches less',
  );
  assert.equal(
    farmingSuspected(window, { maxObsPerHour: 60, minObservations: 8, maxInterArrivalCv: 0.25 }),
    true,
  );
});

test('D55: bursty activity earns full credit', () => {
  let seed = 7;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let at = 0;
  const bursty = Array.from({ length: 20 }, () => {
    at += -Math.log(1 - random()) * 45_000;
    return { at, scope: 'work' };
  });

  assert.equal(positiveCredit(bursty), 1);
});

test('D55: perfectly regular gaps earn no credit at all', () => {
  const fixed = Array.from({ length: 20 }, (_, i) => ({ at: i * 30_000, scope: 'work' }));

  assert.equal(positiveCredit(fixed), 0);
});

test('D55: credit is continuous, so there is no boundary to sit outside of', () => {
  // A jittered sleep earns proportionally more than a fixed one, and proportionally
  // less than human burstiness. A cliff would invite tuning to just clear it.
  let seed = 3;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  let at = 0;
  const jittered = Array.from({ length: 20 }, () => {
    at += 30_000 * (0.8 + random() * 0.4);
    return { at, scope: 'work' };
  });

  const credit = positiveCredit(jittered);
  assert.ok(credit > 0 && credit < 1, `expected partial credit, got ${credit}`);
});

test('D55: too little history earns full credit, because absence is not evidence', () => {
  assert.equal(positiveCredit([]), 1);
  assert.equal(
    positiveCredit(Array.from({ length: 4 }, (_, i) => ({ at: i * 1000, scope: 'a' }))),
    1,
  );
});
