/**
 * Calibration rules that do not need a browser or a real run. M2.2.
 *
 * The refusals are the part worth testing. A calibration script that quietly prints a
 * table for a dataset that cannot answer the question is worse than one that fails: the
 * table travels, and the caveat does not.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  DEFAULT_CELL,
  MIN_PER_PERSONA,
  audit,
  evaluateCell,
  grid,
  reportText,
  type PolicyCell,
} from './calibration.ts';
import { classify, type LabRecord } from './summary.ts';
import type { PersonaLabel } from './personas.ts';

function row(
  persona: string,
  groundTruth: PersonaLabel,
  index: number,
  options: { stage?: string; status?: number; negative?: boolean; at?: number } = {},
): LabRecord {
  const status = options.status ?? 200;
  const negative = options.negative ?? false;
  return {
    at: options.at ?? 1_700_000_000_000 + index * 1_000,
    entity: 'entity-' + persona,
    method: 'GET',
    path: '/index.html',
    scope: 'demo.page',
    observation: {
      scope: 'demo.page',
      data: {},
      ...(negative ? { evidence: { negative: 'weak' } } : {}),
    },
    status,
    answeredWithDocument: false,
    advice: 'ALLOW',
    hardViolated: false,
    violations: [],
    stage: options.stage ?? 'unknown',
    mean: 0.5,
    mass: 2,
    interArrivalCv: 0.2,
    windowCount: 1,
    anomaly: undefined,
    diversity: undefined,
    farming: undefined,
    signals: [],
    persona,
    groundTruth,
  };
}

/** A run big enough and mixed enough to pass every refusal. */
function healthy(): LabRecord[] {
  const records: LabRecord[] = [];
  for (let persona = 0; persona < 12; persona += 1) {
    const label: PersonaLabel = persona % 3 === 0 ? 'adversarial' : 'legitimate';
    const id = 'persona-' + String(persona);
    for (let index = 0; index < 20; index += 1) {
      records.push(row(id, label, persona * 100 + index, { stage: 'developing' }));
    }
  }
  return records;
}

test('M2.2: a run that is too small is refused, not averaged', () => {
  const records = healthy().slice(0, 30);
  const result = audit(records);
  assert.equal(result.ok, false);
  assert.ok(
    result.reasons.some((reason) => reason.includes('below the')),
    'the reason names the floor it missed: ' + result.reasons.join(' | '),
  );
});

test('M2.2: a persona with too few rows is refused by name', () => {
  const records = healthy();
  let kept = 0;
  const thin = records.filter((record) => {
    if (record.persona !== 'persona-1') return true;
    kept += 1;
    return kept <= 3;
  });
  const result = audit(thin);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((reason) => reason.startsWith('persona-1 has')));
  assert.ok(thin.length > MIN_PER_PERSONA, 'the run as a whole is still big enough');
});

test('M2.2: a run where nothing earned evidence is refused, because no cell could differ', () => {
  const records = healthy().map((record) => ({ ...record, stage: 'unknown' }));
  const result = audit(records);
  assert.equal(result.ok, false);
  assert.ok(
    result.reasons.some((reason) => reason.includes('no request earned evidence')),
    'the reason has to say why the grid would be constant: ' + result.reasons.join(' | '),
  );
});

test('M2.2: a run with one side missing cannot show the other mistake', () => {
  const bothAdversarial = healthy().map((record) => ({ ...record, groundTruth: 'adversarial' as const }));
  const adversarialOnly = audit(bothAdversarial);
  assert.equal(adversarialOnly.ok, false);
  assert.ok(adversarialOnly.reasons.some((reason) => reason.includes('no legitimate persona')));

  const bothLegitimate = healthy().map((record) => ({ ...record, groundTruth: 'legitimate' as const }));
  const legitimateOnly = audit(bothLegitimate);
  assert.equal(legitimateOnly.ok, false);
  assert.ok(legitimateOnly.reasons.some((reason) => reason.includes('no adversarial persona')));
});

test('M2.2: rows without their observation are refused, because they cannot be replayed', () => {
  const records = healthy().map((record, index) =>
    index < 5 ? { ...record, observation: undefined as never } : record,
  );
  const result = audit(records);
  assert.equal(result.ok, false);
  assert.ok(result.reasons.some((reason) => reason.includes('cannot be replayed')));
});

test('M2.2: a healthy run passes the audit', () => {
  const result = audit(healthy());
  assert.deepEqual(result.reasons, []);
  assert.equal(result.ok, true);
});

test('M2.2: the grid covers the shipped cell and moves both axes', () => {
  const cells = grid();
  assert.equal(cells.length, 9);
  assert.ok(
    cells.some(
      (cell) =>
        cell.halfLifeHours === DEFAULT_CELL.halfLifeHours &&
        cell.developingAt === DEFAULT_CELL.developingAt &&
        cell.establishedAt === DEFAULT_CELL.establishedAt,
    ),
    'the shipped policy must be one of the rows, or the table cannot be read against today',
  );
  assert.equal(new Set(cells.map((cell) => cell.halfLifeHours)).size, 3);
  assert.equal(new Set(cells.map((cell) => cell.developingAt)).size, 3);
  for (const cell of cells) assert.ok(cell.establishedAt > cell.developingAt);
});

test('M2.2: a replay under the shipped policy reproduces the recorded advice', async () => {
  // Six refusals for one entity: the recorded run showed this reaches OBSERVE once the
  // evidence mass leaves the prior, so a replay that does not is not replaying.
  const records = Array.from({ length: 6 }, (_, index) =>
    row('scanner', 'adversarial', index, { status: 404, negative: true, at: 1_700_000_000_000 + index * 120 }),
  );
  const outcome = await evaluateCell(records, DEFAULT_CELL);
  const decisions = outcome.decisions['scanner'] ?? {};
  assert.equal(outcome.total, 1);
  assert.ok((decisions['OBSERVE'] ?? 0) > 0, 'the replay has to reach OBSERVE: ' + JSON.stringify(decisions));
  assert.deepEqual(outcome.falseNegatives, ['scanner'], 'watched but never treated is still a miss');
});

test('M2.2: the two mistakes are one rule, used by the report and the grid', () => {
  assert.equal(classify('monitor', 'legitimate', true), 'false-positive');
  assert.equal(classify('reader', 'legitimate', false), 'correct');
  assert.equal(classify('hammer', 'adversarial', true), 'correct');
  assert.equal(classify('scanner', 'adversarial', false), 'false-negative');
});

test('M2.2: the report is a table with the shipped cell marked', () => {
  const cells: PolicyCell[] = [DEFAULT_CELL, { halfLifeHours: 168, developingAt: 5, establishedAt: 9 }];
  const text = reportText(
    cells.map((cell) => ({
      cell,
      falsePositives: [],
      falseNegatives: ['scanner'],
      correct: 13,
      total: 14,
      decisions: {},
    })),
  );
  const lines = text.split('\n');
  assert.equal(lines.length, 3, 'a header and one row per cell');
  assert.ok(lines[1]?.includes('(shipped)'), 'the shipped cell is marked');
  assert.equal(lines[2]?.includes('(shipped)'), false);
  assert.ok(lines[2]?.includes('13/14'));
});
