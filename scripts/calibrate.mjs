/**
 * Calibration over a recorded lab run. M2.2.
 *
 * Reads `var/lab/<run>/`, checks that the run can answer the question at all, and only
 * then replays it under each policy in the grid. If the audit refuses, this exits
 * non-zero and prints the reasons: a refusal is the correct output for a dataset that
 * would produce the same answer under every cell.
 *
 * Plain JavaScript, like the other scripts here, because .mjs is not type-stripped.
 * The logic lives in examples/lab/calibration.ts where the tests can reach it.
 *
 *   npm run calibrate
 *   npm run calibrate -- --run=2026-10-24T15-28-22-310Z
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { audit, evaluateCell, grid, reportText } from '../examples/lab/calibration.ts';
import { parseRecords } from '../examples/lab/summary.ts';

/** @param {string} name */
function option(name) {
  const prefix = '--' + name + '=';
  const match = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  return match?.slice(prefix.length);
}

function latestRun() {
  const root = resolve('var', 'lab');
  if (!existsSync(root)) throw new Error('no runs in var/lab; run npm run lab first');
  const runs = readdirSync(root)
    .filter((name) => existsSync(join(root, name, 'manifest.json')))
    .sort();
  const newest = runs[runs.length - 1];
  if (newest === undefined) throw new Error('no runs in var/lab; run npm run lab first');
  return newest;
}

const runId = option('run') ?? latestRun();
const dir = resolve('var', 'lab', runId);
/** @type {{ runId: string, targets: Array<{ id: string, label: string }> }} */
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

/**
 * Persona ids are reused across targets, so they are qualified here. Two runs of
 * `reader` against two sites are two visitors, and merging them would report one
 * judgement for both.
 */
/** @type {Array<import('../examples/lab/summary.ts').LabRecord>} */
const records = [];
for (const target of manifest.targets) {
  const file = join(dir, target.id + '.jsonl');
  if (!existsSync(file)) continue;
  for (const record of parseRecords(readFileSync(file, 'utf8'))) {
    records.push({ ...record, persona: target.id + ':' + record.persona });
  }
}

console.log('');
console.log('  run ' + runId + ', ' + String(records.length) + ' recorded requests');

const checked = audit(records);
if (!checked.ok) {
  console.log('');
  console.log('  refused. This run cannot calibrate, and a table from it would be fiction:');
  for (const reason of checked.reasons) console.log('    - ' + reason);
  console.log('');
  process.exitCode = 1;
} else {
  /** @type {Array<import('../examples/lab/calibration.ts').CellOutcome>} */
  const outcomes = [];
  for (const cell of grid()) outcomes.push(await evaluateCell(records, cell));
  console.log('');
  console.log(reportText(outcomes));
  console.log('');
  writeFileSync(join(dir, 'calibration.json'), JSON.stringify({ runId, outcomes }, null, 2) + '\n');
  console.log('  written to var/lab/' + runId + '/calibration.json');
  console.log('');
}
