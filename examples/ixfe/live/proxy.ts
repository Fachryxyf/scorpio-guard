/**
 * Observational reverse proxy in front of a live IXFE deployment. D56.
 *
 * The roadmap's first remaining item is IXFE's real traffic. IXFE records none of
 * it per request, `security_events` only fires on scanner signatures, and the
 * tunnel's inspector keeps a handful of requests: so before anything can be
 * calibrated, real requests have to be *recorded* in the shape the guard reads.
 *
 * This is a transparent hop, not an integration:
 *
 *   tunnel ──▶ this proxy ──▶ IXFE origin (unchanged)
 *                  │
 *                  └──▶ one JSONL line per request: what SG would have advised
 *
 * Three properties are load-bearing.
 *
 * 1. **It never decides anything.** The response is the origin's, byte for byte.
 *    D9 says the guard advises; here that is enforced structurally, because the
 *    advice is computed after the response has already been sent.
 * 2. **It cannot break the site.** Forwarding is independent of observation: the
 *    guard runs out of band, and every failure inside it is swallowed. A bug in
 *    SG costs a log line, never a real visitor's request.
 * 3. **It records shape, not content.** The entity key is a salted hash, request
 *    bodies are read for the two fields the invariants declare (`dwell`,
 *    `website`) and then dropped, and no IP, address, query string or payload
 *    reaches the record.
 *
 * This proxy adds no authentication and no filtering of its own, everything the
 * origin exposes stays exposed, exactly as before. That is deliberate (it must be
 * observationally neutral) and it means the proxy is not a defence.
 *
 * Usage:
 *   SG_LIVE_SALT=<stable-secret> \
 *   node --experimental-strip-types examples/ixfe/live/proxy.ts \
 *     --origin http://127.0.0.1:4000 --port 4100 --out var/live-traffic.jsonl
 *
 * Then point the tunnel at 4100 instead of 4000. Read the result with
 * `examples/ixfe/live/report.ts`.
 */
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { createGuard, type Observation } from '../../../src/core/guard.ts';
import { sqliteStore } from '../../../src/store/sqlite.ts';
import { measureLatency } from '../../../src/collect/timing.ts';
import { collectSignalIds } from '../../../src/collect/signals.ts';
import type { BehaviorFeatures } from '../../../src/core/behavior.ts';
import type { Invariant } from '../../../src/core/constraints.ts';
import {
  AUTH_SCOPE,
  BILLING_SCOPE,
  ORDER_SCOPE,
  WAITLIST_SCOPE,
  WORK_SCOPE,
  ixfeInvariants,
} from '../invariants.ts';

/**
 * Scope prefix for a document request. Deliberately undeclared: unknown, not
 * forbidden (D32).
 *
 * The scope is per *path*, and the first D57 run is why. Collapsing every page into
 * one `ixfe.page` made `scopeEntropy` and `distinctScopes` degenerate for anyone who
 * only reads: one scope admits no balance, so every browsing visitor scored as
 * monotonous by construction and tripped `SIG_REPEATED_PATTERN`. That is D46's
 * entropy-denominator bug wearing a different hat, the feature measured the
 * integration's coarseness rather than the visitor's behavior.
 */
export const PAGE_SCOPE = 'ixfe.page';

/** `ixfe.page:/order`. Bounded by the site's own routes, which are few. */
export function pageScope(path: string): string {
  return `${PAGE_SCOPE}:${path === '' ? '/' : path}`;
}

/**
 * IXFE's own time-trap constant, `MIN_DWELL_MS` in `landing-service/server.js`.
 *
 * Reused rather than invented: the number belongs to the host (D42 keeps
 * thresholds out of the library), and using the host's own value is what makes a
 * disagreement between the two readings meaningful.
 */
export const HOST_DWELL_FLOOR_MS = 1500;

/** Bodies are read only for the declared fields, and only this far. */
const MAX_BODY_BYTES = 64 * 1024;

/** Documents are read for their links, not stored: a page bigger than this is not parsed. */
const MAX_HTML_BYTES = 512 * 1024;

/**
 * The paths a document offers, as paths. H19.
 *
 * Only root-relative and relative links are kept, and the fragment and query are
 * dropped, because the question is which paths this site told a visitor about. What
 * the visitor does with a link is their business; what the site promised is ours.
 */
