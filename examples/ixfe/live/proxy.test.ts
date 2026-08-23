import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createLiveProxy, pageScope, scopeFor, type LiveRecord } from './proxy.ts';
import { falsePositiveCandidates, parseRecords, quantile, summarise } from './report.ts';
import { ORDER_SCOPE, WAITLIST_SCOPE, WORK_SCOPE } from '../invariants.ts';

/** A stand-in origin: it answers, and it records what it was asked. */
function fakeOrigin(
  handler: (path: string, body: string) => { status: number; body: string; contentType?: string },
) {
  const seen: { method: string; path: string; body: string }[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      seen.push({ method: req.method ?? '', path: req.url ?? '', body });
      const answer = handler(req.url ?? '', body);
      res.writeHead(answer.status, {
        'Content-Type': answer.contentType ?? 'application/json',
        'X-Origin-Marker': 'yes',
      });
      res.end(answer.body);
    });
  });
  return { server, seen };
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

/** Start origin + proxy, run the body, and always tear both down. */
async function withProxy(
  handler: (path: string, body: string) => { status: number; body: string; contentType?: string },
  run: (base: string, records: LiveRecord[], originSeen: { method: string; path: string; body: string }[]) => Promise<void>,
) {
  const origin = fakeOrigin(handler);
  const originPort = await listen(origin.server);
  const records: LiveRecord[] = [];
  const proxy = createLiveProxy({
    origin: `http://127.0.0.1:${originPort}`,
    port: 0,
    storePath: ':memory:',
    salt: 'test-salt',
    sink: (record) => records.push(record),
  });
  await proxy.listen();
  const port = (proxy.server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`, records, origin.seen);
  } finally {
    await proxy.close();
    await new Promise<void>((resolve) => origin.server.close(() => resolve()));
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Records are written on `finish`, which lands just after the client has its response. */
async function settle(records: readonly LiveRecord[], expected: number): Promise<void> {
  for (let i = 0; i < 100 && records.length < expected; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('D56: the proxy is transparent — status, body and headers are the origin\'s', async () => {
  await withProxy(
    () => ({ status: 201, body: '{"slot":7}' }),
    async (base, records, seen) => {
      const res = await fetch(`${base}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.test', dwell: 4200 }),
      });

      assert.equal(res.status, 201);
      assert.equal(res.headers.get('x-origin-marker'), 'yes');
      assert.deepEqual(await res.json(), { slot: 7 });
      // The origin saw the request unmodified, body included.
      assert.equal(seen.length, 1);
      assert.deepEqual(JSON.parse(seen[0]!.body), { email: 'a@b.test', dwell: 4200 });

      await settle(records, 1);
      assert.equal(records.length, 1);
      assert.equal(records[0]!.dwellMs, 4200);
      assert.equal(records[0]!.hardViolated, false);
    },
  );
});

/**
 * The proof the pentest could only assert against a scripted client: a submission
 * with no `dwell` did not come from the form (D47), and here it is read off the wire.
 */
test('D56: a submission with no dwell is a hard violation, and is still served', async () => {
  await withProxy(
    () => ({ status: 200, body: '{"slot":0}' }),
    async (base, records) => {
      const res = await fetch(`${base}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bot@throwaway.test' }),
      });

      assert.equal(res.status, 200, 'the origin decides, never the guard');
      await settle(records, 1);
      assert.equal(records[0]!.hardViolated, true);
      assert.deepEqual(records[0]!.violations, ['ixfe.submission-came-from-form']);
      assert.equal(records[0]!.advice, 'RESTRICT');
    },
  );
});

test('D56: a filled honeypot is soft, and a fast dwell is a weak signal', async () => {
  await withProxy(
    () => ({ status: 200, body: '{"slot":0}' }),
    async (base, records) => {
      await fetch(`${base}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x@y.test', dwell: 200, website: 'https://spam.example' }),
      });

      await settle(records, 1);
      assert.equal(records[0]!.hardViolated, false);
      assert.deepEqual(records[0]!.violations, ['ixfe.honeypot-untouched']);
      assert.deepEqual(records[0]!.signals, ['SIG_SUBHUMAN_LATENCY']);
      // Neither is proof, so neither may escalate on its own. D38, D42.
      assert.ok(['ALLOW', 'OBSERVE'].includes(records[0]!.advice), records[0]!.advice);
    },
  );
});

