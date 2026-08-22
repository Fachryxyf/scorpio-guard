/**
 * Drive personas through a guard and report what happened. D45, generalised by D47.
 *
 * One row per interaction is too fine a grain to argue about; the design's claims
 * are stated per *visitor* — a legitimate user is never given friction, sustained
 * abuse becomes expensive — so this reports a verdict per persona.
 *
 * The clock is driven by the persona's own gaps, so a fourteen-day run costs
 * milliseconds while decay, retention and diversity all see real elapsed time.
 */
import type { Invariant } from '../../src/core/constraints.ts';
import { severity, type Decision } from '../../src/core/decision.ts';
import { createGuard, type Assessment } from '../../src/core/guard.ts';
import type { VelocityThresholds } from '../../src/core/behavior.ts';
import type { Policy } from '../../src/core/policy.ts';
import type { StateStore } from '../../src/core/store.ts';
import type { HostOutcome, Persona } from './persona.ts';

export type Observed = {
  readonly at: number;
  readonly entity: string;
  readonly event: string;
  /** What the guard advised. Never acted upon. */
  readonly advice: Decision;
  readonly hostDid: HostOutcome;
  readonly agrees: boolean;
  readonly stage: string;
  readonly mean: number;
  readonly mass: number;
  readonly diversity: boolean | undefined;
  /** Whether the velocity ceiling engaged. D50. */
  readonly farming: boolean | undefined;
  /** Distance from the reference behavior profile, or `undefined` when unscored. D52. */
  readonly anomaly: number | undefined;
  readonly hardViolated: boolean;
  readonly trace: readonly string[];
};

export type PersonaResult = {
  readonly persona: string;
  readonly legitimate: boolean;
  readonly what: string;
  readonly steps: number;
  /** The most interventionist advice this persona ever received. */
  readonly worst: Decision;
  /** The step where `worst` was first reached, 1-based. */
  readonly worstAtStep: number | undefined;
  /** True when a legitimate persona was given friction or worse. */
  readonly falsePositive: boolean;
  /** True when an illegitimate persona never got past OBSERVE. */
  readonly walkedThrough: boolean;
  readonly finalStage: string;
  readonly finalMean: number;
  /** True when the velocity ceiling engaged on any step. D50. */
  readonly farmingSeen: boolean;
  /** Highest anomaly score reached, or `undefined` if never scored. D52. */
  readonly peakAnomaly: number | undefined;
  readonly records: readonly Observed[];
};

/**
 * `INCREASE_FRICTION` is the first rung a legitimate user would actually feel, and
 * therefore both the false-positive line and the line at which abuse starts to
 * cost something. One constant, two readings — they are the same threshold seen
 * from either side.
 */
const FELT: Decision = 'INCREASE_FRICTION';

export type ReplayOptions = {
  readonly invariants?: readonly Invariant[];
  readonly store?: StateStore;
  readonly policy?: Partial<Policy>;
  readonly startAt?: number;
  /**
   * Read as "the host would not have stood in the way". A host with no friction
   * step — only pass and reject — should count friction as agreement with passing.
   */
  readonly permits?: (advice: Decision) => boolean;
  /** Velocity thresholds for the farming ceiling. D50. */
  readonly velocity?: VelocityThresholds;
  /** Let the anomaly classifier drive the D37 concurrence instead of the conjunction. D52. */
  readonly useAnomalyClassifier?: boolean;
};

const defaultPermits = (advice: Decision): boolean => severity(advice) < severity('RESTRICT');