function linksIn(html: string): string[] {
  const found: string[] = [];
  const pattern = /href\s*=\s*["']([^"'#?]+)/gi;
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    if (href === undefined) continue;
    if (href.startsWith('http://') || href.startsWith('https://')) continue;
    if (href.startsWith('mailto:')) continue;
    found.push(href.startsWith('/') ? href : '/' + href);
  }
  return found;
}

export type LiveRecord = {
  readonly at: number;
  readonly entity: string;
  readonly method: string;
  readonly path: string;
  readonly scope: string;
  /**
   * Exactly the observation that was evaluated, kept so a decision can be re-derived
   * under a different policy without reconstructing it (M2.2). Rebuilding it from the
   * record's other fields would be a second implementation of the same rule, and the
   * two would drift.
   */
  readonly observation: Observation;
  readonly status: number;
  /**
   * The origin answered an API path with a document. D57.
   *
   * Recorded rather than derived, because the report has to make the same
   * distinction the evidence rule does: a 200 carrying HTML from `/api/*` is a 404
   * the origin failed to say, so escalation against it is agreement and not a false
   * positive.
   */
  readonly answeredWithDocument: boolean;
  /**
   * A 404 for a path the site itself linked. H19.
   *
   * Recorded rather than inferred, because the difference between a visitor probing
   * and a visitor following a dead link is not visible in the request alone: it is
   * visible in what this proxy served earlier in the same run.
   */
  readonly linkedNotFound?: boolean;
  readonly advice: string;
  readonly hardViolated: boolean;
  readonly violations: readonly string[];
  readonly stage: string;
  readonly mean: number;
  readonly mass: number;
  readonly interArrivalCv: number;
  readonly windowCount: number;
  readonly anomaly: number | undefined;
  readonly diversity: boolean | undefined;
  readonly farming: boolean | undefined;
  /** Present only for the two form endpoints, where the invariants declare it. */
  readonly dwellMs?: number | undefined;
  readonly signals: readonly string[];
};

/**
 * What makes a target observable. D56, generalized for M2.1.
 *
 * The observer was written for IXFE, where the scopes match endpoints that carry
 * declared invariants. The traffic lab needs the same instrument in front of two
 * static sites, so the parts that are about the site rather than about observing
 * are here: which scopes exist, which of them mean "a page was viewed", and what
 * can be proven about them.
 *
 * A static site declares no invariants at all, and that is the honest profile: a
 * marketing page cannot prove order skipping or a replayed token. Whatever the lab
 * records there is statistical, and the dataset says so.
 */
export type LiveProfile = {
  readonly id: string;
  readonly invariants: readonly Invariant[];
  readonly scopeFor: (method: string, path: string) => string | undefined;
  /** Page views earn no evidence; asking for a page that is not there does. */
  readonly isPageView: (scope: string) => boolean;
  /** Scopes whose body carries declared fields. Empty for a site with no forms. */
  readonly formScopes?: readonly string[];
};

export type ProxyOptions = {
  readonly origin: string;
  readonly port: number;
  /** Where records go. Defaults to appending JSONL to `out`. */
  readonly sink?: (record: LiveRecord) => void;
  readonly out?: string;
  /** Durable trust state, so a restart does not discard accumulated evidence (D8). */
  readonly storePath?: string;
  /**
   * Salt for the entity hash. Without a stable one, records cannot be correlated
   * across restarts, which is the safe default, not the useful one.
   */
  readonly salt?: string;
  /** Defaults to IXFE, which is what the first three integrations observed. */
  readonly profile?: LiveProfile;
};

/** Static assets say nothing about intent and would swamp the window. */
const ASSET = /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|txt|xml|json)$/i;

/** Which declared scope this request belongs to, or `undefined` to skip it. */
export function scopeFor(method: string, path: string): string | undefined {
  if (path === '/api/waitlist') return WAITLIST_SCOPE;
  if (path === '/api/order') return ORDER_SCOPE;
  // The page's own phase correction: a cached copy asks whether it is still
  // pre-launch. Part of viewing the page, not an action taken on the system.
  if (path === '/api/launch-state') return pageScope(path);
  if (path.startsWith('/api/auth/')) return AUTH_SCOPE;
  if (path.startsWith('/api/billing/')) return BILLING_SCOPE;
  if (path.startsWith('/api/')) return WORK_SCOPE;
  if (method !== 'GET') return undefined;
  return ASSET.test(path) ? undefined : pageScope(path);
}

