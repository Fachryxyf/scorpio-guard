/**
 * Calibration against the first real host integration's journal.
 *
 * The dataset is the CRM host's staging export (5,123 journal rows with
 * pentest ground truth), which lives in `report-sg/` — gitignored on purpose,
 * because it is a partner's data, not this repository's. This script is the
 * one place that reads it. Run from the repository root:
 *
 *   npm run calibrate:host
 *   npm run calibrate:host -- --dir=/path/to/report-sg/guard-dev-export
 *
 * It reports three things, in order of trustworthiness:
 *  1. hard-drift: reconstructed invariants vs the recorded hardViolated column;
 *  2. drift: replayed decisions vs recorded decisions, per row;
 *  3. the policy grid: FP/FN on labelled rows only, unlabelled rows counted.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  conditionKeys,
  evaluateHostCell,
  grid,
  hostInvariants,
  hostReportText,
  labelRows,
  parseHostJournal,
  replayHost,
} from '../examples/lab/host-calibration.ts';

/** @param {string} name */
function option(name) {
  const prefix = '--' + name + '=';
  const match = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  return match?.slice(prefix.length);
}

const dir = option('dir') ?? resolve('report-sg', 'guard-dev-export');
const journalFile = join(dir, 'journal-full-20261031.csv');
const entityFile = join(dir, 'entities', 'entity-hash-map.csv');
const conditionsFile = join(dir, 'conditions', 'hard-violations-all.csv');

if (!existsSync(journalFile)) {
  console.log('no host journal at ' + journalFile);
  console.log('the dataset is not part of this repository; point --dir= at an export');
  process.exitCode = 1;
} else {
  const rows = parseHostJournal(readFileSync(journalFile, 'utf8'));
  console.log('');
  console.log('  host journal: ' + rows.length + ' rows, ' + new Set(rows.map((r) => r.entity)).size + ' entities');

  // 1. Invariant reconstruction, checked directly against the record.
  const checked = await replayHost(rows);
  const driftRows = checked.filter((outcome) => !outcome.violationsMatch);
  console.log('');
  console.log('  violation reconstruction: ' + (rows.length - driftRows.length) + '/' + rows.length + ' rows agree');
  for (const outcome of driftRows.slice(0, 10)) {
    console.log(
      '    - ' + outcome.row.scope + ' @ ' + new Date(outcome.row.at).toISOString() +
        ' recorded ' + outcome.row.recorded + ', replayed ' + outcome.replayed +
        ', facts ' + JSON.stringify(outcome.row.facts).slice(0, 120),
    );
  }
  if (driftRows.length > 10) console.log('    ... and ' + (driftRows.length - 10) + ' more');

  // 2. Labels and composition, stated before any grid is shown.
  const entityMap = new Map(
    existsSync(entityFile)
      ? readFileSync(entityFile, 'utf8')
          .split('\n')
          .slice(1)
          .filter((line) => line.trim())
          .map((line) => {
            // The entity map is a simple three-column CSV with quoted labels.
            const match = line.match(/^([^,]+),([^,]+),"?([^"]*)"?/);
            return match ? [match[1], { kind: match[2], label: match[3] ?? '' }] : undefined;
          })
          .filter(Boolean)
      : [],
  );
  const conditions = existsSync(conditionsFile)
    ? conditionKeys(readFileSync(conditionsFile, 'utf8'))
    : { adversarial: new Set(), legitimate: new Set() };
  const labelled = labelRows(rows, entityMap, conditions.adversarial);
  const composition = { legitimate: 0, adversarial: 0, unlabelled: 0 };
  for (const row of labelled) composition[row.groundTruth] += 1;
  console.log('');
  console.log('  labels: ' + composition.legitimate + ' legitimate rows, ' + composition.adversarial + ' adversarial rows, ' + composition.unlabelled + ' unlabelled (pre-auth entities without ground truth)');

  // 3. The grid. Same nine cells as the lab; the labelled subset is small
  //    enough that only the direction of a move is readable, not a threshold.
  const outcomes = [];
  for (const cell of grid()) outcomes.push(await evaluateHostCell(labelled, cell));
  console.log('');
  console.log(hostReportText(outcomes));
  console.log('');

  const shipped = outcomes[0];
  console.log('  shipped cell: drift ' + shipped.drift + '/' + shipped.total + ' rows, violation-drift ' + shipped.violationDrift +
    ', ' + shipped.falsePositives.length + ' FP entities, ' + shipped.falseNegatives.length + ' FN rows');
  const entityLabel = (hash) => entityMap.get(hash)?.label || entityMap.get(hash)?.kind || hash.slice(0, 12);
  if (shipped.falsePositives.length) {
    console.log('  FP entities: ' + shipped.falsePositives.map(entityLabel).join(', '));
  }
  if (shipped.falseNegatives.length) {
    console.log('  FN rows: ' + shipped.falseNegatives.slice(0, 10).join(', '));
  }
  console.log('');
}
