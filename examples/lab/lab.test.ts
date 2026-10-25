/**
 * The lab logic that does not need a browser. M2.1.
 *
 * The interesting parts of the lab are the parts that decide what a run means: which
 * request belongs to which scope, whether a persona set can keep its entities apart,
 * whether a seed reproduces a stream, and whether a treatment is counted against a
 * legitimate visitor as a false positive. Those are testable without Chrome, so they
 * are, and CI covers them on every push.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { instanceIdentity, seeded, staticPersonas, type PersonaLabel } from './personas.ts';
import { parseRecords, summarise, verdicts, type LabRecord } from './summary.ts';
import { staticProfile } from './targets.ts';

const profile = staticProfile('demo');

function scopeFor(method: string, path: string): string | undefined {
  return profile.scopeFor(method, path);
}

function record(
  persona: string,
  groundTruth: PersonaLabel,
  advice: string,
  path = '/index.html',
): LabRecord {
  return {
    at: 1_700_000_000_000,
    entity: 'entity-' + persona,
    method: 'GET',
    path,
    scope: scopeFor('GET', path) ?? 'unscoped',
    observation: { scope: scopeFor('GET', path) ?? 'unscoped', data: {} },
    status: 200,
    answeredWithDocument: false,
    advice,
    hardViolated: false,
    violations: [],
    stage: 'normal',
    mean: 0.5,
    mass: 1,
    interArrivalCv: 0.2,
    windowCount: 1,
    anomaly: undefined,
    diversity: undefined,
    farming: undefined,
    signals: [],
    persona,
    groundTruth,
  };
}

test('M2.1: a static target maps documents to sections and skips assets', () => {
  assert.equal(scopeFor('GET', '/index.html'), 'demo.page');
  assert.equal(scopeFor('GET', '/'), 'demo.page');
  assert.equal(scopeFor('GET', '/blog/'), 'demo.blog');
  assert.equal(scopeFor('GET', '/blog/post.html'), 'demo.blog');
  assert.equal(scopeFor('GET', '/komunitas'), 'demo.komunitas');
  assert.equal(scopeFor('GET', '/admin/users'), 'demo.page', 'unlisted sections share one scope');

  // Assets carry no intent, and a page's own CSS arriving is not a visit.
  assert.equal(scopeFor('GET', '/style.v2.css'), undefined);
  assert.equal(scopeFor('GET', '/app.v2.js'), undefined);
  assert.equal(scopeFor('GET', '/logo.png'), undefined);

  // Nothing on a static site accepts a write, so there is no scope to price.
  assert.equal(scopeFor('POST', '/index.html'), undefined);

  assert.deepEqual(profile.invariants, [], 'a static site can prove nothing, and says so');
  assert.equal(profile.isPageView('demo.blog'), true, 'every scope here is a page view');
});

test('M2.1: every persona declares a label, and no two share a user agent', () => {
  const personas = staticPersonas();
  assert.ok(personas.length >= 6, 'the composition has to cover both sides of the line');

  const ids = new Set(personas.map((persona) => persona.id));
  assert.equal(ids.size, personas.length, 'ids are unique, because they label rows');

  const agents = personas.map((persona) => persona.userAgent);
  assert.equal(
    new Set(agents).size,
    agents.length,
    'no two personas share a user agent, or two of them merge into one entity',
  );

  for (const persona of personas) {
    assert.ok(
      persona.label === 'legitimate' || persona.label === 'adversarial',
      persona.id + ' has a ground truth',
    );
    assert.ok(persona.what.length > 20, persona.id + ' says what it does, in words');
    assert.match(
      persona.entry('http://127.0.0.1:4800'),
      /^http:\/\/127\.0\.0\.1:4800\//,
      persona.id + ' lands inside the target it is pointed at',
    );
  }

  assert.ok(
    personas.some((persona) => persona.label === 'adversarial'),
    'a composition of only legitimate visitors cannot show a false negative',
  );
  assert.ok(
    personas.some((persona) => persona.label === 'legitimate'),
    'a composition of only adversaries cannot show a false positive',
  );
});

test('M2.1: a seed reproduces a persona stream', () => {
  const first = Array.from({ length: 5 }, seeded(7));
  const again = Array.from({ length: 5 }, seeded(7));
  const other = Array.from({ length: 5 }, seeded(8));

  assert.deepEqual(again, first, 'the manifest records a seed, so it has to mean something');
  assert.notDeepEqual(other, first);
  for (const value of first) assert.ok(value >= 0 && value < 1, 'usable as a probability');
});

test('M2.1: a persona summary reports the first treatment, not the last', () => {
  const records = [
    record('hammer', 'adversarial', 'ALLOW'),
    record('hammer', 'adversarial', 'OBSERVE'),
    record('hammer', 'adversarial', 'INCREASE_FRICTION'),
    record('hammer', 'adversarial', 'BLOCK'),
  ];
  const [summary] = summarise(records);
  assert.ok(summary);
  assert.equal(summary.requests, 4);
  assert.equal(summary.escalatedAt, 3, 'one-based, so it indexes the recorded rows');
  assert.equal(summary.firstTreatment, 'INCREASE_FRICTION');
  assert.equal(summary.lastDecision, 'BLOCK');
  assert.deepEqual(summary.decisions, { ALLOW: 1, OBSERVE: 1, INCREASE_FRICTION: 1, BLOCK: 1 });
});

test('M2.1: watching is not a treatment, and the two mistakes are named', () => {
  const records = [
    record('reader', 'legitimate', 'ALLOW'),
    record('reader', 'legitimate', 'OBSERVE'),
    record('monitor', 'legitimate', 'ALLOW'),
    record('monitor', 'legitimate', 'RESTRICT'),
    record('scanner', 'adversarial', 'ALLOW'),
    record('scanner', 'adversarial', 'OBSERVE'),
    record('hammer', 'adversarial', 'ALLOW'),
    record('hammer', 'adversarial', 'BLOCK'),
  ];

  const summaries = summarise(records);
  const verdict = verdicts(summaries);

  assert.deepEqual(verdict.falsePositives, ['monitor']);
  assert.deepEqual(verdict.falseNegatives, ['scanner']);
  assert.deepEqual(verdict.correct, ['reader', 'hammer']);
});

test('M2.2: a repetition presents a different identity, because a shared one is one visitor', () => {
  const personas = staticPersonas();
  const claimed = new Map<string, string>();

  for (const persona of personas) {
    for (let instance = 0; instance < 8; instance += 1) {
      const agent = instanceIdentity(persona.userAgent, instance);
      const who = persona.id + '#' + String(instance);
      const clash = claimed.get(agent);
      assert.equal(clash, undefined, who + ' would merge with ' + String(clash));
      claimed.set(agent, who);
      assert.equal(
        instanceIdentity(persona.userAgent, instance),
        agent,
        who + ' is the same identity on every run, or the dataset is not reproducible',
      );
    }
    assert.equal(
      instanceIdentity(persona.userAgent, 0),
      persona.userAgent,
      persona.id + ' keeps its declared agent on the first instance',
    );
  }
});

test('M2.2: one treated repetition is a false positive for the whole persona', () => {
  const records = [
    record('reader', 'legitimate', 'ALLOW'),
    { ...record('reader', 'legitimate', 'ALLOW'), instance: 1, entity: 'entity-reader-1' },
    { ...record('reader', 'legitimate', 'INCREASE_FRICTION'), instance: 2, entity: 'entity-reader-2' },
    { ...record('reader', 'legitimate', 'ALLOW'), instance: 3, entity: 'entity-reader-3' },
  ];

  const summaries = summarise(records);
  assert.equal(summaries.length, 1, 'the unit of judgement is the persona, not the instance');
  assert.equal(summaries[0]?.requests, 4, 'every instance counts towards the persona row count');
  assert.deepEqual(
    verdicts(summaries).falsePositives,
    ['reader'],
    'one instance given friction is a false positive even when the other three were allowed',
  );
});

test('M2.1: records parse as JSONL and keep their label', () => {
  const text = [
    JSON.stringify(record('reader', 'legitimate', 'ALLOW')),
    '',
    JSON.stringify(record('reader', 'legitimate', 'OBSERVE', '/blog/')),
    '',
  ].join('\n');

  const records = parseRecords(text);
  assert.equal(records.length, 2, 'blank lines are not records');
  assert.equal(records[1]?.groundTruth, 'legitimate');
  assert.equal(records[1]?.persona, 'reader');
});