/**
 * What the invariants get to see.
 *
 * Only the form endpoints produce a declared shape. Everything else passes an
 * empty observation on purpose: SG has no server-side facts here (no balance, no
 * issuance record), and inventing them would be the falsification D45 warns
 * about, in live traffic where it cannot be caught.
 */
function observationFor(scope: string, body: unknown): { data: unknown; dwellMs?: number | undefined } {
  if (scope !== WAITLIST_SCOPE && scope !== ORDER_SCOPE) return { data: {} };
  const fields = isRecord(body) ? body : {};
  const dwell = Number(fields['dwell']);
  const dwellMs = Number.isFinite(dwell) ? dwell : undefined;
  return {
    dwellMs,
    data: {
      dwellMs,
      honeypot: String(fields['website'] ?? ''),
      fieldsFilled: Object.keys(fields).length,
      interactions: undefined,
    },
  };
}

/**
 * Evidence read from the origin's own answer.
 *
 * A completed API action is weak positive evidence; a refusal the origin itself
 * issued is weak negative. Page views carry neither; they feed the behavioral
 * window (D36) and nothing else, because loading a page is not an achievement.
 *
 * `contentType` is here because the first run of D57 falsified the simpler version.
 * IXFE's landing service answers unknown `/api/*` paths with its SPA fallback, 200
 * and 94 KB of HTML: so a path scanner asking for `/api/admin/users` was *credited
 * with a success* and left with a trust mean above where it started. An API route
 * answering a document did not complete an action; it is a 404 the origin failed to
 * say, so it is read as the refusal it actually is.
 *
 * The innocent cause, since every negative reading owes one: a stale client calling
 * an endpoint that has since been removed. Which is why this is weak evidence rather
 * than a declared invariant, one is a deploy lagging, a stream of them is a scanner.
 */
