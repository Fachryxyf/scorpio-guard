/**
 * The host-dataset adapter is tested on an embedded fixture, because the real
 * dataset (report-sg/) is deliberately not committed. The fixture is small, but
 * every number in it is one the model actually produces: the recorded decisions,
 * means and masses were computed by running the same observations through the
 * guard, so a model change that moves them fails here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  conditionKeys,
  deriveEvidence,
  evaluateHostCell,
  hostInvariants,
  labelRows,
  parseCsv,
  parseHostJournal,
  replayHost,
  type HostJournalRow,
} from './host-calibration.ts';

const HEADER =
  'id,at,scope,decision,stage,uncertainty,hardViolated,violations,entityHash,hostAction,outcome,trace,durationMs,coldStart,trustMean,trustMass,schemaVersion,trustVariance,trustBand,trustProposed,trustCeiling,trustCapped,facts';

const REFRESH_HARD =
  '[{"class": "IMPOSSIBLE_UNISSUED_REFERENCE", "strength": "hard", "invariant": "auth-refresh-session-rotated"}]';
const ADMIN_HARD =
  '[{"class": "IMPOSSIBLE_ACTION_PREREQUISITE", "strength": "hard", "invariant": "admin-permission-held"}]';
const INBOX_SOFT =
  '[{"class": "IMPOSSIBLE_ACTION_PREREQUISITE", "strength": "soft", "invariant": "inbox-thread-visible"}]';

/** Quote one CSV field the way the journal export does: doubled embedded quotes. */
function q(value: string): string {
  return '"' + value.replaceAll('"', '""') + '"';
}

function journalRow(input: {
  id: string;
  at: string;
  scope: string;
  decision: string;
  hard: boolean;
  violations: string;
  entity: string;
  mean: number;
  mass: number;
  facts: string;
}): string {
  return [
    input.id,
    input.at,
    input.scope,
    input.decision,
    'unknown',
    'high',
    String(input.hard),
    q(input.violations),
    input.entity,
    'none (silent)',
    'served',
    'trace',
    '1',
    'true',
    String(input.mean),
    String(input.mass),
    '1',
    '0.25',
    'restrict',
    'ALLOW',
    'ALLOW',
    'false',
    q(input.facts),
  ].join(',');
}

const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const C = 'cccccccccccccccccccccccccccccccc';

const CSV = [
  HEADER,
  // A legitimate session: a 2xx on auth.refresh without rotation is the D79
  // false positive, then a 404 read adds soft mass only.
  journalRow({
    id: '1',
    at: '1970-01-01T00:00:00.000Z',
    scope: 'auth.refresh',
    decision: 'RESTRICT',
    hard: true,
    violations: REFRESH_HARD,
    entity: A,
    mean: 0.5,
    mass: 2,
    facts: '{"method":"POST","status":201,"succeeded":true,"sessionRotated":false}',
  }),
  journalRow({
    id: '2',
    at: '1970-01-01T00:00:10.000Z',
    scope: 'inbox.read',
    decision: 'OBSERVE',
    hard: false,
    violations: INBOX_SOFT,
    entity: A,
    mean: 0.25,
    mass: 4,
    facts: '{"method":"GET","status":404,"notFound":true,"succeeded":false}',
  }),
  // A documented adversarial attempt: an admin action the host refuses.
  journalRow({
    id: '3',
    at: '1970-01-01T00:00:20.000Z',
    scope: 'admin.action',
    decision: 'RESTRICT',
    hard: true,
    violations: ADMIN_HARD,
    entity: B,
    mean: 0.5,
    mass: 2,
    facts: '{"method":"POST","status":403,"permissionDenied":true,"succeeded":false}',
  }),
  // A hostile client whose requests carry no provable violation: the row the
  // statistical layer exists for. It stays ALLOW, so it is a false negative.
  journalRow({
    id: '4',
    at: '1970-01-01T00:00:30.000Z',
    scope: 'auth.login',
    decision: 'ALLOW',
    hard: false,
    violations: '[]',
    entity: C,
    mean: 0.5,
    mass: 2,
    facts: '{"method":"POST","status":200,"succeeded":true,"sessionIssued":true}',
  }),
  // The same hostile client one weak negative later.
  journalRow({
    id: '5',
    at: '1970-01-01T00:00:40.000Z',
    scope: 'auth.login',
    decision: 'ALLOW',
    hard: false,
    violations: '[]',
    entity: C,
    mean: 0.4,
    mass: 2.5,
    facts: '{"method":"POST","status":200,"succeeded":true,"sessionIssued":true}',
  }),
].join('\n');

const ENTITY_MAP = new Map([
  [A, { kind: 'session', label: 'session-of:pt_dc_a1' }],
  [B, { kind: 'unresolved', label: '' }],
  [C, { kind: 'unresolved', label: '' }],
]);

test('the CSV reader survives quoted JSON fields', () => {
  const parsed = parseCsv(CSV);
  assert.equal(parsed.length, 5);
  assert.equal(parsed[0]?.['scope'], 'auth.refresh');
  assert.ok((parsed[0]?.['facts'] ?? '').includes('sessionRotated'));
});

