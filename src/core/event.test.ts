/**
 * The event is a published surface, so it is tested as one: its shape, what it does
 * not carry, and the promise that reporting never changes the advice. D61.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ASSESSMENT_EVENT_SCHEMA, hashEntity, type AssessmentEvent } from './event.ts';
import { createGuard } from './guard.ts';

const ENTITY = 'user@example.com';

/** The event is emitted off the request path, so a bare await is not enough. */
async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function collect() {
  const events: AssessmentEvent[] = [];
  return {
    events,
    onAssessment: (event: AssessmentEvent) => {
      events.push(event);
    },
  };
}

test('D61: one event per evaluation, in a versioned shape', async () => {
  const sink = collect();
  const guard = createGuard({ onAssessment: sink.onAssessment });

  const assessment = await guard.evaluate({ entity: ENTITY, observation: { scope: 'checkout' } });
  await settle();

  assert.equal(sink.events.length, 1, 'exactly one event per evaluation');
  const event = sink.events[0]!;

  assert.equal(event.schemaVersion, ASSESSMENT_EVENT_SCHEMA);
  assert.deepEqual(
    Object.keys(event).sort(),
    [
      'at',
      'coldStart',
      'decision',
      'durationMs',
      'hardViolated',
      'schemaVersion',
      'stage',
      'trace',
      'trust',
      'uncertainty',
      'violations',
    ],
    'the shape is fixed: a host destructures it, so a silent addition is a breaking change',
  );

  assert.equal(event.decision, assessment.decision);
  assert.equal(event.stage, assessment.trust.stage);
  assert.equal(event.uncertainty, assessment.trust.uncertainty);
  assert.deepEqual(event.trust, {
    mean: assessment.trust.mean,
    variance: assessment.trust.variance,
    mass: assessment.trust.mass,
    band: assessment.trust.band,
    proposed: assessment.trust.proposed,
    ceiling: assessment.trust.ceiling,
    capped: assessment.trust.capped,
  });
  assert.deepEqual(event.trace, assessment.trace);
  assert.ok(Number.isFinite(event.durationMs) && event.durationMs >= 0, 'duration is measured');
  assert.ok(event.at > 0, 'the event is stamped with the evaluation clock');
});

test('D61: the raw entity reference never reaches the event by default', async () => {
  const sink = collect();
  const guard = createGuard({ onAssessment: sink.onAssessment });

  await guard.evaluate({ entity: ENTITY, observation: { scope: 'checkout' } });
  await settle();

  const event = sink.events[0]!;
  assert.equal('entity' in event, false, 'no reference is carried unless the host asks');
  assert.equal(
    JSON.stringify(event).includes(ENTITY),
    false,
    'the reference must not leak through any other field',
  );
});

test('D61: a hashed identity is keyed by the host salt, and is not the reference', async () => {
  const first = collect();
  const second = collect();
  const other = collect();

  const withSalt = createGuard({
    onAssessment: first.onAssessment,
    identity: { kind: 'hash', salt: 'deployment-a' },
  });
  const sameAgain = createGuard({
    onAssessment: second.onAssessment,
    identity: { kind: 'hash', salt: 'deployment-a' },
  });
  const differentSalt = createGuard({
    onAssessment: other.onAssessment,
    identity: { kind: 'hash', salt: 'deployment-b' },
  });

  await withSalt.evaluate({ entity: ENTITY });
  await sameAgain.evaluate({ entity: ENTITY });
  await differentSalt.evaluate({ entity: ENTITY });
  await settle();

  const key = first.events[0]!.entity;
  assert.ok(key, 'a hashed identity is present');
  assert.match(key, /^[0-9a-f]{32}$/, 'truncated to 128 bits so it fits a log column');
  assert.notEqual(key, ENTITY);
  assert.equal(second.events[0]!.entity, key, 'stable for one salt, so events correlate');
  assert.notEqual(
    other.events[0]!.entity,
    key,
    'a different salt breaks correlation, which is the point of it being a secret',
  );
});

test('D61: two different entities do not collide under one salt', async () => {
  const salt = 'deployment-a';
  const a = await hashEntity('entity-a', salt);
  const b = await hashEntity('entity-b', salt);
  assert.ok(a && b);
  assert.notEqual(a, b);
  assert.equal(await hashEntity('entity-a', salt), a, 'hashing is deterministic');
});

test('D61: reporting does not change the advice', async () => {
  const quiet = createGuard();
  const sink = collect();
  const loud = createGuard({
    onAssessment: sink.onAssessment,
    identity: { kind: 'hash', salt: 'deployment-a' },
  });

  const input = { entity: ENTITY, observation: { scope: 'checkout', signals: ['no-pointer-motion'] } };
  const withoutSink = await quiet.evaluate(input);
  const withSink = await loud.evaluate(input);
  await settle();

  assert.equal(sink.events.length, 1);
  assert.deepEqual(withSink, withoutSink, 'the event must be an observer, not a factor');
});

test('D61: a broken sink cannot fail an evaluation', async () => {
  const throwing = createGuard({
    onAssessment: () => {
      throw new Error('collector is down');
    },
  });
  const rejecting = createGuard({
    onAssessment: async () => {
      throw new Error('collector is down');
    },
  });

  const first = await throwing.evaluate({ entity: ENTITY });
  const second = await rejecting.evaluate({ entity: ENTITY });
  await settle();

  assert.equal(first.decision, 'ALLOW');
  assert.equal(second.decision, 'ALLOW');
});
