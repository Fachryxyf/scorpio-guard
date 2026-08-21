import { DEFAULT_SOFT_VIOLATION_WEIGHT } from './policy.ts';

/**
 * Declared invariants and their violation. D13, D16, D32.
 *
 * Nothing here is learned. SG never infers impossibility from how rarely
 * something has been seen — that is the anomaly dimension's job (D18).
 */

/**
 * The classes of invariant violation. D13, closed by D41.
 *
 * D13 recorded five classes and the design notes called that list a starting
 * set. D41 closes it by asking what a host can actually prove rather than what
 * an attack looks like: every class below names one source of proof, and the
 * enumeration is exhaustive over those sources rather than over attack shapes.
 */
export const CONSTRAINT_CLASSES = [
  'IMPOSSIBLE_SEGMENT_JUMP',
  'IMPOSSIBLE_IDLE_ACTION',
  'IMPOSSIBLE_TEMPORAL_ORDER',
  'IMPOSSIBLE_STATE_TRANSITION',
  'IMPOSSIBLE_ACTION_PREREQUISITE',
  'IMPOSSIBLE_UNISSUED_REFERENCE',
  'IMPOSSIBLE_EXCLUSIVE_STATE',
] as const;

export type ConstraintClass = (typeof CONSTRAINT_CLASSES)[number];

/**
 * What a host holds that makes a violation provable. D41.
 *
 * A host can only prove impossibility from facts it already has, and those facts
 * come in six kinds:
 *
 * - `reachability` — the flow graph it declared
 * - `precondition` — state that must hold before an action is available
 * - `causality` — the input that must have produced an observed effect
 * - `order` — timestamps the system itself recorded
 * - `issuance` — values the system itself handed out
 * - `exclusivity` — facts that cannot both be true
 *
 * Anything not derivable from one of these is measurement, not proof, and
 * belongs in the weak-signal catalogue (`signals.ts`) instead. That is the whole
 * closure argument: the taxonomy is finite because the proof sources are.
 */
export const PROOF_SOURCES = [
  'reachability',
  'precondition',
  'causality',
  'order',
  'issuance',
  'exclusivity',
] as const;

export type ProofSource = (typeof PROOF_SOURCES)[number];

/**
 * Which fact proves each class.
 *
 * `IMPOSSIBLE_SEGMENT_JUMP` and `IMPOSSIBLE_STATE_TRANSITION` share a proof
 * source deliberately: they are the same proof at two declaration granularities
 * — a required earlier step, and a missing edge in an explicit edge set. They
 * stay separate because the class is diagnostic, and a host reading a trace
 * benefits from the distinction even though SG's advice does not depend on it.
 */
export const PROOF_SOURCE_OF: Record<ConstraintClass, ProofSource> = {
  IMPOSSIBLE_SEGMENT_JUMP: 'reachability',
  IMPOSSIBLE_STATE_TRANSITION: 'reachability',
  IMPOSSIBLE_ACTION_PREREQUISITE: 'precondition',
  IMPOSSIBLE_IDLE_ACTION: 'causality',
  IMPOSSIBLE_TEMPORAL_ORDER: 'order',
  IMPOSSIBLE_UNISSUED_REFERENCE: 'issuance',
  IMPOSSIBLE_EXCLUSIVE_STATE: 'exclusivity',
};

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
 * Hard violations contribute nothing here — they reach the decision layer as
 * their own dimension and never become mass, because proof that decays under a
 * half-life would be incoherent (D15).
 */
export function softViolationMass(
  violations: readonly Violation[],
  weight: number = DEFAULT_SOFT_VIOLATION_WEIGHT,
): number {
  return softViolations(violations).length * weight;
}
