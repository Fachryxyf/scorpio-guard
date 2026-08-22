import test from 'node:test';
import assert from 'node:assert/strict';

import { measureLatency, checkAccessWindow } from './timing.ts';
import { trackBreadth, assessSensitiveTargets } from './target.ts';
import { checkSequence, checkEnvironment } from './sequence.ts';
import { collectSignalIds } from './signals.ts';

test('D42: subhuman latency detected below floor', () => {
  const fast = measureLatency(1000, { floorMs: 500, now: () => 1200 });
  assert.equal(fast.subhuman, true);
  assert.equal(fast.durationMs, 200);

  const human = measureLatency(1000, { floorMs: 500, now: () => 3000 });
  assert.equal(human.subhuman, false);
});

test('D42: access window respects normal hours', () => {
  // 3am with normal hours 8-20
  const night = checkAccessWindow({
    normalStart: 8,
    normalEnd: 20,
    now: () => new Date(2026, 0, 1, 3, 0).getTime(),
  });
  assert.equal(night.offWindow, true);
  assert.equal(night.hour, 3);

  const day = checkAccessWindow({
    normalStart: 8,
    normalEnd: 20,
    now: () => new Date(2026, 0, 1, 14, 0).getTime(),
  });
  assert.equal(day.offWindow, false);
});

test('D42: breadth tracks distinct records', () => {
  const tracker = trackBreadth({ maxDistinctRecords: 5 });
  for (let i = 0; i < 3; i++) tracker.record(`rec-${i}`);
  assert.equal(tracker.observation().broad, false);
  assert.equal(tracker.observation().distinctRecords, 3);

  for (let i = 3; i < 10; i++) tracker.record(`rec-${i}`);
  assert.equal(tracker.observation().broad, true);
});

test('D42: breadth dedupes repeated records', () => {
  const tracker = trackBreadth({ maxDistinctRecords: 5 });
  for (let i = 0; i < 20; i++) tracker.record('same-record');
  assert.equal(tracker.observation().distinctRecords, 1);
  assert.equal(tracker.observation().broad, false);
});

test('D42: sensitive target ratio over visited scopes', () => {
  const result = assessSensitiveTargets(['admin', 'admin', 'home', 'admin'], {
    sensitiveScopes: ['admin'],
    maxSensitiveRatio: 0.5,
  });
  assert.equal(result.concentrated, true);
  assert.equal(result.sensitiveRatio, 0.75);

  const spread = assessSensitiveTargets(['home', 'about', 'admin', 'contact'], {
    sensitiveScopes: ['admin'],
    maxSensitiveRatio: 0.5,
  });
  assert.equal(spread.concentrated, false);
});

test('D42: empty visited scopes are not concentrated', () => {
  const result = assessSensitiveTargets([], {
    sensitiveScopes: ['admin'],
    maxSensitiveRatio: 0.5,
  });
  assert.equal(result.concentrated, false);
  assert.equal(result.sensitiveRatio, 0);
});

test('D42: sequence novelty against known transitions', () => {
  const known = new Set(['cart>address', 'address>payment']);
  assert.equal(checkSequence('cart', 'address', known).novel, false);
  assert.equal(checkSequence('cart', 'payment', known).novel, true);
  assert.equal(checkSequence('cart', 'payment', known).transition, 'cart>payment');
});

test('D42: environment mismatch when declared modality never appears', () => {
  const mismatch = checkEnvironment({
    platform: 'mobile',
    touchCapable: true,
    pointerObserved: false,
  });
  assert.equal(mismatch.mismatch, true);
  assert.ok(mismatch.reasons.length > 0);

  const consistent = checkEnvironment({
    platform: 'mobile',
    touchCapable: true,
    pointerObserved: true,
  });
  assert.equal(consistent.mismatch, false);
});

test('D42: no input modality at all is a mismatch', () => {
  const none = checkEnvironment({
    touchCapable: false,
    pointerObserved: false,
    keyboardObserved: false,
  });
  assert.equal(none.mismatch, true);
});

test('D42: aggregator maps observations to catalogue ids', () => {
  const ids = collectSignalIds({
    latency: { subhuman: true, durationMs: 50 },
    breadth: { broad: true, distinctRecords: 100 },
    sequence: { novel: true, transition: 'a>b' },
  });
  assert.ok(ids.includes('SIG_SUBHUMAN_LATENCY'));
  assert.ok(ids.includes('SIG_BREADTH_OF_TARGET'));
  assert.ok(ids.includes('SIG_UNUSUAL_SEQUENCE'));
  assert.equal(ids.length, 3, 'only fired signals are reported');
});

test('D42: aggregator derives server-side signals from behavior features', () => {
  const ids = collectSignalIds({
    behavior: {
      count: 10,
      distinctScopes: 1,
      scopeEntropy: 0,
      interArrivalCv: 0.02,
      meanGapMs: 1000,
      immediateRepeatRatio: 1,
    },
  });
  assert.ok(ids.includes('SIG_UNIFORM_DELAY_SHAPE'));
  assert.ok(ids.includes('SIG_REPEATED_PATTERN'));
  assert.ok(ids.includes('SIG_IMMEDIATE_REPEAT'));
});

test('D42: aggregator reports nothing when nothing fired', () => {
  assert.deepEqual(collectSignalIds({}), []);
});
