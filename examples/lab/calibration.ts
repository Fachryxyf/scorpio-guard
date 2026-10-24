/**
 * Calibration over a recorded lab run. M2.2.
 *
 * Two things this file refuses to do, both deliberately.
 *
 * It refuses to print a table from a dataset that cannot answer the question. A grid
 * over policy constants only means something if those constants can move a row, and a
 * dataset where no request ever earned evidence produces the same decision under every
 * cell. Nine identical rows would look like a calibration and be a lie, so the audit
 * runs first and the script exits non-zero with the reason instead.
 *
 * It refuses to judge per request. A legitimate persona that was given friction is a
 * false positive however quiet the rest of its traffic was, which is the same rule the
 * lab summary applies (D63).
 */
import { createGuard, type Observation } from '../../src/core/guard.ts';
import { epistemicStage } from '../../src/core/assess.ts';
import type { Policy } from '../../src/core/policy.ts';
import { memoryStore } from '../../src/core/store.ts';
import { classify, isTreatment, type LabRecord } from './summary.ts';

/** Below this, a confusion matrix is a description of one afternoon. */
export const MIN_RECORDS = 240;

/** A persona with a handful of rows cannot be said to have been missed or caught. */
export const MIN_PER_PERSONA = 8;

export type AuditOptions = {
  readonly minRecords?: number;
  readonly minPerPersona?: number;
};

export type Audit = {
  readonly ok: boolean;
  readonly reasons: readonly string[];
};

/**
 * Why this dataset cannot be calibrated, or an empty list.
 *
 * Each reason names the thing that is missing rather than the number that failed, because
 * the number is usually a symptom: 129 rows is not a problem in itself, the problem is
 * that the rows carry nothing a threshold could act on.
 */
export function audit(records: readonly LabRecord[], options: AuditOptions = {}): Audit {
  const minRecords = options.minRecords ?? MIN_RECORDS;
  const minPerPersona = options.minPerPersona ?? MIN_PER_PERSONA;
  const reasons: string[] = [];

  if (records.length < minRecords) {
    reasons.push(
      'the run has ' + String(records.length) + ' recorded requests, below the ' +
        String(minRecords) + ' a grid needs to say anything',
    );
  }

  const byPersona = new Map<string, LabRecord[]>();
  for (const record of records) {
    const bucket = byPersona.get(record.persona);
    if (bucket) bucket.push(record);
    else byPersona.set(record.persona, [record]);
  }

  if (byPersona.size === 0) {
    reasons.push('the run has no rows at all');
    return { ok: false, reasons };
  }

  for (const [persona, rows] of byPersona) {
    if (rows.length < minPerPersona) {
      reasons.push(
        persona + ' has ' + String(rows.length) + ' requests, below the ' +
          String(minPerPersona) + ' that makes its label mean anything',
      );
    }
  }

  const labels = new Set(records.map((record) => record.groundTruth));
  if (!labels.has('legitimate')) reasons.push('no legitimate persona: a false positive cannot be observed');
  if (!labels.has('adversarial')) reasons.push('no adversarial persona: a false negative cannot be observed');

  const withoutObservation = records.filter((record) => record.observation === undefined).length;
  if (withoutObservation > 0) {
    reasons.push(
      String(withoutObservation) + ' rows do not carry the observation that was evaluated, so' +
        ' they cannot be replayed under another policy',
    );
  }

  const stages = new Set(records.map((record) => record.stage));
  if (stages.size === 1 && stages.has('unknown')) {
    reasons.push(
      'every row stayed at the unknown stage: no request earned evidence, so no policy' +
        ' constant can move a decision and every cell of the grid would read the same',
    );
  }

  return { ok: reasons.length === 0, reasons };
}

export type PolicyCell = {
  readonly halfLifeHours: number;
  readonly developingAt: number;
  readonly establishedAt: number;
};

/**
 * The cells to try. Two axes, because those are the two constants that decide how much
 * evidence is enough and how fast it is forgotten; every other constant is either a
 * weight D4 already fixed or a decision D5 already made.
 */
export function grid(): PolicyCell[] {
  const cells: PolicyCell[] = [];
  for (const halfLifeHours of [24, 72, 168]) {
    for (const developingAt of [3, 4, 5]) {
      cells.push({ halfLifeHours, developingAt, establishedAt: developingAt + 4 });
    }
  }
  return cells;
}

