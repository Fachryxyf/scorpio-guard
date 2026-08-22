import test from 'node:test';
import assert from 'node:assert/strict';

import { severity } from './decision.ts';

import { assessTrust, epistemicStage, trustBand, uncertaintyLevel } from './assess.ts';

/** Mass high enough that the epistemic stage is not the binding ceiling. */
const ESTABLISHED = 20;

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

test('D5: epistemic stages are read from evidence mass n = alpha + beta', () => {
  // A fresh entity is the prior alone.
  assert.equal(epistemicStage(2), 'unknown');
  assert.equal(epistemicStage(2.5), 'unknown');
  assert.equal(epistemicStage(3), 'developing');
  assert.equal(epistemicStage(6.99), 'developing');
  assert.equal(epistemicStage(7), 'established');
  assert.equal(epistemicStage(100), 'established');
});

test('D5: an unknown entity receives nothing from the trust dimension', () => {
  // This is the D39 contradiction, resolved: E[p] = 0.5 sits in the friction
  // band, but with no evidence the trust dimension has no standing to ask for it.
  const fresh = assessTrust(0.5, 1 / 12, 2);

  assert.equal(fresh.stage, 'unknown');
  assert.equal(fresh.band, 'friction');
  assert.equal(fresh.proposed, 'INCREASE_FRICTION');
  assert.equal(fresh.decision, 'ALLOW');
  assert.equal(fresh.capped, true);
  assert.match(fresh.reason, /lack of evidence is not evidence of distrust/);
});

test('D5: lack of evidence and balanced evidence are not the same state', () => {
  const noEvidence = assessTrust(0.5, 1 / 12, 2);
  const balanced = assessTrust(0.5, 0.0119, 22);

  assert.equal(noEvidence.mean, balanced.mean, 'both read the same mean');
  assert.notEqual(noEvidence.stage, balanced.stage);
  assert.equal(noEvidence.decision, 'ALLOW');
  assert.equal(balanced.decision, 'INCREASE_FRICTION');
});

test('D46: developing evidence may inform the host, never cost the user', () => {
  const developing = assessTrust(0.1, 0.008, 5);
  assert.equal(developing.stage, 'developing');
  assert.equal(developing.proposed, 'BLOCK');
  // OBSERVE, not INCREASE_FRICTION: friction is the first rung a legitimate user
  // feels, and the middle stage exists to influence without driving. Traffic in
  // D46 showed the old ceiling turning two mistyped PINs into friction.
  assert.equal(developing.decision, 'OBSERVE');
  assert.match(developing.reason, /developing evidence/);
});

test('D46: the unknown to developing boundary is not a cliff', () => {
  // A third observation must not be able to turn silence into something felt.
  const justUnknown = assessTrust(0.1, 0.008, 2.9);
  const justDeveloping = assessTrust(0.1, 0.008, 3);
  assert.equal(justUnknown.decision, 'ALLOW');
  assert.equal(justDeveloping.decision, 'OBSERVE');
});

test('D5: high uncertainty caps treatment even when evidence is established', () => {
  const uncertainDeny = assessTrust(0.1, 0.06, ESTABLISHED);
  assert.equal(uncertainDeny.stage, 'established');
  assert.equal(uncertainDeny.band, 'deny');
  assert.equal(uncertainDeny.proposed, 'BLOCK');
  assert.equal(uncertainDeny.decision, 'INCREASE_FRICTION');
  assert.equal(uncertainDeny.capped, true);
});

test('D5: the lowest of the three ceilings binds', () => {
  // Established mass, low variance, but anomaly withholds: friction, not BLOCK.
  const withheld = assessTrust(0.1, 0.008, ESTABLISHED, { anomalyConcurs: false });
  assert.equal(withheld.decision, 'INCREASE_FRICTION');
  assert.match(withheld.reason, /not diverse enough/);

  // Unknown mass beats every other ceiling, however tight the distribution.
  const unknown = assessTrust(0.1, 0.008, 2, { anomalyConcurs: true });
  assert.equal(unknown.decision, 'ALLOW');
  assert.match(unknown.reason, /unknown entity/);
});

test('D37: low variance alone does not unlock the full decision space', () => {
  const noAnomalyData = assessTrust(0.1, 0.0082, ESTABLISHED);
  assert.equal(noAnomalyData.uncertainty, 'low');
  assert.equal(noAnomalyData.decision, 'INCREASE_FRICTION');
  assert.match(noAnomalyData.reason, /D37/);

  const diverse = assessTrust(0.1, 0.0082, ESTABLISHED, { anomalyConcurs: true });
  assert.equal(diverse.decision, 'BLOCK');
  assert.equal(diverse.capped, false);
});

test('D37: the host may opt into escalating without anomaly data', () => {
  const optedIn = assessTrust(0.1, 0.0082, ESTABLISHED, { allowEscalationWithoutAnomaly: true });
  assert.equal(optedIn.decision, 'BLOCK');

  // An explicit anomaly verdict still overrides the opt-in.
  const contradicted = assessTrust(0.1, 0.0082, ESTABLISHED, {
    allowEscalationWithoutAnomaly: true,
    anomalyConcurs: false,
  });
  assert.equal(contradicted.decision, 'INCREASE_FRICTION');
});

test('D5: a trusted entity is never capped, since ALLOW is below every ceiling', () => {
  for (const mass of [2, 5, ESTABLISHED]) {
    const trusted = assessTrust(0.95, 0.001, mass, { anomalyConcurs: false });
    assert.equal(trusted.decision, 'ALLOW');
    assert.equal(trusted.capped, false);
  }
});

test('D23: every assessment carries its inputs and a reason', () => {
  for (const [mean, variance, mass] of [[0.9, 0.005, 20], [0.5, 0.08, 2], [0.1, 0.008, 5]] as const) {
    const result = assessTrust(mean, variance, mass);
    assert.ok(result.reason.length > 0);
    assert.equal(result.mean, mean);
    assert.equal(result.variance, variance);
    assert.equal(result.mass, mass);
  }
});

test('D49: the D37 gate cannot affect the farming case it was written for', () => {
  // Farming produces a high mean; a high mean proposes ALLOW; a ceiling can only
  // lower a decision. So the gate is unobservable for exactly the entity D37 aimed
  // at. Asserted so the claim cannot quietly drift back into the docs.
  for (const mean of [0.5, 0.6, 0.8, 0.95, 0.99]) {
    const monotonous = assessTrust(mean, 0.002, ESTABLISHED, { anomalyConcurs: false });
    const diverse = assessTrust(mean, 0.002, ESTABLISHED, { anomalyConcurs: true });
    assert.equal(
      monotonous.decision,
      diverse.decision,
      `at mean ${mean} the diversity verdict changed the outcome, which D49 says it cannot`,
    );
  }
});

test('D49: where the gate is observable, monotony earns the milder treatment', () => {
  // The mirror image of what D37 intended, and the tradeoff is real: this protects
  // a broken-but-legitimate uniform client from BLOCK, and equally protects a
  // deliberate bot from RESTRICT. Recorded as a measurement, not asserted as right.
  const monotonous = assessTrust(0.1, 0.002, ESTABLISHED, { anomalyConcurs: false });
  const diverse = assessTrust(0.1, 0.002, ESTABLISHED, { anomalyConcurs: true });

  assert.equal(monotonous.decision, 'INCREASE_FRICTION');
  assert.equal(diverse.decision, 'BLOCK');
  assert.ok(severity(monotonous.decision) < severity(diverse.decision));
});