test('parseHostJournal yields time-ordered rows with parsed facts and violations', () => {
  const rows = parseHostJournal(CSV);
  assert.equal(rows.length, 5);
  assert.ok(rows[0]!.at <= rows[1]!.at);
  assert.equal(rows[0]!.facts.sessionRotated, false);
  assert.equal(rows[0]!.violations[0]!.invariant, 'auth-refresh-session-rotated');
});

test('conditionKeys splits the documented hard rows by intent', () => {
  const conditions = [
    'at,scope,decision,outcome,violations,entityHash,facts,trace',
    '1970-01-01 00:00:20.000,admin.action,RESTRICT,refused,"[]",bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,,',
    '1970-01-01 00:00:00.000,auth.refresh,RESTRICT,served,"[]",aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,,',
  ].join('\n');
  const keys = conditionKeys(conditions);
  assert.ok(keys.adversarial.has('20000|admin.action'));
  assert.ok(keys.legitimate.has('0|auth.refresh'));
});

test('deriveEvidence recovers a weak negative from the mass sequence', () => {
  const rows = parseHostJournal(CSV);
  const derived = deriveEvidence(rows);
  const fifth = rows[4]!;
  assert.deepEqual(derived.get(fifth), { negative: 'weak' });
  // The rows whose mass movement is fully explained by the model itself
  // (the 404 soft violation) derive no evidence.
  assert.equal(derived.get(rows[1]!), undefined);
});

test('labelRows resolves pt_* sessions and documented rows, and leaves the rest unlabelled', () => {
  const rows = parseHostJournal(CSV);
  const conditions = conditionKeys(
    [
      'at,scope,decision,outcome,violations,entityHash,facts,trace',
      '1970-01-01 00:00:20.000,admin.action,RESTRICT,refused,"[]",bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,,',
    ].join('\n'),
  );
  const labelled = labelRows(rows, ENTITY_MAP, conditions.adversarial);
  assert.equal(labelled[0]!.groundTruth, 'legitimate');
  assert.equal(labelled[1]!.groundTruth, 'legitimate');
  assert.equal(labelled[2]!.groundTruth, 'adversarial');
  assert.equal(labelled[3]!.groundTruth, 'unlabelled', 'no condition documents this row here');
  assert.equal(labelled[4]!.groundTruth, 'unlabelled');
});

test('replayHost reproduces the recorded advice on the fixture', async () => {
  const rows: HostJournalRow[] = parseHostJournal(CSV);
  const replayed = await replayHost(rows);

  assert.equal(replayed.length, 5);
  for (const outcome of replayed) {
    assert.equal(outcome.violationsMatch, true, 'reconstructed violations must match the record');
    assert.equal(
      outcome.replayed,
      outcome.row.recorded,
      `row at ${outcome.row.at}: replayed ${outcome.replayed}, recorded ${outcome.row.recorded}`,
    );
  }
});

test('evaluateHostCell counts the documented false positive and the false negative', async () => {
  const rows = parseHostJournal(CSV);
  const conditions = conditionKeys(
    [
      'at,scope,decision,outcome,violations,entityHash,facts,trace',
      '1970-01-01 00:00:20.000,admin.action,RESTRICT,refused,"[]",bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb,,',
    ].join('\n'),
  );
  // The hostile client's rows are not in the conditions file (it lists only hard
  // rows); they are labelled here directly, as the pentest phase reports do.
  const adversarial = conditions.adversarial;
  adversarial.add('30000|auth.login');
  adversarial.add('40000|auth.login');
  const labelled = labelRows(rows, ENTITY_MAP, adversarial);
  const outcome = await evaluateHostCell(labelled, { halfLifeHours: 24, developingAt: 3, establishedAt: 7 });

  assert.equal(outcome.drift, 0, 'the fixture is model-consistent, so replay matches the record');
  assert.deepEqual(outcome.falsePositives, ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']);
  assert.equal(outcome.falseNegatives.length, 2, 'both hostile ALLOW rows are misses');
  assert.equal(outcome.unlabelled, 0);
});

test('the reconstructed invariants stay silent where the record shows no violation', () => {
  for (const invariant of hostInvariants) {
    assert.equal(invariant.holds({ succeeded: true }), true, invariant.id);
    assert.equal(invariant.holds({}), true, invariant.id);
  }
  const byId = new Map(hostInvariants.map((invariant) => [invariant.id, invariant]));
  assert.equal(byId.get('auth-refresh-session-rotated')!.holds({ succeeded: true, sessionRotated: false }), false);
  assert.equal(byId.get('auth-refresh-session-rotated')!.holds({ succeeded: true, sessionRotated: true }), true);
  assert.equal(byId.get('admin-target-issued')!.holds({ notFound: true, hasTargetId: false }), true);
  assert.equal(byId.get('admin-target-issued')!.holds({ notFound: true, hasTargetId: true }), false);
});
