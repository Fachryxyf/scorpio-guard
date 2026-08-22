/**
 * Signal aggregator. D42.
 *
 * Converts collector observations into the signal IDs that `guard.evaluate`
 * accepts. Each collector produces a typed observation; this module maps them to
 * the weak-signal catalogue identifiers so the host has one integration point
 * rather than knowing every signal's ID.
 */

import type { LatencyObservation, AccessWindowObservation } from './timing.ts';
import type { BreadthObservation, SensitiveTargetObservation } from './target.ts';
import type { SequenceObservation, EnvironmentObservation } from './sequence.ts';
import type { BehaviorFeatures } from '../core/behavior.ts';
import { DEFAULT_DIVERSITY, type DiversityThresholds } from '../core/behavior.ts';

export type CollectedSignals = {
  readonly latency?: LatencyObservation;
  readonly accessWindow?: AccessWindowObservation;
  readonly breadth?: BreadthObservation;
  readonly sensitiveTarget?: SensitiveTargetObservation;
  readonly sequence?: SequenceObservation;
  readonly environment?: EnvironmentObservation;
  /** Server-side features, when available. */
  readonly behavior?: BehaviorFeatures;
  readonly diversityThresholds?: DiversityThresholds;
};

/**
 * Reduce collector outputs into the catalogue IDs the guard consumes.
 *
 * Returns only the signals that fired, never the ones that didn't. The guard
 * ignores unknown IDs anyway, but a short list is cheaper to transmit and
 * easier to trace.
 */
export function collectSignalIds(collected: CollectedSignals): string[] {
  const ids: string[] = [];

  if (collected.latency?.subhuman) ids.push('SIG_SUBHUMAN_LATENCY');
  if (collected.accessWindow?.offWindow) ids.push('SIG_OFF_WINDOW_ACCESS');
  if (collected.breadth?.broad) ids.push('SIG_BREADTH_OF_TARGET');
  if (collected.sensitiveTarget?.concentrated) ids.push('SIG_SENSITIVE_TARGET');
  if (collected.sequence?.novel) ids.push('SIG_UNUSUAL_SEQUENCE');
  if (collected.environment?.mismatch) ids.push('SIG_ENVIRONMENT_MISMATCH');

  // Server-side computed signals from BehaviorFeatures
  if (collected.behavior) {
    const thresholds = collected.diversityThresholds ?? DEFAULT_DIVERSITY;
    if (collected.behavior.interArrivalCv < thresholds.minInterArrivalCv && collected.behavior.count >= 4) {
      ids.push('SIG_UNIFORM_DELAY_SHAPE');
    }
    if (collected.behavior.scopeEntropy < thresholds.minScopeEntropy && collected.behavior.distinctScopes < thresholds.minDistinctScopes && collected.behavior.count >= 4) {
      ids.push('SIG_REPEATED_PATTERN');
    }
    if (collected.behavior.immediateRepeatRatio > 0.7 && collected.behavior.count >= 4) {
      ids.push('SIG_IMMEDIATE_REPEAT');
    }
  }

  return ids;
}
