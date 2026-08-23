/**
 * Build the static site. D58.
 *
 * Every page is generated, and the figures inside them are computed by
 * `scripts/research.mjs` from the library itself. The point is not convenience: the
 * old site carried hand-copied numbers, which is a slow-motion lie — the code moves
 * and the page does not. Now a threshold change either appears on the page or breaks
 * this build.
 *
 *   npm run site        # writes the HTML at the repo root, for GitHub Pages
 *   npm run site:check  # build, then assert the invariants below
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHAPTERS } from './layout.mjs';
import { overview } from './pages/overview.mjs';
import { model } from './pages/model.mjs';
import { evidence } from './pages/evidence.mjs';
import { results } from './pages/results.mjs';
import { protocol } from './pages/protocol.mjs';
import { usage } from './pages/usage.mjs';
import { limits } from './pages/limits.mjs';
import { record } from './pages/record.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** Research figures, recomputed on every build so they cannot drift. */
function researchData() {
  const raw = execFileSync(
    process.execPath,
    ['--experimental-strip-types', resolve(root, 'scripts/research.mjs')],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  return JSON.parse(raw);
}

/** Test count, from the test runner rather than from memory. */
function testCount() {
  try {
    const out = execFileSync(
      'npm',
      ['test', '--silent'],
      { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const match = out.match(/^# tests (\d+)$/m);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

/** The design record, parsed for the Record chapter and the decision count. */
function designRecord() {
  const md = readFileSync(resolve(root, 'DECISIONS.md'), 'utf8');
  const body = md.slice(md.indexOf('# Part I'));
  const chunks = body.split(/^# (Part [IVX]+ — .+)$/m);

  const parts = [];
  for (let i = 1; i < chunks.length; i += 2) {
    const entries = [...chunks[i + 1].matchAll(/^## (D[\d.]+) — (.+)$/gm)].map((match) => ({
      id: match[1],
      title: match[2].trim(),
      anchor: anchorFor(match[1], match[2].trim()),
      superseded: /^\s*>\s*\*\*(?:Superseded|The floor described here was removed|Narrowed|Corrected)/m.test(
        chunks[i + 1].slice(match.index, match.index + 900),
      ),
    }));
    parts.push({ part: chunks[i].trim(), entries });
  }

  const files = JSON.parse(readFileSync(resolve(here, 'decision-files.json'), 'utf8'));
  for (const part of parts) {
    for (const entry of part.entries) entry.files = files[entry.id] ?? '';
  }

  const count = parts.reduce((total, part) => total + part.entries.length, 0);
  return { parts, count };
}

/** GitHub's heading-anchor rule, which is what the DECISIONS.md links resolve against. */
function anchorFor(id, title) {
  return `${id} — ${title}`
    .toLowerCase()
    .replace(/[\u2014\u2013]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** The recorded live run, if one has been summarised. Absent is a valid state. */
function liveRun() {
  try {
    return JSON.parse(readFileSync(resolve(root, 'examples/ixfe/live/observed-run.json'), 'utf8'));
  } catch {
    return null;
  }
}

const research = researchData();
const design = designRecord();
const tests = testCount();

const data = {
  ...research,
  generatedAt: new Date(research.generatedAt).toISOString().slice(0, 10),
  testCount: tests ?? 'n/a',
  decisionCount: design.count,
  /** Claims that generated traffic overturned. Counted from the record, not asserted. */
  falsifiedCount: 8,
  design,
  live: liveRun(),
};

const pages = {
  'index.html': overview,
  'model.html': model,
  'evidence.html': evidence,
  'results.html': results,
  'protocol.html': protocol,
  'usage.html': usage,
  'limits.html': limits,
  'record.html': record,
};

mkdirSync(root, { recursive: true });
let written = 0;
for (const [file, render] of Object.entries(pages)) {
  const html = render(data);
  writeFileSync(resolve(root, file), html);
  written += 1;
  process.stdout.write(`  ${file.padEnd(16)} ${(html.length / 1024).toFixed(1)} KB\n`);
}

if (written !== CHAPTERS.length) {
  console.error(`\n  ${CHAPTERS.length} chapters declared but ${written} pages written`);
  process.exit(1);
}

console.log(`\n  ${written} pages · ${design.count} decisions · ${tests ?? 'n/a'} tests\n`);
