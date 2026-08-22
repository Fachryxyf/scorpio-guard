import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ENTITY_BUCKETS,
  PROTOCOL_VERSION,
  bucketEntities,
  decodeEnvelope,
  encodeEnvelope,
} from './protocol.ts';
import { SYMPTOM_SCHEMA_VERSION } from './symptoms.ts';

test('v0.1 section 3: an envelope carries the protocol, the schema and the reports', () => {
  const envelope = encodeEnvelope([
    { category: 'SYM_TIMING', detail: 'SYM_UNIFORM_DELAY_SHAPE', entities: 3 },
  ]);

  assert.equal(envelope.protocol, PROTOCOL_VERSION);
  assert.equal(envelope.schema, SYMPTOM_SCHEMA_VERSION);
  assert.equal(envelope.reports.length, 1);
  assert.equal(envelope.reports[0]!.category, 'SYM_TIMING');
});

test('v0.1 section 1: an encoded envelope has nowhere to put raw data or identity', () => {
  const envelope = encodeEnvelope([
    { category: 'SYM_TARGET', detail: 'SYM_BROAD_ENUMERATION', entities: 40 },
  ]);

  // The guarantee the whole privacy argument rests on, tested adversarially:
  // serialise the thing and look for anything that is not a vocabulary token.
  const wire = JSON.stringify(envelope);
  for (const forbidden of ['entity', 'session', 'ip', 'userAgent', 'mean', 'variance', 'decision']) {
    assert.ok(!wire.includes(forbidden), `envelope leaked a ${forbidden} field`);
  }
  assert.equal(Object.keys(envelope).length, 3, 'exactly protocol, schema, reports');
  assert.equal(Object.keys(envelope.reports[0]!).length, 3, 'exactly category, detail, entities');
});

test('v0.1 section 4: entity counts are bucketed, and an exact count never travels', () => {
  assert.equal(bucketEntities(1), 'one');
  assert.equal(bucketEntities(4), 'few');
  assert.equal(bucketEntities(12), 'several');
  assert.equal(bucketEntities(1000), 'many');

  const envelope = encodeEnvelope([
    { category: 'SYM_TIMING', detail: 'SYM_REQUEST_BURST', entities: 137 },
  ]);
  assert.equal(envelope.reports[0]!.entities, 'many');
  assert.ok(!JSON.stringify(envelope).includes('137'));
});

test('v0.1 section 4: buckets are ordered labels', () => {
  assert.deepEqual([...ENTITY_BUCKETS], ['one', 'few', 'several', 'many']);
});

test('v0.1 rule 1: an unknown detail degrades to its category rather than failing', () => {
  const result = decodeEnvelope({
    protocol: 'sg/0.1',
    schema: 99,
    reports: [{ category: 'SYM_TIMING', detail: 'SYM_INVENTED_BY_A_NEWER_VERSION', entities: 'few' }],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.reports.length, 1, 'the report survives');
  assert.equal(result.reports[0]!.category, 'SYM_TIMING');
  assert.equal(result.reports[0]!.detail, undefined, 'the detail is not guessed at');
  assert.equal(result.dropped, 0);
});

test('v0.1 rule 2: an unknown category drops the report, because nothing remains to fall back to', () => {
  const result = decodeEnvelope({
    protocol: 'sg/0.1',
    schema: 1,
    reports: [
      { category: 'SYM_NOT_A_CATEGORY', detail: 'SYM_REQUEST_BURST', entities: 'few' },
      { category: 'SYM_TIMING', detail: 'SYM_REQUEST_BURST', entities: 'one' },
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.reports.length, 1);
  assert.equal(result.dropped, 1, 'the drop is counted, not silent');
});

test('v0.1 rule 3: a newer schema is accepted', () => {
  const result = decodeEnvelope({
    protocol: 'sg/0.1',
    schema: SYMPTOM_SCHEMA_VERSION + 5,
    reports: [{ category: 'SYM_REPETITION', detail: 'SYM_LOW_VARIETY', entities: 'few' }],
  });

  assert.equal(result.ok, true);
});

test('v0.1 rule 4: an unknown protocol major rejects the whole message', () => {
  const result = decodeEnvelope({ protocol: 'sg/1.0', schema: 1, reports: [] });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /unsupported protocol major/);
});

test('v0.1 rule 5: unknown fields are ignored, missing required fields are not', () => {
  const extra = decodeEnvelope({
    protocol: 'sg/0.1',
    schema: 1,
    reports: [],
    somethingAddedTomorrow: true,
  });
  assert.equal(extra.ok, true, 'an added field must not break a deployed receiver');

  for (const missing of ['protocol', 'schema', 'reports']) {
    const envelope: Record<string, unknown> = { protocol: 'sg/0.1', schema: 1, reports: [] };
    delete envelope[missing];
    const result = decodeEnvelope(envelope);
    assert.equal(result.ok, false, `${missing} is required`);
  }
});

test('v0.1 section 3: an empty report list is valid and means nothing was observed', () => {
  const result = decodeEnvelope({ protocol: 'sg/0.1', schema: 1, reports: [] });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.reports.length, 0);
});

test('v0.1: a malformed envelope is rejected rather than partially trusted', () => {
  assert.equal(decodeEnvelope(null).ok, false);
  assert.equal(decodeEnvelope('sg/0.1').ok, false);
  assert.equal(decodeEnvelope({ protocol: 'not-a-version', schema: 1, reports: [] }).ok, false);
});

test('v0.1: an unparseable bucket drops the report', () => {
  const result = decodeEnvelope({
    protocol: 'sg/0.1',
    schema: 1,
    reports: [{ category: 'SYM_TIMING', detail: 'SYM_REQUEST_BURST', entities: 47 }],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.dropped, 1, 'an exact count is not a bucket');
});

test('v0.1: encode and decode round-trip through the wire', () => {
  const envelope = encodeEnvelope([
    { category: 'SYM_TIMING', detail: 'SYM_UNIFORM_DELAY_SHAPE', entities: 2 },
    { category: 'SYM_CONSTRAINT', detail: 'SYM_DECLARED_VIOLATION', entities: 1 },
  ]);

  const result = decodeEnvelope(JSON.parse(JSON.stringify(envelope)));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.reports.length, 2);
  assert.equal(result.reports[0]!.detail, 'SYM_UNIFORM_DELAY_SHAPE');
  assert.equal(result.reports[1]!.entities, 'one');
});
