/**
 * The soak harness: bounded state, bounded memory, stable cost.
 *
 * D1 guarantees the library cannot tell a minted reference from a new visitor, so an
 * attacker who can pick entity keys can always ask for more state. The defence is not
 * detection, it is a cap plus a sweep (D57 in the store, and maxEntities in
 * particular), and the way to know a cap works is to run traffic that tries to break it.
 *
 * Two profiles:
 * - steady: a fixed pool of visitors, the shape of normal traffic.
 * - flood: a new key on every request, the shape of state exhaustion.
 *
 * The clock can be accelerated, so retention and sweeps happen inside a run that lasts
 * minutes. That is stated plainly in docs/SOAK.md: an accelerated run is a test of the
 * cap and the sweep, not a 24 hour memory claim.
 *
 * For a run that is meant to be a memory claim, pace it. `--pace-ms=500` sleeps between
 * iterations so the wall clock is the thing being measured, and `--accel-ms` says how much
 * simulated time each request stands for. A 24 hour run at 500ms pace and 5000ms
 * acceleration is a day of wall clock and ten days of simulated retention, and the two
 * numbers are reported separately because they are not the same claim.
 */
import { createGuard, memoryStore } from '../src/index.ts';
import { sqliteStore } from '../src/store/sqlite.ts';
import { mkdirSync, rmSync, statSync } from 'node:fs';

function flag(name, fallback) {
  const inline = process.argv.find((arg) => arg.startsWith('--' + name + '='));
  if (inline !== undefined) return inline.slice(name.length + 3);
  const index = process.argv.indexOf('--' + name);
  if (index === -1) return fallback;
  const raw = process.argv[index + 1];
  return raw === undefined ? fallback : raw;
}

const seconds = Number(flag('seconds', '60'));
const pool = Number(flag('entities', '500'));
const accelMs = Number(flag('accel-ms', '60000'));
const profile = flag('profile', 'steady');
const kind = flag('store', 'memory');
const maxEntities = Number(flag('max-entities', String(pool)));
const sweepEvery = Number(flag('sweep-every', '512'));
const paceMs = Number(flag('pace-ms', '0'));
const sampleEvery = Number(flag('sample-every', '2000'));
const progressEvery = Number(flag('progress-every', '0'));
const asJson = process.argv.includes('--json');

let simulated = 0;
const clock = { now: () => simulated };

const invariants = [
  {
    id: 'soak.issued',
    class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
    strength: 'hard',
    scope: 'soak',
    holds: (observation) => (observation.data ?? {}).valid !== false,
  },
];

const dbPath = 'var/soak/soak.db';
let store;
if (kind === 'sqlite') {
  mkdirSync('var/soak', { recursive: true });
  // A killed run leaves the write-ahead log behind, and deleting only the database file
  // makes the next run start from whichever of the two SQLite decides to trust.
  for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true });
  store = sqliteStore({ path: dbPath, sweepEvery, maxEntities });
} else {
  store = memoryStore({ sweepEvery, maxEntities });
}

const guard = createGuard({ store, clock, invariants });

/**
 * Fixed-size samples. An unbounded array of timings would be the largest object in
 * the process and the run would report its own bookkeeping as a memory leak.
 */
const LATENCY_SAMPLES = 50_000;
const MEMORY_SAMPLES = 600;
const latencies = new Array(LATENCY_SAMPLES);
const memory = [];
let latencyCount = 0;
let iterations = 0;
let violations = 0;
let peakCount = 0;
const started = Date.now();
let sampledAt = 0;

while (Date.now() - started < seconds * 1000) {
  const entity = profile === 'flood' ? 'minted-' + iterations : 'visitor-' + (iterations % pool);
  const violate = iterations % 17 === 0;
  const observation = violate
    ? { scope: 'soak', data: { valid: false } }
    : { evidence: { positive: iterations % 5 === 0 ? 'strong' : 'weak', negative: iterations % 11 === 0 ? 'weak' : undefined } };

  const began = performance.now();
  const assessed = await guard.evaluate({ entity, observation });
  sampledAt += 1;
  if (sampledAt % 10 === 0) {
    latencies[latencyCount % LATENCY_SAMPLES] = performance.now() - began;
    latencyCount += 1;
  }
  if (assessed.decision === 'RESTRICT' || assessed.decision === 'BLOCK') violations += 1;

  simulated += accelMs;
  iterations += 1;
  if (paceMs > 0) await new Promise((resolve) => setTimeout(resolve, paceMs));

  if (progressEvery > 0 && iterations % progressEvery === 0) {
    // On stderr, so that --json keeps stdout parseable. A day long run with no output is a
    // run nobody can tell apart from a hung one.
    const soFar = latencies.slice(0, Math.min(latencyCount, LATENCY_SAMPLES)).sort((a, b) => a - b);
    const p99SoFar = soFar.length === 0 ? 0 : soFar[Math.min(soFar.length - 1, Math.floor(0.99 * soFar.length))];
    console.error(
      'progress elapsed=' + Math.round((Date.now() - started) / 1000) + 's iterations=' + iterations +
      ' simulated=' + Math.round(simulated / 1000) + 's entities=' + store.size() +
      ' rss=' + (process.memoryUsage().rss / 1e6).toFixed(1) + 'MB p99=' + p99SoFar.toFixed(3) + 'ms',
    );
  }

  if (iterations % sampleEvery === 0 && memory.length < MEMORY_SAMPLES) {
    // Retained memory, not garbage waiting for a lazy collection. Run with --expose-gc.
    globalThis.gc?.();
    const used = process.memoryUsage();
    memory.push({ at: Date.now() - started, rssMb: used.rss / 1e6, heapMb: used.heapUsed / 1e6, entities: store.size() });
    peakCount = Math.max(peakCount, store.size());
  }
}