function evidenceFor(
  scope: string,
  status: number,
  answeredWithDocument: boolean,
  isPageView: (scope: string) => boolean,
  offered: boolean,
): { positive?: 'weak'; negative?: 'weak' } | undefined {
  const refused =
    status === 401 || status === 403 || status === 404 || status === 410 || status === 429;

  // A page view earns nothing, because loading a page is not an achievement. But
  // asking for a page that does not exist is not nothing: it is the shape of a
  // scanner walking a wordlist. Asymmetric on purpose. The innocent cause is a stale
  // link or an old bookmark, which is why it is weak rather than declared.
  //
  // Unless the site itself published that link. A crawler that follows the site's own
  // navigation is doing what it was invited to do, and a 404 behind such a link is the
  // site's dead link rather than the visitor's probing (H19). The lab found the cost:
  // a legitimate indexer inherited every dead link in a build and was treated for it.
  if (isPageView(scope)) {
    if (!refused) return undefined;
    return offered ? undefined : { negative: 'weak' };
  }

  if (status >= 200 && status < 300) {
    return answeredWithDocument ? { negative: 'weak' } : { positive: 'weak' };
  }
  return refused ? { negative: 'weak' } : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Where the observer writes by default. Both live under var/, which is ignored:
 * the record is real visitors' shape and the SQLite file is their trust state, so
 * neither belongs in the published working tree (D56).
 */
const LIVE_RECORDS_PATH = 'var/live-traffic.jsonl';
const LIVE_STORE_PATH = 'var/sg-live.db';

/** Create the parent directory, so a fresh clone works on its first run. */
function ensureParent(file: string): string {
  mkdirSync(dirname(file), { recursive: true });
  return file;
}

/** The profile the D56 and D57 runs used, unchanged. */
export const IXFE_PROFILE: LiveProfile = {
  id: 'ixfe',
  invariants: ixfeInvariants,
  scopeFor,
  isPageView: (scope) => scope.startsWith(PAGE_SCOPE),
  formScopes: [WAITLIST_SCOPE, ORDER_SCOPE],
};

export function createLiveProxy(options: ProxyOptions) {
  const origin = new URL(options.origin);
  const store = sqliteStore({ path: ensureParent(options.storePath ?? LIVE_STORE_PATH) });
  const profile = options.profile ?? IXFE_PROFILE;
  const forms = profile.formScopes ?? [];
  const guard = createGuard({ invariants: profile.invariants, store });
  const salt = options.salt ?? randomBytes(16).toString('hex');
  /**
   * The previous evaluation's features, per entity, so the server-side collectors
   * (D51) have something to read.
   *
   * Deliberately the *previous* window rather than the current one: `evaluate` is
   * what computes features, so a signal derived from this request's window would
   * need the answer before asking the question. Lagging by one observation is the
   * honest version, and it costs one request of latency in the signal, which is
   * the same lag any host integrating the collectors would have.
   *
   * Bounded, because an unbounded map keyed by visitor is a memory-growth surface
   * (D22). Oldest entries go first; losing one costs a signal, never correctness.
   */
  const lastBehavior = new Map<string, BehaviorFeatures>();
  const MAX_TRACKED = 5000;
  const out = options.out ? ensureParent(options.out) : undefined;
  const emit =
    options.sink ??
    ((record: LiveRecord) => {
      if (out) appendFileSync(out, `${JSON.stringify(record)}\n`);
    });

  /**
   * Every path this site linked, learned as the proxy serves the documents (H19).
   *
   * Run-scoped on purpose: a restart forgets the links and pays for it with a few
   * false negatives rather than with false positives on a stale crawler.
   */
  const linked = new Set<string>();

  /** Opaque and stable per client, and useless outside this deployment. */
  function entityOf(req: IncomingMessage): string {
    const ip = String(req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? '');
    const ua = String(req.headers['user-agent'] ?? '');
    return createHash('sha256').update(`${salt}\u0000${ip}\u0000${ua}`).digest('hex').slice(0, 16);
  }

  async function observe(input: {
    entity: string;
    method: string;
    path: string;
    scope: string;
    body: unknown;
    status: number;
    contentType: string;
  }): Promise<void> {
    const { data, dwellMs } = observationFor(input.scope, input.body);
    const previous = lastBehavior.get(input.entity);

    /**
     * Signals are attached to *actions*, never to page views. D57.
     *
     * This is the same argument D56 made about evidence, carried to its conclusion.
     * If loading a page is not an achievement, then loading pages on a schedule is
     * not an offence: because from HTTP alone an uptime monitor and a crawler are
     * the same client. Both are `GET /` at a fixed interval by a non-browser, and
     * `SIG_UNIFORM_DELAY_SHAPE` fires identically on both.
     *
     * Measured before this rule existed: a 20-request uptime check reached
     * `INCREASE_FRICTION` at step 15. That is a false positive on traffic the
     * operator configured themselves, and the central constraint does not trade it
     * for catching a crawler that reads public pages.
     *
     * The cost is stated rather than hidden: a crawler that only reads pages now
     * walks through at `ALLOW`. That is the honest answer for an observer that sees
     * only HTTP, and it is why the proxy is an instrument and not a defence.
     */
    const isPageView = profile.isPageView(input.scope);
    // The catalogue's own ids, from the catalogue's own thresholds. This file
    // contributes no number of its own (D42).
    const signals: string[] = previous && !isPageView ? collectSignalIds({ behavior: previous }) : [];
    if (dwellMs !== undefined && measureLatency(0, { floorMs: HOST_DWELL_FLOOR_MS, now: () => dwellMs }).subhuman) {
      signals.push('SIG_SUBHUMAN_LATENCY');
    }

    const offered = linked.has(input.path);
    const evidence = evidenceFor(
      input.scope,
      input.status,
      input.contentType.includes('text/html'),
      profile.isPageView,
      offered,
    );
    const observation: Observation = {
      scope: input.scope,
      data,
      ...(evidence ? { evidence } : {}),
      ...(signals.length > 0 ? { signals } : {}),
    };
    const assessment = await guard.evaluate({ entity: input.entity, observation });

    if (lastBehavior.size >= MAX_TRACKED) {
      const oldest = lastBehavior.keys().next().value;
      if (oldest !== undefined) lastBehavior.delete(oldest);
    }
    lastBehavior.set(input.entity, assessment.behavior);

    emit({
      at: Date.now(),
      entity: input.entity,
      method: input.method,
      path: input.path,
      scope: input.scope,
      status: input.status,
      answeredWithDocument: !isPageView && input.contentType.includes('text/html'),
      linkedNotFound: offered && input.status === 404,
      advice: assessment.decision,
      hardViolated: assessment.hardViolated,
      violations: assessment.violations.map((violation) => violation.invariant),
      stage: assessment.trust.stage,
      mean: assessment.trust.mean,
      mass: assessment.trust.mass,
      interArrivalCv: assessment.behavior.interArrivalCv,
      windowCount: assessment.behavior.count,
      anomaly: assessment.anomaly.score,
      diversity: assessment.diversity,
      farming: assessment.farming,
      ...(forms.includes(input.scope) ? { dwellMs } : {}),
      signals,
      observation,
    });
  }

  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const method = req.method ?? 'GET';
    const scope = profile.scopeFor(method, path);
    // Bodies are only read where an invariant declares a field in them.
    const wantsBody = scope !== undefined && forms.includes(scope);

    const htmlChunks: Buffer[] = [];
    let htmlBytes = 0;

    const upstream = httpRequest(
      {
        protocol: origin.protocol,
        hostname: origin.hostname,
        port: origin.port,
        method,
        path: req.url ?? '/',
        headers: forwardedHeaders(req),
      },
      (originRes) => {
        originAnswered = true;
        originContentType = String(originRes.headers['content-type'] ?? '');
        // Collected beside the pipe rather than instead of it, so the visitor waits for
        // nothing while the proxy reads the navigation the site is offering.
        if (originContentType.includes('text/html')) {
          originRes.on('data', function (chunk: Buffer) {
            if (htmlBytes <= MAX_HTML_BYTES) {
              htmlBytes += chunk.length;
              htmlChunks.push(chunk);
            }
          });
        }
        res.writeHead(originRes.statusCode ?? 502, originRes.headers);
        originRes.pipe(res);
      },
    );

    // The origin is unreachable or hung up: answer as a proxy must and record nothing.
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end('{"error":"Bad gateway."}');
    });

    // A request the origin never answered says nothing about the caller: the
    // 502 below is this proxy's own words, not IXFE's verdict.
    let originAnswered = false;
    let originContentType = '';
    const chunks: Buffer[] = [];
    let bytes = 0;
    if (wantsBody) {
      req.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes <= MAX_BODY_BYTES) chunks.push(chunk);
        upstream.write(chunk);
      });
      req.on('end', () => upstream.end());
    } else {
      req.pipe(upstream);
    }

    // Observation happens after the response is on the wire, so it cannot delay a
    // real visitor and a throw cannot reach one.
    res.on('finish', () => {
      if (scope === undefined || !originAnswered) return;
      if (Math.floor(res.statusCode / 100) === 2 && htmlChunks.length !== 0) {
        for (const link of linksIn(Buffer.concat(htmlChunks).toString('utf8'))) linked.add(link);
      }
      let body: unknown;
      if (wantsBody && bytes <= MAX_BODY_BYTES) {
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { body = undefined; }
      }
      observe({
        entity: entityOf(req),
        method,
        path,
        scope,
        body,
        status: res.statusCode,
        contentType: originContentType,
      }).catch(() => { /* observation is never worth an error path */ });
    });
  });

  return {
    server,
    guard,
    listen: () => new Promise<void>((resolve) => server.listen(options.port, resolve)),
    close: () => new Promise<void>((resolve) => {
      server.close(() => { store.close(); resolve(); });
    }),
  };
}

