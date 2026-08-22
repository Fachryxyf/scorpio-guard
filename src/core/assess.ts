import type { Decision } from './decision.ts';
import { severity } from './decision.ts';
import {
  DEFAULT_EPISTEMIC_STAGES,
  DEFAULT_POLICY,
  DEFAULT_TRUST_BANDS,
  DEFAULT_UNCERTAINTY_BANDS,
  type EpistemicStage,
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
 * Which epistemic stage an evidence mass falls into. D5, revised.
 *
 * `n = alpha + beta`, so a fresh entity is `n = 2`: the prior and nothing else.
 */
export function epistemicStage(
  mass: number,
  thresholds: { developingAt: number; establishedAt: number } = DEFAULT_POLICY,
): EpistemicStage {
  if (mass >= thresholds.establishedAt) return 'established';
  if (mass >= thresholds.developingAt) return 'developing';
  return 'unknown';
}

/**
 * The decision each trust band proposes, before any ceiling is applied.
 *
 * The bands in D5 are named as pairs ("trusted / observe"), describing a range
 * rather than one rung. Read here as the least interventionist rung of each pair,
 * because a ceiling can only ever lower a decision — so starting at the gentler
 * end would make the ceiling unable to express itself.
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

/**
 * The most severe treatment each epistemic stage permits on trust alone.
 *
 * An `unknown` entity contributes nothing: with no evidence, the trust dimension
 * has no standing to ask for anything. It does not force `ALLOW` either — an
 * independent anomaly signal or hard-constraint violation still reaches the
 * decision layer on its own authority.
 *
 * `developing` permits `OBSERVE` and no more. D40 describes the middle stage as
 * one where trust may *influence* the treatment without *driving* it, and
 * `OBSERVE` is the only rung that does that: it costs the user nothing and tells
 * the host something. `INCREASE_FRICTION` is the first rung a legitimate user
 * actually feels, so allowing it here made the `unknown` → `developing` boundary a
 * cliff — a third observation could turn silence into friction. D46 records the
 * traffic that found it.
 */
const STAGE_CEILING: Record<EpistemicStage, Decision> = {
  unknown: 'ALLOW',
  developing: 'OBSERVE',
  established: 'BLOCK',
};

export type TrustAssessment = {
  readonly mean: number;
  readonly variance: number;
  /** Evidence mass, `n = alpha + beta`. A fresh entity reads 2. */
  readonly mass: number;
  readonly stage: EpistemicStage;
  readonly band: TrustBand;
  readonly uncertainty: UncertaintyLevel;
  /** What the trust band alone proposed. */
  readonly proposed: Decision;
  /** The binding ceiling, after epistemic stage, uncertainty and anomaly. */
  readonly ceiling: Decision;
  /** The advice: `proposed`, lowered to `ceiling` if it exceeded it. */
  readonly decision: Decision;
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
   * mathematics.
   */
  readonly allowEscalationWithoutAnomaly?: boolean;

  readonly thresholds?: { developingAt: number; establishedAt: number };
};

/**
 * Read a trust distribution as advice. D5, with the epistemic stage of the D5
 * revision and the anomaly concurrence of D37.
 *
 * Three ceilings apply and the lowest binds:
 *
 * - epistemic stage — has enough evidence arrived to interpret the mean at all
 * - uncertainty — is the distribution tight enough to act on
 * - anomaly concurrence — is that tightness earned by varied behavior
 *
 * Advisory only; the host decides what to do with the result. D14.
 */
export function assessTrust(
  mean: number,
  variance: number,
  mass: number,
  options: AssessOptions = {},
): TrustAssessment {
  const band = trustBand(mean);
  const level = uncertaintyLevel(variance);
  const stage = epistemicStage(mass, options.thresholds ?? DEFAULT_POLICY);
  const proposed = BAND_DECISION[band];

  const candidates: ReadonlyArray<{ ceiling: Decision; reason: string }> = [
    {
      ceiling: STAGE_CEILING[stage],
      reason:
        stage === 'unknown'
          ? `unknown entity (n=${round(mass)}): lack of evidence is not evidence of distrust`
          : `${stage} evidence (n=${round(mass)}) permits at most ${STAGE_CEILING[stage]}`,
    },
    {
      ceiling: UNCERTAINTY_CEILING[level],
      reason: `${level} uncertainty permits at most ${UNCERTAINTY_CEILING[level]}`,
    },
    anomalyCeiling(level, options),
  ];

  const binding = candidates.reduce((lowest, candidate) =>
    severity(candidate.ceiling) < severity(lowest.ceiling) ? candidate : lowest,
  );

  const capped = severity(proposed) > severity(binding.ceiling);
  const decision = capped ? binding.ceiling : proposed;

  return {
    mean,
    variance,
    mass,
    stage,
    band,
    uncertainty: level,
    proposed,
    ceiling: binding.ceiling,
    decision,
    capped,
    reason: capped ? binding.reason : `${band} band advises ${proposed}`,
  };
}

/** D37: low variance earned by monotonous volume is not evidence of anything. */
function anomalyCeiling(
  level: UncertaintyLevel,
  options: AssessOptions,
): { ceiling: Decision; reason: string } {
  if (level !== 'low') return { ceiling: 'BLOCK', reason: 'anomaly ceiling not engaged' };

  const concurrence = options.anomalyConcurs ?? options.allowEscalationWithoutAnomaly ?? false;
  if (concurrence) return { ceiling: 'BLOCK', reason: 'anomaly concurs with low uncertainty' };

  return {
    ceiling: 'INCREASE_FRICTION',
    reason:
      options.anomalyConcurs === false
        ? 'low uncertainty withheld: behavior is not diverse enough to believe it (D37)'
        : 'low uncertainty withheld: no anomaly data to corroborate it (D37)',
  };
}

function round(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}
