import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodeEnvelope } from '../../src/core/protocol.ts';
import { validateEnvelope } from './validate.ts';
import { startReceiver } from './server.ts';
import { createReporter } from './sender.ts';

const FIXTURES = fileURLToPath(new URL('../../protocol/fixtures/v0.1/', import.meta.url));

type Fixture = {
  readonly name: string;
  readonly rule: string;
  readonly why: string;
  readonly request: unknown;
  readonly expect: unknown;
};

const fixtures: readonly Fixture[] = readdirSync(FIXTURES)
  .filter(function (name) {
    return name.endsWith('.json');
  })
  .sort()
  .map(function (name) {
    return JSON.parse(readFileSync(FIXTURES + name, 'utf8')) as Fixture;
  });

/** The library decoder, in the normalised shape every fixture speaks. */
function throughLibrary(request: unknown): unknown {
  const result = decodeEnvelope(request);
  if (!result.ok) {
    return result.field === undefined
      ? { ok: false, code: result.code }
      : { ok: false, code: result.code, field: result.field };
  }
  return {
    ok: true,
    reports: result.reports.map(function (entry) {
      return { category: entry.category, detail: entry.detail ?? null, entities: entry.entities };
    }),
    dropped: result.dropped,
  };
}

for (const fixture of fixtures) {
  test('fixture ' + fixture.name + ' (library): ' + fixture.why, function () {
    assert.deepEqual(throughLibrary(fixture.request), fixture.expect);
  });

  test('fixture ' + fixture.name + ' (receiver): ' + fixture.why, function () {
    assert.deepEqual(validateEnvelope(fixture.request), fixture.expect);
  });
}

test('the fixture suite covers both accept and reject paths', function () {
  const rejected = fixtures.filter(function (fixture) {
    return (fixture.expect as { ok: boolean }).ok === false;
  });
  assert.ok(fixtures.length >= 20, 'fixtures: ' + fixtures.length);
  assert.ok(rejected.length >= 8, 'rejections: ' + rejected.length);
});

test('section 1: every forbidden name is rejected by both implementations', function () {
  for (const name of ['entity', 'sessionId', 'ip', 'userAgent', 'count', 'path', 'timestamp']) {
    const request = { protocol: 'sg/0.1', schema: 1, reports: [], extra: { [name]: 'x' } };
    const library = decodeEnvelope(request);
    assert.equal(library.ok, false, name);
    if (library.ok) return;
    assert.equal(library.code, 'FORBIDDEN_FIELD', name);
    assert.equal(library.field, name, name);
    assert.deepEqual(validateEnvelope(request), { ok: false, code: 'FORBIDDEN_FIELD', field: name });
  }
});

async function post(endpoint: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function oneReport(): unknown {
  return {
    protocol: 'sg/0.1',
    schema: 1,
    reports: [{ category: 'SYM_TIMING', detail: 'SYM_UNIFORM_DELAY_SHAPE', entities: 'few' }],
  };
}

test('interop: one batch crosses the wire and the receiver answers with prescriptions', async function (t) {
  const receiver = await startReceiver();
  t.after(function () {
    return receiver.close();
  });
  const reporter = createReporter({
    endpoint: receiver.url,
    intervalMs: 60_000,
    strategies: ['TIGHTEN_TIMING_TOLERANCE'],
  });
  t.after(function () {
    return reporter.close();
  });

  reporter.record({ detail: 'SYM_UNIFORM_DELAY_SHAPE', category: 'SYM_TIMING', entities: 2 });
  reporter.record({ detail: 'SYM_BROAD_ENUMERATION', category: 'SYM_TARGET', entities: 12 });
  reporter.record({ detail: 'SYM_REQUEST_BURST', category: 'SYM_REPETITION', entities: 40 });

  assert.equal(receiver.stats().requests, 0, 'nothing leaves before a flush or the cadence');

  const result = await reporter.flush();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.sent, 3);
  assert.equal(result.applied, 1, 'the one strategy this instance knows is applied');
  assert.equal(result.ignored, 2, 'the others are ignored rather than escalated');

  const stats = receiver.stats();
  assert.equal(stats.requests, 1, 'three shapes travel as one request');
  assert.equal(stats.reports, 3);
  assert.equal(stats.accepted, 1);
  assert.equal(stats.rejected, 0);
  assert.equal(receiver.prescriptions().length, 3);
});

test('interop: the cadence sends without a caller asking', async function (t) {
  const receiver = await startReceiver();
  t.after(function () {
    return receiver.close();
  });
  const reporter = createReporter({ endpoint: receiver.url, intervalMs: 20, batchSize: 100 });
  t.after(function () {
    return reporter.close();
  });

  reporter.record({ detail: 'SYM_UNIFORM_DELAY_SHAPE', category: 'SYM_TIMING', entities: 1 });
  await new Promise(function (resolve) {
    setTimeout(resolve, 150);
  });

  assert.equal(reporter.stats().sent, 1);
  assert.equal(receiver.stats().reports, 1);
});

