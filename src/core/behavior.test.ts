import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DIVERSITY,
  behaviorFeatures,
  diversityConcurs,
  pushObservation,
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
