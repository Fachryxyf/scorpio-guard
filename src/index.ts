export { DECISIONS, severity, strongest } from './core/decision.ts';
export type { Decision } from './core/decision.ts';

export { systemClock } from './core/clock.ts';
export type { Clock } from './core/clock.ts';

export {
  DEFAULT_POLICY,
  DEFAULT_HALF_LIFE_HOURS,
  DEFAULT_RETENTION_HOURS,
  DEFAULT_WEIGHTS,
  DEFAULT_TRUST_BANDS,
  DEFAULT_UNCERTAINTY_BANDS,
  DEFAULT_SOFT_VIOLATION_WEIGHT,
  DEFAULT_HARD_VIOLATION_DECISION,
  DEFAULT_EPISTEMIC_STAGES,
} from './core/policy.ts';
export type { EpistemicStage, Policy, TrustBand, UncertaintyLevel } from './core/policy.ts';

export {
  freshState,
  decayFactor,
  decayedMass,
  applyEvidence,
  evidenceMass,
  expectedTrust,
  uncertainty,
  isExpired,
} from './core/trust.ts';
export type { EntityState } from './core/trust.ts';

export { memoryStore } from './core/store.ts';
export type { StateStore } from './core/store.ts';

export { assessTrust, epistemicStage, trustBand, uncertaintyLevel } from './core/assess.ts';
export type { AssessOptions, TrustAssessment } from './core/assess.ts';

export {
  CONSTRAINT_CLASSES,
  checkInvariants,
  hardViolations,
  softViolations,
  softViolationMass,
} from './core/constraints.ts';
export type { ConstraintClass, Invariant, Strength, Violation } from './core/constraints.ts';

export { transitionGraph } from './core/transitions.ts';
export type { Transition } from './core/transitions.ts';

export { createGuard } from './core/guard.ts';
export type {
  Assessment,
  EvaluateInput,
  EvaluationContext,
  EvidenceStrength,
  Guard,
  GuardOptions,
  Observation,
} from './core/guard.ts';

export {
  behaviorFeatures,
  diversityConcurs,
  pushObservation,
  DEFAULT_DIVERSITY,
  DEFAULT_WINDOW_SIZE,
} from './core/behavior.ts';
export type {
  BehaviorFeatures,
  DiversityThresholds,
  ObservationTrace,
} from './core/behavior.ts';
