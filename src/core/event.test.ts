/**
 * The event is a published surface, so it is tested as one: its shape, what it does
 * not carry, and the promise that reporting never changes the advice. D61.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ASSESSMENT_EVENT_SCHEMA, hashEntity, type AssessmentEvent } from './event.ts';
import { createGuard } from './guard.ts';

const ENTITY = 'user@example.com';

/**
 * A sink that also lets a test wait for the next event.
 *
 * The event is emitted off the request path, so `await guard.evaluate()` does not mean
 * the sink has run: the digest is asynchronous, and on a loaded machine that can take
 * longer than any fixed number of ticks. The first version of this file waited two
 * `setImmediate` turns and failed in CI for exactly that reason. Waiting on the event
 * itself is the only version that is deterministic.
 */
function collect() {
  const events: AssessmentEvent[] = [];
  const waiters: Array<() => void> = [];
  let cursor = 0;

  return {
    events,
    onAssessment: (event: AssessmentEvent): void => {
      events.push(event);
      for (const wake of waiters.splice(0)) wake();
    },
    async next(timeoutMs = 5000): Promise<AssessmentEvent> {
      while (events.length <= cursor) {
        await Promise.race([
          new Promise<void>((resolve) => waiters.push(resolve)),
          new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error('no assessment event within ' + timeoutMs + ' ms')),
              timeoutMs,
            );
            timer.unref?.();
          }),
        ]);
      }
      return events[cursor++]!;
    },
  };
}

test('D61: one event per evaluation, in a versioned shape', async () => {
  const sink = collect();
  const guard = createGuard({ onAssessment: sink.onAssessment });

  const assessment = await guard.evaluate({ entity: ENTITY, observation: { scope: 'checkout' } });
  const event = await sink.next();

  assert.equal(sink.events.length, 1, 'exactly one event per evaluation');
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
    'the shape is fixed: a host destructures it, so an addition is a decision',
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
  const event = await sink.next();

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

  const key = (await first.next()).entity;
  assert.ok(key, 'a hashed identity is present');
  assert.match(key, /^[0-9a-f]{32}$/, 'truncated to 128 bits so it fits a log column');
  assert.notEqual(key, ENTITY);
  assert.equal((await second.next()).entity, key, 'stable for one salt, so events correlate');
  assert.notEqual(
    (await other.next()).entity,
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
  // A fixed clock, so the comparison is about the sink and not about the milliseconds
  // that passed between the two calls.
  const clock = { now: () => 1_700_000_000_000 };
  const quiet = createGuard({ clock });
  const sink = collect();
  const loud = createGuard({
    clock,
    onAssessment: sink.onAssessment,
    identity: { kind: 'hash', salt: 'deployment-a' },
  });

  const input = { entity: ENTITY, observation: { scope: 'checkout', signals: ['no-pointer-motion'] } };
  const withoutSink = await quiet.evaluate(input);
  const withSink = await loud.evaluate(input);
  await sink.next();

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
  // Give a would-be unhandled rejection a chance to surface: the sink runs after the
  // evaluation resolves, so a missing catch would show up here rather than never.
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(first.decision, 'ALLOW');
  assert.equal(second.decision, 'ALLOW');
});
