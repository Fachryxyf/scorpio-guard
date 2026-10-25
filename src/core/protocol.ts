/**
 * The v0.1 wire format for symptom reporting. See PROTOCOL.md.
 *
 * NOT EXPORTED from the package surface, for the same reason `symptoms.ts` is not:
 * nothing transmits on its own (D17, D20), and an exported encoder with no
 * transmitter invites use it has no semantics for. What lives here is the *shape*,
 * the degradation rules, and the prohibition the format rests on, so the spec has an
 * executable counterpart and cannot drift from the vocabulary it describes.
 *
 * `examples/protocol/` holds the other side, including a receiver written from
 * PROTOCOL.md rather than from this file. `protocol/fixtures/v0.1/` is the contract
 * the two of them have to agree on.
 *
 * The encoder deliberately has no field for raw observation, identity, or trust
 * state. That is the privacy argument made structural rather than documented:
 * there is nowhere for such data to go.
 */

import {
  SYMPTOM_SCHEMA_VERSION,
  isSymptomCategory,
  type SymptomCategory,
  type SymptomDetail,
  isSymptom,
} from './symptoms.ts';

export const PROTOCOL_VERSION = 'sg/0.1';

/** Major version a receiver must recognise. Section 6, rule 4. */
export const PROTOCOL_MAJOR = 0;

/**
 * Field names a conforming message cannot contain. Section 1.
 *
 * This is the one place where an extra field is a rejection rather than an
 * ignore: a receiver that reads and ignores a session id has already written it
 * to an access log, and that is the guarantee the privacy argument rests on. The
 * scan runs before every other rule, so a message cannot smuggle a field past it
 * by failing an earlier check. D70.
 */
export const FORBIDDEN_FIELDS = [
  'address',
  'agent',
  'at',
  'authorization',
  'cookie',
  'count',
  'counts',
  'decision',
  'dwell',
  'email',
  'entity',
  'interval',
  'intervals',
  'ip',
  'mass',
  'mean',
  'observations',
  'path',
  'paths',
  'recordId',
  'recordIds',
  'records',
  'remoteAddress',
  'score',
  'session',
  'sessionId',
  'stage',
  'timestamp',
  'timestamps',
  'trust',
  'url',
  'userAgent',
  'userId',
  'variance',
  'verdict',
] as const;

const FORBIDDEN = new Map(
  FORBIDDEN_FIELDS.map((name) => [name.toLowerCase(), name] as const),
);

/**
 * Bucketed entity counts. Section 4.
 *
 * Ordered labels, never numbers: an exact count is identifying in a small
 * deployment, and no receiver decision improves from the precision.
 */
export const ENTITY_BUCKETS = ['one', 'few', 'several', 'many'] as const;

export type EntityBucket = (typeof ENTITY_BUCKETS)[number];

/**
 * Bucket boundaries are sender-side policy and are not part of the spec:
 * publishing them lets an attacker infer deployment size from a boundary
 * crossing. These are this implementation's, and an adopter may replace them.
 */
export function bucketEntities(count: number): EntityBucket {
  if (count <= 1) return 'one';
  if (count <= 5) return 'few';
  if (count <= 25) return 'several';
  return 'many';
}

export type SymptomEnvelope = {
  readonly protocol: string;
  readonly schema: number;
  readonly reports: readonly {
    readonly category: SymptomCategory;
    readonly detail: string;
    readonly entities: EntityBucket;
  }[];
};

/** Build a conforming request. Section 3. */
export function encodeEnvelope(
  reports: readonly { detail: SymptomDetail; category: SymptomCategory; entities: number }[],
): SymptomEnvelope {
  return {
    protocol: PROTOCOL_VERSION,
    schema: SYMPTOM_SCHEMA_VERSION,
    reports: reports.map((report) => ({
      category: report.category,
      detail: report.detail,
      entities: bucketEntities(report.entities),
    })),
  };
}

export type DecodedReport = {
  readonly category: SymptomCategory;
  /** `undefined` when the detail is newer than this receiver. Rule 1. */
  readonly detail: SymptomDetail | undefined;
  readonly entities: EntityBucket;
};

/** Stable failure codes. A receiver answers with one of these, never with prose. */
export type DecodeFailureCode =
  | 'NOT_OBJECT'
  | 'MISSING_PROTOCOL'
  | 'UNPARSEABLE_PROTOCOL'
  | 'UNSUPPORTED_MAJOR'
  | 'MISSING_SCHEMA'
  | 'INVALID_SCHEMA'
  | 'MISSING_REPORTS'
  | 'FORBIDDEN_FIELD';

