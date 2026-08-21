import type { ConstraintClass } from './constraints.ts';

/**
 * Every tunable number in one place.
 *
 * These are policy, not law. The design record (DECISIONS.md) fixes the shape of
 * the model; the values here are PoC defaults chosen to be revised once the proof
 * of concept meets real traffic.
 */

/** Hours. Time for existing evidence to lose half its weight. D3. */
export const DEFAULT_HALF_LIFE_HOURS = 24;

/** Hours without a meaningful update before state is deleted outright. D6. */
export const DEFAULT_RETENTION_HOURS = 7 * 24;

/** Evidence mass per observation, by strength. D4. */
export const DEFAULT_WEIGHTS = {
  weak: 0.5,
  strong: 2,
} as const;

/**
 * Mass contributed by a violated `soft` invariant. D38.
 *
 * Strong, not weak: the host deliberately declared that this should not happen.
 * That it is not provable does not make it faint — weak weight is for signals SG
 * inferred on its own.
 */
export const DEFAULT_SOFT_VIOLATION_WEIGHT = DEFAULT_WEIGHTS.strong;

/** Trust bands over E[p], read as "at least this mean". D5. */
export const DEFAULT_TRUST_BANDS = [
  { atLeast: 0.8, band: 'trusted' },
  { atLeast: 0.6, band: 'observe' },
  { atLeast: 0.4, band: 'friction' },
  { atLeast: 0.2, band: 'restrict' },
  { atLeast: 0, band: 'deny' },
] as const;

/**
 * Epistemic stages over evidence mass `n = alpha + beta`. D5, revised.
 *
 * Read as "at least this much evidence". A fresh entity has `n = 2` — the prior
 * alone — and must land in `unknown`, because lack of evidence is not negative
 * evidence.
 *
 * The boundaries are tied to the D5 trajectory rather than picked freely: `3` is
 * roughly where a second observation has arrived and the mean starts meaning
 * something, `7` is roughly where low uncertainty becomes reachable at all.
 */
export const DEFAULT_EPISTEMIC_STAGES = [
  { atLeast: 7, stage: 'established' },
  { atLeast: 3, stage: 'developing' },
  { atLeast: 0, stage: 'unknown' },
] as const;

export type EpistemicStage = (typeof DEFAULT_EPISTEMIC_STAGES)[number]['stage'];

/** Uncertainty bands over Var[p], read as "at most this variance". D5. */
export const DEFAULT_UNCERTAINTY_BANDS = [
  { atMost: 0.02, level: 'low' },
  { atMost: 0.05, level: 'medium' },
  { atMost: Infinity, level: 'high' },
] as const;

export type TrustBand = (typeof DEFAULT_TRUST_BANDS)[number]['band'];
export type UncertaintyLevel = (typeof DEFAULT_UNCERTAINTY_BANDS)[number]['level'];

/**
 * What a proven violation advises, by default.
 *
 * D14 is explicit that "hard" describes the certainty of the violation, not the
 * severity of the treatment — so SG must advise *something* without claiming the
 * authority to enforce. `RESTRICT` rather than `BLOCK` keeps the final escalation
 * with the host.
 *
 * One value for every constraint class, because SG has no basis for ranking them:
 * all seven are equally *proven*, and how much a given impossibility should cost
 * is a property of the host's flow, not of the class. Hosts that do have a basis
 * override per class — see `HardViolationPolicy`.
 */
export const DEFAULT_HARD_VIOLATION_DECISION = 'RESTRICT';

/**
 * Advice for proven violations: one decision for all classes, or per class. D41.
 *
 * The per-class form is partial — classes left out fall back to
 * `DEFAULT_HARD_VIOLATION_DECISION`, so declaring one exception does not oblige a
 * host to restate the other six.
 */
export type HardViolationDecision = 'INCREASE_FRICTION' | 'RESTRICT' | 'BLOCK';

export type HardViolationPolicy =
  | HardViolationDecision
  | { readonly [K in ConstraintClass]?: HardViolationDecision };

/** What a violation of this class advises, honouring a per-class override. D41. */
export function hardViolationDecision(
  policy: HardViolationPolicy,
  violationClass: ConstraintClass,
): HardViolationDecision {
  if (typeof policy === 'string') return policy;
  return policy[violationClass] ?? DEFAULT_HARD_VIOLATION_DECISION;
}

export type Policy = {
  readonly halfLifeHours: number;
  readonly retentionHours: number;
  readonly weights: { readonly weak: number; readonly strong: number };
  readonly softViolationWeight: number;
  readonly hardViolationDecision: HardViolationPolicy;
  /** Mass thresholds for the epistemic stages. */
  readonly developingAt: number;
  readonly establishedAt: number;
};

export const DEFAULT_POLICY: Policy = {
  halfLifeHours: DEFAULT_HALF_LIFE_HOURS,
  retentionHours: DEFAULT_RETENTION_HOURS,
  weights: DEFAULT_WEIGHTS,
  softViolationWeight: DEFAULT_SOFT_VIOLATION_WEIGHT,
  hardViolationDecision: DEFAULT_HARD_VIOLATION_DECISION,
  developingAt: 3,
  establishedAt: 7,
};
