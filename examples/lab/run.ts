/**
 * The traffic lab: real Chrome instances, real targets, one declared persona each. M2.1.
 *
 * What this produces is a labelled dataset. The label is known by construction, which
 * is the only reason generated traffic can calibrate anything: nobody had to guess
 * which visitor was a bot, because the lab launched it and said so. What it cannot
 * produce is a population. Every number read off this dataset describes these
 * personas against these targets, and D45 applies to it exactly as it applies to
 * anything else claimed without a sample.
 *
 * One Chrome per persona, not one browser with several tabs. A shared instance shares
 * a profile, a cache, and a cookie jar, so a persona could be influenced by the one
 * before it and the ground truth would quietly stop being true. Each instance gets a
 * fresh user-data-dir and dies when its persona is done.
 *
 * Everything the observer records goes through one sink, which stamps the current
 * persona. Runs are sequential per target, so the stamp is exact and no guessing about
 * loopback address spelling or user-agent matching is involved.
 *
 * Usage:
 *   npm run lab
 *   npm run lab -- --target=aufsicht,talkhere
 *   npm run lab -- --persona=reader,hammer --seed=7
 *   npm run lab -- --strict            # exit non-zero on any false positive or negative
 *   npm run lab -- --report=2026-10-24T16-00-00-000Z
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { connect, launch } from '../ixfe/live/cdp.ts';
import { IXFE_PROFILE, createLiveProxy } from '../ixfe/live/proxy.ts';
import { ADVERSARIES, LEGITIMATE } from '../ixfe/live/visitors.ts';
import { seeded, staticPersonas, type LabPersona } from './personas.ts';
import { createStaticServer } from './serve.ts';
import { labTargets, unavailableReason, type LabTarget } from './targets.ts';
import {
  parseRecords,
  summarise,
  verdicts,
  type LabRecord,
  type PersonaSummary,
} from './summary.ts';

type RunOptions = {
  readonly targets: readonly string[] | undefined;
  readonly personas: readonly string[] | undefined;
  readonly seed: number;
  readonly strict: boolean;
  readonly report: string | undefined;
};

type PersonaResult = {
  readonly id: string;
  readonly label: string;
  readonly what: string;
  readonly userAgent: string;
  readonly landingPath: string;
  readonly requests: number;
  readonly error?: string;
};

type TargetResult = {
  readonly id: string;
  readonly label: string;
  readonly source: string;
  readonly origin: string;
  readonly profile: string;
  readonly invariants: number;
  readonly personas: readonly PersonaResult[];
  readonly summaries: readonly PersonaSummary[];
  /** What the browser reported about itself, recorded with the rows it produced. */
  readonly chrome?: string;
  readonly error?: string;
};

function option(name: string): string | undefined {
  const prefix = '--' + name + '=';
  const match = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  return match?.slice(prefix.length);
}

function parseOptions(): RunOptions {
  const targets = option('target')?.split(',').map((id) => id.trim()).filter(Boolean);
  const personas = option('persona')?.split(',').map((id) => id.trim()).filter(Boolean);
  const seed = Number(option('seed') ?? '1');
  if (!Number.isFinite(seed)) throw new Error('--seed must be a number');
  return {
    targets,
    personas,
    seed,
    strict: process.argv.slice(2).includes('--strict'),
    report: option('report'),
  };
}

/**
 * The IXFE rows come from the sessions D56 and D57 already wrote, wrapped so the same
 * runner can label them. Their user-agent is chosen inside the session, which is why
 * the manifest says so instead of quoting one.
 */
function personasFor(target: LabTarget): LabPersona[] {
  if (target.id !== 'ixfe') return staticPersonas();
  return [...LEGITIMATE, ...ADVERSARIES].map((session) => ({
    id: 'ixfe-' + session.id,
    label: session.legitimate ? ('legitimate' as const) : ('adversarial' as const),
    what: session.what,
    userAgent: 'chosen by the session',
    entry: (base: string) => base + '/',
    run: ({ base, browser }) => session.run({ target: base + '/', browser }),
  }));
}

