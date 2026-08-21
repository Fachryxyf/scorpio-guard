import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkInvariants,
  hardViolations,
  softViolationMass,
  softViolations,
  type Invariant,
} from './constraints.ts';
import { DEFAULT_WEIGHTS } from './policy.ts';
import { transitionGraph } from './transitions.ts';

const checkout = transitionGraph({
  id: 'checkout-order',
  scope: 'checkout',
  strength: 'hard',
  allowed: [
    { from: 'cart', to: 'address' },
    { from: 'address', to: 'payment' },
    { from: 'payment', to: 'confirm' },
  ],
});

test('D16: a declared transition graph is set membership, not scoring', () => {
  const legit = checkInvariants({ from: 'cart', to: 'address' }, 'checkout', [checkout]);
  assert.equal(legit.violations.length, 0);

  const jump = checkInvariants({ from: 'cart', to: 'confirm' }, 'checkout', [checkout]);
  assert.equal(jump.violations.length, 1);
  assert.equal(jump.violations[0]?.class, 'IMPOSSIBLE_STATE_TRANSITION');
});

test('D32: outside every declared scope, behavior is unknown rather than forbidden', () => {
  // The same illegal-looking edge, observed in a scope nobody declared.
  const result = checkInvariants({ from: 'cart', to: 'confirm' }, 'navigation', [checkout]);
  assert.equal(result.declared, false);
  assert.equal(result.violations.length, 0, 'an undeclared scope must not manufacture violations');
});

test('D32: the closed-world reading applies only inside a declared scope', () => {
  const inside = checkInvariants({ from: 'payment', to: 'cart' }, 'checkout', [checkout]);
  assert.equal(inside.declared, true);
  assert.equal(inside.violations.length, 1, 'unlisted edge inside a hard scope is a violation');
});

test('D32: strength is per constraint, so scopes can differ in confidence', () => {
  const navigation = transitionGraph({
    id: 'navigation-order',
    scope: 'navigation',
    strength: 'soft',
    allowed: [{ from: 'home', to: 'search' }],
  });

  const all = [checkout, navigation];

  const hardScope = checkInvariants({ from: 'cart', to: 'confirm' }, 'checkout', all);
  assert.equal(hardViolations(hardScope.violations).length, 1);
  assert.equal(softViolations(hardScope.violations).length, 0);

  const softScope = checkInvariants({ from: 'home', to: 'checkout' }, 'navigation', all);
  assert.equal(hardViolations(softScope.violations).length, 0);
  assert.equal(softViolations(softScope.violations).length, 1);
});

test('D13: an invariant ignores observations it does not describe', () => {
  const notATransition = checkInvariants({ clicks: 3 }, 'checkout', [checkout]);
  assert.equal(notATransition.violations.length, 0);
});

test('D23: a violation names the invariant, class, strength and scope', () => {
  const result = checkInvariants({ from: 'cart', to: 'payment' }, 'checkout', [checkout]);
  assert.deepEqual(result.violations[0], {
    invariant: 'checkout-order',
    class: 'IMPOSSIBLE_STATE_TRANSITION',
    strength: 'hard',
    scope: 'checkout',
  });
});

test('D16: several invariants may cover one scope, and all are consulted', () => {
  const alwaysFails: Invariant = {
    id: 'idle-action',
    class: 'IMPOSSIBLE_IDLE_ACTION',
    strength: 'hard',
    scope: 'checkout',
    holds: () => false,
  };

  const result = checkInvariants({ from: 'cart', to: 'confirm' }, 'checkout', [checkout, alwaysFails]);
  assert.equal(result.violations.length, 2);
  assert.deepEqual(
    result.violations.map((violation) => violation.class).sort(),
    ['IMPOSSIBLE_IDLE_ACTION', 'IMPOSSIBLE_STATE_TRANSITION'],
  );
});

test('D38: soft violations become strong negative mass; hard ones contribute none', () => {
  const soft = transitionGraph({
    id: 'nav',
    scope: 'navigation',
    strength: 'soft',
    allowed: [{ from: 'home', to: 'search' }],
  });

  const softResult = checkInvariants({ from: 'home', to: 'admin' }, 'navigation', [soft]);
  assert.equal(softViolationMass(softResult.violations), DEFAULT_WEIGHTS.strong);

  const hardResult = checkInvariants({ from: 'cart', to: 'confirm' }, 'checkout', [checkout]);
  assert.equal(
    softViolationMass(hardResult.violations),
    0,
    'a proof must not become decaying evidence mass (D15)',
  );
});

test('D38: mass scales with the number of soft violations and honours policy', () => {
  const two: readonly Invariant[] = [
    { id: 'a', class: 'IMPOSSIBLE_TEMPORAL_ORDER', strength: 'soft', scope: 's', holds: () => false },
    { id: 'b', class: 'IMPOSSIBLE_ACTION_PREREQUISITE', strength: 'soft', scope: 's', holds: () => false },
  ];

  const result = checkInvariants({}, 's', two);
  assert.equal(softViolationMass(result.violations), 2 * DEFAULT_WEIGHTS.strong);
  assert.equal(softViolationMass(result.violations, 0.5), 1);
});