test('D56: assets and unknown methods are not observed at all', async () => {
  await withProxy(
    () => ({ status: 200, body: '{}' }),
    async (base, records) => {
      await fetch(`${base}/logo.svg`);
      await fetch(`${base}/favicon.ico`);
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(records.length, 0);

      await fetch(`${base}/`);
      await settle(records, 1);
      assert.equal(records.length, 1);
      assert.equal(records[0]!.scope, pageScope('/'));
    },
  );
});

test('D56: an unreachable origin answers 502 and records nothing', async () => {
  const records: LiveRecord[] = [];
  const proxy = createLiveProxy({
    // Port 1 is privileged and nothing is listening: connect fails immediately.
    origin: 'http://127.0.0.1:1',
    port: 0,
    storePath: ':memory:',
    salt: 'test-salt',
    sink: (record) => records.push(record),
  });
  await proxy.listen();
  const port = (proxy.server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.test', dwell: 3000 }),
    });
    assert.equal(res.status, 502);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(records.length, 0);
  } finally {
    await proxy.close();
  }
});

test('D56: page views earn nothing, because loading a page is not an achievement', async () => {
  await withProxy(
    () => ({ status: 200, body: '{}' }),
    async (base, records) => {
      for (let i = 0; i < 3; i += 1) await fetch(`${base}/`);
      await settle(records, 3);
      assert.equal(records.length, 3);
      // `evidenceMass` counts the Beta(1,1) prior, so 2 is "no evidence at all".
      assert.equal(records[2]!.mass, 2);
      assert.equal(records[2]!.windowCount, 3, 'they still feed the behavioral window');
    },
  );
});

/**
 * The first D57 run falsified the simpler reading of a 2xx. IXFE's landing service
 * answers unknown `/api/*` paths with its 94 KB SPA fallback, so a scanner asking
 * for `/api/admin/users` was credited with a success and *gained* trust.
 */
test('D57: an API path answered with a document is a refusal, not a success', async () => {
  await withProxy(
    (path) =>
      path.startsWith('/api/admin')
        ? { status: 200, body: '<!doctype html><html>the whole landing page</html>', contentType: 'text/html; charset=utf-8' }
        : { status: 200, body: '{"ok":true}' },
    async (base, records) => {
      await fetch(`${base}/api/admin/users`);
      await fetch(`${base}/api/credits`);
      await settle(records, 2);

      const [scanned, real] = records;
      assert.ok(scanned!.mean < 0.5, `expected trust to fall, got mean ${scanned!.mean}`);
      assert.ok(real!.mean > scanned!.mean, 'a real JSON answer still earns a positive');
      assert.equal(scanned!.answeredWithDocument, true);
      assert.equal(real!.answeredWithDocument, false);
    },
  );
});

/**
 * The false positive the first D57 run produced, pinned. An uptime check is `GET /`
 * at a fixed interval by a non-browser — indistinguishable over HTTP from a crawler,
 * and configured by the operator themselves.
 */
test('D57: repeated page views never escalate, however regular they are', async () => {
  await withProxy(
    () => ({ status: 200, body: '<html>page</html>', contentType: 'text/html; charset=utf-8' }),
    async (base, records) => {
      for (let i = 0; i < 16; i += 1) {
        await fetch(`${base}/`);
        await sleep(15);
      }
      await settle(records, 16);

      const escalated = records.filter((record) => record.advice !== 'ALLOW');
      assert.deepEqual(escalated, [], 'a page view must not accrue anything');
      assert.deepEqual(records.at(-1)!.signals, [], 'signals belong to actions, not to reads');
      assert.equal(records.at(-1)!.mass, 2, 'still just the prior');
    },
  );
});

