/**
 * A minimal reference receiver for sg/0.1.
 *
 * It does four things: validate, answer with prescriptions, keep aggregates, and
 * forget. It has no field for a sender, so it cannot store one, and its stats are
 * counts of shapes rather than of visitors.
 *
 * Operational defaults are decisions, not tuning knobs left implicit: one hour of
 * shape aggregates, sixty requests per minute per transport address, a 64 KiB
 * body, and a replay window as long as retention. D71.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { validateEnvelope, type ReceivedReport, type ReceiveFailureCode } from './validate.ts';

const PROTOCOL = 'sg/0.1';

/** Section 5 leaves the strategy vocabulary open; these are this receiver choices. */
const STRATEGY: Readonly<Record<string, string>> = {
  SYM_TIMING: 'TIGHTEN_TIMING_TOLERANCE',
  SYM_REPETITION: 'DEDUPE_BY_SHAPE',
  SYM_INTERACTION: 'REQUIRE_EXPLICIT_INTENT',
  SYM_SEQUENCE: 'REQUIRE_ORDERED_STEPS',
  SYM_TARGET: 'NARROW_SURFACE',
  SYM_CONSTRAINT: 'KEEP_THE_CONSTRAINT',
};

export type ReceiverOptions = {
  /** 0 binds an ephemeral port, which is what the tests use. */
  readonly port?: number;
  readonly retentionMs?: number;
  readonly rateLimit?: number;
  readonly rateWindowMs?: number;
  readonly maxBodyBytes?: number;
  readonly corroborateAt?: number;
  readonly now?: () => number;
};

export type Shape = {
  readonly category: string;
  readonly detail: string | null;
  readonly entities: string;
};

export type Prescription = Shape & {
  readonly strategy: string;
  readonly confidence: 'provisional' | 'corroborated';
};

export type ReceiverStats = {
  readonly requests: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly replayed: number;
  readonly rateLimited: number;
  readonly reports: number;
  readonly dropped: number;
  readonly shapes: number;
  readonly addresses: number;
  readonly rejections: Readonly<Record<string, number>>;
};

export type Receiver = {
  readonly url: string;
  readonly port: number;
  readonly stats: () => ReceiverStats;
  readonly prescriptions: () => readonly Prescription[];
  readonly prune: () => void;
  readonly close: () => Promise<void>;
};

type ShapeEntry = { readonly shape: Shape; count: number; lastSeen: number };