const finalCount = store.size();
peakCount = Math.max(peakCount, finalCount);

const timings = latencies.slice(0, Math.min(latencyCount, LATENCY_SAMPLES)).sort((a, b) => a - b);
function percentile(p) {
  if (timings.length === 0) return 0;
  const index = Math.min(timings.length - 1, Math.floor((p / 100) * timings.length));
  return Number(timings[index].toFixed(3));
}

const first = memory[0] ?? { rssMb: 0, heapMb: 0 };
const last = memory[memory.length - 1] ?? first;
const warmup = memory[Math.floor(memory.length / 10)] ?? first;
const dbBytes = kind === 'sqlite' ? statSync(dbPath).size : 0;

/**
 * A leak is a trend, not an absolute number. The absolute check above answers whether the
 * process is under a budget; this one answers whether it is still climbing after warmup,
 * which a run of a few minutes cannot show and a run of a day can. Medians of the first and
 * last third survive the sawtooth of collection without smoothing it away.
 */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

const trendSamples = memory.length >= 30 ? Math.floor(memory.length / 3) : 0;
const firstThirdMb = trendSamples === 0 ? 0 : median(memory.slice(0, trendSamples).map((sample) => sample.rssMb));
const lastThirdMb = trendSamples === 0 ? 0 : median(memory.slice(-trendSamples).map((sample) => sample.rssMb));
const trendLimitMb = firstThirdMb * 1.25 + 10;

const report = {
  profile,
  store: kind,
  seconds,
  accelMs,
  paceMs,
  sampleEvery,
  simulatedSeconds: Math.round(simulated / 1000),
  iterations,
  requestsPerSecond: Math.round(iterations / ((Date.now() - started) / 1000)),
  p50: percentile(50),
  p95: percentile(95),
  p99: percentile(99),
  rssStartMb: Number(first.rssMb.toFixed(1)),
  rssEndMb: Number(last.rssMb.toFixed(1)),
  rssWarmupMb: Number(warmup.rssMb.toFixed(1)),
  rssGrowthMb: Number((last.rssMb - warmup.rssMb).toFixed(1)),
  rssFirstThirdMb: Number(firstThirdMb.toFixed(1)),
  rssLastThirdMb: Number(lastThirdMb.toFixed(1)),
  rssTrendSamples: trendSamples,
  heapStartMb: Number(first.heapMb.toFixed(1)),
  heapEndMb: Number(last.heapMb.toFixed(1)),
  heapGrowthMb: Number((last.heapMb - warmup.heapMb).toFixed(1)),
  gcAvailable: Boolean(globalThis.gc),
  finalEntities: finalCount,
  peakEntities: peakCount,
  maxEntities,
  dbBytes,
  violations,
};

const cap = profile === 'flood' ? maxEntities + sweepEvery : pool;
const checks = [
  { name: 'state stays under the cap', ok: peakCount <= cap, detail: 'peak ' + peakCount + ', cap ' + cap },
  { name: 'p99 under 5ms', ok: report.p99 < 5, detail: report.p99 + 'ms' },
  { name: 'rss growth after warmup under 100MB', ok: report.rssGrowthMb < 100, detail: report.rssGrowthMb + 'MB' },
];
if (trendSamples !== 0) {
  checks.push({
    name: 'rss does not trend up across the run',
    ok: lastThirdMb <= trendLimitMb,
    detail: 'first third ' + firstThirdMb.toFixed(1) + 'MB, last third ' + lastThirdMb.toFixed(1) + 'MB, limit ' + trendLimitMb.toFixed(1) + 'MB',
  });
}

if (asJson) {
  console.log(JSON.stringify({ report, checks }, null, 2));
} else {
  console.log('profile ' + profile + ' store ' + kind + ' for ' + seconds + 's');
  console.log('  iterations    ' + report.iterations + ' (' + report.requestsPerSecond + '/s)');
  console.log('  latency       p50 ' + report.p50 + 'ms, p95 ' + report.p95 + 'ms, p99 ' + report.p99 + 'ms');
  if (paceMs > 0) console.log('  pacing        ' + paceMs + 'ms per iteration, ' + report.simulatedSeconds + 's simulated');
  console.log('  rss           ' + report.rssStartMb + 'MB start, ' + report.rssWarmupMb + 'MB warm, ' + report.rssEndMb + 'MB end');
  console.log('  state         ' + report.finalEntities + ' final, ' + report.peakEntities + ' peak, cap ' + cap);
  console.log('  heap          ' + report.heapStartMb + 'MB start, ' + report.heapEndMb + 'MB end' + (report.gcAvailable ? ' (forced gc before each sample)' : ' (run with --expose-gc for retained memory)'));
  if (kind === 'sqlite') console.log('  db            ' + (report.dbBytes / 1e6).toFixed(1) + 'MB');
  if (trendSamples !== 0) console.log('  rss trend     ' + firstThirdMb.toFixed(1) + 'MB first third, ' + lastThirdMb.toFixed(1) + 'MB last third');
  else console.log('  rss trend     not measured (' + memory.length + ' samples, needs 30)');
  for (const check of checks) console.log('  ' + (check.ok ? 'ok  ' : 'FAIL') + ' ' + check.name + ' (' + check.detail + ')');
}

const failed = checks.filter((check) => !check.ok);
if (failed.length !== 0) process.exitCode = 1;
