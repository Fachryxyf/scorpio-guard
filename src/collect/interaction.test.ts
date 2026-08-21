import test from 'node:test';
import assert from 'node:assert/strict';

import { toObservation, watchInteraction, type Observable } from './interaction.ts';

/** A stand-in for an element, so the collector is testable without a DOM. */
function fakeElement(): Observable & { fire(type: string): void; listenerCount(): number } {
  const listeners = new Map<string, Set<(event: unknown) => void>>();

  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    fire(type) {
      for (const listener of listeners.get(type) ?? []) listener({ type });
    },
    listenerCount() {
      let total = 0;
      for (const set of listeners.values()) total += set.size;
      return total;
    },
  };
}

function fakeClock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

test('a human typing produces keyboard interaction and no injection', () => {
  const element = fakeElement();
  const clock = fakeClock();
  const collector = watchInteraction(element, { hasValue: () => true }, { now: clock.now });

  element.fire('pointerdown');
  clock.advance(120);
  for (let i = 0; i < 6; i += 1) {
    element.fire('keydown');
    element.fire('input');
    clock.advance(90);
  }

  const counts = collector.counts();
  assert.equal(counts.keyboard, 6);
  assert.equal(counts.pointer, 1);
  assert.equal(counts.injected, 0, 'typing must not read as injection');
  assert.ok((counts.durationMs ?? 0) > 0);
});

test('a value appearing with no keystroke reads as injected', () => {
  const element = fakeElement();
  const collector = watchInteraction(element, { hasValue: () => true });

  // Programmatic assignment, or a password manager: input with nothing before it.
  element.fire('input');

  const counts = collector.counts();
  assert.equal(counts.keyboard, 0);
  assert.equal(counts.injected, 1);
  assert.equal(counts.populated, true);
});

test('paste is counted as injection, not as typing', () => {
  const element = fakeElement();
  const collector = watchInteraction(element, { hasValue: () => true });

  element.fire('paste');
  element.fire('input');

  assert.equal(collector.counts().injected, 2);
  assert.equal(collector.counts().keyboard, 0);
});

test('injected input is excluded from the interaction count, or the signal is erased', () => {
  const element = fakeElement();
  const collector = watchInteraction(element, { hasValue: () => true });

  element.fire('input');
  const observation = toObservation(collector.counts());

  assert.equal(observation.fieldPopulated, true);
  assert.equal(observation.interactions, 0, 'this is what the idle-action constraint looks for');
  assert.equal(observation.injected, 1);
});

test('an untouched empty field reports nothing at all', () => {
  const element = fakeElement();
  const collector = watchInteraction(element, { hasValue: () => false });

  const counts = collector.counts();
  assert.equal(counts.populated, false);
  assert.equal(counts.durationMs, undefined, 'no interaction means no duration');
  assert.equal(toObservation(counts).interactions, 0);
});

test('stop removes every listener, so a collector cannot outlive its element', () => {
  const element = fakeElement();
  const collector = watchInteraction(element, { hasValue: () => false });

  assert.ok(element.listenerCount() > 0);
  collector.stop();
  assert.equal(element.listenerCount(), 0);

  element.fire('keydown');
  assert.equal(collector.counts().keyboard, 0, 'a stopped collector must not keep counting');
});

test('reset clears counters without unbinding, for a second attempt', () => {
  const element = fakeElement();
  const collector = watchInteraction(element, { hasValue: () => true });

  element.fire('keydown');
  collector.reset();
  assert.equal(collector.counts().keyboard, 0);

  element.fire('keydown');
  assert.equal(collector.counts().keyboard, 1, 'listeners must survive a reset');
});

test('the collector never records what was entered', () => {
  const element = fakeElement();
  const collector = watchInteraction(element, { hasValue: () => true });

  element.fire('keydown');
  const counts = collector.counts();

  // Counts and a boolean. Anything resembling content would be a privacy defect,
  // not a feature — D19 and the local-first non-goals both forbid it.
  assert.deepEqual(Object.keys(counts).sort(), [
    'durationMs',
    'injected',
    'keyboard',
    'pointer',
    'populated',
  ]);
  for (const [key, value] of Object.entries(counts)) {
    assert.ok(
      typeof value === 'number' || typeof value === 'boolean' || value === undefined,
      `${key} must be a count or a flag, got ${typeof value}`,
    );
  }
});
