/**
 * The API surface, as data rather than as prose.
 *
 * M5.3 freezes the public API at 1.0.0, and a freeze that lives in a document is a
 * sentence someone can forget. This script reads the emitted declarations with the
 * TypeScript checker, records every exported name per entry point and whether it is a
 * type, a value, or both, and fails when the recorded surface and the built package
 * disagree.
 *
 *   node scripts/api-surface.mjs                  print the current surface
 *   node scripts/api-surface.mjs --check          compare against api/v0.2.json
 *   node scripts/api-surface.mjs --write          rewrite the snapshot, deliberately
 *   node scripts/api-surface.mjs --from <dir>     read a tarball layout instead of dist
 *
 * Adding a name is a minor release. Removing one, or turning a value into a type, is a
 * major release, and both fail here until the snapshot is written on purpose in the
 * same commit that documents them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const SNAPSHOT = resolve(root, 'api/v0.2.json');

const fromIndex = process.argv.indexOf('--from');
const from = fromIndex === -1 ? null : process.argv[fromIndex + 1];
const base = from === null ? root : resolve(from);
const pkg = JSON.parse(readFileSync(resolve(base, 'package.json'), 'utf8'));
const ENTRIES = Object.keys(pkg.exports ?? {}).filter((key) => key === '.' || key.startsWith('./')).sort();

function declarationPath(entry) {
  const types = pkg.exports?.[entry]?.types;
  if (types === undefined) throw new Error('no types for entry ' + entry);
  return resolve(base, types);
}

function kindOf(checker, symbol) {
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const flags = resolved.flags;
  const isType = (flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class | ts.SymbolFlags.Enum)) !== 0;
  const isValue = (flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Variable | ts.SymbolFlags.Class | ts.SymbolFlags.Enum | ts.SymbolFlags.BlockScopedVariable | ts.SymbolFlags.Property)) !== 0;
  if (isType && isValue) return 'both';
  return isType ? 'type' : 'value';
}

function surfaceOf(entry) {
  const file = declarationPath(entry);
  const program = ts.createProgram([file], { noEmit: true, skipLibCheck: true });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  if (source === undefined) throw new Error('no declarations for ' + entry + ' at ' + file);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) throw new Error('no module symbol for ' + entry);

  const exports = {};
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    const name = symbol.getName();
    if (name === 'default') continue;
    exports[name] = kindOf(checker, symbol);
  }
  return Object.fromEntries(Object.entries(exports).sort(([a], [b]) => a.localeCompare(b)));
}

const current = {};
for (const entry of ENTRIES) current[entry] = surfaceOf(entry);

function diff(expected, actual) {
  const changes = [];
  for (const entry of ENTRIES) {
    const before = expected[entry] ?? {};
    const after = actual[entry] ?? {};
    for (const name of Object.keys(after)) {
      if (!(name in before)) changes.push(entry + ' ' + name + ': added');
      else if (before[name] !== after[name]) changes.push(entry + ' ' + name + ': ' + before[name] + ' became ' + after[name]);
    }
    for (const name of Object.keys(before)) {
      if (!(name in after)) changes.push(entry + ' ' + name + ': removed');
    }
  }
  return changes;
}

if (process.argv.includes('--write')) {
  writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2) + '\n');
  const count = ENTRIES.reduce((total, entry) => total + Object.keys(current[entry]).length, 0);
  console.log('api snapshot written: ' + count + ' names across ' + ENTRIES.length + ' entries');
} else if (process.argv.includes('--check')) {
  let expected;
  try {
    expected = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  } catch {
    console.error('api snapshot missing at ' + SNAPSHOT + '; run npm run api -- --write');
    process.exit(1);
  }
  const changes = diff(expected, current);
  if (changes.length !== 0) {
    console.error('api surface moved:');
    for (const change of changes) console.error('  ' + change);
    console.error('');
    console.error('minor for additions, major for removals or kind changes; document it, then run npm run api -- --write');
    process.exit(1);
  }
  const count = ENTRIES.reduce((total, entry) => total + Object.keys(current[entry]).length, 0);
  console.log('api ok: ' + count + ' names across ' + ENTRIES.length + ' entries match api/v0.2.json');
} else {
  console.log(JSON.stringify(current, null, 2));
}