async function chromeVersion(port: number): Promise<string | undefined> {
  try {
    const response = await fetch('http://127.0.0.1:' + port + '/json/version');
    if (!response.ok) return undefined;
    const body = (await response.json()) as { Browser?: string };
    return body.Browser;
  } catch {
    return undefined;
  }
}

/** Stable, so the same persona gets the same stream for one seed. */
function offsetFor(id: string): number {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 100_000;
}

async function observeTarget(
  target: LabTarget,
  personas: readonly LabPersona[],
  runId: string,
  seed: number,
  index: number,
): Promise<TargetResult> {
  const outDir = resolve('var', 'lab', runId);
  mkdirSync(outDir, { recursive: true });
  const recordsPath = join(outDir, target.id + '.jsonl');
  writeFileSync(recordsPath, '');

  const profile = target.id === 'ixfe' ? IXFE_PROFILE : target.profile;
  const site = target.root === undefined ? undefined : createStaticServer(target.root);
  const origin =
    site === undefined
      ? (target.origin ?? '')
      : 'http://127.0.0.1:' + String(await site.listen(4700 + index));
  if (origin === '') throw new Error('target has neither a build directory nor an origin');

  const base = 'http://127.0.0.1:' + String(4800 + index);
  let current: LabPersona | undefined;
  const sinkFailures: string[] = [];

  const proxy = createLiveProxy({
    origin,
    port: 4800 + index,
    profile,
    storePath: join(outDir, target.id + '.sqlite'),
    sink: (record) => {
      const persona = current;
      if (persona === undefined) {
        sinkFailures.push('a record arrived with no persona running');
        return;
      }
      const labelled: LabRecord = { ...record, persona: persona.id, groundTruth: persona.label };
      try {
        appendFileSync(recordsPath, JSON.stringify(labelled) + '\n');
      } catch (error) {
        // The origin is still answering; a dropped row is a hole in the dataset, not
        // a reason to fail the request the visitor is waiting on.
        sinkFailures.push(String(error));
      }
    },
  });
  await proxy.listen();

  const results: PersonaResult[] = [];
  let version: string | undefined;
  try {
    for (const [position, persona] of personas.entries()) {
      current = persona;
      const debugPort = 5400 + position;
      const profileDir = join(tmpdir(), 'sg-lab-' + runId + '-' + target.id + '-' + persona.id);
      let error: string | undefined;

      try {
        const kill = await launch({ port: debugPort, profileDir });
        try {
          const browser = await connect(debugPort);
          version ??= await chromeVersion(debugPort);
          await persona.run({ base, browser, rng: seeded(seed + offsetFor(persona.id)) });
          await browser.close();
        } finally {
          kill();
        }
      } catch (failure) {
        error = failure instanceof Error ? failure.message : String(failure);
      }

      results.push({
        id: persona.id,
        label: persona.label,
        what: persona.what,
        userAgent: persona.userAgent,
        landingPath: persona.entry(''),
        requests: 0,
        ...(error === undefined ? {} : { error }),
      });
    }
  } finally {
    current = undefined;
    await proxy.close();
    await site?.close();
  }

  const records = parseRecords(readFileSync(recordsPath, 'utf8'));
  const summaries = summarise(records);
  const counted = new Map(summaries.map((summary) => [summary.persona, summary.requests]));

  return {
    id: target.id,
    label: target.label,
    source: target.source,
    origin,
    profile: profile.id,
    invariants: profile.invariants.length,
    personas: results.map((result) => ({ ...result, requests: counted.get(result.id) ?? 0 })),
    summaries,
    ...(version === undefined ? {} : { chrome: version }),
    ...(sinkFailures.length === 0 ? {} : { error: sinkFailures.join('; ') }),
  };
}

function decisions(summary: PersonaSummary): string {
  return Object.entries(summary.decisions)
    .map(([decision, count]) => decision + ' x' + String(count))
    .join(', ');
}

