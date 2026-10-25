/**
 * Prints the poisoning experiment: what patience buys an attacker, and what it costs.
 *
 * The numbers in docs/POISONING.md are these rows. The test suite asserts four of them,
 * so a policy change that moves the price fails the suite instead of quietly rewriting
 * the document.
 */
import { runMatrix } from '../examples/poison/experiment.ts';

const rows = await runMatrix();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('| positives spent | pacing | trust after positives | decision | negatives to treatment |');
  console.log('|---|---|---|---|---|');
  for (const row of rows) {
    console.log(
      '| ' + row.positives + ' | ' + row.gaps + ' | ' + row.trustAfterPositives.toFixed(3) + ' | ' + row.decisionAfterPositives + ' | ' + row.negativesToTreatment + ' |',
    );
  }
}
