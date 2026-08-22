/**
 * Sequence and environment signal collectors. D42.
 *
 * SIG_UNUSUAL_SEQUENCE needs to know what this entity has done before, which is
 * per-entity state the host already holds — so this module takes the history as
 * an argument rather than storing it. SIG_ENVIRONMENT_MISMATCH reads coarse
 * client facts only, and records no fingerprint.
 */

export type SequenceObservation = {
  /** True when this transition has not been seen for this entity before. */
  readonly novel: boolean;
  readonly transition: string;
};

/**
 * SIG_UNUSUAL_SEQUENCE: a path no invariant forbids but this entity has not
 * taken before. Novel on a first visit, which is why the catalogue rates it
 * `notable` rather than `pronounced` — most first visits are legitimate.
 *
 * `knownTransitions` is the host's per-entity history, as `from>to` strings.
 */
export function checkSequence(
  from: string,
  to: string,
  knownTransitions: ReadonlySet<string>,
): SequenceObservation {
  const transition = `${from}>${to}`;
  return { novel: !knownTransitions.has(transition), transition };
}

/**
 * Coarse client facts. Every field is optional: a host that cannot determine one
 * should omit it rather than guess, because a guessed value produces a mismatch
 * that says nothing about the client.
 *
 * Deliberately not a fingerprint. There is no canvas hash, no font enumeration,
 * no screen geometry — only the handful of facts whose *disagreement* is
 * meaningful.
 */
export type ClientFacts = {
  /** Declared platform family, e.g. 'mobile' | 'desktop'. */
  readonly platform?: 'mobile' | 'desktop' | 'unknown';
  /** Whether a touch input modality is reported as available. */
  readonly touchCapable?: boolean;
  /** Whether pointer events were actually observed during the interaction. */
  readonly pointerObserved?: boolean;
  /** Whether keyboard events were actually observed. */
  readonly keyboardObserved?: boolean;
};

export type EnvironmentObservation = {
  readonly mismatch: boolean;
  /** Which check disagreed, for the trace. Empty when nothing did. */
  readonly reasons: readonly string[];
};

/**
 * SIG_ENVIRONMENT_MISMATCH: coarse facts that disagree with each other.
 *
 * A mobile client that reports touch capability but never produces a pointer
 * event is the canonical case — the declared modality never appeared. Privacy
 * tooling and managed devices produce the same shape, which is why this is
 * `faint` and only matters in combination.
 */
export function checkEnvironment(facts: ClientFacts): EnvironmentObservation {
  const reasons: string[] = [];

  if (facts.platform === 'mobile' && facts.touchCapable === true && facts.pointerObserved === false) {
    reasons.push('mobile client reported touch capability but produced no pointer events');
  }
  if (facts.touchCapable === false && facts.pointerObserved === false && facts.keyboardObserved === false) {
    reasons.push('no input modality was observed at all');
  }

  return { mismatch: reasons.length > 0, reasons };
}
