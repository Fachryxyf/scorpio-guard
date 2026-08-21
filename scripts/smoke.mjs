/**
 * Verifies the built package, not the source: `npm test` already covers the
 * source, and a broken `exports` map or a stripped type-only import would pass
 * that and still fail for an adopter.
 */
import { createGuard } from '../dist/index.js';
import { toObservation, EMPTY_COUNTS } from '../dist/collect/index.js';

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

console.log(`smoke ok: ${result.decision} (${result.trust.reason})`);
