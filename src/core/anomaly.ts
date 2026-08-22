/**
 * The anomaly classifier over the D36 feature space.
 *
 * D18 deferred the algorithm until the feature space settled. It has, so this is
 * the first classifier — and the choice of algorithm is itself a decision worth
 * stating.
 *
 * **Why a distance-to-reference model rather than a learned one.** A learned
 * classifier needs labelled traffic, and D34 records that none exists: what the
 * project has is generated personas (D45), which are hypotheses about behavior
 * rather than ground truth. Training on them would produce a model that has
 * learned the author's assumptions and reports them back as findings. So this
 * classifier is explicitly *not* trained. It measures distance from a declared
 * reference profile, where every number in the profile is a policy an adopter is
 * expected to change.
 *
 * That keeps the property the rest of the library has: nothing here is a
 * discovered threshold presented as a fact.
 *
 * ponytail: weighted Manhattan distance against a fixed reference, no learning.
 * Upgrade path: once IXFE's real logs are labelled, fit the reference per
 * population and keep this as the cold-start default.
 */

import type { BehaviorFeatures } from './behavior.ts';

/**
 * The reference profile: what unremarkable human traffic is assumed to look like
 * on each feature, and how much a deviation on that feature counts.
 *
 * Only features whose deviation is *interpretable* are included. `count` and
 * `meanGapMs` are deliberately absent: volume is the farming problem (D49) and
 * belongs to the velocity check, and absolute gap length is what D42 refuses to
 * publish a threshold for.
 */
export type AnomalyReference = {
  /** Expected scope entropy for varied browsing. Deviation below counts. */
  readonly scopeEntropy: number;
  /** Expected inter-arrival CV. Human traffic is bursty; deviation below counts. */
  readonly interArrivalCv: number;
  /** Expected immediate-repeat ratio. Deviation above counts. */
  readonly immediateRepeatRatio: number;
  /** Expected distinct scopes. Deviation below counts. */
  readonly distinctScopes: number;
};

export type AnomalyWeights = {
  readonly scopeEntropy: number;
  readonly interArrivalCv: number;
  readonly immediateRepeatRatio: number;
  readonly distinctScopes: number;
};

/**
 * PoC reference. Every value is a guess, chosen leniently: a wrong number here
 * under-reports rather than manufacturing a finding.
 */
export const DEFAULT_REFERENCE: AnomalyReference = {
  scopeEntropy: 0.6,
  interArrivalCv: 0.8,
  immediateRepeatRatio: 0.2,
  distinctScopes: 4,
};

/**
 * Feature weights. Ordered by how hard the feature is to fake while still
 * accomplishing something: gap *shape* is the hardest, which is why the design
 * notes single it out, so it carries the most weight.
 */
export const DEFAULT_ANOMALY_WEIGHTS: AnomalyWeights = {
  interArrivalCv: 0.4,
  scopeEntropy: 0.25,
  immediateRepeatRatio: 0.2,
  distinctScopes: 0.15,
};

/** How many observations before a score means anything. */
export const MIN_OBSERVATIONS = 4;

export type AnomalyScore = {
  /**
   * Distance from the reference profile in [0,1]. Higher is more unusual.
   * `undefined` when the window is too small to score — not the same claim as 0.
   */
  readonly score: number | undefined;
  /** Per-feature contribution, for the trace. */
  readonly contributions: Readonly<Record<keyof AnomalyReference, number>>;
  /** Which feature contributed most. `undefined` when unscored. */
  readonly dominant: keyof AnomalyReference | undefined;
};

export type AnomalyOptions = {
  readonly reference?: AnomalyReference;
  readonly weights?: AnomalyWeights;
  readonly minObservations?: number;
};

/**
 * Score behavior against the reference profile.
 *
 * One-sided per feature: only deviation in the *suspicious* direction counts.
 * Browsing more diversely than the reference is not anomalous, and a symmetric
 * distance would report it as such.
 */
export function anomalyScore(
  features: BehaviorFeatures,
  options: AnomalyOptions = {},
): AnomalyScore {
  const reference = options.reference ?? DEFAULT_REFERENCE;
  const weights = options.weights ?? DEFAULT_ANOMALY_WEIGHTS;
  const minimum = options.minObservations ?? MIN_OBSERVATIONS;

  const empty = {
    scopeEntropy: 0,
    interArrivalCv: 0,
    immediateRepeatRatio: 0,
    distinctScopes: 0,
  } as const;

  if (features.count < minimum) {
    return { score: undefined, contributions: empty, dominant: undefined };
  }

  const contributions = {
    // Below reference is suspicious: attention was less balanced than expected.
    scopeEntropy: shortfall(features.scopeEntropy, reference.scopeEntropy) * weights.scopeEntropy,
    // Below reference is suspicious: gaps were more regular than human traffic.
    interArrivalCv: shortfall(features.interArrivalCv, reference.interArrivalCv) * weights.interArrivalCv,
    // Above reference is suspicious: the same scope re-entered over and over.
    immediateRepeatRatio:
      excess(features.immediateRepeatRatio, reference.immediateRepeatRatio) * weights.immediateRepeatRatio,
    // Below reference is suspicious: attention was narrower than expected.
    distinctScopes:
      shortfall(features.distinctScopes, reference.distinctScopes) * weights.distinctScopes,
  } as const;

  const total = Object.values(contributions).reduce((sum, value) => sum + value, 0);
  const weightSum = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const score = weightSum > 0 ? Math.min(1, total / weightSum) : 0;

  let dominant: keyof AnomalyReference | undefined;
  let highest = 0;
  for (const [feature, value] of Object.entries(contributions) as ReadonlyArray<
    readonly [keyof AnomalyReference, number]
  >) {
    if (value > highest) {
      highest = value;
      dominant = feature;
    }
  }

  return { score, contributions, dominant };
}

/**
 * Does the anomaly dimension concur that behavior is varied? D37.
 *
 * The classifier's answer to the question `diversityConcurs` currently answers
 * with three independent threshold comparisons. Both are kept: this one is a
 * single interpretable number, the other is the conjunction the D37 gate was
 * written against, and which reads better against real populations is not
 * something generated traffic can settle.
 */
export function anomalyConcurs(
  features: BehaviorFeatures,
  suspicionCeiling = 0.5,
  options: AnomalyOptions = {},
): boolean | undefined {
  const { score } = anomalyScore(features, options);
  if (score === undefined) return undefined;
  return score < suspicionCeiling;
}

/** Normalised shortfall below an expected value, in [0,1]. */
function shortfall(observed: number, expected: number): number {
  if (expected <= 0) return 0;
  if (observed >= expected) return 0;
  return (expected - observed) / expected;
}

/** Normalised excess above an expected value, in [0,1]. */
function excess(observed: number, expected: number): number {
  if (observed <= expected) return 0;
  const headroom = 1 - expected;
  if (headroom <= 0) return 0;
  return Math.min(1, (observed - expected) / headroom);
}
