/**
 * Compute every number the site publishes. D58.
 *
 * The site used to carry hand-copied figures, which is a slow-motion lie: the code
 * moves and the page does not. Everything quantitative in `index.html` is generated
 * from here, so a threshold change either shows up on the page or breaks this script.
 *
 *   node --experimental-strip-types scripts/research.mjs > /tmp/research.json
 *
 * Sections map one-to-one onto the site's results chapter. Where a number is a
 * measurement rather than a property of the model, the source run is named.
 */
import { createGuard } from '../src/core/guard.ts';
import {
  decayFactor,
  expectedTrust,
  uncertainty,
  evidenceMass,
  applyEvidence,
  freshState,
} from '../src/core/trust.ts';
import {
  DEFAULT_EPISTEMIC_STAGES,
  DEFAULT_HALF_LIFE_HOURS,
  DEFAULT_POLICY,
  DEFAULT_RETENTION_HOURS,
  DEFAULT_TRUST_BANDS,
  DEFAULT_UNCERTAINTY_BANDS,
  DEFAULT_WEIGHTS,
} from '../src/core/policy.ts';
import { DEFAULT_DIVERSITY, DEFAULT_VELOCITY, DEFAULT_WINDOW_SIZE } from '../src/core/behavior.ts';
import { DEFAULT_ANOMALY_WEIGHTS, DEFAULT_REFERENCE } from '../src/core/anomaly.ts';
import { WEAK_SIGNALS, SIGNAL_WEIGHTS, SIGNAL_MASS_CAP } from '../src/core/signals.ts';
import { CONSTRAINT_CLASSES, PROOF_SOURCE_OF } from '../src/core/constraints.ts';
import { DECISIONS } from '../src/core/decision.ts';
import {
  SYMPTOM_CATEGORIES,
  SYMPTOM_DETAILS,
  SYMPTOM_SCHEMA_VERSION,
} from '../src/core/symptoms.ts';
import { ENTITY_BUCKETS, PROTOCOL_VERSION } from '../src/core/protocol.ts';

import { replayAll } from '../examples/harness/replay.ts';
import { burstyGap, seeded } from '../examples/harness/persona.ts';
import { ixfeInvariants } from '../examples/ixfe/invariants.ts';
import { IXFE_ADVERSARIES, IXFE_LEGITIMATE } from '../examples/ixfe/personas.ts';
import { healthmeInvariants } from '../examples/healthme/invariants.ts';
import {
  ADVERSARY_PERSONAS,
  LEGITIMATE_PERSONAS,
  churningBruteForce,
} from '../examples/healthme/personas.ts';

const HOUR = 3_600_000;
const round = (value, places = 4) => Number(value.toFixed(places));

/* ------------------------------------------------------------------ *
 * 1. The model as declared. Not measured — read off the code.
 * ------------------------------------------------------------------ */

const parameters = {
  halfLifeHours: DEFAULT_HALF_LIFE_HOURS,
  retentionHours: DEFAULT_RETENTION_HOURS,
  weights: { ...DEFAULT_WEIGHTS },
  softViolationWeight: DEFAULT_POLICY.softViolationWeight,
  windowSize: DEFAULT_WINDOW_SIZE,
  signalMassCap: SIGNAL_MASS_CAP,
  signalWeights: { ...SIGNAL_WEIGHTS },
  trustBands: DEFAULT_TRUST_BANDS.map((entry) => ({ ...entry })),
  uncertaintyBands: DEFAULT_UNCERTAINTY_BANDS.map((entry) => ({
    level: entry.level,
    atMost: entry.atMost === Infinity ? null : entry.atMost,
  })),
  epistemicStages: DEFAULT_EPISTEMIC_STAGES.map((entry) => ({ ...entry })),
  diversity: { ...DEFAULT_DIVERSITY },
  velocity: { ...DEFAULT_VELOCITY },
  anomalyReference: { ...DEFAULT_REFERENCE },
  anomalyWeights: { ...DEFAULT_ANOMALY_WEIGHTS },
  decisions: [...DECISIONS],
  protocolVersion: PROTOCOL_VERSION,
  symptomSchema: SYMPTOM_SCHEMA_VERSION,
  entityBuckets: [...ENTITY_BUCKETS],
  symptoms: SYMPTOM_CATEGORIES.map((category) => ({
    category,
    details: [...SYMPTOM_DETAILS[category]],
  })),
  constraintClasses: CONSTRAINT_CLASSES.map((cls) => ({ class: cls, source: PROOF_SOURCE_OF[cls] })),
  signals: WEAK_SIGNALS.map((signal) => ({
    id: signal.id,
    source: signal.source,
    weight: signal.weight,
    mass: SIGNAL_WEIGHTS[signal.weight],
    computed: signal.computed,
    measures: signal.measures,
    innocentCause: signal.innocentCause,
  })),
};

