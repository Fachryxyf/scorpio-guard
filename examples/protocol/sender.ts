/**
 * A batching sender for sg/0.1.
 *
 * Two privacy rules live here rather than in a document: a report waits for the
 * cadence instead of leaving the moment it happens, so a send cannot be lined up
 * with an event, and a batch that cannot be delivered is dropped rather than
 * retried forever, because a retry log is a timeline with fresh timestamps.
 *
 * A prescription it does not understand is counted and ignored. Escalating on an
 * unknown strategy would hand a receiver the power section 5 says it does not have.
 */
import { encodeEnvelope } from '../../src/core/protocol.ts';
import type { SymptomCategory, SymptomDetail } from '../../src/core/symptoms.ts';

export type ReporterOptions = {
  readonly endpoint: string;
  /** Queue length that triggers an early send. */
  readonly batchSize?: number;
  readonly intervalMs?: number;
  readonly timeoutMs?: number;
  readonly maxQueue?: number;
  /** Strategies this instance understands. Anything else is ignored. */
  readonly strategies?: readonly string[];
  readonly fetchImpl?: typeof fetch;
  readonly onApplied?: (prescription: AppliedPrescription) => void;
};

export type AppliedPrescription = {
  readonly category: string;
  readonly detail: string | null;
  readonly strategy: string;
};

export type ReporterStats = {
  readonly queued: number;
  readonly sent: number;
  readonly batches: number;
  readonly failed: number;
  readonly dropped: number;
  readonly applied: number;
  readonly ignored: number;
};

export type FlushResult =
  | { readonly ok: true; readonly sent: number; readonly applied: number; readonly ignored: number }
  | { readonly ok: false; readonly reason: string; readonly dropped: number };

export type Reporter = {
  readonly record: (shape: {
    readonly detail: SymptomDetail;
    readonly category: SymptomCategory;
    readonly entities: number;
  }) => void;
  readonly flush: () => Promise<FlushResult>;
  readonly stats: () => ReporterStats;
  readonly close: () => Promise<void>;
};

type Pending = { readonly detail: SymptomDetail; readonly category: SymptomCategory; readonly entities: number };

export function createReporter(options: ReporterOptions): Reporter {
  const batchSize = options.batchSize ?? 20;
  const intervalMs = options.intervalMs ?? 60 * 1000;
  const timeoutMs = options.timeoutMs ?? 2000;
  const maxQueue = options.maxQueue ?? 200;
  const known = new Set(options.strategies ?? []);
  const call = options.fetchImpl ?? fetch;

  const queue: Pending[] = [];
  const counters = { sent: 0, batches: 0, failed: 0, dropped: 0, applied: 0, ignored: 0 };
  let inFlight: Promise<FlushResult> | null = null;
  let closed = false;

  const timer = setInterval(function () {
    if (queue.length === 0) return;
    void flush();
  }, intervalMs);
  timer.unref();

  function record(shape: Pending): void {
    if (closed) return;
    queue.push(shape);
    if (queue.length > maxQueue) {
      queue.shift();
      counters.dropped += 1;
    }
    if (queue.length >= batchSize) void flush();
  }

  function apply(prescriptions: readonly { strategy?: unknown; category?: unknown; detail?: unknown }[]): number {
    let applied = 0;
    for (const entry of prescriptions) {
      const strategy = typeof entry.strategy === 'string' ? entry.strategy : '';
      if (!known.has(strategy)) {
        counters.ignored += 1;
        continue;
      }
      applied += 1;
      counters.applied += 1;
      if (options.onApplied !== undefined) {
        options.onApplied({
          category: typeof entry.category === 'string' ? entry.category : '',
          detail: typeof entry.detail === 'string' ? entry.detail : null,
          strategy: strategy,
        });
      }
    }
    return applied;
  }

  async function send(): Promise<FlushResult> {
    const batch = queue.splice(0, queue.length);
    if (batch.length === 0) return { ok: true, sent: 0, applied: 0, ignored: 0 };

    const envelope = encodeEnvelope(batch);
    counters.batches += 1;

    let response: Response;
    try {
      response = await call(options.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      counters.failed += 1;
      counters.dropped += batch.length;
      return { ok: false, reason: reasonOf(error), dropped: batch.length };
    }

    if (!response.ok) {
      counters.failed += 1;
      counters.dropped += batch.length;
      return { ok: false, reason: 'status ' + response.status, dropped: batch.length };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      counters.failed += 1;
      counters.dropped += batch.length;
      return { ok: false, reason: 'response is not json', dropped: batch.length };
    }

    const prescriptions = prescriptionsOf(payload);
    if (prescriptions === null) {
      counters.failed += 1;
      counters.dropped += batch.length;
      return { ok: false, reason: 'response is not a prescription envelope', dropped: batch.length };
    }

    counters.sent += batch.length;
    const applied = apply(prescriptions);
    return { ok: true, sent: batch.length, applied: applied, ignored: counters.ignored };
  }

  function flush(): Promise<FlushResult> {
    if (inFlight !== null) return inFlight;
    const run = send().finally(function () {
      inFlight = null;
    });
    inFlight = run;
    return run;
  }

  return {
    record: record,
    flush: flush,
    stats: function (): ReporterStats {
      return {
        queued: queue.length,
        sent: counters.sent,
        batches: counters.batches,
        failed: counters.failed,
        dropped: counters.dropped,
        applied: counters.applied,
        ignored: counters.ignored,
      };
    },
    close: async function (): Promise<void> {
      closed = true;
      clearInterval(timer);
      await flush();
    },
  };
}

function prescriptionsOf(payload: unknown): readonly Record<string, unknown>[] | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as Record<string, unknown>;
  if (typeof body.protocol !== 'string' || !body.protocol.startsWith('sg/0.')) return null;
  if (!Array.isArray(body.prescriptions)) return null;
  return body.prescriptions.filter(function (entry): entry is Record<string, unknown> {
    return typeof entry === 'object' && entry !== null;
  });
}

function reasonOf(error: unknown): string {
  if (error instanceof Error) return error.name + ': ' + error.message;
  return 'send failed';
}
