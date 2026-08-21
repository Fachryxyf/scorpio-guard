import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SIGNAL_SOURCES,
  SIGNAL_WEIGHTS,
  WEAK_SIGNALS,
  isWeakSignal,
  signalMass,
  signalsBySource,
  SIGNAL_MASS_CAP,
} from './signals.ts';
import { DEFAULT_POLICY, DEFAULT_WEIGHTS } from './policy.ts';

test('D42: the catalogue covers every source it claims to enumerate', () => {
  const grouped = signalsBySource();
  for (const source of SIGNAL_SOURCES) {
    assert.ok(
      grouped[source].length > 0,
      `source "${source}" is declared but has no signal: the enumeration is not closed`,
    );
  }
});

test('D42: ids are unique, and every signal states an innocent cause', () => {
  const ids = new Set(WEAK_SIGNALS.map((signal) => signal.id));
  assert.equal(ids.size, WEAK_SIGNALS.length, 'duplicate signal id');

  for (const signal of WEAK_SIGNALS) {
    assert.ok(signal.innocentCause.length > 0, `${signal.id} claims no false-positive path`);
    // A threshold in the catalogue is the exact target §7 says not to publish.
    assert.doesNotMatch(
      signal.measures,
      /\d+\s*(ms|px|%)/,
      `${signal.id} publishes a threshold; measure the shape, not the number`,
    );
  }
});

test('D42: weights are ordered, and the faintest is weaker than one weak observation', () => {
  assert.ok(SIGNAL_WEIGHTS.faint < SIGNAL_WEIGHTS.notable);
  assert.ok(SIGNAL_WEIGHTS.notable < SIGNAL_WEIGHTS.pronounced);
  assert.ok(SIGNAL_WEIGHTS.faint < DEFAULT_WEIGHTS.weak);
});

test('D42: signals combine by summation, so a second signal never weakens the first', () => {
  const one = signalMass(['SIG_OFF_WINDOW_ACCESS']);
  const two = signalMass(['SIG_OFF_WINDOW_ACCESS', 'SIG_IMMEDIATE_REPEAT']);
  assert.ok(two > one);
});

test('D42: repeated ids count once, and unknown ids are ignored rather than guessed at', () => {
  const once = signalMass(['SIG_REPEATED_PATTERN']);
  assert.equal(signalMass(['SIG_REPEATED_PATTERN', 'SIG_REPEATED_PATTERN']), once);
  assert.equal(signalMass(['SIG_INVENTED_BY_A_HOST']), 0);
  assert.equal(signalMass([]), 0);
});

test('D42: no pile of measurements outweighs one weak observation', () => {
  const everything = signalMass(WEAK_SIGNALS.map((signal) => signal.id));
  assert.equal(everything, SIGNAL_MASS_CAP);
  assert.equal(SIGNAL_MASS_CAP, DEFAULT_WEIGHTS.weak);
});

test('D42: tripping the whole catalogue at once cannot leave the unknown stage', () => {
  // The numeric form of "never a standalone trigger": prior mass plus everything
  // the catalogue can contribute in one interaction still sits below `developingAt`,
  // where the trust dimension asks for nothing at all (D40).
  const prior = 2;
  assert.ok(prior + SIGNAL_MASS_CAP < DEFAULT_POLICY.developingAt);
});

test('D42: the guard recognises exactly the published ids', () => {
  for (const signal of WEAK_SIGNALS) assert.ok(isWeakSignal(signal.id));
  assert.ok(!isWeakSignal('SIG_MADE_UP'));
  assert.ok(!isWeakSignal(null));
});

test('D42: signals the feature space already computes are marked as such', () => {
  const computed = WEAK_SIGNALS.filter((signal) => signal.computed).map((signal) => signal.id);
  // D36 derives entropy, gap CV and immediate repeats; nothing else is automatic yet.
  assert.deepEqual(computed.sort(), [
    'SIG_IMMEDIATE_REPEAT',
    'SIG_REPEATED_PATTERN',
    'SIG_UNIFORM_DELAY_SHAPE',
  ]);
});
