/**
 * The runtime surface: what the shipped entry points are allowed to depend on.
 *
 * Two of the five runtimes in H14 are not Node, and the package cannot test them by
 * running them here. What it can do is make the property falsifiable: walk the import
 * graph from each portable entry point and fail if anything on it reaches a Node-only
 * global. A browser bundle and an edge runtime both work by exactly this rule, so the
 * rule is the test rather than a claim in a README.
 *
 * The Node-only entries are asserted to be a separate graph, so this cannot pass by
 * being vacuous: if sqlite stopped importing node:sqlite, the boundary would be a lie.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, '..');

const NODE_ONLY: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }> = [
  { name: 'node: import', pattern: /(?:from|import)\s*\(?\s*'node:/ },
  { name: 'require()', pattern: /require\s*\(/ },
  { name: 'process', pattern: /process\./ },
  { name: 'Buffer', pattern: /Buffer/ },
  { name: 'setImmediate', pattern: /setImmediate/ },
  { name: '__dirname', pattern: /__dirname/ },
];

const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*'(\.[^']+)'/g;

function walk(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [resolve(srcRoot, entry)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    RELATIVE_IMPORT.lastIndex = 0;
    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      const target = resolve(dirname(file), match[1] ?? '');
      if (target.endsWith('.ts') && !target.endsWith('.test.ts')) queue.push(target);
    }
  }
  return [...seen].sort();
}

function offenders(files: readonly string[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const rule of NODE_ONLY) {
      if (rule.pattern.test(source)) found.push(file.replace(srcRoot + '/', '') + ': ' + rule.name);
    }
  }
  return found;
}

test('the root entry point reaches nothing Node-only', () => {
  const files = walk('index.ts');
  assert.ok(files.length > 10, 'the walk found ' + files.length + ' files, which is too few to mean anything');
  assert.deepEqual(offenders(files), [], 'a browser bundle or an edge runtime would fail on these');
});

test('the browser collector entry point reaches nothing Node-only', () => {
  const files = walk('collect/index.ts');
  assert.ok(files.length > 2, 'the walk found ' + files.length + ' files');
  assert.deepEqual(offenders(files), []);
});

test('the Node-only entry points are a separate graph, not an empty rule', () => {
  const portable = new Set(walk('index.ts'));
  const sqlite = resolve(srcRoot, 'store/sqlite.ts');

  assert.ok(readFileSync(sqlite, 'utf8').includes('node:sqlite'), 'the sqlite store is why the split exists');
  assert.equal(portable.has(sqlite), false, 'a portable entry point must never reach the sqlite store');

  const nodeOnly = walk('store/sqlite.ts');
  assert.ok(nodeOnly.length > 0);
  assert.ok(offenders(nodeOnly).length > 0, 'the sqlite store is allowed to use Node, and does');
});
