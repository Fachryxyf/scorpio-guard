/**
 * Read recorded live traffic and print the numbers a threshold gets argued from. D56.
 *
 * Every "still unvalidated" row in the README that says *needs real traffic* names a
 * number this report measures against real clients:
 *
 * - `maxInterArrivalCv = 0.25` (D55) — the gap-regularity gate that decides how much
 *   trust a legitimate machine client is denied. Reported as the observed CV
 *   distribution, so the question becomes where real clients actually sit rather
 *   than whether 0.25 feels right.
 * - The anomaly reference profile (D52) — reported as observed quantiles per feature,
 *   which is what a reference profile should be fitted to.
 * - The collectors (D51) — every advice above `ALLOW` given to a client that the
 *   origin itself never refused is a false-positive candidate, listed individually
 *   because D51's debt is that not one collector has met a real one.
 *
 * It computes distributions and never a threshold. Choosing one is a human decision
 * with the numbers in front of it, and writing it here would be D45's mistake with
 * better data.
 *
 *   node --experimental-strip-types examples/ixfe/live/report.ts live-traffic.jsonl
 */
import { readFileSync } from 'node:fs';

import { DEFAULT_REFERENCE } from '../../../src/core/anomaly.ts';
import { DEFAULT_VELOCITY } from '../../../src/core/behavior.ts';
import type { LiveRecord } from './proxy.ts';

/** Records with a measurable window. Below this the features are not defined (D52). */
const MIN_WINDOW = 4;

export function parseRecords(text: string): LiveRecord[] {
  const records: LiveRecord[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try { records.push(JSON.parse(line) as LiveRecord); } catch { /* a truncated tail is not an error */ }
  }
  return records;
}

export function quantile(values: readonly number[], q: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[index];
}

/**
 * Advice the origin did not corroborate.
 *
 * The origin refusing a request is IXFE's own verdict, so escalation there is
 * agreement rather than a false positive. Escalation on traffic the origin served
 * happily is the case D51 asks for.
 *
 * Two exclusions, both load-bearing:
 *
 * - A hard violation is proof (D15). It cannot be a false positive, whatever the
 *   origin answered.
 * - A 2xx from IXFE is not consent. `/api/waitlist` and `/api/order` answer
 *   `{ slot: 0 }` to a request their own honeypot or time-trap caught — "serap
 *   diam-diam", absorb silently — so reading that status as agreement would count
 *   IXFE's own detections as the guard's mistakes.
 * - Nor is a 200 that carries a document from an API path. That is the SPA fallback
 *   answering for a route that does not exist (D57), so the origin refused too; it
 *   just said so with 94 KB of HTML and the wrong status code.
 */
export function falsePositiveCandidates(records: readonly LiveRecord[]): LiveRecord[] {
  return records.filter(
    (record) =>
      record.status >= 200 && record.status < 300 &&
      !record.hardViolated &&
      record.violations.length === 0 &&
      record.answeredWithDocument !== true &&
      record.advice !== 'ALLOW' && record.advice !== 'OBSERVE',
  );
}

export function summarise(records: readonly LiveRecord[]) {
  const scored = records.filter((record) => record.windowCount >= MIN_WINDOW);
  const cvs = scored.map((record) => record.interArrivalCv);
  const anomalies = scored
    .map((record) => record.anomaly)
    .filter((score): score is number => score !== undefined);

  const byAdvice = new Map<string, number>();
  const byScope = new Map<string, number>();
  const entities = new Set<string>();
  for (const record of records) {
    byAdvice.set(record.advice, (byAdvice.get(record.advice) ?? 0) + 1);
    byScope.set(record.scope, (byScope.get(record.scope) ?? 0) + 1);
    entities.add(record.entity);
  }

  return {
    total: records.length,
    entities: entities.size,
    scored: scored.length,
    byAdvice: Object.fromEntries([...byAdvice].sort()),
    byScope: Object.fromEntries([...byScope].sort()),
    /** How many measurable clients sit below the D55 gate, and would be discounted. */
    belowVelocityGate: cvs.filter((cv) => cv < DEFAULT_VELOCITY.maxInterArrivalCv).length,
    cv: { p10: quantile(cvs, 0.1), p50: quantile(cvs, 0.5), p90: quantile(cvs, 0.9) },
    anomaly: { p50: quantile(anomalies, 0.5), p90: quantile(anomalies, 0.9), max: quantile(anomalies, 1) },
    hardViolations: records.filter((record) => record.hardViolated).length,
    falsePositiveCandidates: falsePositiveCandidates(records).length,
  };
}

