/**
 * Verifies the built package, not the source: `npm test` already covers the
 * source, and a broken `exports` map or a stripped type-only import would pass
 * that and still fail for an adopter.
 */
import { createGuard, WEAK_SIGNALS, signalMass } from '../dist/index.js';
import { toObservation, EMPTY_COUNTS } from '../dist/collect/index.js';
import { sqliteStore } from '../dist/store/sqlite.js';

const guard = createGuard();
const result = await guard.evaluate({ entity: 'smoke' });

if (result.decision !== 'ALLOW') {
  throw new Error(`a first-time entity must be advised ALLOW, got ${result.decision}`);
}
if (result.trust.stage !== 'unknown') {
  throw new Error(`a first-time entity must read as unknown, got ${result.trust.stage}`);
}

// The ./collect subpath must resolve too: a broken exports map passes `npm test`
// and still fails for an adopter.
const observation = toObservation(EMPTY_COUNTS);
if (observation.interactions !== 0 || observation.fieldPopulated !== false) {
  throw new Error('collect subpath returned unexpected defaults');
}

// D42: the whole catalogue at once must still not escalate on its own.
const signalled = await guard.evaluate({
  entity: 'smoke-signals',
  observation: { signals: WEAK_SIGNALS.map((signal) => signal.id) },
});
if (signalled.decision !== 'ALLOW') {
  throw new Error(`weak signals alone must not escalate, got ${signalled.decision}`);
}
if (signalMass(WEAK_SIGNALS.map((signal) => signal.id)) <= 0) {
  throw new Error('the signal catalogue produced no mass at all');
}

// The ./sqlite subpath must resolve, and the durable store must actually persist.
const store = sqliteStore();
const durable = createGuard({ store });
await durable.evaluate({ entity: 'smoke-durable', observation: { evidence: { positive: 'strong' } } });
const reread = await durable.evaluate({ entity: 'smoke-durable' });
if (reread.coldStart !== false) {
  throw new Error('the sqlite store did not retain state within one process');
}
store.close();

console.log(`smoke ok: ${result.decision} (${result.trust.reason})`);
