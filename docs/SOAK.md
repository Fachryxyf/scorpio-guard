# Soak: bounded state, bounded memory, stable cost

H18 asks for a 24 hour soak with limits on memory and state count. This document is the
harness, the thresholds, and the runs that exist so far. The 24 hour run does not exist
yet, so M4.4 stays open and 1.0.0 stays withheld (D1.1 is the root of trust, this is the
memory side of the same discipline).

## What is being proved

An entity key is attacker-controlled (D1.1, D72), so a request that mints a fresh reference
is indistinguishable from a new visitor. The defence is a cap plus a sweep in the store
(`maxEntities`, `sweepEvery`, retention enforced on read), and the only way to know the cap
holds is to run traffic that tries to break it while watching three numbers:

1. **state count**, which must stay under the cap;
2. **retained memory**, which must plateau rather than climb;
3. **p99 latency**, which must stay inside the bench budget.

## The harness

`scripts/soak.mjs`, run as `npm run soak` or `npm run soak:flood`. Two profiles:

- **steady**: a fixed pool of visitors, the shape of normal traffic.
- **flood**: a new reference on every request, the shape of state exhaustion.

Flags: `--seconds`, `--entities`, `--store=memory|sqlite`, `--max-entities`, `--sweep-every`,
`--accel-ms` (simulated milliseconds per request, so retention and sweeps fire inside a
short run), `--json`.

Each run exits non-zero if any check fails. The checks are the same in the local runs below
and in CI:

| Check | Threshold |
|---|---|
| State stays under the cap | `maxEntities + sweepEvery` for flood, the pool size for steady |
| p99 | under 5 ms |
| Retained RSS after warmup | growth under 100 MB |

Memory is sampled with a forced collection (`--expose-gc`), so the number is the retained
set rather than garbage waiting for a lazy sweep. Without the flag the script prints a note
saying so, and RSS readings then include uncollected churn.

## Runs recorded

macOS, Node 22.16.0, shipped policy. These describe this harness on this machine, not a
throughput claim about any deployment.

| Run | Iterations | Rate | p50 / p95 / p99 | State | RSS after warmup | Heap |
|---|---|---|---|---|---|---|
| steady, memory, 500 visitors, 30 s | 1,992,425 | 66.4k/s | 0.009 / 0.012 / 0.035 ms | 500 of 500 cap | +0.3 MB | 10.6 to 11.4 MB |
| flood, memory, cap 500, sweep 512, 30 s | 4,140,962 | 137.9k/s | 0.003 / 0.004 / 0.012 ms | 996 peak of 1012 allowed | +0.3 MB | 10.6 to 10.9 MB |
| steady, sqlite, 300 visitors, 20 s | 52,581 | 2.6k/s | 0.258 / 1.218 / 2.552 ms | 300 of 300 cap | +0.3 MB | 10.4 to 10.6 MB |
| CI: steady, 200 visitors, 20 s, sweep 64 | pass | 66k/s | p99 0.028 ms | 200 of 200 cap | +0.7 MB | 10.5 to 11.0 MB |
| CI: flood, cap 200, 20 s, sweep 64 | pass | 141k/s | p99 0.040 ms | 248 peak of 264 allowed | +0.7 MB | 10.4 to 10.7 MB |

The sqlite run wrote a 0.3 MB database for 300 entities and 52,581 evaluations, and the file
size did not grow past the entity count: writes update existing rows rather than appending a
history.

What the numbers mean: state stayed under the cap in both profiles, the SQLite store stays
inside the same p99 budget as memory at roughly 2.6k evaluations per second on this machine,
and memory plateaued rather than climbing once warmup passed. The flood run reaching 996 of
a 1012 allowance is the amortised sweep overshooting by design, which is why the check uses
`maxEntities + sweepEvery` rather than `maxEntities`.

## What this does not show

- **It is not the 24 hour run.** Thirty seconds with an accelerated clock exercises the
  sweep and the cap, but it cannot show a slow leak that needs hours, a fragmentation pattern,
  or a GC cycle that only appears at a different heap size. M4.4 needs wall clock, and until
  it runs this document says so instead of counting a short run as the evidence.
- **It does not cover real concurrency.** Each run is one process, one guard, one store, and
  a sequential loop. Worker threads, several processes over one SQLite file, and an adapter
  under a framework event loop are not measured here.
- **It does not cover the network.** No HTTP, no protocol receiver, no adapter. Cost per
  evaluation is not cost per request.
- **It is one machine.** RAM, CPU, and Node version move every number, and none of these
  figures are a capacity claim.
- **The clock is accelerated.** Retention expiry is real in these runs because the simulated
  clock advances per request, but idle behaviour (a process with no traffic) is untested.

## The 24 hour run

```
npm run soak -- --seconds=86400 --entities=5000 --store=sqlite
npm run soak:flood -- --seconds=86400 --max-entities=5000
```

Both write nothing outside `var/`, and both print the same three checks. The run counts for
M4.4 when the output is committed to this document, with the machine named and the day.
Until then the task is open.