/**
 * Per-client verdicts, which is the grain the design's claims are stated at. D58.
 *
 * A row per request is too fine to argue from — "no legitimate visitor is ever given
 * friction" is a claim about visitors. Same reasoning as `formatResults` in the
 * persona harness.
 */
export function perClient(records: readonly LiveRecord[]) {
  const rungs = ['ALLOW', 'OBSERVE', 'INCREASE_FRICTION', 'RESTRICT', 'BLOCK'];
  const clients = new Map<
    string,
    {
      client: string;
      requests: number;
      worst: string;
      worstAtRequest: number | null;
      hardViolations: number;
      finalMean: number;
      distinctPaths: number;
      firstPath: string;
    }
  >();

  for (const record of records) {
    const existing = clients.get(record.entity);
    const entry =
      existing ??
      {
        client: record.entity.slice(0, 8),
        requests: 0,
        worst: 'ALLOW',
        worstAtRequest: null as number | null,
        hardViolations: 0,
        finalMean: 0,
        distinctPaths: 0,
        firstPath: record.path,
      };
    entry.requests += 1;
    if (rungs.indexOf(record.advice) > rungs.indexOf(entry.worst)) {
      entry.worst = record.advice;
      entry.worstAtRequest = entry.requests;
    }
    if (record.hardViolated) entry.hardViolations += 1;
    entry.finalMean = record.mean;
    clients.set(record.entity, entry);
  }

  const paths = new Map<string, Set<string>>();
  for (const record of records) {
    const seen = paths.get(record.entity) ?? new Set<string>();
    seen.add(record.path);
    paths.set(record.entity, seen);
  }
  for (const [entity, entry] of clients) {
    entry.distinctPaths = paths.get(entity)?.size ?? 0;
  }

  return [...clients.values()];
}

if (process.argv[1]?.endsWith('report.ts')) {
  const path = process.argv[2] ?? 'live-traffic.jsonl';
  const records = parseRecords(readFileSync(path, 'utf8'));
  const summary = summarise(records);

  // `--json` is what the site build reads. The recorded traffic itself is never
  // committed (it is real visitors' shape); this summary is.
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ summary, clients: perClient(records) }, null, 2));
    process.exit(0);
  }

  console.log(`\n  IXFE live traffic — ${path}`);
  console.log(`    records: ${summary.total}   distinct clients: ${summary.entities}   measurable windows: ${summary.scored}\n`);

  if (summary.total === 0) {
    console.log('  Nothing recorded yet. Run the proxy in front of the origin first.\n');
  } else {
    console.log('  advice:');
    for (const [advice, count] of Object.entries(summary.byAdvice)) {
      console.log(`    ${advice.padEnd(20)} ${count}`);
    }
    console.log('\n  scope:');
    for (const [scope, count] of Object.entries(summary.byScope)) {
      console.log(`    ${scope.padEnd(20)} ${count}`);
    }

    const fmt = (value: number | undefined) => (value === undefined ? '  n/a' : value.toFixed(2));
    console.log(`\n  gap CV (D55 gate is ${DEFAULT_VELOCITY.maxInterArrivalCv}, reference is ${DEFAULT_REFERENCE.interArrivalCv}):`);
    console.log(`    p10 ${fmt(summary.cv.p10)}   p50 ${fmt(summary.cv.p50)}   p90 ${fmt(summary.cv.p90)}`);
    console.log(`    below the gate: ${summary.belowVelocityGate}/${summary.scored} measurable observations`);

    console.log('\n  anomaly score (D52 reference profile is untrained):');
    console.log(`    p50 ${fmt(summary.anomaly.p50)}   p90 ${fmt(summary.anomaly.p90)}   max ${fmt(summary.anomaly.max)}`);

    console.log(`\n  hard violations: ${summary.hardViolations}`);
    console.log(`  false-positive candidates: ${summary.falsePositiveCandidates}   (origin served 2xx, guard escalated past OBSERVE)`);

    for (const record of falsePositiveCandidates(records).slice(0, 15)) {
      console.log(`    ${record.method} ${record.path} [${record.status}] → ${record.advice}   client ${record.entity.slice(0, 8)}  mean ${record.mean.toFixed(3)}  CV ${record.interArrivalCv.toFixed(2)}`);
    }
    console.log('');
  }
}
