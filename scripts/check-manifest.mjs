/**
 * Fails when the manifest and the lockfile disagree, or when the declared package
 * manager cannot be the one that produced the lockfile that is actually present.
 *
 * This exists because a bulk edit once wrote a stale copy of package.json and put a
 * pnpm packageManager field back into a repository that installs with npm. Nothing
 * failed, and the audit kept claiming the field was gone.
 */
import { existsSync, readFileSync } from 'node:fs';

const LOCKFILES = [
  ['npm', 'package-lock.json'],
  ['pnpm', 'pnpm-lock.yaml'],
  ['yarn', 'yarn.lock'],
];

const problems = [];
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));

if (!existsSync('package-lock.json')) {
  problems.push('package-lock.json is missing: npm ci cannot run without it');
}

const lock = existsSync('package-lock.json')
  ? JSON.parse(readFileSync('package-lock.json', 'utf8'))
  : null;

if (lock) {
  if (lock.name !== manifest.name) {
    problems.push('lockfile name ' + lock.name + ' != manifest name ' + manifest.name);
  }
  if (lock.version !== manifest.version) {
    problems.push('lockfile version ' + lock.version + ' != manifest version ' + manifest.version);
  }
  const root = lock.packages && lock.packages[''] ? lock.packages[''] : {};
  if (root.name && root.name !== manifest.name) {
    problems.push('lockfile root name ' + root.name + ' != manifest name ' + manifest.name);
  }
  if (root.version && root.version !== manifest.version) {
    problems.push('lockfile root version ' + root.version + ' != manifest version ' + manifest.version);
  }
}

const present = LOCKFILES.filter((entry) => existsSync(entry[1])).map((entry) => entry[0]);
if (present.length > 1) {
  problems.push('more than one lockfile present: ' + present.join(', '));
}

// packageManager, when declared, names the tool that must own the lockfile.
const declared = manifest.packageManager;
if (declared) {
  const manager = String(declared).split('@')[0];
  if (!present.includes(manager)) {
    problems.push(
      'packageManager declares ' + manager + ' but the lockfile present is ' + (present.join(', ') || 'none'),
    );
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error('check-manifest: ' + problem);
  process.exit(1);
}

console.log(
  'manifest ok: ' + manifest.name + '@' + manifest.version +
    ', lockfile ' + (present[0] || 'none') +
    (declared ? ', packageManager ' + declared : ', no packageManager field'),
);
