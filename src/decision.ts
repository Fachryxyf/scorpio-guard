/**
 * The decision spectrum. Ordered least to most interventionist: each step to the
 * right demands strictly stronger evidence than the one before it.
 *
 * The guard never enforces. It returns a point on this spectrum as advice, and
 * the host application decides what to do with it.
 */
export const DECISIONS = [
  'ALLOW',
  'OBSERVE',
  'INCREASE_FRICTION',
  'RESTRICT',
  'BLOCK',
] as const;

export type Decision = (typeof DECISIONS)[number];

/** Position on the spectrum. Higher means more intervention. */
export function severity(decision: Decision): number {
  return DECISIONS.indexOf(decision);
}

/**
 * When several layers each advise a decision, the strongest one wins.
 *
 * Deliberately a plain maximum rather than a weighted blend: hard constraints
 * and weak signals are typed differently precisely so they are not averaged
 * into one score.
 */
export function strongest(decisions: readonly Decision[]): Decision {
  let worst: Decision = 'ALLOW';
  for (const decision of decisions) {
    if (severity(decision) > severity(worst)) worst = decision;
  }
  return worst;
}
