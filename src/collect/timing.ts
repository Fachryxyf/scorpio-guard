/**
 * Timing signal collectors. D42.
 *
 * Computes SIG_SUBHUMAN_LATENCY and SIG_OFF_WINDOW_ACCESS client-side.
 * These join SIG_UNIFORM_DELAY_SHAPE which is already derived server-side
 * from behaviorFeatures (interArrivalCv).
 */

export type LatencyObservation = {
  /** True when action completed faster than the configured floor. */
  readonly subhuman: boolean;
  /** Duration in ms from start-of-interaction to completion. */
  readonly durationMs: number;
};

export type LatencyOptions = {
  /**
   * Minimum plausible milliseconds for a deliberate human action on this form.
   * ponytail: host must configure per-form. No single default is correct.
   * Upgrade path: learn per-entity baseline once real traffic exists.
   */
  readonly floorMs: number;
  readonly now?: () => number;
};

/**
 * Measure elapsed time between two marks (e.g. form render → submit).
 * Returns the signal observation the host passes to `evaluate`.
 */
export function measureLatency(startMs: number, options: LatencyOptions): LatencyObservation {
  const now = (options.now ?? Date.now)();
  const durationMs = now - startMs;
  return { subhuman: durationMs < options.floorMs, durationMs };
}

export type AccessWindowOptions = {
  /** Hours (0-23) considered normal. Inclusive both ends. */
  readonly normalStart: number;
  readonly normalEnd: number;
  readonly now?: () => number;
};

export type AccessWindowObservation = {
  readonly offWindow: boolean;
  readonly hour: number;
};

/**
 * SIG_OFF_WINDOW_ACCESS: activity outside normal hours for this application.
 * The host defines what "normal" means.
 */
export function checkAccessWindow(options: AccessWindowOptions): AccessWindowObservation {
  const now = options.now ? new Date(options.now()) : new Date();
  const hour = now.getHours();
  const { normalStart, normalEnd } = options;

  let offWindow: boolean;
  if (normalStart <= normalEnd) {
    offWindow = hour < normalStart || hour > normalEnd;
  } else {
    // Wraps midnight, e.g. 22-6
    offWindow = hour < normalStart && hour > normalEnd;
  }
  return { offWindow, hour };
}