export type DecodeResult =
  | { readonly ok: true; readonly reports: readonly DecodedReport[]; readonly dropped: number }
  | {
      readonly ok: false;
      readonly code: DecodeFailureCode;
      readonly reason: string;
      /** The canonical name found, when the code is FORBIDDEN_FIELD. */
      readonly field?: string;
    };

/**
 * Read an envelope, applying every degradation rule in section 6.
 *
 * An unknown *detail* degrades to its category and is kept (rule 1). An unknown
 * *category* drops that report and is counted (rule 2). A newer schema is accepted
 * (rule 3). An unknown protocol major rejects the whole message (rule 4). Unknown
 * fields are ignored by construction, since nothing reads them (rule 5), except a
 * field named in section 1: those are rejected before any of this runs (D70).
 */
export function decodeEnvelope(value: unknown): DecodeResult {
  // Section 1 before section 6: an identity field is a rejection, and it is
  // found by walking the raw value rather than the shape this version knows.
  const forbidden = forbiddenFieldIn(value);
  if (forbidden !== undefined) {
    return {
      ok: false,
      code: 'FORBIDDEN_FIELD',
      reason: `forbidden field: ${forbidden}`,
      field: forbidden,
    };
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, code: 'NOT_OBJECT', reason: 'envelope is not an object' };
  }

  const envelope = value as Partial<SymptomEnvelope>;

  if (typeof envelope.protocol !== 'string') {
    return { ok: false, code: 'MISSING_PROTOCOL', reason: 'missing required field: protocol' };
  }
  const major = majorOf(envelope.protocol);
  if (major === undefined) {
    return {
      ok: false,
      code: 'UNPARSEABLE_PROTOCOL',
      reason: `unparseable protocol: ${envelope.protocol}`,
    };
  }
  if (major !== PROTOCOL_MAJOR) {
    return {
      ok: false,
      code: 'UNSUPPORTED_MAJOR',
      reason: `unsupported protocol major: ${major}`,
    };
  }
  if (envelope.schema === undefined) {
    return { ok: false, code: 'MISSING_SCHEMA', reason: 'missing required field: schema' };
  }
  if (typeof envelope.schema !== 'number' || !Number.isInteger(envelope.schema)) {
    return { ok: false, code: 'INVALID_SCHEMA', reason: 'schema is not an integer' };
  }
  if (!Array.isArray(envelope.reports)) {
    return { ok: false, code: 'MISSING_REPORTS', reason: 'missing required field: reports' };
  }

  const reports: DecodedReport[] = [];
  let dropped = 0;

  for (const entry of envelope.reports) {
    if (typeof entry !== 'object' || entry === null) {
      dropped += 1;
      continue;
    }
    const report = entry as Partial<SymptomEnvelope['reports'][number]>;

    // Rule 2: an unknown category has nothing to fall back to.
    if (!isSymptomCategory(report.category)) {
      dropped += 1;
      continue;
    }
    if (!isEntityBucket(report.entities)) {
      dropped += 1;
      continue;
    }

    reports.push({
      category: report.category,
      // Rule 1: an unknown detail is not an error. It degrades to its category.
      detail: isSymptom(report.detail) ? report.detail : undefined,
      entities: report.entities,
    });
  }

  return { ok: true, reports, dropped };
}

function isEntityBucket(value: unknown): value is EntityBucket {
  return typeof value === 'string' && (ENTITY_BUCKETS as readonly string[]).includes(value);
}

/**
 * The first forbidden field name anywhere in the message, or .
 *
 * Nested on purpose: a report is where an entity key would hide, and a top-level
 * scan would report a clean message. Names are compared case-insensitively and
 * reported in their canonical spelling, so two implementations agree on the
 * answer without agreeing on how they walk the tree.
 */
export function forbiddenFieldIn(value: unknown): string | undefined {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, child] of Object.entries(node)) {
      const canonical = FORBIDDEN.get(key.toLowerCase());
      if (canonical !== undefined) found.add(canonical);
      walk(child);
    }
  };
  walk(value);
  if (found.size === 0) return undefined;
  return [...found].sort()[0];
}

function majorOf(protocol: string): number | undefined {
  const match = /^sg\/(\d+)\.(\d+)$/.exec(protocol);
  if (!match) return undefined;
  return Number(match[1]);
}
