import type { ConstraintClass, Invariant, Strength } from './constraints.ts';

export type Transition = {
  readonly from: string;
  readonly to: string;
};

/**
 * Build an invariant from an explicit allowed-edge set. D16.
 *
 *     violation  <=>  (from, to) not in T
 *
 * Set membership, not scoring: no threshold, no calibration, and therefore no
 * false positives *given a correct declaration*. Which is exactly why `strength`
 * is a required argument rather than defaulting to `hard` — declaring `hard`
 * asserts that `allowed` is complete for this scope (D32), and a forgotten edge
 * becomes a provable violation of something legitimate.
 */
export function transitionGraph(options: {
  readonly id: string;
  readonly scope: string;
  readonly strength: Strength;
  readonly allowed: readonly Transition[];
  readonly class?: ConstraintClass;
}): Invariant {
  const allowed = new Set(options.allowed.map((edge) => `${edge.from}\u0000${edge.to}`));

  return {
    id: options.id,
    class: options.class ?? 'IMPOSSIBLE_STATE_TRANSITION',
    strength: options.strength,
    scope: options.scope,
    holds: (observation) => {
      if (!isTransition(observation)) return true; // not a transition; not this invariant's business
      return allowed.has(`${observation.from}\u0000${observation.to}`);
    },
  };
}

function isTransition(value: unknown): value is Transition {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Transition).from === 'string' &&
    typeof (value as Transition).to === 'string'
  );
}
