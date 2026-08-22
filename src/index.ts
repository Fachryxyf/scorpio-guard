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

export { memoryStore, DEFAULT_SWEEP_EVERY } from './core/store.ts';
export type { MemoryStore, MemoryStoreOptions, StateStore } from './core/store.ts';

export { checkStoreConformance, assertConformant } from './core/conformance.ts';
export type { ConformanceResult } from './core/conformance.ts';

export { assessTrust, epistemicStage, trustBand, uncertaintyLevel } from './core/assess.ts';
export type { AssessOptions, TrustAssessment } from './core/assess.ts';

export {
  CONSTRAINT_CLASSES,
  PROOF_SOURCES,
  PROOF_SOURCE_OF,
  checkInvariants,
  hardViolations,
  softViolations,
  softViolationMass,
} from './core/constraints.ts';
export type {
  ConstraintClass,
  Invariant,
  ProofSource,
  Strength,
  Violation,
} from './core/constraints.ts';

export {
  SIGNAL_SOURCES,
  SIGNAL_WEIGHTS,
  WEAK_SIGNALS,
  isWeakSignal,
  signalMass,
  signalsBySource,
} from './core/signals.ts';
export type { SignalSource, SignalWeight, WeakSignal } from './core/signals.ts';

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

export { velocityExceeded, DEFAULT_VELOCITY } from './core/behavior.ts';
export type { VelocityThresholds } from './core/behavior.ts';

export {
  anomalyScore,
  anomalyConcurs,
  DEFAULT_REFERENCE,
  DEFAULT_ANOMALY_WEIGHTS,
  MIN_OBSERVATIONS,
} from './core/anomaly.ts';
export type {
  AnomalyOptions,
  AnomalyReference,
  AnomalyScore,
  AnomalyWeights,
} from './core/anomaly.ts';
