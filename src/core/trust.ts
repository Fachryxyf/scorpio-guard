import type { ObservationTrace } from './behavior.ts';
import { DEFAULT_HALF_LIFE_HOURS } from './policy.ts';

const HOUR_MS = 3_600_000;

/**
 * Accumulated evidence mass for one entity. D1, D3.
 *
 * `a` and `b` are evidence mass only — the Beta(1,1) prior is structural and
 * lives outside them, so a fresh entity is (0, 0) and reads as exactly flat.
 * Both timestamps are milliseconds since the epoch:
 *
 * - `lastSeen` anchors decay (D3)
 * - `lastMeaningfulUpdate` anchors retention (D6)
 */
export type EntityState = {
  readonly a: number;
  readonly b: number;
  readonly lastSeen: number;
  readonly lastMeaningfulUpdate: number;
  /**
   * Bounded window of recent observations, for the anomaly features of D36.
   *
   * Kept beside the trust state so one store round trip serves both dimensions,
   * and so a purge (D22) or an expiry (D6) removes behavioral history along with
   * everything else rather than leaving an orphan.
   */
  readonly window: readonly ObservationTrace[];
};

export function freshState(now: number): EntityState {
  return { a: 0, b: 0, lastSeen: now, lastMeaningfulUpdate: now, window: [] };
}

/**
 * Decay factor over an elapsed interval. D3.
 *
 *     lambda(dt) = 2^(-dt/H)
 *
 * Composable: lambda(dt1 + dt2) === lambda(dt1) * lambda(dt2), which is why
 * decaying once across a whole gap is exact rather than an approximation.
 */
export function decayFactor(
  elapsedMs: number,
  halfLifeHours: number = DEFAULT_HALF_LIFE_HOURS,
): number {
  if (elapsedMs <= 0) return 1;
  return 2 ** (-elapsedMs / (halfLifeHours * HOUR_MS));
}

/** Evidence mass decayed to `now`, without mutating stored state. */
export function decayedMass(
  state: EntityState,
  now: number,
  halfLifeHours?: number,
): { a: number; b: number } {
  const lambda = decayFactor(now - state.lastSeen, halfLifeHours);
  return { a: state.a * lambda, b: state.b * lambda };
}

/**
 * Apply evidence. D3 write-time rule: decay to now, then add.
 *
 * The order matters. Decay-then-add is what bounds mass at
 * `w / (1 - lambda(T))` for arrivals every `T`; add-then-decay-on-read lets it
 * grow without limit.
 *
 * `positive` and `negative` are masses and must not be negative — sign is
 * carried by which parameter they land in, never by the number itself. D4.
 */
export function applyEvidence(
  state: EntityState,
  evidence: { positive?: number; negative?: number },
  now: number,
  halfLifeHours?: number,
): EntityState {
  const positive = evidence.positive ?? 0;
  const negative = evidence.negative ?? 0;
  if (positive < 0 || negative < 0) {
    throw new RangeError('evidence mass must be non-negative; sign is carried by parameter, not value');
  }

  const decayed = decayedMass(state, now, halfLifeHours);
  const meaningful = positive > 0 || negative > 0;

  return {
    a: decayed.a + positive,
    b: decayed.b + negative,
    lastSeen: now,
    lastMeaningfulUpdate: meaningful ? now : state.lastMeaningfulUpdate,
    window: state.window,
  };
}

/** Expected trust, E[p] = alpha / (alpha + beta). D2a. */
export function expectedTrust(state: EntityState, now: number, halfLifeHours?: number): number {
  const { a, b } = decayedMass(state, now, halfLifeHours);
  return (1 + a) / (2 + a + b);
}

/** Uncertainty, Var[p]. D2a. Flat Beta(1,1) gives 1/12. */
export function uncertainty(state: EntityState, now: number, halfLifeHours?: number): number {
  const { a, b } = decayedMass(state, now, halfLifeHours);
  const alpha = 1 + a;
  const beta = 1 + b;
  const total = alpha + beta;
  return (alpha * beta) / (total * total * (total + 1));
}

/**
 * Evidence mass, `n = alpha + beta`. D5 revision.
 *
 * Includes the prior, so a fresh entity reads exactly 2 — which is what makes
 * "has any evidence arrived at all" answerable rather than inferred from the mean.
 */
export function evidenceMass(state: EntityState, now: number, halfLifeHours?: number): number {
  const { a, b } = decayedMass(state, now, halfLifeHours);
  return 2 + a + b;
}

/**
 * Has state passed the retention horizon? D6.
 *
 * Measured from the last meaningful update, not the last sighting, so trivial
 * traffic cannot keep state alive indefinitely. Expiry is a retention boundary,
 * not a trust judgement: expired state is deleted, and the same reference
 * arriving later starts again from the cold-start prior.
 */
export function isExpired(state: EntityState, now: number, retentionHours: number): boolean {
  return now - state.lastMeaningfulUpdate > retentionHours * HOUR_MS;
}