test('interop: a replayed request is answered but not counted twice', async function (t) {
  const receiver = await startReceiver();
  t.after(function () {
    return receiver.close();
  });

  const first = await post(receiver.url, oneReport());
  const second = await post(receiver.url, oneReport());

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(second.body, { protocol: 'sg/0.1', prescriptions: [] });
  assert.equal(receiver.stats().replayed, 1);
  assert.equal(receiver.stats().reports, 1, 'a retry does not count one observation twice');
  assert.equal(receiver.stats().shapes, 1);
});

test('interop: a manipulated envelope is rejected over HTTP, with a code', async function (t) {
  const receiver = await startReceiver();
  t.after(function () {
    return receiver.close();
  });

  const major = await post(receiver.url, { protocol: 'sg/1.0', schema: 1, reports: [] });
  assert.equal(major.status, 400);
  assert.deepEqual(major.body, { ok: false, code: 'UNSUPPORTED_MAJOR' });

  const identity = await post(receiver.url, { ...(oneReport() as object), sessionId: 'abc123' });
  assert.equal(identity.status, 400);
  assert.deepEqual(identity.body, { ok: false, code: 'FORBIDDEN_FIELD', field: 'sessionId' });

  const stats = receiver.stats();
  assert.equal(stats.accepted, 0);
  assert.equal(stats.rejected, 2);
  assert.equal(stats.rejections.UNSUPPORTED_MAJOR, 1);
  assert.equal(stats.rejections.FORBIDDEN_FIELD, 1);
});

test('operational: the rate limit is per transport address and answers 429', async function (t) {
  const receiver = await startReceiver({ rateLimit: 2 });
  t.after(function () {
    return receiver.close();
  });

  assert.equal((await post(receiver.url, oneReport())).status, 200);
  assert.equal((await post(receiver.url, oneReport())).status, 200);
  const third = await post(receiver.url, oneReport());
  assert.equal(third.status, 429);
  assert.deepEqual(third.body, { ok: false, code: 'RATE_LIMITED' });

  const stats = receiver.stats();
  assert.equal(stats.rateLimited, 1);
  assert.equal(stats.addresses, 1, 'one key, never stored with content');
});

test('operational: aggregates expire and the address table empties with them', async function (t) {
  const receiver = await startReceiver({ retentionMs: 20, rateWindowMs: 10, corroborateAt: 5 });
  t.after(function () {
    return receiver.close();
  });

  await post(receiver.url, oneReport());
  assert.equal(receiver.stats().shapes, 1);
  const prescriptions = receiver.prescriptions();
  assert.equal(prescriptions.length, 1);
  assert.equal(prescriptions[0]?.confidence, 'provisional');

  await new Promise(function (resolve) {
    setTimeout(resolve, 40);
  });
  receiver.prune();

  assert.equal(receiver.stats().shapes, 0, 'nothing is retained past the window');
  assert.equal(receiver.stats().addresses, 0);
});

test('operational: body size, method, and malformed json each get their own answer', async function (t) {
  const receiver = await startReceiver({ maxBodyBytes: 32 });
  t.after(function () {
    return receiver.close();
  });

  const tooLarge = await post(receiver.url, 'x'.repeat(200));
  assert.equal(tooLarge.status, 413);
  assert.deepEqual(tooLarge.body, { ok: false, code: 'BODY_TOO_LARGE' });

  const malformed = await post(receiver.url, 'not json');
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.body, { ok: false, code: 'INVALID_JSON' });

  const get = await fetch(receiver.url, { method: 'GET' });
  assert.equal(get.status, 405);

  const wrongPath = await fetch('http://127.0.0.1:' + receiver.port + '/v0/other', { method: 'POST' });
  assert.equal(wrongPath.status, 404);
});

test('interop: an unreachable receiver loses the batch and does not throw', async function () {
  const reporter = createReporter({ endpoint: 'http://127.0.0.1:1/v0/symptoms', timeoutMs: 300 });

  reporter.record({ detail: 'SYM_UNIFORM_DELAY_SHAPE', category: 'SYM_TIMING', entities: 1 });
  reporter.record({ detail: 'SYM_REQUEST_BURST', category: 'SYM_TIMING', entities: 9 });
  const result = await reporter.flush();

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.dropped, 2);
  assert.equal(reporter.stats().failed, 1);
  assert.equal(reporter.stats().dropped, 2);
  assert.equal(reporter.stats().queued, 0);
  await reporter.close();
});
