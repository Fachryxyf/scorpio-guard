/**
 * Drive personas through the observer and report what happened. D45.
 *
 * The observer records one row per interaction; this turns a set of personas into
 * a verdict per persona, which is the granularity the design's claims are stated
 * at: *a legitimate user is never given friction*, and *sustained abuse becomes
 * expensive*.
 *
 * The clock is driven by the persona's own gaps, so a fourteen-day run costs
 * milliseconds and decay, retention and diversity all see real elapsed time.
 */
import type { Decision } from '../../src/core/decision.ts';
import { severity } from '../../src/core/decision.ts';
import type { StateStore } from '../../src/core/store.ts';
import type { Persona } from './personas.ts';
import { createObserver, type Record as ObservedRecord } from './observe.ts';

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
  readonly records: readonly ObservedRecord[];
};

/** `INCREASE_FRICTION` is the first rung a legitimate user would actually feel. */
const FELT: Decision = 'INCREASE_FRICTION';

/** The first rung that makes sustained abuse cost anything. */
const COSTLY: Decision = 'INCREASE_FRICTION';

export async function replayPersona(
  persona: Persona,
  options: { store?: StateStore; startAt?: number } = {},
): Promise<PersonaResult> {
  let current = options.startAt ?? Date.UTC(2026, 0, 1, 7, 0, 0);
  const clock = { now: () => current };

  const observer = createObserver({
    clock,
    ...(options.store ? { store: options.store } : {}),
  });

  let worst: Decision = 'ALLOW';
  let worstAtStep: number | undefined;

  for (const [index, step] of persona.steps.entries()) {
    current += Math.round(step.afterMs);

    const assessment = await observer.observe({
      entity: persona.id,
      event: step.event,
      scope: step.scope,
      data: step.data,
      hostDid: step.hostDid,
      ...(step.evidence ? { evidence: step.evidence } : {}),
      ...(step.signals ? { signals: step.signals } : {}),
    });

    if (severity(assessment.decision) > severity(worst)) {
      worst = assessment.decision;
      worstAtStep = index + 1;
    }
  }

  const records = observer.records();
  const last = records.at(-1);

  return {
    persona: persona.id,
    legitimate: persona.legitimate,
    what: persona.what,
    steps: persona.steps.length,
    worst,
    worstAtStep,
    falsePositive: persona.legitimate && severity(worst) >= severity(FELT),
    walkedThrough: !persona.legitimate && severity(worst) < severity(COSTLY),
    finalStage: last?.stage ?? 'unknown',
    finalMean: last?.mean ?? 0.5,
    records,
  };
}

export async function replayAll(
  personas: readonly Persona[],
  options: { store?: StateStore } = {},
): Promise<readonly PersonaResult[]> {
  const results: PersonaResult[] = [];
  // Sequential and per-persona: each starts from its own clean state, because a
  // shared store would let one persona's history decide another's outcome.
  for (const persona of personas) {
    results.push(await replayPersona(persona, options));
  }
  return results;
}

/** A table an actual human can read, for the report. */
export function formatResults(results: readonly PersonaResult[]): string {
  const rows = results.map((result) => {
    const flag = result.falsePositive
      ? 'FALSE POSITIVE'
      : result.walkedThrough
        ? 'WALKED THROUGH'
        : 'as intended';
    const at = result.worstAtStep ? `@${result.worstAtStep}/${result.steps}` : `-/${result.steps}`;
    return [
      result.persona.padEnd(22),
      (result.legitimate ? 'legit' : 'adversary').padEnd(10),
      result.worst.padEnd(18),
      at.padEnd(9),
      result.finalStage.padEnd(12),
      result.finalMean.toFixed(3).padEnd(7),
      flag,
    ].join(' ');
  });

  const header = [
    'persona'.padEnd(22),
    'kind'.padEnd(10),
    'worst advice'.padEnd(18),
    'at'.padEnd(9),
    'stage'.padEnd(12),
    'mean'.padEnd(7),
    'verdict',
  ].join(' ');

  return [header, '-'.repeat(header.length), ...rows].join('\n');
}
