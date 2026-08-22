export { watchInteraction, toObservation, EMPTY_COUNTS } from './interaction.ts';
export type {
  CollectorOptions,
  InteractionCounts,
  Observable,
  ValueSource,
} from './interaction.ts';

export { measureLatency, checkAccessWindow } from './timing.ts';
export type {
  LatencyObservation,
  LatencyOptions,
  AccessWindowObservation,
  AccessWindowOptions,
} from './timing.ts';

export { trackBreadth, assessSensitiveTargets, DEFAULT_BREADTH_WINDOW } from './target.ts';
export type {
  BreadthObservation,
  BreadthOptions,
  SensitiveTargetObservation,
  SensitiveTargetOptions,
} from './target.ts';

export { checkSequence, checkEnvironment } from './sequence.ts';
export type {
  SequenceObservation,
  EnvironmentObservation,
  ClientFacts,
} from './sequence.ts';

export { collectSignalIds } from './signals.ts';
export type { CollectedSignals } from './signals.ts';
