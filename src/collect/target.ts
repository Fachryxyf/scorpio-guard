/**
 * Target-breadth signal collectors. D42.
 *
 * SIG_BREADTH_OF_TARGET and SIG_SENSITIVE_TARGET are computed from what the
 * host observed being requested — record identifiers and endpoint labels.
 *
 * Ids are hashed before they enter this module's state, so breadth is countable
 * without the guard holding the identifiers themselves. That is the same
 * privacy posture as the rest of the library: shape, never content.
 */

export type BreadthOptions = {
  /** Distinct records above which breadth is reportable. Host-configured. */
  readonly maxDistinctRecords: number;
  /** Bounded set size, so a long session cannot grow memory without limit. */
  readonly windowSize?: number;
};

export const DEFAULT_BREADTH_WINDOW = 200;

export type BreadthObservation = {
  readonly broad: boolean;
  readonly distinctRecords: number;
};

/**
 * Track distinct record identifiers touched within one session.
 *
 * `record()` takes an already-opaque key. If the caller has a raw database id,
 * hash it first — this module deliberately offers no hashing, so the choice of
 * salt and algorithm stays with the host that owns the data.
 */
export function trackBreadth(options: BreadthOptions) {
  const limit = options.windowSize ?? DEFAULT_BREADTH_WINDOW;
  const seen = new Set<string>();
  let overflowed = false;

  return {
    record(opaqueKey: string): void {
      if (seen.size >= limit) {
        overflowed = true;
        return;
      }
      seen.add(opaqueKey);
    },

    observation(): BreadthObservation {
      const distinctRecords = seen.size;
      return {
        // Overflow means the bound was reached, which is itself past any
        // sane threshold — report broad rather than under-report.
        broad: overflowed || distinctRecords > options.maxDistinctRecords,
        distinctRecords,
      };
    },

    reset(): void {
      seen.clear();
      overflowed = false;
    },
  };
}

export type SensitiveTargetOptions = {
  /** Endpoint labels the host marked expensive or sensitive. */
  readonly sensitiveScopes: readonly string[];
  /** Fraction of attention on sensitive scopes above which it is reportable. */
  readonly maxSensitiveRatio: number;
};

export type SensitiveTargetObservation = {
  readonly concentrated: boolean;
  readonly sensitiveRatio: number;
};

/**
 * SIG_SENSITIVE_TARGET: attention concentrated on the endpoints the host
 * marked expensive. Ratio over the scopes actually visited, not over the
 * application's full surface — a two-page app should not read as concentrated
 * simply for having few pages.
 */
export function assessSensitiveTargets(
  visitedScopes: readonly string[],
  options: SensitiveTargetOptions,
): SensitiveTargetObservation {
  if (visitedScopes.length === 0) {
    return { concentrated: false, sensitiveRatio: 0 };
  }
  const sensitive = new Set(options.sensitiveScopes);
  let hits = 0;
  for (const scope of visitedScopes) {
    if (sensitive.has(scope)) hits += 1;
  }
  const sensitiveRatio = hits / visitedScopes.length;
  return { concentrated: sensitiveRatio > options.maxSensitiveRatio, sensitiveRatio };
}
