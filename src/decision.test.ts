import test from 'node:test';
import assert from 'node:assert/strict';

import { DECISIONS, severity, strongest } from './decision.ts';
import { isSymptom, SYMPTOMS } from './symptoms.ts';

test('the spectrum is ordered from least to most interventionist', () => {
  for (let i = 1; i < DECISIONS.length; i += 1) {
    assert.ok(severity(DECISIONS[i]!) > severity(DECISIONS[i - 1]!));
  }
});

test('an empty advisory set defaults to ALLOW, not to punishment', () => {
  assert.equal(strongest([]), 'ALLOW');
});

test('the strongest advice wins rather than being averaged away', () => {
  assert.equal(strongest(['ALLOW', 'RESTRICT', 'OBSERVE']), 'RESTRICT');
  assert.equal(strongest(['ALLOW', 'ALLOW']), 'ALLOW');
  assert.equal(strongest(['BLOCK', 'ALLOW']), 'BLOCK');
});

test('unknown symptom tokens are rejected at the trust boundary', () => {
  for (const symptom of SYMPTOMS) assert.ok(isSymptom(symptom));
  assert.ok(!isSymptom('SYM_MADE_UP'));
  assert.ok(!isSymptom(null));
  assert.ok(!isSymptom(0));
});
