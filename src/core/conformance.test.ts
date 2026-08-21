import test from 'node:test';
import assert from 'node:assert/strict';

import { assertConformant, checkStoreConformance } from './conformance.ts';
import { memoryStore, type StateStore } from './store.ts';
import { freshState, type EntityState } from './trust.ts';

test('D8: the reference in-memory store is conformant', async () => {
  const results = await checkStoreConformance(() => memoryStore());

  assertConformant(results);
  assert.ok(results.length >= 10, `expected a substantial contract, got ${results.length} checks`);
});

/**
 * The kit is only worth shipping if it actually catches a broken store. Each of
 * these is a mistake a real implementation plausibly makes.
 */

test('it catches a store that invents a default instead of returning undefined', async () => {
  const wrong: StateStore = {
    get: async () => freshState(0),
    set: async () => {},
    delete: async () => {},
  };

  const results = await checkStoreConformance(() => wrong);
  const failed = results.filter((result) => !result.passed).map((result) => result.name);
  assert.ok(failed.includes('absent state reads as undefined'), `caught: ${failed.join(', ')}`);
  assert.throws(() => assertConformant(results));
});

test('it catches a store that loses millisecond precision', async () => {
  const map = new Map<string, EntityState>();
  const lossy: StateStore = {
    // A second-resolution timestamp column: plausible, and it silently corrupts
    // both decay and retention.
    set: async (entity, state) => {
      map.set(entity, { ...state, lastSeen: Math.floor(state.lastSeen / 1000) * 1000 });
    },
    get: async (entity) => map.get(entity),
    delete: async (entity) => {
      map.delete(entity);
    },
  };

  const results = await checkStoreConformance(() => lossy);
  const failed = results.filter((result) => !result.passed).map((result) => result.name);
  assert.ok(failed.includes('numeric precision survives the round trip'));
});

test('it catches a store that drops the observation window', async () => {
  const map = new Map<string, EntityState>();
  const dropsWindow: StateStore = {
    // Persisting only the scalar columns: an easy omission, and it disables the
    // whole anomaly dimension without any error surfacing.
    set: async (entity, state) => {
      map.set(entity, { ...state, window: [] });
    },
    get: async (entity) => map.get(entity),
    delete: async (entity) => {
      map.delete(entity);
    },
  };

  const results = await checkStoreConformance(() => dropsWindow);
  const failed = results.filter((result) => !result.passed).map((result) => result.name);
  assert.ok(failed.includes('the observation window survives, in order'));
});

test('it catches a store that normalises keys', async () => {
  const map = new Map<string, EntityState>();
  const normalising: StateStore = {
    // Trimming looks harmless and merges two distinct entities into one.
    set: async (entity, state) => {
      map.set(entity.trim().toLowerCase(), state);
    },
    get: async (entity) => map.get(entity.trim().toLowerCase()),
    delete: async (entity) => {
      map.delete(entity.trim().toLowerCase());
    },
  };

  const results = await checkStoreConformance(() => normalising);
  const failed = results.filter((result) => !result.passed).map((result) => result.name);
  assert.ok(failed.includes('entity keys are opaque and do not collide'));
});

test('it catches a store that hands back a live internal object', async () => {
  const map = new Map<string, EntityState>();
  const leaky: StateStore = {
    set: async (entity, state) => {
      // Storing a mutable copy and returning it directly: the caller can then
      // change trust state without going through `set`.
      map.set(entity, { ...state });
    },
    get: async (entity) => map.get(entity),
    delete: async (entity) => {
      map.delete(entity);
    },
  };

  const results = await checkStoreConformance(() => leaky);
  const failed = results.filter((result) => !result.passed).map((result) => result.name);
  assert.ok(failed.includes('a returned state cannot be mutated through the store'));
});

test('assertConformant names every failure, not just the first', async () => {
  const broken: StateStore = {
    get: async () => freshState(0),
    set: async () => {},
    delete: async () => {},
  };

  const results = await checkStoreConformance(() => broken);
  assert.throws(
    () => assertConformant(results),
    (error: Error) => error.message.split('\n').length > 2,
  );
});
