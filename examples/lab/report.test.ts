/**
 * The published lab report: the numbers the site shows about a recorded run. M2.8.
 *
 * `npm run report:lab` writes `report.json` from a run under `var/lab/`, and the site
 * build reads it, so the page cannot drift from the recording by hand. What this file
 * guards is not the generator but the claims a reader would check: the counters add up,
 * the shipped policy is still the best cell, every persona ran the number of times the
 * manifest declares, and no hashed identifier survived into a committed file.
 *
 * A regenerated report with different numbers is expected to pass. A report where the
 * shipped cell stopped being the best cell is not: that means the policy nobody chose
 * beat the one that ships, and it has to become a decision rather than a diff.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

type Persona = {
  readonly id: string;
  readonly label: string;
  readonly what: string;
  readonly instances: number;
  readonly failures: number;
  readonly requests: number;
  readonly decisions: Readonly<Record<string, number>>;
};

type Target = {
  readonly id: string;
  readonly label: string;
  readonly origin: string;
  readonly rows: number;
  readonly invariants: number;
  readonly personas: readonly Persona[];
};

type Cell = {
  readonly halfLifeHours: number;
  readonly developingAt: number;
  readonly establishedAt: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly correct: number;
  readonly total: number;
  readonly shipped: boolean;
};

type Row = {
  readonly threshold: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly correct: number;
  readonly total: number;
};

type Peak = {
  readonly persona: string;
  readonly groundTruth: string | null;
  readonly max: number | null;
  readonly scored: number;
};

type Report = {
  readonly run: string;
  readonly chrome: string;
  readonly seed: number;
  readonly repeat: number;
  readonly requests: number;
  readonly personas: number;
  readonly targets: readonly Target[];
  readonly grid: readonly Cell[];
  readonly totals: {
    readonly falsePositives: number;
    readonly falseNegatives: number;
    readonly correct: number;
    readonly total: number;
  };
  readonly misses: readonly string[];
  readonly wronged: readonly string[];
  readonly anomaly: readonly Row[];
  readonly peaks: readonly Peak[];
};

const REPORT_FILE = new URL('./report.json', import.meta.url);
const raw = readFileSync(REPORT_FILE, 'utf8');
const report = JSON.parse(raw) as Report;

test('M2.8: the report names the run it came from', function () {
  assert.match(
    report.run,
    /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/,
    'a report without a run id cannot be regenerated or checked against anything',
  );
  assert.notEqual(report.requests, 0);
  assert.notEqual(report.personas, 0);
  assert.notEqual(report.targets.length, 0);
  assert.ok(report.chrome.startsWith('Chrome/'), 'the browser is part of the composition');
  assert.equal(typeof report.seed, 'number');
});

test('M2.8: the counters add up', function () {
  const totals = report.totals;
  assert.equal(totals.total, report.personas, 'the judgement unit is the persona, not the row');
  assert.equal(
    totals.correct + totals.falsePositives + totals.falseNegatives,
    totals.total,
    'a persona that is neither correct nor wrong is an accounting error',
  );
  assert.equal(report.misses.length, totals.falseNegatives);
  assert.equal(report.wronged.length, totals.falsePositives);

  const rows = report.targets.reduce(function (sum, target) {
    return sum + target.rows;
  }, 0);
  assert.equal(rows, report.requests, 'every recorded row belongs to exactly one target');

  const personas = report.targets.reduce(function (sum, target) {
    return sum + target.personas.length;
  }, 0);
  assert.equal(personas, report.personas);

  for (const target of report.targets) {
    const covered = target.personas.reduce(function (sum, persona) {
      return sum + persona.requests;
    }, 0);
    assert.equal(covered, target.rows, target.id + ': rows and per-persona requests disagree');
  }
});

test('M2.8: the shipped policy is still the best cell', function () {
  const shipped = report.grid.filter(function (cell) {
    return cell.shipped;
  });
  assert.equal(shipped.length, 1, 'exactly one cell is marked as the policy the library ships');
  const shippedCell = shipped[0];
  assert.ok(shippedCell !== undefined);

  for (const cell of report.grid) {
    assert.equal(cell.total, report.personas);
    assert.equal(cell.correct + cell.falsePositives + cell.falseNegatives, cell.total);
  }

  const best = Math.max.apply(null, report.grid.map(function (cell) {
    return cell.correct;
  }));
  assert.equal(
    shippedCell.correct,
    best,
    'another cell beat the shipped policy: choose it in DECISIONS.md, or regenerate the report',
  );
  assert.equal(shippedCell.falsePositives, report.totals.falsePositives);
  assert.equal(shippedCell.falseNegatives, report.totals.falseNegatives);
});

test('M2.8: every persona is a population, and its rows are all accounted for', function () {
  assert.notEqual(
    report.repeat,
    1,
    'one visit per persona is not a population; see the identity rule in examples/lab/personas.ts',
  );
  for (const target of report.targets) {
    for (const persona of target.personas) {
      assert.equal(
        persona.instances,
        report.repeat,
        persona.id + ' ran a different number of times than the run declares',
      );
      assert.notEqual(
        persona.instances,
        persona.failures,
        persona.id + ' recorded nothing: every instance failed',
      );
      const decided = Object.values(persona.decisions).reduce(function (sum, count) {
        return sum + count;
      }, 0);
      assert.equal(decided, persona.requests, persona.id + ': decisions do not cover its requests');
      assert.ok(persona.label === 'legitimate' || persona.label === 'adversarial');
    }
  }
});

test('M2.8: no anomaly threshold on this run beats the evidence policy', function () {
  for (const row of report.anomaly) {
    assert.equal(row.total, report.personas);
    assert.equal(row.correct + row.falsePositives + row.falseNegatives, row.total);
  }
  for (const peak of report.peaks) {
    assert.ok(peak.groundTruth === 'legitimate' || peak.groundTruth === 'adversarial');
    if (peak.scored === 0) assert.equal(peak.max, null, 'a persona with no scored row has no peak');
    else assert.equal(typeof peak.max, 'number');
  }
  const best = Math.max.apply(null, report.anomaly.map(function (row) {
    return row.correct;
  }));
  assert.ok(
    best - report.totals.correct <= 0,
    'an anomaly threshold beat the evidence policy: D67 has to be reopened with this data',
  );
});

test('M2.8: no hashed identifier reached the committed report', function () {
  assert.doesNotMatch(
    raw,
    /\b[0-9a-f]{32,}\b/,
    'the report carries a hash; entity hashes belong to the run, not to the site',
  );
  assert.doesNotMatch(raw, /"entity"/, 'per-row identifiers are not part of a report');
});
