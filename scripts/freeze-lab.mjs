/**
 * Freeze a recorded lab run into a fixture CI can replay. M2.3.
 *
 * The fixture is a contract, not a sample: it holds the observations, the persona labels,
 * and the decisions the model produced at the moment of freezing. A model change that
 * moves a decision breaks `examples/lab/fixture.test.ts`, which is the point. Regenerating
 * the fixture is therefore a deliberate act, taken with the diff in front of you.
 *
 * Rows are trimmed to what a replay needs and the entity keys are replaced with stable
 * short ids, so the file carries no hashed visitor identifier at all.
 *
 *   npm run freeze:lab
 *   npm run freeze:lab -- --run=2026-10-24T15-28-22-310Z
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { DEFAULT_CELL, evaluateCell } from '../examples/lab/calibration.ts';
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
/** @type {{ runId: string, seed: number, chrome: string, node: string, targets: Array<{ id: string }> }} */
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

/** @type {Array<{ at: number, entity: string, persona: string, groundTruth: 'legitimate' | 'adversarial', profile: string, observation: unknown }>} */
const rows = [];
const recorded = new Map();
let origin = Number.POSITIVE_INFINITY;
let key = 0;

for (const target of manifest.targets) {
  const file = join(dir, target.id + '.jsonl');
  if (!existsSync(file)) continue;
  const parsed = parseRecords(readFileSync(file, 'utf8'));
  const entities = new Map();
  for (const record of parsed) {
    const persona = target.id + ':' + record.persona;
    // Keyed by instance, not only by persona: with repetitions (D66) one persona is
    // several visitors, and one shared fixture entity would replay them as a single
    // client carrying eight visits of history.
    const handle = record.persona + '#' + record.entity;
    let entity = entities.get(handle);
    if (entity === undefined) {
      key += 1;
      entity = 'e' + String(key).padStart(2, '0');
      entities.set(handle, entity);
    }
    origin = Math.min(origin, record.at);
    rows.push({
      at: record.at,
      entity,
      persona,
      groundTruth: record.groundTruth,
      // The profile id travels with the row: the replay needs the invariants the row was
      // judged against, and they are code rather than data (see invariantsFor).
      profile: record.profile ?? target.profile,
      observation: record.observation,
    });
    const bucket = recorded.get(persona) ?? {};
    bucket[record.advice] = (bucket[record.advice] ?? 0) + 1;
    recorded.set(persona, bucket);
  }
}

if (rows.length === 0) throw new Error('the run has no rows');
for (const row of rows) row.at = row.at - origin;
rows.sort((left, right) => left.at - right.at);

const outcome = await evaluateCell(rows, DEFAULT_CELL);
const replay = JSON.parse(JSON.stringify(outcome.decisions));

// The replay should reproduce what the observer recorded. If it does not, the freeze is
// about to pin the wrong thing, and that is worth seeing before the file is written.
let drifted = 0;
for (const [persona, decisions] of Object.entries(replay)) {
  const live = recorded.get(persona) ?? {};
  if (JSON.stringify(decisions) !== JSON.stringify(live)) {
    drifted += 1;
    console.log('  drift ' + persona);
    console.log('    recorded ' + JSON.stringify(live));
    console.log('    replay   ' + JSON.stringify(decisions));
  }
}

const fixture = {
  frozenAt: new Date().toISOString(),
  source: runId,
  seed: manifest.seed,
  chrome: manifest.chrome,
  note:
    'Frozen lab run. A model change that moves any decision here must regenerate this' +
    ' file on purpose: npm run freeze:lab. The decisions recorded below are the contract.',
  rows,
  expected: {
    halfLifeHours: DEFAULT_CELL.halfLifeHours,
    developingAt: DEFAULT_CELL.developingAt,
    establishedAt: DEFAULT_CELL.establishedAt,
    decisions: replay,
    falsePositives: outcome.falsePositives,
    falseNegatives: outcome.falseNegatives,
    correct: outcome.correct,
    total: outcome.total,
  },
};

const outDir = resolve('examples', 'lab', 'fixtures');
mkdirSync(outDir, { recursive: true });
const file = join(outDir, 'lab-' + runId.slice(0, 10) + '.json');
writeFileSync(file, JSON.stringify(fixture) + '\n');

console.log('');
console.log('  ' + String(rows.length) + ' rows from ' + runId + ' (' + String(manifest.targets.length) + ' targets)');
console.log('  drift against the live advice: ' + String(drifted) + ' personas');
console.log('  written to ' + file);
console.log('');
