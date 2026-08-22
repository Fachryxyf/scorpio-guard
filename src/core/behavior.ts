/**
 * The anomaly feature space. D36.
 *
 * Features first, algorithm later (D18) — so this file computes features and
 * makes no attempt to classify. Every value here is derived from a bounded
 * window of recent observations, never from raw payloads.
 *
 * The immediate purpose is the diversity signal D37 requires: the trust
 * dimension must not have its uncertainty ceiling lifted on volume alone, and
 * "was that volume varied or monotonous" is the question that gates it.
 */

/** One observation, reduced to the least SG needs to measure shape. */
export type ObservationTrace = {
  /** Milliseconds since the epoch. */
  readonly at: number;
  /** Which declared scope, or a coarse label. Never a payload. */
  readonly scope: string;
};

/**
 * The feature vector. All values are dimensionless or in units of time, so a
 * later model consumes numbers rather than reconstructing meaning.
 *
 * Computed from a bounded window (D36, `DEFAULT_WINDOW_SIZE`), not from a
 * streaming estimator. That is a decision rather than a shortcut: over a window
 * this size the values here are exact, a streaming estimator would only
 * approximate them, and the bound is itself required — an unbounded per-entity
 * history is a memory-growth surface and a retention problem (D6, D22). A
 * streaming form becomes worth writing only if the window ever needs to be large,
 * which nothing in the model currently asks for.
 */
export type BehaviorFeatures = {
  /** Observations in the window. */
  readonly count: number;
  /** Distinct scopes seen. Low values mean repetitive attention. */
  readonly distinctScopes: number;
  /**
   * Shannon entropy over scope frequency, normalised to [0,1] against the maximum
   * the *observed* scopes allow. Read it as evenness: 1 means attention was spread
   * perfectly evenly over whatever scopes were visited, 0 means every observation
   * landed in the same one.
   *
   * Normalised against `log2(distinctScopes)` rather than `log2(count)` — see D46.
   * The window-size denominator made this a proxy for `distinctScopes` and tied
   * the value to how many scopes the *application* has, so the same behavior
   * scored differently in a small app than in a large one. Breadth is
   * `distinctScopes`'s job; this measures balance.
   */
  readonly scopeEntropy: number;
  /**
   * Coefficient of variation of inter-arrival gaps: standard deviation over mean.
   *
   * This is the discriminating feature the design notes single out — the tell is
   * not the delay but the *shape* of the randomness. Human activity is bursty
   * (high CV); fixed sleeps approach 0, and a flat `uniform(a, b)` sits at a
   * characteristic low value well below human traffic.
   */
  readonly interArrivalCv: number;
  /** Mean gap in milliseconds, or `undefined` with fewer than two observations. */
  readonly meanGapMs: number | undefined;
  /** Fraction of observations that repeated the immediately preceding scope. */
  readonly immediateRepeatRatio: number;
};

export function behaviorFeatures(window: readonly ObservationTrace[]): BehaviorFeatures {
  const count = window.length;
  if (count === 0) {
    return {
      count: 0,
      distinctScopes: 0,
      scopeEntropy: 0,
      interArrivalCv: 0,
      meanGapMs: undefined,
      immediateRepeatRatio: 0,
    };
  }

  const frequency = new Map<string, number>();
  let immediateRepeats = 0;
  for (let i = 0; i < window.length; i += 1) {
    const scope = window[i]!.scope;
    frequency.set(scope, (frequency.get(scope) ?? 0) + 1);
    if (i > 0 && window[i - 1]!.scope === scope) immediateRepeats += 1;
  }

  let entropy = 0;
  for (const seen of frequency.values()) {
    const p = seen / count;
    entropy -= p * Math.log2(p);
  }
  // Maximum entropy over `k` observed scopes is log2(k), reached when attention is
  // spread evenly across them. A single scope admits no balance either way, so it
  // reads as 0 rather than as perfectly balanced. D46.
  const maxEntropy = frequency.size > 1 ? Math.log2(frequency.size) : 0;

  const gaps: number[] = [];
  for (let i = 1; i < window.length; i += 1) {
    gaps.push(window[i]!.at - window[i - 1]!.at);
  }

  return {
    count,
    distinctScopes: frequency.size,
    scopeEntropy: maxEntropy > 0 ? entropy / maxEntropy : 0,
    interArrivalCv: coefficientOfVariation(gaps),
    meanGapMs: gaps.length > 0 ? mean(gaps) : undefined,
    immediateRepeatRatio: count > 1 ? immediateRepeats / (count - 1) : 0,
  };
}

/**
 * Does observed behavior vary enough for low variance to be believed? D37.
 *
 * Returns `undefined` when the window is too small to judge — which is not the
 * same claim as monotonous, and is why `anomalyConcurs` is three-valued.
 */
export function diversityConcurs(
  features: BehaviorFeatures,
  thresholds: DiversityThresholds = DEFAULT_DIVERSITY,
): boolean | undefined {
  if (features.count < thresholds.minObservations) return undefined;

  return (
    features.distinctScopes >= thresholds.minDistinctScopes &&
    features.scopeEntropy >= thresholds.minScopeEntropy &&
    features.interArrivalCv >= thresholds.minInterArrivalCv
  );
}

export type DiversityThresholds = {
  readonly minObservations: number;
  readonly minDistinctScopes: number;
  readonly minScopeEntropy: number;
  readonly minInterArrivalCv: number;
};

/**
 * PoC defaults. Every one of these is a guess until D30 puts them against real
 * traffic — they are deliberately lenient, because a wrong threshold here
 * withholds escalation rather than manufacturing a false positive.
 */
export const DEFAULT_DIVERSITY: DiversityThresholds = {
  minObservations: 8,
  minDistinctScopes: 2,
  minScopeEntropy: 0.35,
  minInterArrivalCv: 0.25,
};

/** How many observations are retained per entity. Bounded on purpose. */
export const DEFAULT_WINDOW_SIZE = 20;

export function pushObservation(
  window: readonly ObservationTrace[],
  trace: ObservationTrace,
  limit: number = DEFAULT_WINDOW_SIZE,
): readonly ObservationTrace[] {
  const next = [...window, trace];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function mean(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function coefficientOfVariation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  if (average === 0) return 0;

  let sumSquares = 0;
  for (const value of values) sumSquares += (value - average) ** 2;
  // Population standard deviation: the window is the whole thing being described,
  // not a sample from which to infer a wider population.
  return Math.sqrt(sumSquares / values.length) / average;
}
