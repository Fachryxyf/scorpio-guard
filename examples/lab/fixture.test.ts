/**
 * The frozen fixture: a recorded run, replayed on every push. M2.3.
 *
 * A threshold change is not visible in a test that only asserts shapes. It is visible
 * here: each fixture holds labelled rows and the exact decisions the model produced at
 * the moment it was frozen, so a change that moves treatment fails CI and has to be
 * accepted on purpose rather than discovered in production. There are two: the first
 * static-only run (129 rows, no invariants to replay) and the run with repetitions and
 * the IXFE target (1656 rows, three targets, eight visitors per persona).
 *
 * The remedy is not to edit the expectation. It is `npm run freeze:lab`, which rewrites
 * the file from a fresh run so the diff shows what moved.
 */
import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { DEFAULT_CELL, evaluateCell, type ReplayRow } from './calibration.ts';

const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url));

type Fixture = {
  readonly source: string;
  readonly chrome: string;
  readonly rows: readonly ReplayRow[];
  readonly expected: {
    readonly halfLifeHours: number;
    readonly developingAt: number;
    readonly establishedAt: number;
    readonly decisions: Readonly<Record<string, Readonly<Record<string, number>>>>;
    readonly falsePositives: readonly string[];
    readonly falseNegatives: readonly string[];
    readonly correct: number;
    readonly total: number;
  };
};

const files = readdirSync(FIXTURE_DIR).filter((name) => name.endsWith('.json'));

test('M2.3: there is a frozen run to play', () => {
  assert.ok(files.length > 0, 'a frozen fixture is the point of M2.3');
});

for (const name of files) {
  const fixture = JSON.parse(readFileSync(FIXTURE_DIR + name, 'utf8')) as Fixture;

  test('M2.3: ' + name + ' replays to the decisions it was frozen with', async () => {
    assert.ok(fixture.rows.length > 0);
    assert.deepEqual(
      [
        fixture.expected.halfLifeHours,
        fixture.expected.developingAt,
        fixture.expected.establishedAt,
      ],
      [DEFAULT_CELL.halfLifeHours, DEFAULT_CELL.developingAt, DEFAULT_CELL.establishedAt],
      'the fixture is pinned to the shipped policy; a different policy needs its own fixture',
    );

    const outcome = await evaluateCell(fixture.rows, DEFAULT_CELL);

    assert.deepEqual(
      outcome.decisions,
      fixture.expected.decisions,
      'a decision moved. If that was intended, regenerate the fixture with npm run freeze:lab',
    );
    assert.deepEqual(outcome.falsePositives, fixture.expected.falsePositives);
    assert.deepEqual(outcome.falseNegatives, fixture.expected.falseNegatives);
    assert.equal(outcome.correct, fixture.expected.correct);
    assert.equal(outcome.total, fixture.expected.total);
  });

  test('M2.3: ' + name + ' carries no hashed visitor identifier', () => {
    for (const row of fixture.rows) {
      assert.match(
        row.entity,
        /^e[0-9]{2,3}$/,
        'entities in the fixture are stable short ids, not the run\'s hashes',
      );
      assert.ok(row.observation !== undefined, 'a row without its observation cannot be replayed');
    }
  });
}