export async function startReceiver(options: ReceiverOptions = {}): Promise<Receiver> {
  const retentionMs = options.retentionMs ?? 60 * 60 * 1000;
  const rateLimit = options.rateLimit ?? 60;
  const rateWindowMs = options.rateWindowMs ?? 60 * 1000;
  const maxBodyBytes = options.maxBodyBytes ?? 64 * 1024;
  const corroborateAt = options.corroborateAt ?? 3;
  const now = options.now ?? Date.now;

  const shapes = new Map<string, ShapeEntry>();
  const seen = new Map<string, number>();
  const rate = new Map<string, { count: number; resetAt: number }>();
  const counters = {
    requests: 0,
    accepted: 0,
    rejected: 0,
    replayed: 0,
    rateLimited: 0,
    reports: 0,
    dropped: 0,
  };
  const rejections: Record<string, number> = {};

  function prune(): void {
    const at = now();
    for (const [key, entry] of shapes) {
      if (entry.lastSeen + retentionMs - at <= 0) shapes.delete(key);
    }
    for (const [digest, expiry] of seen) {
      if (expiry - at <= 0) seen.delete(digest);
    }
    for (const [address, bucket] of rate) {
      if (bucket.resetAt - at <= 0) rate.delete(address);
    }
  }

  function overLimit(address: string): boolean {
    const at = now();
    const bucket = rate.get(address);
    if (bucket === undefined || bucket.resetAt - at <= 0) {
      rate.set(address, { count: 1, resetAt: at + rateWindowMs });
      return false;
    }
    bucket.count += 1;
    return bucket.count > rateLimit;
  }

  function note(shape: Shape): Prescription {
    const key = shape.category + '|' + (shape.detail ?? '*') + '|' + shape.entities;
    const entry = shapes.get(key);
    const confidence = entry === undefined || entry.count + 1 < corroborateAt ? 'provisional' : 'corroborated';
    if (entry === undefined) {
      shapes.set(key, { shape: shape, count: 1, lastSeen: now() });
    } else {
      entry.count += 1;
      entry.lastSeen = now();
    }
    const strategy = STRATEGY[shape.category];
    return {
      category: shape.category,
      detail: shape.detail,
      entities: shape.entities,
      strategy: strategy === undefined ? 'OBSERVE_ONLY' : strategy,
      confidence: confidence,
    };
  }

  function reject(code: string): void {
    counters.rejected += 1;
    const weight = rejections[code] ?? 0;
    rejections[code] = weight + 1;
  }

  function send(response: ServerResponse, status: number, body: unknown): void {
    const text = JSON.stringify(body);
    response.writeHead(status, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(text),
    });
    response.end(text);
  }

  async function body(req: IncomingMessage): Promise<string | null> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = chunk as Buffer;
      size += buffer.length;
      if (size > maxBodyBytes) return null;
      chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  const server: Server = createServer(function (req, res) {
    void handle(req, res);
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    prune();
    counters.requests += 1;

    if (req.method !== 'POST') {
      reject('METHOD_NOT_ALLOWED');
      send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
      return;
    }
    if (req.url !== '/v0/symptoms') {
      reject('NOT_FOUND');
      send(res, 404, { ok: false, code: 'NOT_FOUND' });
      return;
    }

    const address = req.socket.remoteAddress ?? 'unknown';
    if (overLimit(address)) {
      counters.rateLimited += 1;
      counters.rejected += 1;
      send(res, 429, { ok: false, code: 'RATE_LIMITED' });
      return;
    }

    const text = await body(req);
    if (text === null) {
      reject('BODY_TOO_LARGE');
      send(res, 413, { ok: false, code: 'BODY_TOO_LARGE' });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      reject('INVALID_JSON');
      send(res, 400, { ok: false, code: 'INVALID_JSON' });
      return;
    }

    const result = validateEnvelope(parsed);
    if (!result.ok) {
      const code: ReceiveFailureCode = result.code;
      reject(code);
      send(res, 400, result.field === undefined ? { ok: false, code: code } : { ok: false, code: code, field: result.field });
      return;
    }

    const digest = createHash('sha256').update(text).digest('hex');
    const expiry = seen.get(digest);
    if (expiry !== undefined && expiry - now() > 0) {
      counters.replayed += 1;
      send(res, 200, { protocol: PROTOCOL, prescriptions: [] });
      return;
    }
    seen.set(digest, now() + retentionMs);

    counters.accepted += 1;
    counters.reports += result.reports.length;
    counters.dropped += result.dropped;

    const prescriptions = result.reports.map(note);
    send(res, 200, { protocol: PROTOCOL, prescriptions: prescriptions });
  }

  await new Promise<void>(function (resolve) {
    server.listen(options.port ?? 0, '127.0.0.1', function () {
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('receiver did not bind a port');
  }
  const port = address.port;

  return {
    url: 'http://127.0.0.1:' + port + '/v0/symptoms',
    port: port,
    stats: function (): ReceiverStats {
      return {
        requests: counters.requests,
        accepted: counters.accepted,
        rejected: counters.rejected,
        replayed: counters.replayed,
        rateLimited: counters.rateLimited,
        reports: counters.reports,
        dropped: counters.dropped,
        shapes: shapes.size,
        addresses: rate.size,
        rejections: Object.freeze({ ...rejections }),
      };
    },
    prescriptions: function (): readonly Prescription[] {
      return [...shapes.values()].map(function (entry) {
        const strategy = STRATEGY[entry.shape.category];
        return {
          category: entry.shape.category,
          detail: entry.shape.detail,
          entities: entry.shape.entities,
          strategy: strategy === undefined ? 'OBSERVE_ONLY' : strategy,
          confidence: entry.count >= corroborateAt ? 'corroborated' : 'provisional',
        };
      });
    },
    prune: prune,
    close: function (): Promise<void> {
      return new Promise<void>(function (resolve, fail) {
        server.close(function (error) {
          if (error) fail(error);
          else resolve();
        });
      });
    },
  };
}

export type { ReceivedReport };

const entry = process.argv[1] ?? '';
if (entry.endsWith('server.ts')) {
  const port = process.env.PORT === undefined ? 4009 : Number(process.env.PORT);
  const receiver = await startReceiver({ port: port });
  console.log('sg/0.1 receiver listening on ' + receiver.url);
}
