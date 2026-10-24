/**
 * Reading a lab run back: what each persona was given, and whether it was right. M2.1.
 *
 * The unit of judgement here is the persona, not the request. A legitimate visitor
 * who received friction is a false positive even if ninety percent of their requests
 * were allowed, and an adversarial one who was never given any is a false negative
 * even if their requests were watched closely. Counting per request would let a chatty
 * lab target hide exactly the mistake that matters.
 *
 * `OBSERVE` is not a treatment. It records more and changes nothing, so a persona that
 * only ever saw `OBSERVE` was not interfered with, and lumping it in with friction
 * would make the lab look worse than the product is.
 */
import type { Decision } from '../../src/core/decision.ts';
import type { LiveRecord } from '../ixfe/live/proxy.ts';
import type { PersonaLabel } from './personas.ts';

export type LabRecord = LiveRecord & {
  readonly persona: string;
  readonly groundTruth: PersonaLabel;
};

/** Decisions that change what the visitor can do. */
export const TREATMENTS: readonly Decision[] = ['INCREASE_FRICTION', 'RESTRICT', 'BLOCK'];

export type PersonaSummary = {
  readonly persona: string;
  readonly groundTruth: PersonaLabel;
  readonly requests: number;
  /** How many requests carried each decision, including the ones that changed nothing. */
  readonly decisions: Record<string, number>;
  /** 1-based request that first carried a treatment, or null if none did. */
  readonly escalatedAt: number | null;
  readonly firstTreatment: string | null;
  readonly lastDecision: string | null;
};

export function isTreatment(decision: string): boolean {
  return (TREATMENTS as readonly string[]).includes(decision);
}

export function summarisePersona(records: readonly LabRecord[]): PersonaSummary {
  const first = records[0];
  if (!first) throw new Error('a persona with no requests was never observed');

  const decisions: Record<string, number> = {};
  let escalatedAt: number | null = null;
  let firstTreatment: string | null = null;

  records.forEach((record, index) => {
    decisions[record.advice] = (decisions[record.advice] ?? 0) + 1;
    if (escalatedAt === null && isTreatment(record.advice)) {
      escalatedAt = index + 1;
      firstTreatment = record.advice;
    }
  });

  return {
    persona: first.persona,
    groundTruth: first.groundTruth,
    requests: records.length,
    decisions,
    escalatedAt,
    firstTreatment,
    lastDecision: records[records.length - 1]?.advice ?? null,
  };
}

/** One summary per persona, in first-seen order. */
export function summarise(records: readonly LabRecord[]): PersonaSummary[] {
  const byPersona = new Map<string, LabRecord[]>();
  for (const record of records) {
    const bucket = byPersona.get(record.persona);
    if (bucket) bucket.push(record);
    else byPersona.set(record.persona, [record]);
  }
  return [...byPersona.values()].map((bucket) => summarisePersona(bucket));
}

export type Verdicts = {
  /** Legitimate personas that were given friction. */
  readonly falsePositives: readonly string[];
  /** Adversarial personas that were never given any. */
  readonly falseNegatives: readonly string[];
  readonly correct: readonly string[];
};

export function verdicts(summaries: readonly PersonaSummary[]): Verdicts {
  const falsePositives: string[] = [];
  const falseNegatives: string[] = [];
  const correct: string[] = [];

  for (const summary of summaries) {
    const treated = summary.escalatedAt !== null;
    if (summary.groundTruth === 'legitimate') (treated ? falsePositives : correct).push(summary.persona);
    else (treated ? correct : falseNegatives).push(summary.persona);
  }

  return { falsePositives, falseNegatives, correct };
}

/** JSONL, one record per line, as the observer wrote it. */
export function parseRecords(text: string): LabRecord[] {
  const records: LabRecord[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    records.push(JSON.parse(line) as LabRecord);
  }
  return records;
}
