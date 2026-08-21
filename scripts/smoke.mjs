/**
 * Verifies the built package, not the source: `npm test` already covers the
 * source, and a broken `exports` map or a stripped type-only import would pass
 * that and still fail for an adopter.
 */
import { createGuard } from '../dist/index.js';

const guard = createGuard();
const result = await guard.evaluate({ entity: 'smoke' });

if (result.decision !== 'ALLOW') {
  throw new Error(`a first-time entity must be advised ALLOW, got ${result.decision}`);
}
if (result.trust.stage !== 'unknown') {
  throw new Error(`a first-time entity must read as unknown, got ${result.trust.stage}`);
}

console.log(`smoke ok: ${result.decision} (${result.trust.reason})`);