function printTarget(result: TargetResult): void {
  const records = result.summaries.reduce((total, summary) => total + summary.requests, 0);
  console.log('\n  ' + result.id + '  (' + result.label + ')');
  console.log('    origin ' + result.origin + ', profile ' + result.profile + ', ' + String(result.invariants) + ' invariants');
  console.log('    ' + String(result.personas.length) + ' personas, ' + String(records) + ' recorded requests');
  if (result.error !== undefined) console.log('    problem: ' + result.error);

  for (const summary of result.summaries) {
    const treated =
      summary.escalatedAt === null
        ? 'no treatment'
        : summary.firstTreatment + ' at request ' + String(summary.escalatedAt);
    console.log(
      '      ' +
        summary.persona.padEnd(18) +
        summary.groundTruth.padEnd(13) +
        String(summary.requests).padStart(3) +
        ' requests  ' +
        treated.padEnd(28) +
        decisions(summary),
    );
  }
}

function printVerdicts(summaries: readonly PersonaSummary[], strict: boolean): void {
  const verdict = verdicts(summaries);
  console.log('\n  calibration');
  console.log('    false positives ' + (verdict.falsePositives.join(', ') || 'none'));
  console.log('    false negatives ' + (verdict.falseNegatives.join(', ') || 'none'));
  console.log(
    '    labelled correctly ' +
      String(verdict.correct.length) +
      ' of ' +
      String(summaries.length) +
      ' personas',
  );
  if (strict && (verdict.falsePositives.length > 0 || verdict.falseNegatives.length > 0)) {
    process.exitCode = 1;
  }
}

function reportRun(runId: string, strict: boolean): void {
  const dir = resolve('var', 'lab', runId);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as {
    runId: string;
    seed: number;
    targets: readonly TargetResult[];
  };
  console.log('\n  replayed ' + manifest.runId + ', seed ' + String(manifest.seed));

  const all: PersonaSummary[] = [];
  for (const target of manifest.targets) {
    const records = parseRecords(readFileSync(join(dir, target.id + '.jsonl'), 'utf8'));
    const summaries = summarise(records);
    printTarget({ ...target, summaries });
    all.push(...summaries);
  }
  printVerdicts(all, strict);
}

async function main(): Promise<void> {
  const options = parseOptions();
  if (options.report !== undefined) {
    reportRun(options.report, options.strict);
    return;
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const startedAt = new Date().toISOString();
  const selected = labTargets().filter(
    (target) => options.targets === undefined || options.targets.includes(target.id),
  );
  if (selected.length === 0) {
    throw new Error('no target matched; known ids: ' + labTargets().map((t) => t.id).join(', '));
  }

  const results: TargetResult[] = [];
  for (const [index, target] of selected.entries()) {
    const unavailable = unavailableReason(target);
    if (unavailable !== undefined) {
      console.log('\n  skipped ' + target.id + ': ' + unavailable);
      continue;
    }

    const personas = personasFor(target).filter(
      (persona) => options.personas === undefined || options.personas.includes(persona.id),
    );
    if (personas.length === 0) {
      console.log('\n  skipped ' + target.id + ': no persona matched');
      continue;
    }

    console.log('\n  running ' + target.id + ' with ' + String(personas.length) + ' personas');
    try {
      const result = await observeTarget(target, personas, runId, options.seed, index);
      results.push(result);
      printTarget(result);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      console.log('  failed ' + target.id + ': ' + message);
      results.push({
        id: target.id,
        label: target.label,
        source: target.source,
        origin: target.origin ?? target.root ?? 'unknown',
        profile: target.profile.id,
        invariants: target.profile.invariants.length,
        personas: [],
        summaries: [],
        error: message,
      });
    }
  }

  const summaries = results.flatMap((result) => result.summaries);
  const manifest = {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform + '-' + process.arch,
    chrome: results.find((result) => result.chrome !== undefined)?.chrome ?? 'not observed',
    seed: options.seed,
    /** Entity keys are hashed with a per-run random salt, so runs do not correlate. */
    entitySalt: 'random per run, not recorded',
    note:
      'Generated traffic. Ground truth is by construction. This is not a sample of any' +
      ' population, and no rate read off it describes real visitors.',
    targets: results,
  };

  const dir = resolve('var', 'lab', runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(dir, 'summary.json'), JSON.stringify({ runId, summaries }, null, 2) + '\n');

  printVerdicts(summaries, options.strict);
  console.log('\n  dataset: var/lab/' + runId + '/');
  console.log('  replay:  npm run lab -- --report=' + runId + '\n');
}

await main();