/** Asking for pages that are not there is not the same as reading pages that are. */
test('D57: a 404 on a page is weak negative evidence', async () => {
  await withProxy(
    (path) =>
      path === '/'
        ? { status: 200, body: '<html>page</html>', contentType: 'text/html; charset=utf-8' }
        : { status: 404, body: 'Not found', contentType: 'text/plain' },
    async (base, records) => {
      for (const path of ['/.env', '/.git/config', '/wp-login.php', '/backup.zip']) {
        await fetch(`${base}${path}`);
        await sleep(15);
      }
      await settle(records, 4);
      assert.ok(records.at(-1)!.mean < 0.5, `expected trust to fall, got ${records.at(-1)!.mean}`);
    },
  );
});

test('D56: request routing maps to the declared scopes', () => {
  assert.equal(scopeFor('POST', '/api/waitlist'), WAITLIST_SCOPE);
  assert.equal(scopeFor('POST', '/api/order'), ORDER_SCOPE);
  assert.equal(scopeFor('POST', '/api/discover'), WORK_SCOPE);
  // The page asking whether it is still pre-launch is not an action on the system.
  assert.equal(scopeFor('GET', '/api/launch-state'), pageScope('/api/launch-state'));
  // Per path, so that reading four pages does not read as monotonous attention.
  assert.equal(scopeFor('GET', '/order'), pageScope('/order'));
  assert.notEqual(scopeFor('GET', '/order'), scopeFor('GET', '/privacy'));
  assert.equal(scopeFor('GET', '/app.js'), undefined);
  assert.equal(scopeFor('OPTIONS', '/anything'), undefined);
});

/* ------------------------------------------------------------------ *
 * The report
 * ------------------------------------------------------------------ */

function record(overrides: Partial<LiveRecord> = {}): LiveRecord {
  return {
    at: 0,
    entity: 'abcdef0123456789',
    method: 'POST',
    path: '/api/waitlist',
    scope: WAITLIST_SCOPE,
    status: 200,
    answeredWithDocument: false,
    advice: 'ALLOW',
    hardViolated: false,
    violations: [],
    stage: 'established',
    mean: 0.9,
    mass: 10,
    interArrivalCv: 0.8,
    windowCount: 10,
    anomaly: 0.2,
    diversity: true,
    farming: false,
    signals: [],
    ...overrides,
  };
}

test('D56: escalation the origin refused too is agreement, not a false positive', () => {
  const candidates = falsePositiveCandidates([
    record({ status: 429, advice: 'RESTRICT' }),
    record({ status: 200, advice: 'OBSERVE' }),
    // IXFE absorbs a caught bot with 2xx, so the status is not consent.
    record({ status: 200, advice: 'RESTRICT', hardViolated: true, violations: ['ixfe.submission-came-from-form'] }),
    record({ status: 200, advice: 'INCREASE_FRICTION', violations: ['ixfe.honeypot-untouched'] }),
    // A 200 carrying HTML from an API path is a 404 the origin failed to say.
    record({ status: 200, advice: 'BLOCK', answeredWithDocument: true }),
    record({ status: 200, advice: 'INCREASE_FRICTION' }),
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]!.advice, 'INCREASE_FRICTION');
  assert.deepEqual(candidates[0]!.violations, []);
});

test('D56: the report measures the D55 gate rather than asserting it', () => {
  const summary = summarise([
    record({ interArrivalCv: 0.05 }),
    record({ interArrivalCv: 0.1 }),
    record({ interArrivalCv: 0.9 }),
    // Too short a window to have features at all — excluded, not counted as 0.
    record({ interArrivalCv: 0, windowCount: 2, anomaly: undefined }),
  ]);

  assert.equal(summary.total, 4);
  assert.equal(summary.scored, 3);
  assert.equal(summary.belowVelocityGate, 2);
  assert.equal(summary.cv.p50, 0.1);
});

test('D56: a truncated final line does not lose the records before it', () => {
  const parsed = parseRecords(`${JSON.stringify(record())}\n{"at":1,"entity":`);
  assert.equal(parsed.length, 1);
  assert.equal(quantile([], 0.5), undefined);
});
