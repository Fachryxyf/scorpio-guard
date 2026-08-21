/**
 * Observational integration for HealthMe. D34.
 *
 * Records what Scorpio Guard *would* have advised, and changes nothing. The
 * existing lockout and IP limiting are what the guard is being compared against,
 * so removing them before there is evidence would destroy both the comparison and
 * the application's protection at once.
 *
 * The interesting output is disagreement:
 *
 * - guard says ALLOW, HealthMe locked out  -> a false positive HealthMe pays for
 * - guard escalates, HealthMe allowed      -> something HealthMe misses
 */
import { createGuard, type Assessment } from '../../src/core/guard.ts';
import type { Clock } from '../../src/core/clock.ts';
import type { StateStore } from '../../src/core/store.ts';
import { API_SCOPE, UNLOCK_SCOPE, healthmeInvariants, type ApiCall } from './invariants.ts';

/** What HealthMe actually did, for comparison. */
export type HostOutcome = 'allowed' | 'rejected' | 'locked-out' | 'rate-limited';

export type Record = {
  readonly at: number;
  readonly entity: string;
  readonly event: string;
  /** What the guard advised. Never acted upon. */
  readonly advice: Assessment['decision'];
  readonly hostDid: HostOutcome;
  readonly agrees: boolean;
  readonly stage: string;
  readonly trace: readonly string[];
};

export type ObserverOptions = {
  readonly store?: StateStore;
  readonly clock?: Clock;
  /** Where records go. Defaults to collecting in memory. */
  readonly sink?: (record: Record) => void;
};

/**
 * Treatments at or below `INCREASE_FRICTION` are read as "the guard would not
 * have stood in the way", which is what HealthMe's `allowed` means. Friction is
 * counted as agreement with allowing because HealthMe has no friction step \u2014 it
 * has only pass and lockout \u2014 so anything short of RESTRICT is closer to pass.
 */
function permits(advice: Assessment['decision']): boolean {
  return advice === 'ALLOW' || advice === 'OBSERVE' || advice === 'INCREASE_FRICTION';
}

export function createObserver(options: ObserverOptions = {}) {
  const guard = createGuard({
    invariants: healthmeInvariants,
    ...(options.store ? { store: options.store } : {}),
    ...(options.clock ? { clock: options.clock } : {}),
  });

  const records: Record[] = [];
  const emit = options.sink ?? ((record: Record) => records.push(record));

  async function observe(input: {
    readonly entity: string;
    readonly event: string;
    readonly scope: typeof UNLOCK_SCOPE | typeof API_SCOPE;
    readonly data: ApiCall | { from: string; to: string };
    readonly hostDid: HostOutcome;
    /** Evidence the host attributes to this interaction, if any. */
    readonly evidence?: { positive?: 'weak' | 'strong'; negative?: 'weak' | 'strong' };
  }): Promise<Assessment> {
    const assessment = await guard.evaluate({
      entity: input.entity,
      observation: {
        scope: input.scope,
        data: input.data,
        ...(input.evidence ? { evidence: input.evidence } : {}),
      },
    });

    emit({
      at: Date.now(),
      entity: input.entity,
      event: input.event,
      advice: assessment.decision,
      hostDid: input.hostDid,
      agrees: permits(assessment.decision) === (input.hostDid === 'allowed'),
      stage: assessment.trust.stage,
      trace: assessment.trace,
    });

    return assessment;
  }

  return {
    observe,
    records: (): readonly Record[] => records,
    forget: guard.forget,

    /** Disagreements only \u2014 the whole point of running observationally. */
    disagreements: (): readonly Record[] => records.filter((record) => !record.agrees),

    summary() {
      const byOutcome = new Map<string, number>();
      for (const record of records) {
        const key = `${record.hostDid} vs ${record.advice}`;
        byOutcome.set(key, (byOutcome.get(key) ?? 0) + 1);
      }
      return {
        observed: records.length,
        disagreements: records.filter((record) => !record.agrees).length,
        pairs: Object.fromEntries(byOutcome),
      };
    },
  };
}
