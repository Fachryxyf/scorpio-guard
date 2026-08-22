import test from 'node:test';
import assert from 'node:assert/strict';

import { PROOF_SOURCES, PROOF_SOURCE_OF } from '../../src/core/constraints.ts';
import { replayAll, replayPersona } from '../harness/replay.ts';
import { ixfeInvariants } from './invariants.ts';
import {
  IXFE_ADVERSARIES,
  IXFE_LEGITIMATE,
  creditDrainer,
  endpointShooter,
  rotatingShooter,
} from './personas.ts';

const withInvariants = { invariants: ixfeInvariants };

/**
 * The central constraint. D47.
 *
 * IXFE's legitimate personas are drawn from its real funnel, including the awkward
 * ones — a mistyped email domain, a refused request from a zero balance. None may
 * cost a user anything.
 */
test('D47: no legitimate IXFE persona is ever given friction', async () => {
  const results = await replayAll(IXFE_LEGITIMATE, withInvariants);

  const offenders = results
    .filter((result) => result.falsePositive)
    .map((result) => `${result.persona} was advised ${result.worst} at step ${result.worstAtStep}`);

  assert.deepEqual(offenders, []);
  assert.equal(results.length, 5);
});

test('D47: every IXFE adversary costs something', async () => {
  const results = await replayAll(IXFE_ADVERSARIES, withInvariants);

  const walkedThrough = results
    .filter((result) => result.walkedThrough)
    .map((result) => `${result.persona} never got past ${result.worst}`);

  assert.deepEqual(walkedThrough, []);
  assert.equal(results.length, 8);
});

/**
 * The reason IXFE replaces HealthMe as the primary target: it can exercise all six
 * proof sources, where a PIN screen could reach four.
 */
test('D47: the declared invariants cover every proof source in D41', async () => {
  const covered = new Set(
    ixfeInvariants.map((invariant) => PROOF_SOURCE_OF[invariant.class]),
  );

  for (const source of PROOF_SOURCES) {
    assert.ok(covered.has(source), `no IXFE invariant proves anything from "${source}"`);
  }
});

test('D48: a refused request from a stale balance is evidence, never proof', async () => {
  // The first draft declared this `hard`, which asserts no legitimate client ever
  // asks for work it cannot afford. False: the client's view of its balance is stale
  // by construction. One refused request must therefore cost nothing.
  const honest = await replayPersona(
    IXFE_LEGITIMATE.find((persona) => persona.id === 'ran-out-of-credits')!,
    withInvariants,
  );

  const refused = honest.records.find((record) => record.hostDid === 'rejected');
  assert.ok(refused, 'the persona must actually get refused');
  assert.equal(refused!.hardViolated, false, 'a stale balance is not a proof of anything');
  assert.equal(honest.falsePositive, false);
});

test('D47: a missing dwell is a proof, where a fast dwell would only be a signal', async () => {
  // IXFE absorbs these silently and learns nothing. The page always computes
  // `dwell`, so its absence proves the request bypassed the page — as opposed to
  // `dwell < 1500ms`, which is a calibrated guess about human speed and lives in the
  // weak-signal catalogue instead.
  const result = await replayPersona(endpointShooter(5), withInvariants);

  assert.equal(result.records[0]!.hardViolated, true);
  assert.equal(result.worst, 'RESTRICT');
  assert.equal(result.worstAtStep, 1, 'proof does not need history to accumulate');
});

/**
 * The persona that has to be caught statistically or not at all: every request is
 * authorised, nothing violates an invariant, and it spends real money.
 */
test('D47: the credit drainer breaks no invariant and is still escalated', async () => {
  const result = await replayPersona(creditDrainer(40), withInvariants);

  assert.ok(
    result.records.every((record) => !record.hardViolated),
    'this persona must not be catchable by proof, or it tests nothing',
  );
  assert.equal(result.walkedThrough, false);
  assert.ok(result.worstAtStep! <= 20, `took ${result.worstAtStep} steps to notice`);
});

test('D45: rotating the entity reference still costs two requests per identity', async () => {
  // Measured on HealthMe, re-measured here because IXFE's rate limiter is keyed on
  // CF-Connecting-IP: an attacker with addresses to spare rotates past both defences
  // at once, so the floor matters more.
  const twoEach = await replayPersona(rotatingShooter(20, 2), withInvariants);
  assert.ok(
    twoEach.records.some((record) => record.advice === 'RESTRICT'),
    'a missing dwell is provable, so even a fresh identity is caught immediately',
  );

  // And unlike HealthMe's brute force, one request per identity is caught too —
  // because the violation is a proof rather than accumulated evidence.
  const onceEach = await replayPersona(rotatingShooter(20, 1), withInvariants);
  assert.equal(onceEach.walkedThrough, false, 'proof needs no history');
});
