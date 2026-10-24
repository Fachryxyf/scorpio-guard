/**
 * The release gate: what a stranger actually gets. M1.6.
 *
 * `npm run build` proves the source compiles. The smoke test proves the built entry
 * point imports from this checkout. Neither proves what the registry would hand over:
 * a tarball whose contents, entry points, and subpath exports all work once installed
 * somewhere else, with no dev dependencies and no monorepo to resolve against.
 *
 * So this packs, inspects, installs into an empty directory, and runs the published
 * surface from there. Slow by a few seconds, and the only step that catches a `files`
 * entry that dropped a directory.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const workdir = mkdtempSync(join(tmpdir(), 'sg-pack-'));
const problems = [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    console.error('pack-check: ' + command + ' ' + args.join(' ') + ' failed');
    console.error(((result.stdout || '') + (result.stderr || '')).trim());
    process.exit(1);
  }
  return result.stdout;
}

try {
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', workdir]));
  const info = packed[0];
  const files = info.files.map((file) => file.path);

  if (info.version !== manifest.version) {
    problems.push('tarball version ' + info.version + ' != manifest version ' + manifest.version);
  }

  const required = [
    'package.json',
    'README.md',
    'dist/index.js',
    'dist/index.d.ts',
    'dist/store/sqlite.js',
    'dist/store/kv.js',
  ];
  for (const file of required) {
    if (!files.includes(file)) problems.push('missing from the tarball: ' + file);
  }

  for (const file of files) {
    if (file.startsWith('src/') || file.endsWith('.test.ts') || file.startsWith('examples/')) {
      problems.push('should not ship: ' + file);
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error('pack-check: ' + problem);
    process.exit(1);
  }

  const tarball = join(workdir, info.filename);
  const app = join(workdir, 'app');
  mkdirSync(app);
  writeFileSync(
    join(app, 'package.json'),
    JSON.stringify({ name: 'scorpio-guard-install-check', private: true, type: 'module' }, null, 2),
  );

  run('npm', ['install', '--no-audit', '--no-fund', tarball], { cwd: app });

  writeFileSync(
    join(app, 'probe.mjs'),
    [
      "import { ASSESSMENT_EVENT_SCHEMA, createGuard } from '@fachryxyf/scorpio-guard';",
      "import { kvStore, memoryTransport } from '@fachryxyf/scorpio-guard/kv';",
      "import { sqliteStore } from '@fachryxyf/scorpio-guard/sqlite';",
      '',
      'const events = [];',
      'const guard = createGuard({ onAssessment: (event) => events.push(event) });',
      "const result = await guard.evaluate({ entity: 'probe', observation: { scope: 'page' } });",
      "if (result.decision !== 'ALLOW') throw new Error('unexpected advice: ' + result.decision);",
      "if (ASSESSMENT_EVENT_SCHEMA !== 1) throw new Error('unexpected schema version');",
      "if (typeof sqliteStore !== 'function') throw new Error('sqlite subpath did not resolve');",
      'const store = kvStore({ transport: memoryTransport(), onError: () => {} });',
      "await store.set('k', { a: 1, b: 1, lastSeen: 0, lastMeaningfulUpdate: 0, window: [] });",
      'await new Promise((resolve) => setImmediate(resolve));',
      "if (events.length !== 1) throw new Error('expected one assessment event');",
      "console.log('installed package ok: advice ' + result.decision + ', event schema ' + events[0].schemaVersion);",
    ].join('\n'),
  );

  const output = run(process.execPath, ['probe.mjs'], { cwd: app });
  console.log(output.trim());
  console.log('pack-check ok: ' + files.length + ' files, ' + manifest.name + '@' + manifest.version);
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
