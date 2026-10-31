import { anomalyConcurs, anomalyScore, type AnomalyOptions, type AnomalyScore } from './anomaly.ts';
import { assessTrust, type TrustAssessment } from './assess.ts';
import {
  DEFAULT_DIVERSITY,
  DEFAULT_VELOCITY,
  DEFAULT_WINDOW_SIZE,
  behaviorFeatures,
  diversityConcurs,
  farmingSuspected,
  positiveCredit,
  pushObservation,
  type BehaviorFeatures,
  type DiversityThresholds,
  type VelocityThresholds,
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
import { severity, strongest, type Decision } from './decision.ts';
import {
  toAssessmentEvent,
  type AssessmentEvent,
  type AssessmentIdentity,
} from './event.ts';
import { signalMass, type WeakSignal } from './signals.ts';
import {
  DEFAULT_INTEGRATION_WARNING_MIN_CONSECUTIVE,
  DEFAULT_POLICY,
  hardViolationDecision,
  type Policy,
} from './policy.ts';
import {
  DEFAULT_STORE_DEADLINE_MS,
  memoryStore,
  StoreDeadlineError,
  type StateStore,
} from './store.ts';
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

/**
 * An observation about the integration itself, raised on the assessment without
 * ever touching the advice. D78.
 *
 * The one kind today: a scope whose evaluations uniformly hard-violate the same
 * invariant. Row by row the guard is correct; the uniformity is the host's
 * mapping to blame, and nothing else in the system says so.
 */
export type IntegrationWarning = {
  readonly kind: 'uniform-hard-violation';
  readonly scope: string;
  readonly invariant: string;
  readonly count: number;
};

export type Observation = {
  /**
   * Which declared scope this observation belongs to. Invariants outside it are
   * not consulted, and an undeclared scope yields no violations, unknown, not
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

  /**
   * Weak signals the host observed, by catalogue id. D42.
   *
   * Measurement, not proof: these become negative trust mass and nothing else.
   * Ids the catalogue does not know are ignored rather than guessed at, so a
   * newer host cannot widen SG's vocabulary by inventing tokens.
   */
  readonly signals?: readonly string[];
};

export type EvaluationContext = {
  /**
   * Endpoint sensitivity and anything else the host wants recorded against the
   * decision. Part of `C` in `T = PI(A, C)`, not part of the state key, since
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
  /**
   * Whether this entity looks like it is farming trust: a high observation rate
   * *and* a monotonous shape. D50, corrected by D54.
   *
   * `undefined` when there is too little in the window to measure a rate.
   */
  readonly farming: boolean | undefined;
  /**
   * Distance from the reference behavior profile. D18.
   *
   * Reported on every evaluation whether or not it drives the decision, so an
   * adopter can compare the classifier against the threshold conjunction on their
   * own traffic before switching.
   */
  readonly anomaly: AnomalyScore;
  readonly violations: readonly Violation[];
  /** True when a proven violation set the outcome, bypassing the trust ceiling. */
  readonly hardViolated: boolean;
  /** True when state was absent or past its retention horizon. D6, D21. */
  readonly coldStart: boolean;
  /**
   * True when a store operation did not land within the deadline (D76): the
   * advice was given without retained state, or the state write was lost. A
   * run of these is an outage the host must alert on, not a property of the
   * traffic.
   */
  readonly storeDegraded: boolean;
  /**
   * Present when the integration itself looks misconfigured. D78. Never
   * changes the decision: the advice is the host's to weigh.
   */
  readonly integrationWarning?: IntegrationWarning;
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
  /** Thresholds for the farming check, and for the D55 positive discount. */
  readonly velocity?: VelocityThresholds;
  /**
   * Discount positive evidence earned with machine-regular gaps. D55.
   *
   * On by default: it is what closes the patient farmer, and it cannot advise worse
   * than `OBSERVE` for a client that only earns positives. Turn it off for a
   * deployment whose legitimate traffic is predominantly automated and whose
   * operators would rather it accrue trust at full rate.
   */
  readonly discountRegularPositives?: boolean;
  /**
   * Use the anomaly classifier (D18) for the D37 concurrence instead of the three
   * threshold comparisons in `diversityConcurs`.
   *
   * Defaults to `false`: the classifier is new, the conjunction is what the D37 gate
   * was reasoned against, and which reads better against a real population is not
   * something generated traffic can settle. The score is reported either way.
   */
  readonly useAnomalyClassifier?: boolean;
  /** Reference profile and weights for the classifier. D18. */
  readonly anomaly?: AnomalyOptions;
  /** Override the weak-signal catalogue. D42. Defaults to the published one. */
  readonly signals?: readonly WeakSignal[];

  /**
   * Called once per evaluation with a structured event. D61.
   *
   * Reporting only. The event is built after the decision is final and the guard
   * does not wait for the sink, so a slow collector cannot slow the advice and a
   * broken one cannot fail the request.
   */
  readonly onAssessment?: (event: AssessmentEvent) => void | Promise<void>;

  /**
   * How that event identifies the entity. D61.
   *
   * Defaults to omitting the reference, so an event log cannot quietly become a
   * second copy of the host user table. A hashed identity keys the event to an
   * entity without carrying it: keep the salt as configuration, and rotating it
   * breaks correlation in the log rather than in the state.
   */
  readonly identity?: AssessmentIdentity;

  /**
   * How long one store operation may hold the evaluation before the guard
   * stops waiting. D76. Defaults to `DEFAULT_STORE_DEADLINE_MS` (100ms); zero
   * disables the bound for a host whose store is deliberately slow.
   *
   * Fail-open (D62) is only as fast as the transport admits, and a transport
   * that retries for minutes turns a store outage into a host outage. Past the
   * deadline the evaluation answers without retained state (a cold start), the
   * assessment and its event carry `storeDegraded: true`, and the state write,
   * if it was the one lost, does not land. Store errors keep their existing
   * semantics; only the wait is bounded.
   */
  readonly storeDeadlineMs?: number;

  /**
   * Surface a warning when one scope's evaluations uniformly hard-violate the
   * same invariant. D78. That uniformity is a host mapping bug — two
   * interactions sharing a scope — and it silently poisons trust for every
   * legitimate user of the scope.
   *
   * Defaults to `{ minConsecutive: DEFAULT_INTEGRATION_WARNING_MIN_CONSECUTIVE
   * }`; `false` turns the warnings off. The warning rides the assessment and
   * the event and never alters the decision.
   */
  readonly integrationWarnings?: false | { readonly minConsecutive?: number };
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
  const velocityThresholds = options.velocity ?? DEFAULT_VELOCITY;
  const anomalyOptions = options.anomaly ?? {};
  const discountPositives = options.discountRegularPositives ?? true;
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;

  /** Chains one in-flight evaluation per entity. D77. */
  const inFlight = new Map<string, Promise<void>>();

  const deadlineMs = options.storeDeadlineMs ?? DEFAULT_STORE_DEADLINE_MS;

  /**
   * Consecutive evaluations per (scope, invariant) that hard-violated the same
   * invariant. D78. Process-local on purpose: the warning describes the host's
   * own configuration, which restarts with the process.
   */
  const uniformHard = new Map<string, Map<string, number>>();
  const warningThreshold =
    options.integrationWarnings === false
      ? undefined
      : (options.integrationWarnings?.minConsecutive ?? DEFAULT_INTEGRATION_WARNING_MIN_CONSECUTIVE);

  /**
   * Track the uniformity signal and return a warning when one (scope, invariant)
   * has fired on this many consecutive evaluations of the scope. An evaluation
   * of the scope without that invariant resets its count: hostile traffic mixes
   * with refusals and other entities, a mapping bug does not.
   */
  function trackUniformHard(scope: string, hard: readonly Violation[]): IntegrationWarning | undefined {
    const byInvariant = uniformHard.get(scope) ?? new Map<string, number>();
    uniformHard.set(scope, byInvariant);
    const fired = new Set(hard.map((violation) => violation.invariant));
    for (const id of [...byInvariant.keys()]) {
      if (!fired.has(id)) byInvariant.delete(id);
    }
    let warning: IntegrationWarning | undefined;
    for (const violation of hard) {
      const count = (byInvariant.get(violation.invariant) ?? 0) + 1;
      byInvariant.set(violation.invariant, count);
      if (count >= warningThreshold! && (warning === undefined || count > warning.count)) {
        warning = { kind: 'uniform-hard-violation', scope, invariant: violation.invariant, count };
      }
    }
    return warning;
  }

  /**
   * Bound one store operation by the deadline. D76.
   *
   * Resolves `{ ok: false }` when the operation did not land in time, in which
   * case the losing promise is left to settle on its own: a `set` that lands
   * after the deadline has already answered still writes the state it was
   * given, which is safe, and a `get` that answers late is simply discarded.
   * Store errors rethrow: only the wait is bounded, not the failure semantics
   * the store itself chose (D62).
   */
  async function bound<T>(operation: Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
    if (!(deadlineMs > 0)) {
      return { ok: true, value: await operation };
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new StoreDeadlineError(deadlineMs)), deadlineMs);
    });
    try {
      return { ok: true, value: await Promise.race([operation, expired]) };
    } catch (error) {
      if (error instanceof StoreDeadlineError) return { ok: false };
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Load state, treating absent and expired alike. D6. */
  async function load(
    entity: string,
    now: number,
  ): Promise<{ state: EntityState; coldStart: boolean; degraded: boolean }> {
    const got = await bound(store.get(entity));
    if (!got.ok) return { state: freshState(now), coldStart: true, degraded: true };

    const stored = got.value;
    if (!stored) return { state: freshState(now), coldStart: true, degraded: false };

    if (isExpired(stored, now, policy.retentionHours)) {
      const deleted = await bound(store.delete(entity));
      return { state: freshState(now), coldStart: true, degraded: !deleted.ok };
    }
    return { state: stored, coldStart: false, degraded: false };
  }

  async function evaluateOnce(input: EvaluateInput): Promise<Assessment> {
    const now = clock.now();
    const startedAt = performance.now();
    const observation = input.observation ?? {};
    const trace: string[] = [];

    const { state, coldStart, degraded } = await load(input.entity, now);
    let storeDegraded = degraded;
    if (coldStart) trace.push('cold start: no retained state, prior is Beta(1,1)');
    if (degraded) {
      trace.push(
        `store degraded: the read did not land within ${deadlineMs}ms, evaluating without retained state (D76)`,
      );
    }

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

      // The uniformity signal runs before anything else consumes the violations,
      // and feeds the report only: it never reaches the decision. D78.
      const integrationWarning =
        scope && warningThreshold !== undefined ? trackUniformHard(scope, hard) : undefined;
      if (integrationWarning) {
        trace.push(
          `integration warning: ${integrationWarning.count} consecutive evaluations of scope "${integrationWarning.scope}" hard-violated "${integrationWarning.invariant}" — that uniformity is a mapping bug, not traffic (D78)`,
        );
      }

      // Evidence: what the host attributed, plus mass owed by soft violations. D38.
      const positive = observation.evidence?.positive
        ? policy.weights[observation.evidence.positive]
        : 0;
      const attributedNegative = observation.evidence?.negative
        ? policy.weights[observation.evidence.negative]
        : 0;
      const signalled = signalMass(observation.signals ?? [], options.signals);
      const negative =
        attributedNegative + softViolationMass(soft, policy.softViolationWeight) + signalled;

      if (signalled > 0) {
        trace.push(
          `${observation.signals?.length ?? 0} weak signal(s) contribute ${signalled} negative mass; they cannot escalate on their own`,
        );
      }

      if (soft.length > 0) {
        trace.push(
          `${soft.length} soft violation(s) contribute ${softViolationMass(soft, policy.softViolationWeight)} negative mass`,
        );
      }

      // The window including this observation, needed before evidence is applied:
      // D55 prices a positive by the shape of the gaps it arrived in.
      const window = pushObservation(
        state.window,
        { at: now, scope: scope ?? 'unscoped' },
        windowSize,
      );

      const credit = discountPositives ? positiveCredit(window, velocityThresholds) : 1;
      const creditedPositive = positive * credit;

      if (positive > 0 && credit < 1) {
        trace.push(
          `positive evidence discounted to ${(credit * 100).toFixed(0)}%: gaps are machine-regular (D55). Negative evidence is never discounted.`,
        );
      }

      const withEvidence = applyEvidence(
        state,
        { positive: creditedPositive, negative },
        now,
        policy.halfLifeHours,
      );
      const updated: EntityState = { ...withEvidence, window };
      const put = await bound(store.set(input.entity, updated));
      if (!put.ok) {
        storeDegraded = true;
        trace.push(
          `store degraded: the state write did not land within ${deadlineMs}ms, this update is lost (D76)`,
        );
      }

      // The anomaly dimension: features over this entity's own recent behavior.
      // Computed from the updated window so the current interaction counts. D36.
      const behavior = behaviorFeatures(updated.window);
      const anomaly = anomalyScore(behavior, anomalyOptions);
      const derived = options.useAnomalyClassifier
        ? anomalyConcurs(behavior, 0.5, anomalyOptions)
        : diversityConcurs(behavior, diversityThresholds);
      const diversity = input.anomalyConcurs ?? derived;

      if (anomaly.score !== undefined) {
        trace.push(
          `anomaly score ${anomaly.score.toFixed(2)}${anomaly.dominant ? `, dominated by ${anomaly.dominant}` : ''}${options.useAnomalyClassifier ? ' (drives concurrence)' : ' (reported only)'}`,
        );
      }

      if (diversity === undefined) {
        trace.push(
          `diversity undetermined: ${behavior.count} observation(s), needs ${diversityThresholds.minObservations}`,
        );
      } else {
        trace.push(
          `diversity ${diversity ? 'concurs' : 'withheld'}: ${behavior.distinctScopes} scope(s), entropy ${behavior.scopeEntropy.toFixed(2)}, gap CV ${behavior.interArrivalCv.toFixed(2)}`,
        );
      }

      // Reported, not acted on. D55 supersedes the D54 floor: pricing the evidence at
      // intake reaches the farmer without a floor that also lands on legitimate
      // automation. This stays because "was this entity farming" is worth being able
      // to read in the trace and in a host's own metrics.
      const farming = farmingSuspected(updated.window, velocityThresholds);
      if (farming === true) {
        trace.push(
          `farming shape observed: rate above ${velocityThresholds.maxObsPerHour}/hr with gaps too regular (CV ${behavior.interArrivalCv.toFixed(2)}). Priced at intake rather than escalated, see D55.`,
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
        // Per-class advice, strongest wins, the same rule the decision layer
        // already uses when several dimensions each advise something. D41.
        const advised = strongest(
          hard.map((violation) => hardViolationDecision(policy.hardViolationDecision, violation.class)),
        );
        if (severity(advised) > severity(decision)) {
          decision = advised;
          trace.push(
            `hard violation of ${hard.map((violation) => violation.invariant).join(', ')}: advises ${advised}, ceiling bypassed`,
          );
        } else {
          trace.push(`hard violation recorded; trust already advises ${decision}`);
        }
      }

      const assessment: Assessment = {
        entity: input.entity,
        decision,
        trust,
        behavior,
        diversity,
        farming,
        anomaly,
        violations: checked.violations,
        hardViolated: hard.length > 0,
        coldStart,
        storeDegraded,
        integrationWarning,
        context: input.context,
        trace,
      };

      // Reporting happens after the advice is settled, and is not awaited. D61.
      if (options.onAssessment) {
        emit(options.onAssessment, options.identity, assessment, now, performance.now() - startedAt);
      }

      return assessment;
  }

  return {
    /**
     * Evaluations of one entity are serialized behind each other. D77.
     *
     * The store contract is `get`/`set`, so two concurrent evaluations of the same
     * entity would both read the same state and the last writer would erase the
     * evidence the other applied. Measured on a real integration before the fix:
     * 5,817 journal rows (1.229%) fell below their decay floor, which is lost
     * update, not decay. Different entities still evaluate concurrently; the slot
     * is removed when its chain settles, so the map holds only in-flight entities.
     */
    async evaluate(input: EvaluateInput): Promise<Assessment> {
      const previous = inFlight.get(input.entity) ?? Promise.resolve();
      const result = previous.then(() => evaluateOnce(input));
      const tail = result.then(
        () => undefined,
        () => undefined,
      );
      inFlight.set(input.entity, tail);
      void tail.then(() => {
        if (inFlight.get(input.entity) === tail) inFlight.delete(input.entity);
      });
      return result;
    },

    /**
     * Forget one entity outright. D22. Same operation retention uses.
     *
     * Waits behind any in-flight evaluation of the same entity, because a delete
     * that lands between `load` and `set` would be resurrected by that write.
     * Unlike evaluation, a delete that misses the deadline throws rather than
     * silently leaving the row behind (D76).
     */
    async forget(entity: string): Promise<void> {
      await (inFlight.get(entity) ?? Promise.resolve());
      const deleted = await bound(store.delete(entity));
      if (!deleted.ok) throw new StoreDeadlineError(deadlineMs);
    },
  };
}

export type Guard = ReturnType<typeof createGuard>;

/**
 * Hand the event to the host sink, and never let that sink touch the advice.
 *
 * The digest is asynchronous, so the event is built off the request path rather than
 * awaited: a host pointing this at a network collector would otherwise add that
 * collector latency to every evaluation. Out of order arrival is therefore possible,
 * which is why each event carries both at and durationMs.
 */
function emit(
  sink: (event: AssessmentEvent) => void | Promise<void>,
  identity: AssessmentIdentity | undefined,
  assessment: Assessment,
  at: number,
  durationMs: number,
): void {
  void (async () => {
    try {
      const event = await toAssessmentEvent(assessment, { at, durationMs, identity });
      await sink(event);
    } catch {
      // A collector that is down, or a digest that is unavailable, is a telemetry
      // problem. The evaluation already answered and its answer stands.
    }
  })();
}
