import { assessTrust, type TrustAssessment } from './assess.ts';
import {
  DEFAULT_DIVERSITY,
  DEFAULT_WINDOW_SIZE,
  behaviorFeatures,
  diversityConcurs,
  pushObservation,
  type BehaviorFeatures,
  type DiversityThresholds,
} from './behavior.ts';
import { systemClock, type Clock } from './clock.ts';
import {
  checkInvariants,
  hardViolations,
  softViolationMass,
  softViolations,
  type Invariant,
  type Violation,
} from './constraints.ts';
import { severity, type Decision } from './decision.ts';
import { DEFAULT_POLICY, type Policy } from './policy.ts';
import { memoryStore, type StateStore } from './store.ts';
import {
  applyEvidence,
  evidenceMass,
  expectedTrust,
  freshState,
  isExpired,
  uncertainty,
  type EntityState,
} from './trust.ts';

export type EvidenceStrength = 'weak' | 'strong';

export type Observation = {
  /**
   * Which declared scope this observation belongs to. Invariants outside it are
   * not consulted, and an undeclared scope yields no violations — unknown, not
   * forbidden. D32.
   */
  readonly scope?: string;

  /** Whatever the host's invariants know how to read. Never inspected by SG. */
  readonly data?: unknown;

  /** Evidence the host attributes to this interaction. D4. */
  readonly evidence?: {
    readonly positive?: EvidenceStrength;
    readonly negative?: EvidenceStrength;
  };
};

export type EvaluationContext = {
  /**
   * Endpoint sensitivity and anything else the host wants recorded against the
   * decision. Part of `C` in `T = PI(A, C)` — not part of the state key, since
   * trust is global per entity. D2.
   */
  readonly [key: string]: unknown;
};

export type Assessment = {
  readonly entity: string;
  readonly decision: Decision;
  readonly trust: TrustAssessment;
  /** Behavioral features over the retained window. D36. */
  readonly behavior: BehaviorFeatures;
  /**
   * Whether behavior was varied enough to believe low variance. D37.
   * `undefined` when the window is too small to judge.
   */
  readonly diversity: boolean | undefined;
  readonly violations: readonly Violation[];
  /** True when a proven violation set the outcome, bypassing the trust ceiling. */
  readonly hardViolated: boolean;
  /** True when state was absent or past its retention horizon. D6, D21. */
  readonly coldStart: boolean;
  readonly context: EvaluationContext | undefined;
  /** Why this outcome, in order of what actually decided it. D23. */
  readonly trace: readonly string[];
};

export type GuardOptions = {
  readonly store?: StateStore;
  readonly clock?: Clock;
  readonly policy?: Partial<Policy>;
  readonly invariants?: readonly Invariant[];
  /** See D37. Defaults to withholding escalation with no anomaly data. */
  readonly allowEscalationWithoutAnomaly?: boolean;
  /** Thresholds for the diversity signal. D36. */
  readonly diversity?: DiversityThresholds;
  /** Observations retained per entity for behavioral features. D36. */
  readonly windowSize?: number;
};

export type EvaluateInput = {
  readonly entity: string;
  readonly observation?: Observation;
  readonly context?: EvaluationContext;
  /**
   * Override the computed diversity verdict. D37.
   *
   * Normally omitted: SG derives concurrence from the entity's own observation
   * window (D36). Supply this only when the host holds a better signal.
   */
  readonly anomalyConcurs?: boolean;
};

/**
 * The guard. Advisory only: it returns a point on the decision spectrum and the
 * reasoning behind it, and the host decides what to do. D9, D14.
 */