/* ------------------------------------------------------------------ *
 * 2. The prior, and what one observation is worth.
 * ------------------------------------------------------------------ */

const fresh = freshState(0);
const prior = {
  mean: round(expectedTrust(fresh, 0)),
  variance: round(uncertainty(fresh, 0), 6),
  mass: round(evidenceMass(fresh, 0), 2),
};

/** One observation of each kind, applied to a fresh entity. */
const singleObservation = [
  ['one weak positive', { positive: DEFAULT_WEIGHTS.weak }],
  ['one strong positive', { positive: DEFAULT_WEIGHTS.strong }],
  ['one weak negative', { negative: DEFAULT_WEIGHTS.weak }],
  ['one strong negative', { negative: DEFAULT_WEIGHTS.strong }],
  ['every weak signal at once', { negative: SIGNAL_MASS_CAP }],
].map(([label, evidence]) => {
  const state = applyEvidence(fresh, evidence, 0);
  return {
    label,
    mean: round(expectedTrust(state, 0)),
    variance: round(uncertainty(state, 0), 6),
    mass: round(evidenceMass(state, 0), 2),
  };
});

/* ------------------------------------------------------------------ *
 * 3. Decay, and the mass bound it implies.
 * ------------------------------------------------------------------ */

const decayCurve = [];
for (let hours = 0; hours <= 72; hours += 1) {
  decayCurve.push({ hours, factor: round(decayFactor(hours * HOUR)) });
}

/**
 * `applyEvidence` decays before adding, so mass converges rather than growing.
 *
 *     m_inf = w / (1 - 2^(-T/H))
 *
 * Reported alongside a simulation of 500 arrivals, because a closed form that does
 * not match the code it describes is worse than no closed form.
 */
const massBound = [1, 6, 24, 72].map((intervalHours) => {
  const w = DEFAULT_WEIGHTS.weak;
  const lambda = decayFactor(intervalHours * HOUR);
  const closedForm = w / (1 - lambda);

  let state = fresh;
  let t = 0;
  for (let i = 0; i < 500; i += 1) {
    t += intervalHours * HOUR;
    state = applyEvidence(state, { positive: w }, t);
  }
  return {
    intervalHours,
    lambda: round(lambda),
    closedForm: round(closedForm, 3),
    simulated: round(state.a, 3),
    ceilingMean: round(expectedTrust(state, t)),
  };
});

/* ------------------------------------------------------------------ *
 * 4. Trajectories. What accumulation actually looks like.
 * ------------------------------------------------------------------ */

async function trajectory(label, options) {
  let now = 0;
  const random = seeded(11071996);
  const guard = createGuard({ clock: { now: () => now } });
  const points = [];
  for (let i = 0; i < options.steps; i += 1) {
    const assessment = await guard.evaluate({
      entity: 'e',
      observation: {
        scope: `scope-${i % options.scopes}`,
        evidence: options.evidence,
      },
    });
    points.push({
      n: i + 1,
      mean: round(assessment.trust.mean),
      variance: round(assessment.trust.variance, 6),
      mass: round(assessment.trust.mass, 2),
      stage: assessment.trust.stage,
      decision: assessment.decision,
      cv: round(assessment.behavior.interArrivalCv, 3),
    });
    now += options.bursty
      ? Math.round(burstyGap(random, options.gapHours * HOUR))
      : options.gapHours * HOUR;
  }
  return {
    label,
    gapHours: options.gapHours,
    scopes: options.scopes,
    bursty: options.bursty === true,
    points,
  };
}

const trajectories = [
  await trajectory('honest', {
    steps: 20,
    scopes: 3,
    evidence: { positive: 'weak' },
    gapHours: 1,
    bursty: true,
  }),
  await trajectory('adversary', { steps: 20, scopes: 1, evidence: { negative: 'weak' }, gapHours: 0.5 }),
  // Same positives, same rate, gaps perfectly regular. The gap between this line and
  // the honest one is the intake discount (D55), drawn rather than asserted.
  await trajectory('regular-positive', {
    steps: 20,
    scopes: 1,
    evidence: { positive: 'weak' },
    gapHours: 1,
  }),
];

