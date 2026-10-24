/**
 * The example is tested the way a host would use it: real HTTP requests, real
 * decisions, no fakes. If this file breaks, the adoption story in the README is wrong.
 */
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createExpressApp } from './express.ts';
import { createGuardedServer, listen } from './server.ts';

type Payload = { decision: string; reason: string; host: string; trace: string[] };

async function body(response: Response): Promise<Payload> {
  return (await response.json()) as Payload;
}

async function readBeforeLogin(base: string, entity: string, runs: number) {
  let last: { status: number; payload: Payload } | undefined;
  for (let run = 0; run < runs; run += 1) {
    const response = await fetch(base + '/data', {
      headers: { 'x-entity': entity, 'x-after-login': '0' },
    });
    last = { status: response.status, payload: await body(response) };
  }
  assert.ok(last);
  return last;
}

describe('node:http integration', () => {
  let server: Server;
  let base: string;

  before(async () => {
    server = createGuardedServer();
    base = await listen(server);
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('serves a client with nothing against it', async () => {
    const response = await fetch(base + '/data', {
      headers: { 'x-entity': 'fresh', 'x-after-login': '1' },
    });
    const payload = await body(response);
    assert.equal(response.status, 200);
    assert.equal(payload.decision, 'ALLOW');
    assert.ok(payload.trace.length > 0);
  });

  it('asks for friction once three reads arrive with no login', async () => {
    const last = await readBeforeLogin(base, 'crawler', 3);
    assert.equal(last.payload.decision, 'INCREASE_FRICTION');
    assert.equal(last.status, 429);
    assert.ok(last.payload.trace.some((line) => line.includes('soft') || line.includes('violation')));
  });

  it('restricts a token the host never issued', async () => {
    const response = await fetch(base + '/login', {
      method: 'POST',
      headers: { 'x-entity': 'replayer', 'content-type': 'application/json' },
      body: JSON.stringify({ tokenWasIssued: false }),
    });
    const payload = await body(response);
    assert.equal(payload.decision, 'RESTRICT');
    assert.equal(response.status, 403);
    assert.ok(payload.host.includes('refuse'));
  });
});

describe('express adapter', () => {
  let server: Server;
  let base: string;

  before(async () => {
    server = createExpressApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address() as AddressInfo;
    base = 'http://127.0.0.1:' + address.port;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('serves a client with nothing against it', async () => {
    const response = await fetch(base + '/data', {
      headers: { 'x-entity': 'fresh-express', 'x-after-login': '1' },
    });
    assert.equal((await body(response)).decision, 'ALLOW');
  });

  it('asks for friction once three reads arrive with no login', async () => {
    const last = await readBeforeLogin(base, 'crawler-express', 3);
    assert.equal(last.payload.decision, 'INCREASE_FRICTION');
    assert.equal(last.status, 429);
  });

  it('restricts a token the host never issued', async () => {
    const response = await fetch(base + '/login', {
      method: 'POST',
      headers: { 'x-entity': 'replayer-express', 'content-type': 'application/json' },
      body: JSON.stringify({ tokenWasIssued: false }),
    });
    assert.equal((await body(response)).decision, 'RESTRICT');
    assert.equal(response.status, 403);
  });
});