/** Keep the client's own headers, and be honest about the extra hop. */
function forwardedHeaders(req: IncomingMessage): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = { ...req.headers } as Record<string, string | string[]>;
  const previous = req.headers['x-forwarded-for'];
  const remote = req.socket.remoteAddress ?? '';
  headers['x-forwarded-for'] = previous ? `${previous}, ${remote}` : remote;
  return headers;
}

// CLI entry point.

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

if (process.argv[1]?.endsWith('proxy.ts')) {
  const origin = arg('origin', 'http://127.0.0.1:4000')!;
  const port = Number(arg('port', '4100'));
  const out = arg('out', LIVE_RECORDS_PATH)!;
  const salt = process.env['SG_LIVE_SALT'];

  const proxy = createLiveProxy({
    origin,
    port,
    out,
    ...(salt ? { salt } : {}),
    ...(process.env['SG_LIVE_STORE'] ? { storePath: process.env['SG_LIVE_STORE'] } : {}),
  });
  await proxy.listen();

  console.log(`\n  Scorpio Guard live observer (advisory only, changes nothing)`);
  console.log(`    listening: http://127.0.0.1:${port}`);
  console.log(`    origin:    ${origin}`);
  console.log(`    records:   ${out}`);
  if (!salt) console.log(`    note:      SG_LIVE_SALT unset, entity keys change on restart\n`);
  else console.log('');

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => { void proxy.close().then(() => process.exit(0)); });
  }
}
