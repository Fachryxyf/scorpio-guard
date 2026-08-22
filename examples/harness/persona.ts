/**
 * Persona traffic, independent of any one application. D45, generalised by D47.
 *
 * A persona is a sequence of interactions with the gaps between them. Nothing here
 * knows what an application's scopes mean — the host supplies invariants, the
 * persona supplies observations, and the harness drives one through the other.
 *
 * Kept out of `src/` deliberately: this generates *test* traffic. Shipping it
 * inside the library would put a traffic generator in an adopter's bundle, and
 * would blur the line the whole design rests on — SG observes, it never produces.
 */

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * Deterministic PRNG. `Math.random()` would make a failing run impossible to
 * reproduce, which is the one thing a traffic generator must not be.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Exponential gaps: bursty, which is what human activity actually looks like. */
export function burstyGap(random: () => number, meanMs: number): number {
  return -Math.log(1 - random()) * meanMs;
}

/** What the host's own defences did, for comparison. */
export type HostOutcome = 'allowed' | 'rejected' | 'locked-out' | 'rate-limited';

export type Step = {
  /** Milliseconds to wait *before* this step. */
  readonly afterMs: number;
  readonly event: string;
  /** Which declared scope this belongs to. Invariants outside it are not consulted. */
  readonly scope: string;
  /** Whatever the host's invariants know how to read. Never inspected by SG. */
  readonly data: unknown;
  readonly hostDid: HostOutcome;
  readonly evidence?: { positive?: 'weak' | 'strong'; negative?: 'weak' | 'strong' };
  /** Weak signals a collector would have reported. D42. */
  readonly signals?: readonly string[];
  /**
   * Override the entity for this step.
   *
   * Present because some attacks are *about* the entity: churning references, or
   * one attacker driving many sessions. Defaults to the persona's own id.
   */
  readonly entity?: string;
};

export type Persona = {
  readonly id: string;
  /** True when this traffic is legitimate and must never be escalated. */
  readonly legitimate: boolean;
  readonly what: string;
  readonly steps: readonly Step[];
};
