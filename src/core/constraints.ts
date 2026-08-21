import { DEFAULT_SOFT_VIOLATION_WEIGHT } from './policy.ts';

/**
 * Declared invariants and their violation. D13, D16, D32.
 *
 * Nothing here is learned. SG never infers impossibility from how rarely
 * something has been seen — that is the anomaly dimension's job (D18).
 */

/** The five classes of invariant violation. D13. */
export const CONSTRAINT_CLASSES = [
  'IMPOSSIBLE_SEGMENT_JUMP',
  'IMPOSSIBLE_IDLE_ACTION',
  'IMPOSSIBLE_TEMPORAL_ORDER',
  'IMPOSSIBLE_STATE_TRANSITION',
  'IMPOSSIBLE_ACTION_PREREQUISITE',
] as const;

export type ConstraintClass = (typeof CONSTRAINT_CLASSES)[number];

/**
 * Epistemic strength, declared by the host per constraint. D32.
 *
 * `hard` is two claims at once: violations are deterministic, *and* the
 * declaration is complete over its own scope — within it, anything not declared
 * legitimate is provably wrong.
 *
 * `soft` claims only the first. It contributes evidence (D38), never proof, and
 * is the honest choice when completeness cannot be guaranteed.
 */
export type Strength = 'hard' | 'soft';

/**
 * One declared invariant.
 *
 * `scope` is what the completeness claim covers, and is why a partial
 * declaration is not silently global: a host may be certain about checkout step
 * ordering and unsure about navigation, and declare each accordingly.
 */
export type Invariant = {
  readonly id: string;
  readonly class: ConstraintClass;
  readonly strength: Strength;
  readonly scope: string;
  /** True when the observation satisfies this invariant. */
  readonly holds: (observation: unknown) => boolean;
};

export type Violation = {
  readonly invariant: string;
  readonly class: ConstraintClass;
  readonly strength: Strength;
  readonly scope: string;
};

/**
 * Check an observation against the invariants covering a scope.
 *
 * Invariants outside `scope` are not consulted. An observation in a scope nobody
 * declared yields no violations — unknown, not forbidden (D32).
 */
export function checkInvariants(
  observation: unknown,
  scope: string,
  invariants: readonly Invariant[],
): {
  readonly declared: boolean;
  readonly violations: readonly Violation[];
} {
  const applicable = invariants.filter((invariant) => invariant.scope === scope);
  const violations: Violation[] = [];

  for (const invariant of applicable) {
    if (invariant.holds(observation)) continue;
    violations.push({
      invariant: invariant.id,
      class: invariant.class,
      strength: invariant.strength,
      scope: invariant.scope,
    });
  }

  return { declared: applicable.length > 0, violations };
}

/** Violations that are proven, so they bypass the uncertainty ceiling. D14, D15. */
export function hardViolations(violations: readonly Violation[]): readonly Violation[] {
  return violations.filter((violation) => violation.strength === 'hard');
}

/** Violations that are evidence, so they become trust mass instead. D38. */
export function softViolations(violations: readonly Violation[]): readonly Violation[] {
  return violations.filter((violation) => violation.strength === 'soft');
}

/**
 * Trust mass owed by soft violations. D38.
 *
 * Soft violations become negative evidence in the Trust dimension, not in
 * Anomaly: they are declared, and Anomaly is measured. Routing a declaration
 * through a learned baseline would also let it influence the D37 diversity
 * check, which it has no business touching.
 *
 * Hard violations contribute nothing here \u2014 they reach the decision layer as
 * their own dimension and never become mass, because proof that decays under a
 * half-life would be incoherent (D15).
 */
export function softViolationMass(
  violations: readonly Violation[],
  weight: number = DEFAULT_SOFT_VIOLATION_WEIGHT,
): number {
  return softViolations(violations).length * weight;
}
