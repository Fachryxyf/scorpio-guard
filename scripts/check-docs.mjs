/**
 * Fails when a document claims a count the generator does not produce.
 *
 * The README states the test count in words. Nothing checked that sentence, so it
 * drifted to "two hundred and thirty-three" while the suite had already grown past it.
 * This gate reads the counts out of the rendered site, meaning the same output a
 * stranger sees, and compares every claim made in the documents below.
 *
 * A document that stops making a required claim also fails: deleting the sentence is
 * not a way to satisfy the check.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SUBJECTS = ['tests', 'decisions', 'pages'];

const DOCUMENTS = [{ path: 'README.md', require: ['tests'] }];

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

const SCALES = { hundred: 100, thousand: 1000 };

function wordsToNumber(phrase) {
  let total = 0;
  let current = 0;
  for (const token of phrase.toLowerCase().split(/[\s-]+/)) {
    if (token === '' || token === 'and') continue;
    if (token in UNITS) current += UNITS[token];
    else if (token in TENS) current += TENS[token];
    else if (token in SCALES) {
      const scale = SCALES[token];
      if (scale === 100) current = (current || 1) * 100;
      else {
        total += (current || 1) * 1000;
        current = 0;
      }
    } else return null;
  }
  return total + current;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/**
 * Every place a document puts a number before a subject noun, in digits or in words.
 */
function claimsOf(text, subject) {
  const pattern = new RegExp('([A-Za-z0-9][A-Za-z0-9 ,-]{0,40}?)\\s+' + subject + '\\b', 'g');
  const found = [];
  for (const match of text.matchAll(pattern)) {
    const phrase = match[1].trim();
    const digits = phrase.match(/(\d[\d,]*)$/);
    if (digits) {
      found.push({ line: lineOf(text, match.index), raw: digits[1], value: Number(digits[1].replace(/,/g, '')) });
      continue;
    }
    const words = phrase.match(/((?:[A-Za-z]+[ ,-]+){1,6}[A-Za-z]+)$/);
    if (!words) continue;
    const value = wordsToNumber(words[1]);
    if (value === null) continue;
    found.push({ line: lineOf(text, match.index), raw: words[1], value });
  }
  return found;
}

function renderedCounts() {
  const run = spawnSync(process.execPath, ['site/build.mjs', '--check'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = (run.stdout || '') + (run.stderr || '');
  if (run.status !== 0) {
    console.error('check-docs: the site generator failed, so there is nothing to compare against:');
    console.error(output.split('\n').slice(-20).join('\n'));
    process.exit(1);
  }
  const match = output.match(/(\d+) pages render.*?(\d+) decisions.*?(\d+) tests/);
  if (!match) {
    console.error('check-docs: the site reported no usable counts, so the gate cannot check anything:');
    console.error(output.split('\n').slice(-10).join('\n'));
    process.exit(1);
  }
  return { pages: Number(match[1]), decisions: Number(match[2]), tests: Number(match[3]) };
}

const counted = renderedCounts();
const problems = [];

for (const document of DOCUMENTS) {
  const text = readFileSync(document.path, 'utf8');
  for (const subject of SUBJECTS) {
    const found = claimsOf(text, subject);
    for (const claim of found) {
      if (claim.value !== counted[subject]) {
        problems.push(
          document.path +
            ':' + claim.line + ' claims ' + claim.raw + ' ' + subject + ', the site renders ' + counted[subject],
        );
      }
    }
    const required = document.require && document.require.includes(subject);
    if (required && found.length === 0) {
      problems.push(
        document.path + ' makes no claim about ' + subject + ', so this gate cannot check it',
      );
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error('check-docs: ' + problem);
  process.exit(1);
}

console.log(
  'docs ok: ' + counted.pages + ' pages, ' + counted.decisions + ' decisions, ' + counted.tests + ' tests match every claim in the README',
);