export function createGuard(options: GuardOptions = {}) {
  const store = options.store ?? memoryStore();
  const clock = options.clock ?? systemClock;
  const policy: Policy = { ...DEFAULT_POLICY, ...options.policy };
  const invariants = options.invariants ?? [];
  const diversityThresholds = options.diversity ?? DEFAULT_DIVERSITY;
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;

  /** Load state, treating absent and expired alike. D6. */
  async function load(entity: string, now: number): Promise<{ state: EntityState; coldStart: boolean }> {
    const stored = await store.get(entity);
    if (!stored) return { state: freshState(now), coldStart: true };

    if (isExpired(stored, now, policy.retentionHours)) {
      await store.delete(entity);
      return { state: freshState(now), coldStart: true };
    }
    return { state: stored, coldStart: false };
  }

  return {
    async evaluate(input: EvaluateInput): Promise<Assessment> {
      const now = clock.now();
      const observation = input.observation ?? {};
      const trace: string[] = [];

      const { state, coldStart } = await load(input.entity, now);
      if (coldStart) trace.push('cold start: no retained state, prior is Beta(1,1)');

      // Declared invariants first: they are proof, and proof does not depend on
      // accumulated trust. D15, D16.
      const scope = observation.scope;
      const checked = scope
        ? checkInvariants(observation.data, scope, invariants)
        : { declared: false, violations: [] as readonly Violation[] };

      if (scope && !checked.declared) {
        trace.push(`scope "${scope}" has no declared invariants: unknown, not forbidden`);
      }

      const hard = hardViolations(checked.violations);
      const soft = softViolations(checked.violations);

      // Evidence: what the host attributed, plus mass owed by soft violations. D38.
      const positive = observation.evidence?.positive
        ? policy.weights[observation.evidence.positive]
        : 0;
      const attributedNegative = observation.evidence?.negative
        ? policy.weights[observation.evidence.negative]
        : 0;
      const negative = attributedNegative + softViolationMass(soft, policy.softViolationWeight);

      if (soft.length > 0) {
        trace.push(
          `${soft.length} soft violation(s) contribute ${softViolationMass(soft, policy.softViolationWeight)} negative mass`,
        );
      }

      const withEvidence = applyEvidence(state, { positive, negative }, now, policy.halfLifeHours);
      const updated: EntityState = {
        ...withEvidence,
        window: pushObservation(state.window, { at: now, scope: scope ?? 'unscoped' }, windowSize),
      };
      await store.set(input.entity, updated);

      // The anomaly dimension: features over this entity's own recent behavior.
      // Computed from the updated window so the current interaction counts. D36.
      const behavior = behaviorFeatures(updated.window);
      const diversity = input.anomalyConcurs ?? diversityConcurs(behavior, diversityThresholds);

      if (diversity === undefined) {
        trace.push(
          `diversity undetermined: ${behavior.count} observation(s), needs ${diversityThresholds.minObservations}`,
        );
      } else {
        trace.push(
          `diversity ${diversity ? 'concurs' : 'withheld'}: ${behavior.distinctScopes} scope(s), entropy ${behavior.scopeEntropy.toFixed(2)}, gap CV ${behavior.interArrivalCv.toFixed(2)}`,
        );
      }

      const trust = assessTrust(
        expectedTrust(updated, now, policy.halfLifeHours),
        uncertainty(updated, now, policy.halfLifeHours),
        evidenceMass(updated, now, policy.halfLifeHours),
        {
          anomalyConcurs: diversity,
          allowEscalationWithoutAnomaly: options.allowEscalationWithoutAnomaly ?? false,
          thresholds: { developingAt: policy.developingAt, establishedAt: policy.establishedAt },
        },
      );
      trace.push(`trust: ${trust.reason}`);

      // A proof is not subject to the uncertainty ceiling, which exists to guard
      // against probabilistic error. D14, D37. It still advises rather than
      // enforces, so the escalation is bounded by policy.
      let decision = trust.decision;
      if (hard.length > 0) {
        const advised = policy.hardViolationDecision;
        if (severity(advised) > severity(decision)) {
          decision = advised;
          trace.push(
            `hard violation of ${hard.map((violation) => violation.invariant).join(', ')}: advises ${advised}, ceiling bypassed`,
          );
        } else {
          trace.push(`hard violation recorded; trust already advises ${decision}`);
        }
      }

      return {
        entity: input.entity,
        decision,
        trust,
        behavior,
        diversity,
        violations: checked.violations,
        hardViolated: hard.length > 0,
        coldStart,
        context: input.context,
        trace,
      };
    },

    /** Forget one entity outright. D22. Same operation retention uses. */
    async forget(entity: string): Promise<void> {
      await store.delete(entity);
    },
  };
}

export type Guard = ReturnType<typeof createGuard>;