/** The first step at which each decision rung is reached, per trajectory. */
const firstReached = trajectories.map((run) => {
  const seen = {};
  for (const point of run.points) {
    if (!(point.decision in seen)) seen[point.decision] = point.n;
  }
  return { label: run.label, firstReached: seen };
});

/* ------------------------------------------------------------------ *
 * 5. The cost of a memory: how much honest history buys.
 * ------------------------------------------------------------------ */

const ABUSE_LIMIT = 200;

/**
 * The rung being counted to.
 *
 * `INCREASE_FRICTION`, not `RESTRICT`, and the first draft of this script got it
 * wrong: it counted to `RESTRICT` and reported that farming was never answered at
 * all. It is — but `RESTRICT` needs low uncertainty, low uncertainty needs anomaly
 * concurrence (D37), and an entity hammering one scope monotonously never concurs.
 * So a bot is held at `INCREASE_FRICTION` *because* it behaves mechanically, which
 * is the tradeoff D49 recorded rather than a failure to escalate.
 *
 * `INCREASE_FRICTION` is also the honest line for both readings: it is the first
 * rung a legitimate user would actually feel, so it is simultaneously the
 * false-positive line and the line at which abuse starts to cost something. Same
 * constant as `FELT` in the replay harness.
 */
const FELT = 'INCREASE_FRICTION';
const feltOrWorse = (decision) => DECISIONS.indexOf(decision) >= DECISIONS.indexOf(FELT);

/**
 * Build trust with `days` of honest use, then abuse it, and count how many abuse
 * calls it takes before the entity feels anything.
 *
 * Two things had to be fixed before this measured what it claimed, and both are
 * worth recording because each produced a confident wrong number first.
 *
 * 1. **The gaps must be bursty.** The first version used a fixed 1.5-hour interval
 *    and reported that ten honest days bought *less* trust than one. That is D55
 *    working exactly as designed: a perfectly regular positive earns partial credit,
 *    so a fixed-interval "honest user" is a farmer by the model's own definition.
 *    Human activity is bursty (D54), so the honest case has to be generated that way.
 *
 * 2. **It must be run across seeds.** One seed produces a clean-looking monotonic
 *    table, and the monotonicity is an artifact. Ten seeds show the real shape.
 */
async function headStart(days, seed, callsPerDay = 8) {
  let now = 0;
  const random = seeded(seed);
  const guard = createGuard({ clock: { now: () => now } });

  for (let day = 0; day < days; day += 1) {
    for (let call = 0; call < callsPerDay; call += 1) {
      await guard.evaluate({
        entity: 'e',
        observation: { scope: `scope-${call % 3}`, evidence: { positive: 'weak' } },
      });
      now += Math.round(burstyGap(random, 1.5 * HOUR));
    }
  }

  const before = await guard.evaluate({ entity: 'e', observation: { scope: 'scope-0' } });
  let abuse = null;
  for (let i = 1; i <= ABUSE_LIMIT; i += 1) {
    now += 2000;
    const result = await guard.evaluate({
      entity: 'e',
      observation: { scope: 'scope-0', evidence: { negative: 'strong' } },
    });
    if (feltOrWorse(result.decision)) {
      abuse = i;
      break;
    }
  }
  return { mean: before.trust.mean, mass: before.trust.mass, calls: abuse };
}

const SEEDS = 10;
const headStarts = [];
for (const days of [0, 1, 2, 3, 5, 10, 20, 30]) {
  const runs = [];
  for (let seed = 0; seed < SEEDS; seed += 1) {
    runs.push(await headStart(days, 7919 * (seed + 1) + days));
  }
  const calls = runs.map((run) => run.calls).sort((a, b) => a - b);
  const means = runs.map((run) => run.mean);
  headStarts.push({
    days,
    seeds: SEEDS,
    meanBefore: round(means.reduce((a, b) => a + b, 0) / SEEDS),
    massBefore: round(runs.reduce((a, run) => a + run.mass, 0) / SEEDS, 2),
    callsMedian: calls[Math.floor(SEEDS / 2)],
    callsMin: calls[0],
    callsMax: calls[SEEDS - 1],
  });
}

/* ------------------------------------------------------------------ *
 * 6. The intake discount. D55, measured again here so the page cannot drift.
 * ------------------------------------------------------------------ */

/**
 * Farm `count` positives at a fixed gap, then abuse. With the D55 discount on, a
 * regular gap earns partial credit, so the farm buys less.
 */
