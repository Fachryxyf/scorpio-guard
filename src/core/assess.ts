import type { Decision } from './decision.ts';
import { severity } from './decision.ts';
import {
  DEFAULT_TRUST_BANDS,
  DEFAULT_UNCERTAINTY_BANDS,
  type TrustBand,
  type UncertaintyLevel,
} from './policy.ts';

/** Which band `E[p]` falls into. D5. */
export function trustBand(mean: number): TrustBand {
  for (const entry of DEFAULT_TRUST_BANDS) {
    if (mean >= entry.atLeast) return entry.band;
  }
  return 'deny';
}

/** Which band `Var[p]` falls into. D5. */
export function uncertaintyLevel(variance: number): UncertaintyLevel {
  for (const entry of DEFAULT_UNCERTAINTY_BANDS) {
    if (variance <= entry.atMost) return entry.level;
  }
  return 'high';
}

/**
 * The decision each trust band proposes, before any ceiling is applied.
 *
 * The bands in D5 are named as pairs ("trusted / observe"), describing a range
 * rather than one rung. Read here as the least interventionist rung of each pair,
 * because the uncertainty ceiling can only ever lower a decision — so starting at
 * the gentler end would make the ceiling unable to express itself.
 */
const BAND_DECISION: Record<TrustBand, Decision> = {
  trusted: 'ALLOW',
  observe: 'OBSERVE',
  friction: 'INCREASE_FRICTION',
  restrict: 'RESTRICT',
  deny: 'BLOCK',
};

/** The most severe treatment each uncertainty level permits. D5. */
const UNCERTAINTY_CEILING: Record<UncertaintyLevel, Decision> = {
  low: 'BLOCK',
  medium: 'INCREASE_FRICTION',
  high: 'INCREASE_FRICTION',
};

export type TrustAssessment = {
  readonly mean: number;
  readonly variance: number;
  readonly band: TrustBand;
  readonly uncertainty: UncertaintyLevel;
  /** What the trust band alone proposed. */
  readonly proposed: Decision;
  /** The ceiling that applied, after uncertainty and anomaly concurrence. */
  readonly ceiling: Decision;
  /** The advice: `proposed`, lowered to `ceiling` if it exceeded it. */
  readonly decision: Decision;
  /** True when the ceiling actually lowered the proposal. */
  readonly capped: boolean;
  readonly reason: string;
};

export type AssessOptions = {
  /**
   * Whether the anomaly dimension concurs that observed behavior is diverse
   * enough for low variance to be believed. D37.
   *
   * `undefined` means no anomaly data exists yet, which is the current state of
   * the project — not an assertion that behavior is monotonous.
   */
  readonly anomalyConcurs?: boolean | undefined;

  /**
   * Permit a full ceiling on low variance alone, with no anomaly concurrence.
   *
   * Defaults to `false`: uniform, high-volume traffic drives variance down while
   * proving very little, and D37 places the fix here rather than in the trust
   * mathematics. Lifting this is a deliberate host policy choice, not a default.
   */
  readonly allowEscalationWithoutAnomaly?: boolean;
};

/**
 * Read a trust distribution as advice. D5, capped per D37.
 *
 * Advisory only — the host decides what to do with the result (D14).
 */
export function assessTrust(
  mean: number,
  variance: number,
  options: AssessOptions = {},
): TrustAssessment {
  const band = trustBand(mean);
  const level = uncertaintyLevel(variance);
  const proposed = BAND_DECISION[band];

  let ceiling = UNCERTAINTY_CEILING[level];
  let reason = `${level} uncertainty permits at most ${ceiling}`;

  // D37: low variance earned by monotonous volume is not evidence of anything.
  const concurrence = options.anomalyConcurs ?? options.allowEscalationWithoutAnomaly ?? false;
  if (level === 'low' && !concurrence) {
    ceiling = 'INCREASE_FRICTION';
    reason =
      options.anomalyConcurs === false
        ? 'low uncertainty withheld: behavior is not diverse enough to believe it (D37)'
        : 'low uncertainty withheld: no anomaly data to corroborate it (D37)';
  }

  const capped = severity(proposed) > severity(ceiling);
  const decision = capped ? ceiling : proposed;

  return {
    mean,
    variance,
    band,
    uncertainty: level,
    proposed,
    ceiling,
    decision,
    capped,
    reason: capped ? reason : `${band} band advises ${proposed}`,
  };
}
