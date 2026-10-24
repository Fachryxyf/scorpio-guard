/**
 * The node:http server: the smallest honest integration, with no framework to explain.
 *
 * Run it with --demo and three scripted clients arrive over real HTTP. The printed
 * table is the whole adoption story: the advice, the reason, and what the host did
 * about it.
 */
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  createIntegrationGuard,
  decide,
  type Handler,
  type HostRoute,
  type RawRequest,
} from './core.ts';

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function routeOf(url: string): HostRoute | undefined {
  if (url.startsWith('/login')) return 'login';
  if (url.startsWith('/data')) return 'data';
  return undefined;
}

export function createGuardedServer(guard: Handler = createIntegrationGuard()): Server {
  return createServer(async (request, response) => {
    const route = routeOf(request.url ?? '/');
    if (!route) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found');
      return;
    }

    const body = route === 'login' ? await readJson(request) : {};
    const result = await decide(guard, {
      entity: String(request.headers['x-entity'] ?? 'anonymous'),
      route,
      raw: {
        body,
        headers: request.headers as Record<string, string | undefined>,
      },
    });

    response.writeHead(result.status, { 'content-type': 'application/json', ...result.headers });
    response.end(JSON.stringify(result.body));
  });
}

export async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return 'http://127.0.0.1:' + address.port;
}

type Scenario = {
  readonly name: string;
  readonly entity: string;
  readonly route: HostRoute;
  readonly expected: string;
  readonly runs: number;
  readonly raw?: RawRequest;
};

const SCENARIOS: readonly Scenario[] = [
  {
    name: 'first contact, nothing violated',
    entity: 'new-client',
    route: 'data',
    expected: 'ALLOW',
    runs: 1,
    raw: { headers: { 'x-after-login': '1' } },
  },
  {
    name: 'three reads with no login',
    entity: 'crawler',
    route: 'data',
    expected: 'INCREASE_FRICTION',
    runs: 3,
    raw: { headers: { 'x-after-login': '0' } },
  },
  {
    name: 'a token the host never issued',
    entity: 'replayer',
    route: 'login',
    expected: 'RESTRICT',
    runs: 1,
    raw: { body: { tokenWasIssued: false } },
  },
];

export async function runDemo(): Promise<boolean> {
  const server = createGuardedServer();
  const base = await listen(server);
  let passed = true;

  console.log('scenario'.padEnd(34) + 'decision'.padEnd(20) + 'http'.padEnd(6) + 'what the host did');
  for (const scenario of SCENARIOS) {
    let decision = '';
    let status = 0;
    let host = '';
    for (let run = 0; run < scenario.runs; run += 1) {
      const init: RequestInit = {
        method: scenario.route === 'login' ? 'POST' : 'GET',
        headers: { 'x-entity': scenario.entity, ...(scenario.raw?.headers ?? {}) },
      };
      if (scenario.route === 'login') init.body = JSON.stringify(scenario.raw?.body ?? {});
      const response = await fetch(base + '/' + scenario.route, init);
      const payload = (await response.json()) as { decision: string; host: string };
      decision = payload.decision;
      host = payload.host;
      status = response.status;
    }
    const matched = decision === scenario.expected;
    passed = passed && matched;
    console.log(
      scenario.name.padEnd(34) +
        (matched ? decision : decision + ' (expected ' + scenario.expected + ')').padEnd(20) +
        String(status).padEnd(6) +
        host,
    );
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));
  console.log(passed ? 'demo ok: every scenario landed on its expected advice' : 'demo FAILED');
  return passed;
}

if (process.argv[1]?.endsWith('server.ts') && process.argv.includes('--demo')) {
  const passed = await runDemo();
  process.exit(passed ? 0 : 1);
}
