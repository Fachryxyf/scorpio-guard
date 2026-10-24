/**
 * The assessment event: one structured record per evaluation. D61.
 *
 * The trace (D23) explains a decision to a person. This is the same occasion in the
 * shape a collector can aggregate, so a host does not have to parse log lines to learn
 * how often it was advised to add friction, or which invariant class set the outcome.
 *
 * ## What is deliberately absent
 *
 * The entity reference. Not because it is secret to SG, which already keys all of its
 * state by it, but because an event log leaves the process: it goes to a collector, a
 * dashboard, a retention policy the host did not write. Sending the raw reference
 * would make that log a second copy of the host's user table, with weaker rules than
 * the original. A host that needs to correlate events keys them itself through
 * `identity`, and the salt never leaves its configuration.
 *
 * ## Reporting cannot change the advice
 *
 * The event is built after the decision is final, and the guard calls the sink without
 * waiting for it. A sink that throws, rejects, or is slow is a telemetry problem, not
 * an outage of the host's request path.
 */
import type { ConstraintClass, Strength } from './constraints.ts';
import type { Decision } from './decision.ts';
import type { Assessment } from './guard.ts';
import type { EpistemicStage, TrustBand, UncertaintyLevel } from './policy.ts';

/** Bumped only when a field changes meaning or disappears. D61. */
export const ASSESSMENT_EVENT_SCHEMA = 1;

/**
 * How the event identifies the entity, if at all.
 *
 * `{ kind: 'omit' }` is the default. `{ kind: 'hash', salt }` keys the event to an
 * entity without carrying the reference: the digest is stable for a given salt, and a
 * salt chosen by the host is what keeps a small identifier space from being enumerated
 * back into addresses.
 */
export type AssessmentIdentity = { readonly kind: 'omit' } | { readonly kind: 'hash'; readonly salt: string };

export type AssessmentEventViolation = {
  readonly invariant: string;
  readonly class: ConstraintClass;
  readonly strength: Strength;
};

export type AssessmentEvent = {
  readonly schemaVersion: typeof ASSESSMENT_EVENT_SCHEMA;
  /** When the evaluation ran, on the injected clock, so it agrees with the state it wrote. */
  readonly at: number;
  /** Wall time the evaluation took. Measured, not inferred from `at`. */
  readonly durationMs: number;
  /** Present only when `identity` asks for it. D61. */
  readonly entity?: string;
  readonly decision: Decision;
  readonly stage: EpistemicStage;
  readonly uncertainty: UncertaintyLevel;
  readonly trust: {
    readonly mean: number;
    readonly variance: number;
    readonly mass: number;
    readonly band: TrustBand;
    readonly proposed: Decision;
    readonly ceiling: Decision;
    readonly capped: boolean;
  };
  readonly violations: readonly AssessmentEventViolation[];
  readonly hardViolated: boolean;
  readonly coldStart: boolean;
  /**
   * The same explanation the assessment returns.
   *
   * Hosts that put scope names in `observation.scope` should keep those names free of
   * identifiers, because the trace quotes them and the event leaves the process.
   */
  readonly trace: readonly string[];
};

/**
 * SHA-256 over the salt and the reference, truncated to 128 bits.
 *
 * Web Crypto rather than `node:crypto` so the core keeps running wherever the host
 * runs, including edge and browser targets (M5.1). When `subtle` is unavailable the
 * identity is dropped rather than downgraded to an unhashed reference.
 */
export async function hashEntity(entity: string, salt: string): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return undefined;
  const bytes = new TextEncoder().encode(salt + '\u0000' + entity);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export type AssessmentEventOptions = {
  readonly at: number;
  readonly durationMs: number;
  readonly identity?: AssessmentIdentity | undefined;
};

/** Build the event for a finished assessment. Standalone so it is testable alone. */
export async function toAssessmentEvent(
  assessment: Assessment,
  options: AssessmentEventOptions,
): Promise<AssessmentEvent> {
  const identity = options.identity ?? { kind: 'omit' };
  const entity =
    identity.kind === 'hash' ? await hashEntity(assessment.entity, identity.salt) : undefined;

  const event: AssessmentEvent = {
    schemaVersion: ASSESSMENT_EVENT_SCHEMA,
    at: options.at,
    durationMs: options.durationMs,
    decision: assessment.decision,
    stage: assessment.trust.stage,
    uncertainty: assessment.trust.uncertainty,
    trust: {
      mean: assessment.trust.mean,
      variance: assessment.trust.variance,
      mass: assessment.trust.mass,
      band: assessment.trust.band,
      proposed: assessment.trust.proposed,
      ceiling: assessment.trust.ceiling,
      capped: assessment.trust.capped,
    },
    violations: assessment.violations.map((violation) => ({
      invariant: violation.invariant,
      class: violation.class,
      strength: violation.strength,
    })),
    hardViolated: assessment.hardViolated,
    coldStart: assessment.coldStart,
    trace: assessment.trace,
  };

  return entity === undefined ? event : { ...event, entity };
}
