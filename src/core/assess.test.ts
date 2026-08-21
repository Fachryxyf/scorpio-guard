import test from 'node:test';
import assert from 'node:assert/strict';

import { assessTrust, trustBand, uncertaintyLevel } from './assess.ts';

test('D5: trust band boundaries are inclusive at the lower edge', () => {
  assert.equal(trustBand(1), 'trusted');
  assert.equal(trustBand(0.8), 'trusted');
  assert.equal(trustBand(0.7999), 'observe');
  assert.equal(trustBand(0.6), 'observe');
  assert.equal(trustBand(0.4), 'friction');
  assert.equal(trustBand(0.2), 'restrict');
  assert.equal(trustBand(0.1999), 'deny');
  assert.equal(trustBand(0), 'deny');
});

test('D5: uncertainty band boundaries are inclusive at the upper edge', () => {
  assert.equal(uncertaintyLevel(0), 'low');
  assert.equal(uncertaintyLevel(0.02), 'low');
  assert.equal(uncertaintyLevel(0.0201), 'medium');
  assert.equal(uncertaintyLevel(0.05), 'medium');
  assert.equal(uncertaintyLevel(0.0501), 'high');
  assert.equal(uncertaintyLevel(1 / 12), 'high');
});

test('D5: high uncertainty caps treatment at INCREASE_FRICTION', () => {
  // A fresh entity: friction band, high variance.
  const fresh = assessTrust(0.5, 1 / 12);
  assert.equal(fresh.uncertainty, 'high');
  assert.equal(fresh.decision, 'INCREASE_FRICTION');

  // Deny band, but still uncertain: must not reach BLOCK.
  const uncertainDeny = assessTrust(0.1, 0.06);
  assert.equal(uncertainDeny.band, 'deny');
  assert.equal(uncertainDeny.proposed, 'BLOCK');
  assert.equal(uncertainDeny.decision, 'INCREASE_FRICTION');
  assert.equal(uncertainDeny.capped, true);
});

test('D5: an unknown entity can never be restricted or denied', () => {
  const fresh = assessTrust(0.5, 1 / 12);
  assert.ok(
    fresh.decision !== 'RESTRICT' && fresh.decision !== 'BLOCK',
    'unknown must not be treated as untrusted',
  );
});

test('D4/D5: one strong negative on a new entity cannot reach RESTRICT', () => {
  // Mass (0, 2) gives E[p] = 0.25, Var = 0.0375 — restrict band, medium
  // uncertainty. The cap is what keeps a single observation from restricting.
  const once = assessTrust(0.25, 0.0375);
  assert.equal(once.band, 'restrict');
  assert.equal(once.proposed, 'RESTRICT');
  assert.equal(once.uncertainty, 'medium');
  assert.equal(once.decision, 'INCREASE_FRICTION');
  assert.equal(once.capped, true);
});

test('D37: low variance alone does not unlock the full decision space', () => {
  // Sustained negatives: E[p] = 0.1 at Var = 0.0082, low uncertainty.
  const noAnomalyData = assessTrust(0.1, 0.0082);
  assert.equal(noAnomalyData.uncertainty, 'low');
  assert.equal(noAnomalyData.decision, 'INCREASE_FRICTION');
  assert.match(noAnomalyData.reason, /D37/);

  const monotonous = assessTrust(0.1, 0.0082, { anomalyConcurs: false });
  assert.equal(monotonous.decision, 'INCREASE_FRICTION');
  assert.match(monotonous.reason, /not diverse enough/);

  const diverse = assessTrust(0.1, 0.0082, { anomalyConcurs: true });
  assert.equal(diverse.decision, 'BLOCK');
  assert.equal(diverse.capped, false);
});

test('D37: the host may opt into escalating without anomaly data', () => {
  const optedIn = assessTrust(0.1, 0.0082, { allowEscalationWithoutAnomaly: true });
  assert.equal(optedIn.decision, 'BLOCK');

  // An explicit anomaly verdict still overrides the opt-in.
  const contradicted = assessTrust(0.1, 0.0082, {
    allowEscalationWithoutAnomaly: true,
    anomalyConcurs: false,
  });
  assert.equal(contradicted.decision, 'INCREASE_FRICTION');
});

test('D37: a saturated farming entity gains nothing from its volume', () => {
  // High-frequency uniform traffic: E[p] near 1 at very low variance.
  const farmed = assessTrust(0.98, 0.0004, { anomalyConcurs: false });
  assert.equal(farmed.uncertainty, 'low');
  // ALLOW is below the ceiling, so nothing is capped — the guard against farming
  // matters for escalation, and a trusted entity was never being escalated.
  assert.equal(farmed.decision, 'ALLOW');
  assert.equal(farmed.capped, false);
});

test('D14: the assessment is advice and always explains itself', () => {
  for (const [mean, variance] of [[0.9, 0.005], [0.5, 0.08], [0.1, 0.008], [0.25, 0.0375]] as const) {
    const result = assessTrust(mean, variance);
    assert.ok(result.reason.length > 0, 'every decision must carry a reason (D23)');
    assert.equal(result.mean, mean);
    assert.equal(result.variance, variance);
  }
});
