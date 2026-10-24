/**
 * What one evaluation costs, per store. M1.5.
 *
 * Why this exists: "cheap enough to run per request" was a claim with no number
 * behind it. The library's own pitch is that the invariant layer answers most decisions
 * locally, and that pitch is only worth reading if the local cost is measured.
 *
 * Two honest limits, stated so the numbers are not read as more than they are:
 *
 * - This is one process on one machine, sequential, with no contention. A real
 *   deployment runs many requests at once against the same keys, which is a different
 *   measurement and a later task (M4.4).
 * - The KV row measures the guard over an in-process transport, so it prices SG's own
 *   work and not the network. The network is the host's latency, not SG's, and a
 *   number here that hid it would be misleading.
 *
 * The budget is a regression alarm, not a target: `--set-budget` records twice the
 * measured p95, and the check fails at twice that again, so an ordinary noisy runner
 * does not turn a slow afternoon into a red build.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { createGuard } from '../src/index.ts';
import { kvStore, memoryTransport } from '../src/store/kv.ts';
import { sqliteStore } from '../src/store/sqlite.ts';

const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 2000);
const WARMUP = 200;
const BUDGET_PATH = 'bench/budget.json';
const SET_BUDGET = process.argv.includes('--set-budget');

function percentile(sorted, fraction) {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
}

async function measure(name, store) {
  const guard = createGuard(store ? { store } : {});

  for (let i = 0; i < WARMUP; i += 1) {
    await guard.evaluate({ entity: 'warmup-' + i, observation: { scope: 'page' } });
  }

  const samples = new Float64Array(ITERATIONS);
  for (let i = 0; i < ITERATIONS; i += 1) {
    const started = performance.now();
    await guard.evaluate({
      entity: 'entity-' + i,
      observation: {
        scope: i % 3 === 0 ? 'checkout' : 'page',
        signals: i % 10 === 0 ? ['SIG_UNIFORM_DELAY_SHAPE'] : [],
      },
    });
    samples[i] = performance.now() - started;
  }

  samples.sort();
  return {
    name,
    p50: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
    p99: percentile(samples, 0.99),
    max: samples[samples.length - 1],
  };
}

const directory = mkdtempSync(join(tmpdir(), 'sg-bench-'));

try {
  const results = [];
  results.push(await measure('memory', undefined));
  results.push(await measure('sqlite', sqliteStore({ path: join(directory, 'bench.db') })));
  results.push(await measure('kv', kvStore({ transport: memoryTransport(), onError: () => {} })));

  const budget = existsSync(BUDGET_PATH) ? JSON.parse(readFileSync(BUDGET_PATH, 'utf8')) : null;

  const rows = results.map((result) => {
    // 1 ms floor: below it, the measurement is mostly timer resolution and GC, and a
    // busy CI runner would fail the build for its own noise rather than for a regression.
    // The sqlite row is what this gate actually guards.
    const allowed =
      budget && budget.stores[result.name]
        ? Math.max(budget.stores[result.name].p95Ms * 2, 1)
        : undefined;
    const verdict = allowed === undefined ? 'n/a' : result.p95 <= allowed ? 'ok' : 'OVER';
    return {
      ...result,
      perSecond: Math.round(1000 / result.p50),
      allowed,
      verdict,
    };
  });

  console.log('store'.padEnd(8) + 'p50 ms'.padEnd(11) + 'p95 ms'.padEnd(11) + 'p99 ms'.padEnd(11) + 'per second'.padEnd(12) + 'budget p95'.padEnd(13) + 'verdict');
  for (const row of rows) {
    console.log(
      row.name.padEnd(8) +
        row.p50.toFixed(4).padEnd(11) +
        row.p95.toFixed(4).padEnd(11) +
        row.p99.toFixed(4).padEnd(11) +
        String(row.perSecond).padEnd(12) +
        (row.allowed === undefined ? 'none'.padEnd(13) : row.allowed.toFixed(4).padEnd(13)) +
        row.verdict,
    );
  }

  if (SET_BUDGET) {
    const recorded = {};
    for (const result of results) {
      recorded[result.name] = { p95Ms: Number((result.p95 * 2).toFixed(4)) };
    }
    const payload = {
      measuredAt: new Date().toISOString().slice(0, 10),
      iterations: ITERATIONS,
      note: 'p95Ms is twice the p95 measured on the recording machine; the check fails at twice this value again.',
      stores: recorded,
    };
    writeFileSync(BUDGET_PATH, JSON.stringify(payload, null, 2) + '\n');
    console.log('budget recorded at ' + BUDGET_PATH);
  }

  const over = rows.filter((row) => row.verdict === 'OVER');
  if (over.length > 0) {
    for (const row of over) {
      console.error(
        'bench: ' + row.name + ' p95 ' + row.p95.toFixed(4) + ' ms exceeds ' + row.allowed.toFixed(4) + ' ms',
      );
    }
    process.exit(1);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
