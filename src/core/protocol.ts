/**
 * The v0.1 wire format for symptom reporting. See PROTOCOL.md.
 *
 * NOT EXPORTED from the package surface, for the same reason `symptoms.ts` is not:
 * nothing transmits yet (D17, D20), and an exported encoder with no transmitter
 * invites use it has no semantics for. What lives here is the *shape* plus the
 * degradation rules, so the spec has an executable counterpart and cannot drift
 * from the vocabulary it describes.
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
 * Bucketed entity counts. Section 4.
 *
 * Ordered labels, never numbers: an exact count is identifying in a small
 * deployment, and no receiver decision improves from the precision.
 */
export const ENTITY_BUCKETS = ['one', 'few', 'several', 'many'] as const;

export type EntityBucket = (typeof ENTITY_BUCKETS)[number];

/**
 * Bucket boundaries are sender-side policy and are not part of the spec —
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

export type DecodeResult =
  | { readonly ok: true; readonly reports: readonly DecodedReport[]; readonly dropped: number }
  | { readonly ok: false; readonly reason: string };

/**
 * Read an envelope, applying every degradation rule in section 6.
 *
 * An unknown *detail* degrades to its category and is kept (rule 1). An unknown
 * *category* drops that report and is counted (rule 2). A newer schema is accepted
 * (rule 3). An unknown protocol major rejects the whole message (rule 4). Unknown
 * fields are ignored by construction, since nothing reads them (rule 5).
 */
export function decodeEnvelope(value: unknown): DecodeResult {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, reason: 'envelope is not an object' };
  }

  const envelope = value as Partial<SymptomEnvelope>;

  if (typeof envelope.protocol !== 'string') {
    return { ok: false, reason: 'missing required field: protocol' };
  }
  const major = majorOf(envelope.protocol);
  if (major === undefined) {
    return { ok: false, reason: `unparseable protocol: ${envelope.protocol}` };
  }
  if (major !== PROTOCOL_MAJOR) {
    return { ok: false, reason: `unsupported protocol major: ${major}` };
  }
  if (typeof envelope.schema !== 'number') {
    return { ok: false, reason: 'missing required field: schema' };
  }
  if (!Array.isArray(envelope.reports)) {
    return { ok: false, reason: 'missing required field: reports' };
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

function majorOf(protocol: string): number | undefined {
  const match = /^sg\/(\d+)\.(\d+)$/.exec(protocol);
  if (!match) return undefined;
  return Number(match[1]);
}