/** The cell the library ships with today. */
export const DEFAULT_CELL: PolicyCell = { halfLifeHours: 24, developingAt: 3, establishedAt: 7 };

/**
 * What a replay needs from a row, which is less than a recorded row carries. The
 * frozen fixture stores exactly this, so a fixture cannot be missing a field the replay
 * silently defaults.
 */
export type ReplayRow = {
  readonly at: number;
  readonly entity: string;
  readonly persona: string;
  readonly groundTruth: 'legitimate' | 'adversarial';
  readonly observation?: Observation | undefined;
};

export type CellOutcome = {
  readonly cell: PolicyCell;
  readonly falsePositives: readonly string[];
  readonly falseNegatives: readonly string[];
  readonly correct: number;
  readonly total: number;
  /** persona -> decision -> how many requests. */
  readonly decisions: Readonly<Record<string, Readonly<Record<string, number>>>>;
};

/**
 * Replay the run under one policy.
 *
 * The clock is pinned to each row's own timestamp, so the replay meets the same gaps the
 * observer met. Anything else would calibrate a different dataset than the one recorded.
 */
export async function evaluateCell(
  records: readonly ReplayRow[],
  cell: PolicyCell,
): Promise<CellOutcome> {
  const ordered = [...records].sort((left, right) => left.at - right.at);
  let now = ordered[0]?.at ?? 0;
  const clock = { now: () => now };
  const policy: Partial<Policy> = {
    halfLifeHours: cell.halfLifeHours,
    developingAt: cell.developingAt,
    establishedAt: cell.establishedAt,
  };
  const guard = createGuard({ clock, store: memoryStore(), policy });

  const decisions = new Map<string, Record<string, number>>();
  const labels = new Map<string, 'legitimate' | 'adversarial'>();
  const treated = new Set<string>();

  for (const record of ordered) {
    if (record.observation === undefined) {
      throw new Error('a row at ' + String(record.at) + ' carries no observation');
    }
    now = record.at;
    const assessment = await guard.evaluate({ entity: record.entity, observation: record.observation });

    const counts = decisions.get(record.persona) ?? {};
    counts[assessment.decision] = (counts[assessment.decision] ?? 0) + 1;
    decisions.set(record.persona, counts);
    labels.set(record.persona, record.groundTruth);
    if (isTreatment(assessment.decision)) treated.add(record.persona);
  }

  const falsePositives: string[] = [];
  const falseNegatives: string[] = [];
  let correct = 0;
  for (const [persona, groundTruth] of labels) {
    const verdict = classify(persona, groundTruth, treated.has(persona));
    if (verdict === 'false-positive') falsePositives.push(persona);
    else if (verdict === 'false-negative') falseNegatives.push(persona);
    else correct += 1;
  }

  return {
    cell,
    falsePositives,
    falseNegatives,
    correct,
    total: labels.size,
    decisions: Object.fromEntries(decisions),
  };
}

/** Which epistemic stage a mass falls into, for a reader checking a row by hand. */
export function stageOf(mass: number, cell: PolicyCell = DEFAULT_CELL) {
  return epistemicStage(mass, { developingAt: cell.developingAt, establishedAt: cell.establishedAt });
}

/** A table a person can argue with, not a score. */
export function reportText(outcomes: readonly CellOutcome[]): string {
  const lines = [
    '  half-life  developing  established    FP    FN   correct',
  ];
  for (const outcome of outcomes) {
    const isDefault =
      outcome.cell.halfLifeHours === DEFAULT_CELL.halfLifeHours &&
      outcome.cell.developingAt === DEFAULT_CELL.developingAt;
    lines.push(
      '  ' +
        String(outcome.cell.halfLifeHours).padStart(6) +
        'h' +
        String(outcome.cell.developingAt).padStart(12) +
        String(outcome.cell.establishedAt).padStart(13) +
        String(outcome.falsePositives.length).padStart(6) +
        String(outcome.falseNegatives.length).padStart(6) +
        (String(outcome.correct) + '/' + String(outcome.total)).padStart(10) +
        (isDefault ? '   (shipped)' : ''),
    );
  }
  return lines.join('\n');
}
