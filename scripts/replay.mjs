/**
 * Run the persona traffic and print the tables. D45, D47.
 *
 * Separate from `npm test` on purpose: the tests assert the two claims that must not
 * regress, while this exists to be *read* — a threshold gets argued about from
 * numbers, not from prose.
 *
 *   npm run replay
 */
import { replayAll, formatResults } from '../examples/harness/replay.ts';

import { ixfeInvariants } from '../examples/ixfe/invariants.ts';
import { IXFE_ADVERSARIES, IXFE_LEGITIMATE, rotatingShooter } from '../examples/ixfe/personas.ts';

import { healthmeInvariants } from '../examples/healthme/invariants.ts';
import {
  ADVERSARY_PERSONAS,
  LEGITIMATE_PERSONAS,
  churningBruteForce,
} from '../examples/healthme/personas.ts';

let failures = 0;

async function report(title, personas, options) {
  const results = await replayAll(personas, options);
  console.log(`\n${title}`);
  console.log(formatResults(results));

  const falsePositives = results.filter((result) => result.falsePositive);
  const walkedThrough = results.filter((result) => result.walkedThrough);
  console.log(`false positives: ${falsePositives.length}   walked through: ${walkedThrough.length}`);

  failures += falsePositives.length + walkedThrough.length;
  return results;
}

// IXFE is the primary target (D47): three deployables, unauthenticated funnel, and
// paid compute behind a public endpoint.
await report('IXFE — ixfe.pro', [...IXFE_LEGITIMATE, ...IXFE_ADVERSARIES], {
  invariants: ixfeInvariants,
});

// HealthMe is kept as the small-application regression: two scopes, one user. It is
// what caught the entropy denominator in D46.
await report('HealthMe — small-application regression', [...LEGITIMATE_PERSONAS, ...ADVERSARY_PERSONAS], {
  invariants: healthmeInvariants,
  permits: (advice) => advice !== 'RESTRICT' && advice !== 'BLOCK',
});

// Identity churn is a population rather than one persona, so it gets its own lines.
console.log('\nidentity churn');
for (const perEntity of [1, 2, 3]) {
  const churned = await replayAll(churningBruteForce(30, perEntity), {
    invariants: healthmeInvariants,
  });
  const felt = churned.filter(
    (result) => result.worst !== 'ALLOW' && result.worst !== 'OBSERVE',
  ).length;
  console.log(
    `  HealthMe, accumulated evidence, ${perEntity} attempt(s) per identity: ${felt}/${churned.length} felt anything`,
  );
}

// The same rotation against IXFE, where the violation is a proof rather than
// accumulated evidence — so one request per identity is enough.
for (const perEntity of [1, 2]) {
  const rotated = await replayAll([rotatingShooter(20, perEntity)], { invariants: ixfeInvariants });
  const felt = rotated.filter((result) => !result.walkedThrough).length;
  console.log(
    `  IXFE, provable violation, ${perEntity} request(s) per identity: ${felt}/1 personas felt something`,
  );
}

if (failures > 0) process.exitCode = 1;
