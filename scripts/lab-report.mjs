/**
 * A compact report of a recorded lab run, for the site. M2.8.
 *
 * The site must not carry hand-typed numbers, and it must not read `var/` either: that
 * directory is a scratch area and is not committed. So this script reads a recorded run
 * once and writes the small, committed `examples/lab/report.json` that the site build
 * consumes. `examples/lab/report.test.ts` then holds the committed file to the invariants
 * a reader would check by hand, and `site:check` fails if a page drifts from it.
 *
 *   npm run report:lab
 *   npm run report:lab -- --run=2026-10-25T00-45-46-089Z
 *
 * Plain JavaScript, like the other scripts here, because .mjs is not type-stripped.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const labDir = resolve(root, 'var/lab');
const out = resolve(root, 'examples/lab/report.json');

/** Thresholds a reader would try if they wanted the score to decide. M2.4, D67. */
const THRESHOLDS = [0.8, 0.9, 0.95, 0.99];

/** The policy the library ships, which the calibration marks rather than assumes. */
const SHIPPED = { halfLifeHours: 24, developingAt: 3, establishedAt: 7 };

function option(name) {
  const prefix = '--' + name + '=';
  const match = process.argv.slice(2).find(function (argument) {
    return argument.startsWith(prefix);
  });
  return match === undefined ? undefined : match.slice(prefix.length);
}

/** The newest run that carries a calibration, or the one asked for by name. */
function pickRun() {
  const asked = option('run');
  if (asked !== undefined) return asked;
  const runs = readdirSync(labDir).filter(function (name) {
    return existsSync(join(labDir, name, 'calibration.json'));
  });
  runs.sort();
  const last = runs[runs.length - 1];
  if (last === undefined) throw new Error('no recorded run with a calibration in ' + labDir);
  return last;
}

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function rows(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(function (line) {
      return line.length !== 0;
    })
    .map(function (line) {
      return JSON.parse(line);
    });
}

/** True when a score would trip this threshold, written without comparisons to trip on. */
function reaches(value, threshold) {
  if (value === null) return false;
  return !(value < threshold);
}

const runId = pickRun();
const dir = join(labDir, runId);
const manifest = json(join(dir, 'manifest.json'));
const calibration = json(join(dir, 'calibration.json'));

const shipped = calibration.outcomes.find(function (outcome) {
  return outcome.cell.halfLifeHours === SHIPPED.halfLifeHours
    && outcome.cell.developingAt === SHIPPED.developingAt
    && outcome.cell.establishedAt === SHIPPED.establishedAt;
}) ?? calibration.outcomes[0];

const targets = [];
const scored = [];
let requests = 0;

for (const target of manifest.targets) {
  const recorded = rows(join(dir, target.id + '.jsonl'));
  requests += recorded.length;

  for (const row of recorded) {
    if (typeof row.anomaly !== 'number') continue;
    scored.push({
      persona: target.id + ':' + row.persona,
      groundTruth: row.groundTruth,
      anomaly: row.anomaly,
    });
  }

  targets.push({
    id: target.id,
    label: target.label,
    origin: target.origin,
    rows: recorded.length,
    invariants: target.invariants,
    personas: target.personas.map(function (persona) {
      return {
        id: target.id + ':' + persona.id,
        label: persona.label,
        what: persona.what,
        instances: persona.instances,
        failures: persona.failures,
        requests: persona.requests,
        decisions: shipped.decisions[target.id + ':' + persona.id] ?? {},
      };
    }),
  });
}

// Every persona carries a label, including the ones whose rows were all page views and
// so never scored. Taking the label from the rows would leave those unlabelled and let a
// threshold score better by forgetting them.
const truth = new Map();
for (const target of manifest.targets) {
  for (const persona of target.personas) {
    truth.set(target.id + ':' + persona.id, persona.label);
  }
}

const peaks = Object.keys(shipped.decisions).map(function (persona) {
  const own = scored.filter(function (row) {
    return row.persona === persona;
  });
  const max = own.length === 0 ? null : Math.max.apply(null, own.map(function (row) {
    return row.anomaly;
  }));
  return {
    persona,
    groundTruth: truth.get(persona) ?? null,
    max,
    scored: own.length,
  };
}).sort(function (a, b) {
  return (b.max ?? -1) - (a.max ?? -1);
});

const anomaly = THRESHOLDS.map(function (threshold) {
  const falsePositives = peaks.filter(function (peak) {
    return peak.groundTruth === 'legitimate' && reaches(peak.max, threshold);
  }).length;
  const falseNegatives = peaks.filter(function (peak) {
    return peak.groundTruth === 'adversarial' && !reaches(peak.max, threshold);
  }).length;
  return {
    threshold,
    falsePositives,
    falseNegatives,
    correct: peaks.length - falsePositives - falseNegatives,
    total: peaks.length,
  };
});

const report = {
  run: runId,
  startedAt: manifest.startedAt,
  durationMinutes: Math.round(
    (Date.parse(manifest.finishedAt) - Date.parse(manifest.startedAt)) / 60000,
  ),
  node: manifest.node,
  platform: manifest.platform,
  chrome: manifest.chrome,
  seed: manifest.seed,
  repeat: manifest.repeat,
  requests,
  personas: peaks.length,
  note: manifest.note,
  identity: manifest.identity,
  targets,
  grid: calibration.outcomes.map(function (outcome) {
    return {
      halfLifeHours: outcome.cell.halfLifeHours,
      developingAt: outcome.cell.developingAt,
      establishedAt: outcome.cell.establishedAt,
      falsePositives: outcome.falsePositives.length,
      falseNegatives: outcome.falseNegatives.length,
      correct: outcome.correct,
      total: outcome.total,
      shipped: outcome === shipped,
    };
  }),
  totals: {
    falsePositives: shipped.falsePositives.length,
    falseNegatives: shipped.falseNegatives.length,
    correct: shipped.correct,
    total: shipped.total,
  },
  misses: shipped.falseNegatives,
  wronged: shipped.falsePositives,
  anomaly,
  peaks,
};

writeFileSync(out, JSON.stringify(report, null, 1) + '\n');
console.log('  run ' + runId + ': ' + requests + ' requests, ' + peaks.length + ' personas, '
  + report.totals.falsePositives + ' false positives, ' + report.totals.falseNegatives
  + ' misses');
console.log('  written to ' + out);
