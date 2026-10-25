/**
 * A receiver written against PROTOCOL.md, not against the library.
 *
 * This file exists so the fixture suite has two implementations to disagree with.
 * It shares the vocabulary tables with src/core/symptoms.ts, because tokens are
 * data from the spec and not logic, and shares nothing else: the rules here were
 * read off the document and the tests compare this answer with the library answer
 * case by case. When the two disagree on a fixture, the fixture wins.
 */
import { isSymptom, isSymptomCategory, type SymptomCategory } from '../../src/core/symptoms.ts';

export type ReceiveFailureCode =
  | 'NOT_OBJECT'
  | 'MISSING_PROTOCOL'
  | 'UNPARSEABLE_PROTOCOL'
  | 'UNSUPPORTED_MAJOR'
  | 'MISSING_SCHEMA'
  | 'INVALID_SCHEMA'
  | 'MISSING_REPORTS'
  | 'FORBIDDEN_FIELD';

export type ReceivedReport = {
  readonly category: SymptomCategory;
  /** `null` when this receiver does not know the detail. Section 6 rule 1. */
  readonly detail: string | null;
  readonly entities: string;
};

export type ReceiveResult =
  | { readonly ok: true; readonly reports: readonly ReceivedReport[]; readonly dropped: number }
  | {
      readonly ok: false;
      readonly code: ReceiveFailureCode;
      readonly field?: string;
    };

/** Section 4. Ordered labels, and a number is not one of them. */
const BUCKETS: readonly string[] = ['one', 'few', 'several', 'many'];

/** Section 1. Presence is a rejection here, and the reason is in section 8. */
const FORBIDDEN: readonly string[] = [
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
];

const SUPPORTED_MAJOR = 0;

export function validateEnvelope(input: unknown): ReceiveResult {
  const forbidden = forbiddenFieldIn(input);
  if (forbidden !== undefined) {
    return { ok: false, code: 'FORBIDDEN_FIELD', field: forbidden };
  }

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, code: 'NOT_OBJECT' };
  }

  const body = input as Record<string, unknown>;

  if (typeof body.protocol !== 'string') {
    return { ok: false, code: 'MISSING_PROTOCOL' };
  }
  const major = majorOf(body.protocol);
  if (major === null) {
    return { ok: false, code: 'UNPARSEABLE_PROTOCOL' };
  }
  if (major !== SUPPORTED_MAJOR) {
    return { ok: false, code: 'UNSUPPORTED_MAJOR' };
  }

  if (body.schema === undefined) {
    return { ok: false, code: 'MISSING_SCHEMA' };
  }
  if (typeof body.schema !== 'number' || !Number.isInteger(body.schema)) {
    return { ok: false, code: 'INVALID_SCHEMA' };
  }

  if (!Array.isArray(body.reports)) {
    return { ok: false, code: 'MISSING_REPORTS' };
  }

  const reports: ReceivedReport[] = [];
  let dropped = 0;

  for (const entry of body.reports) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      dropped += 1;
      continue;
    }
    const report = entry as Record<string, unknown>;
    if (typeof report.category !== 'string' || !isSymptomCategory(report.category)) {
      dropped += 1;
      continue;
    }
    if (typeof report.entities !== 'string' || BUCKETS.indexOf(report.entities) === -1) {
      dropped += 1;
      continue;
    }
    const detail = report.detail;
    reports.push({
      category: report.category,
      detail: typeof detail === 'string' && isSymptom(detail) ? detail : null,
      entities: report.entities,
    });
  }

  return { ok: true, reports: reports, dropped: dropped };
}

/** Every key at every depth, case-insensitive, canonical name returned. */
export function forbiddenFieldIn(value: unknown): string | undefined {
  const found: string[] = [];
  collect(value, found);
  if (found.length === 0) return undefined;
  return found.sort()[0];
}

function collect(value: unknown, found: string[]): void {
  if (typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    for (const entry of value) collect(entry, found);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const canonical = canonicalName(key);
    if (canonical !== undefined && found.indexOf(canonical) === -1) {
      found.push(canonical);
    }
    collect(child, found);
  }
}

/** The list spelling of a key, or undefined when the key is allowed. */
function canonicalName(key: string): string | undefined {
  const lower = key.toLowerCase();
  for (const name of FORBIDDEN) {
    if (name.toLowerCase() === lower) return name;
  }
  return undefined;
}

function majorOf(protocol: string): number | null {
  const match = /^sg\/(\d+)\.(\d+)$/.exec(protocol);
  if (match === null) return null;
  return Number(match[1]);
}