export async function replayPersona(
  persona: Persona,
  options: ReplayOptions = {},
): Promise<PersonaResult> {
  let current = options.startAt ?? Date.UTC(2026, 0, 1, 7, 0, 0);
  const permits = options.permits ?? defaultPermits;

  const guard = createGuard({
    clock: { now: () => current },
    ...(options.invariants ? { invariants: options.invariants } : {}),
    ...(options.store ? { store: options.store } : {}),
    ...(options.policy ? { policy: options.policy } : {}),
    ...(options.velocity ? { velocity: options.velocity } : {}),
    ...(options.useAnomalyClassifier ? { useAnomalyClassifier: true } : {}),
  });

  const records: Observed[] = [];
  let worst: Decision = 'ALLOW';
  let worstAtStep: number | undefined;

  for (const [index, step] of persona.steps.entries()) {
    current += Math.round(step.afterMs);
    const entity = step.entity ?? persona.id;

    const assessment: Assessment = await guard.evaluate({
      entity,
      observation: {
        scope: step.scope,
        data: step.data,
        ...(step.evidence ? { evidence: step.evidence } : {}),
        ...(step.signals ? { signals: step.signals } : {}),
      },
    });

    records.push({
      at: current,
      entity,
      event: step.event,
      advice: assessment.decision,
      hostDid: step.hostDid,
      agrees: permits(assessment.decision) === (step.hostDid === 'allowed'),
      stage: assessment.trust.stage,
      mean: assessment.trust.mean,
      mass: assessment.trust.mass,
      diversity: assessment.diversity,
      farming: assessment.farming,
      anomaly: assessment.anomaly.score,
      hardViolated: assessment.hardViolated,
      trace: assessment.trace,
    });

    if (severity(assessment.decision) > severity(worst)) {
      worst = assessment.decision;
      worstAtStep = index + 1;
    }
  }

  const last = records.at(-1);

  return {
    persona: persona.id,
    legitimate: persona.legitimate,
    what: persona.what,
    steps: persona.steps.length,
    worst,
    worstAtStep,
    falsePositive: persona.legitimate && severity(worst) >= severity(FELT),
    walkedThrough: !persona.legitimate && severity(worst) < severity(FELT),
    finalStage: last?.stage ?? 'unknown',
    finalMean: last?.mean ?? 0.5,
    farmingSeen: records.some((record) => record.farming === true),
    peakAnomaly: peakOf(records),
    records,
  };
}

export async function replayAll(
  personas: readonly Persona[],
  options: ReplayOptions = {},
): Promise<readonly PersonaResult[]> {
  const results: PersonaResult[] = [];
  // Sequential, each from its own clean state: a shared store would let one
  // persona's history decide another's outcome, which is not what is being tested.
  for (const persona of personas) {
    results.push(await replayPersona(persona, options));
  }
  return results;
}

/** Disagreements between the host and the guard — the interesting output. */
export function disagreements(results: readonly PersonaResult[]): readonly Observed[] {
  return results.flatMap((result) => result.records.filter((record) => !record.agrees));
}

/** A table an actual human can read. */
export function formatResults(results: readonly PersonaResult[]): string {
  const columns = [
    ['persona', 22],
    ['kind', 10],
    ['worst advice', 18],
    ['at', 9],
    ['stage', 12],
    ['mean', 7],
    ['anom', 6],
    ['vel', 5],
    ['verdict', 0],
  ] as const;

  const header = columns.map(([label, width]) => label.padEnd(width)).join(' ');

  const rows = results.map((result) => {
    const verdict = result.falsePositive
      ? 'FALSE POSITIVE'
      : result.walkedThrough
        ? 'WALKED THROUGH'
        : 'as intended';
    const at = result.worstAtStep ? `@${result.worstAtStep}/${result.steps}` : `-/${result.steps}`;

    return [
      result.persona,
      result.legitimate ? 'legit' : 'adversary',
      result.worst,
      at,
      result.finalStage,
      result.finalMean.toFixed(3),
      result.peakAnomaly === undefined ? '-' : result.peakAnomaly.toFixed(2),
      result.farmingSeen ? 'yes' : '-',
      verdict,
    ]
      .map((cell, index) => cell.padEnd(columns[index]![1]))
      .join(' ');
  });

  return [header, '-'.repeat(header.length), ...rows].join('\n');
}

function peakOf(records: readonly Observed[]): number | undefined {
  let peak: number | undefined;
  for (const record of records) {
    if (record.anomaly === undefined) continue;
    if (peak === undefined || record.anomaly > peak) peak = record.anomaly;
  }
  return peak;
}
