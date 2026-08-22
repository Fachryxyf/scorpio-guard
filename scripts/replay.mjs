/**
 * Run the HealthMe persona traffic and print the table. D45.
 *
 * Separate from `npm test` on purpose: the tests assert the two claims that must
 * not regress, while this exists to be *read* — the numbers are how a threshold
 * gets argued about.
 *
 *   npm run replay
 */
import { replayAll, formatResults } from '../examples/healthme/replay.ts';
import {
  ADVERSARY_PERSONAS,
  LEGITIMATE_PERSONAS,
  churningBruteForce,
} from '../examples/healthme/personas.ts';

const results = await replayAll([...LEGITIMATE_PERSONAS, ...ADVERSARY_PERSONAS]);
console.log(formatResults(results));

const falsePositives = results.filter((result) => result.falsePositive);
const walkedThrough = results.filter((result) => result.walkedThrough);

console.log();
console.log(`false positives: ${falsePositives.length}`);
console.log(`walked through:  ${walkedThrough.length}`);

// Churn is a population rather than one persona, so it gets its own line.
for (const perEntity of [1, 2, 3]) {
  const churned = await replayAll(churningBruteForce(30, perEntity));
  const felt = churned.filter(
    (result) => result.worst !== 'ALLOW' && result.worst !== 'OBSERVE',
  ).length;
  console.log(
    `churn, ${perEntity} attempt(s) per identity: ${felt}/${churned.length} identities ever felt anything`,
  );
}

if (falsePositives.length > 0 || walkedThrough.length > 0) {
  process.exitCode = 1;
}
