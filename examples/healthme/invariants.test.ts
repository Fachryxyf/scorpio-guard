import test from 'node:test';
import assert from 'node:assert/strict';

import { checkInvariants, hardViolations, softViolations } from '../../src/core/constraints.ts';
import { API_SCOPE, UNLOCK_SCOPE, healthmeInvariants } from './invariants.ts';

const unlock = (data: unknown) => checkInvariants(data, UNLOCK_SCOPE, healthmeInvariants);
const api = (data: unknown) => checkInvariants(data, API_SCOPE, healthmeInvariants);

test('the legitimate unlock path produces no violations', () => {
  for (const edge of [
    { from: 'locked', to: 'attempting' },
    { from: 'attempting', to: 'unlocked' },
    { from: 'attempting', to: 'locked' },
    { from: 'unlocked', to: 'locked' },
  ]) {
    assert.equal(unlock(edge).violations.length, 0, `${edge.from} -> ${edge.to} must be legitimate`);
  }
});

test('reaching unlocked without an attempt is an impossible segment jump', () => {
  const result = unlock({ from: 'locked', to: 'unlocked' });
  assert.equal(hardViolations(result.violations).length, 1);
  assert.equal(result.violations[0]?.class, 'IMPOSSIBLE_SEGMENT_JUMP');
});

test('calling the AI endpoint before any unlock is an impossible temporal order', () => {
  const forged = api({ state: 'locked', unlockedThisSession: false });
  assert.equal(hardViolations(forged.violations).length, 1);
  assert.equal(forged.violations[0]?.class, 'IMPOSSIBLE_TEMPORAL_ORDER');

  const legitimate = api({ state: 'unlocked', unlockedThisSession: true });
  assert.equal(legitimate.violations.length, 0);
});

test('a repeat unlock in the same session is legitimate, not a replay', () => {
  // Session restore calls handleUnlock with the stored hash. It must not read as
  // an attack, or the guard punishes the app's own reload path.
  const restored = api({ state: 'unlocked', unlockedThisSession: true, vaultLoaded: true });
  assert.equal(restored.violations.length, 0);
});

test('fetching the vault while locked skips its prerequisite', () => {
  const result = unlock({ state: 'locked', unlockedThisSession: false, vaultLoaded: true });
  assert.equal(hardViolations(result.violations).length, 1);
  assert.equal(result.violations[0]?.class, 'IMPOSSIBLE_ACTION_PREREQUISITE');
});

test('a populated field with no interaction is soft evidence, not proof', () => {
  const scripted = unlock({
    state: 'attempting',
    unlockedThisSession: false,
    fieldPopulated: true,
    interactions: 0,
  });

  assert.equal(hardViolations(scripted.violations).length, 0, 'paste and password managers exist');
  assert.equal(softViolations(scripted.violations).length, 1);
  assert.equal(scripted.violations[0]?.class, 'IMPOSSIBLE_IDLE_ACTION');
});

test('a human-typed attempt is clean', () => {
  const typed = unlock({
    state: 'attempting',
    unlockedThisSession: false,
    fieldPopulated: true,
    interactions: 6,
    lockScreenRendered: true,
  });
  assert.equal(typed.violations.length, 0);
});

test('an undeclared scope yields nothing, per D32', () => {
  const elsewhere = checkInvariants(
    { from: 'dashboard', to: 'settings' },
    'healthme.navigation',
    healthmeInvariants,
  );
  assert.equal(elsewhere.declared, false);
  assert.equal(elsewhere.violations.length, 0);
});