async function farmer(gapMinutes, options = {}) {
  const gapMs = gapMinutes * 60_000;
  let now = 0;
  const guard = createGuard({
    clock: { now: () => now },
    ...(options.discount === false ? { discountRegularPositives: false } : {}),
  });

  for (let i = 0; i < 200; i += 1) {
    await guard.evaluate({
      entity: 'e',
      observation: { scope: 'scope-0', evidence: { positive: 'weak' } },
    });
    now += gapMs;
  }
  const farmed = await guard.evaluate({ entity: 'e', observation: { scope: 'scope-0' } });

  let abuse = null;
  for (let i = 1; i <= ABUSE_LIMIT; i += 1) {
    now += 2000;
    const result = await guard.evaluate({
      entity: 'e',
      observation: { scope: 'scope-0', evidence: { negative: 'strong' } },
    });
    if (feltOrWorse(result.decision)) {
      abuse = i;
      break;
    }
  }
  return {
    gapMinutes,
    meanAfterFarming: round(farmed.trust.mean),
    massAfterFarming: round(farmed.trust.mass, 1),
    abuseCallsToFelt: abuse,
  };
}

const farming = [];
for (const gap of [0.5, 10, 30]) {
  farming.push({
    gapMinutes: gap,
    withoutDiscount: await farmer(gap, { discount: false }),
    withDiscount: await farmer(gap),
  });
}

/**
 * The innocent case the discount must not break: clients that are regular by
 * definition and only ever earn positives.
 */
async function automatedClient(label, gapSeconds) {
  let now = 0;
  const guard = createGuard({ clock: { now: () => now } });
  let worst = 'ALLOW';
  const severity = (decision) => DECISIONS.indexOf(decision);
  let last;
  for (let i = 0; i < 60; i += 1) {
    last = await guard.evaluate({
      entity: 'e',
      observation: { scope: 'scope-0', evidence: { positive: 'weak' } },
    });
    if (severity(last.decision) > severity(worst)) worst = last.decision;
    now += gapSeconds * 1000;
  }
  return { label, gapSeconds, worst, finalMean: round(last.trust.mean) };
}

const automation = [
  await automatedClient('polling widget', 60),
  await automatedClient('monitoring probe', 30),
  await automatedClient('integration suite', 2),
  await automatedClient('cron', 15 * 60),
];

/* ------------------------------------------------------------------ *
 * 7. Persona replay. The falsification harness, as a table.
 * ------------------------------------------------------------------ */

function summarisePersonas(results) {
  return results.map((result) => ({
    persona: result.persona,
    legitimate: result.legitimate,
    what: result.what,
    steps: result.steps,
    worst: result.worst,
    worstAtStep: result.worstAtStep ?? null,
    finalStage: result.finalStage,
    finalMean: round(result.finalMean),
    peakAnomaly: result.peakAnomaly === undefined ? null : round(result.peakAnomaly),
    farmingSeen: result.farmingSeen,
    falsePositive: result.falsePositive,
    walkedThrough: result.walkedThrough,
  }));
}

const ixfeResults = await replayAll([...IXFE_LEGITIMATE, ...IXFE_ADVERSARIES], {
  invariants: ixfeInvariants,
});
const healthmeResults = await replayAll([...LEGITIMATE_PERSONAS, ...ADVERSARY_PERSONAS], {
  invariants: healthmeInvariants,
  permits: (advice) => advice !== 'RESTRICT' && advice !== 'BLOCK',
});

/** Identity churn: how few requests per identity defeats accumulation. */
const churn = [];
for (const perEntity of [1, 2, 3]) {
  const results = await replayAll(churningBruteForce(30, perEntity), {
    invariants: healthmeInvariants,
  });
  const felt = results.filter(
    (result) => result.worst !== 'ALLOW' && result.worst !== 'OBSERVE',
  ).length;
  churn.push({ perEntity, felt, total: results.length });
}

const replay = {
  ixfe: {
    personas: summarisePersonas(ixfeResults),
    falsePositives: ixfeResults.filter((result) => result.falsePositive).length,
    walkedThrough: ixfeResults.filter((result) => result.walkedThrough).length,
  },
  healthme: {
    personas: summarisePersonas(healthmeResults),
    falsePositives: healthmeResults.filter((result) => result.falsePositive).length,
    walkedThrough: healthmeResults.filter((result) => result.walkedThrough).length,
  },
  churn,
};

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      parameters,
      prior,
      singleObservation,
      decayCurve,
      massBound,
      trajectories,
      firstReached,
      headStarts,
      farming,
      automation,
      replay,
    },
    null,
    2,
  ),
);
