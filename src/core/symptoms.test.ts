import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SYMPTOMS,
  SYMPTOM_CATEGORIES,
  SYMPTOM_DETAILS,
  SYMPTOM_SCHEMA_VERSION,
  categoryOf,
  isSymptom,
  isSymptomCategory,
  readSymptom,
  reportSymptom,
} from './symptoms.ts';
import { SIGNAL_SOURCES } from './signals.ts';

test('D43: every detail belongs to exactly one category', () => {
  const seen = new Map<string, string>();
  for (const category of SYMPTOM_CATEGORIES) {
    for (const detail of SYMPTOM_DETAILS[category]) {
      assert.equal(seen.get(detail), undefined, `${detail} appears under two categories`);
      seen.set(detail, category);
      assert.equal(categoryOf(detail), category);
    }
  }
  assert.equal(seen.size, SYMPTOMS.length);
});

test('D43: no category is empty, and none is a disguised "unknown"', () => {
  for (const category of SYMPTOM_CATEGORIES) {
    assert.ok(SYMPTOM_DETAILS[category].length > 0, `${category} carries no detail`);
  }
  // Being unable to name a pattern is a detail-tier admission, never a principle.
  assert.ok(!SYMPTOM_CATEGORIES.includes('SYM_UNKNOWN_PATTERN' as never));
});

test('D43: the stable tier mirrors the observable dimensions of D42, plus proof', () => {
  // The category tier claims to be exhaustive over kinds of wrongness. It earns
  // that by covering every weak-signal source, with one extra for proven
  // violations, which carry certainty rather than measurement.
  assert.equal(SYMPTOM_CATEGORIES.length, SIGNAL_SOURCES.length);
  assert.ok(SYMPTOM_CATEGORIES.includes('SYM_CONSTRAINT'));
});

test('D43: a report carries its category, so a frozen receiver never has to look it up', () => {
  const report = reportSymptom('SYM_REQUEST_BURST');
  assert.equal(report.category, 'SYM_TIMING');
  assert.equal(report.schema, SYMPTOM_SCHEMA_VERSION);
});

test('D43: an unrecognised detail degrades to its category instead of failing', () => {
  const fromNewerInstance = {
    category: 'SYM_TIMING' as const,
    detail: 'SYM_SOMETHING_V2_INVENTED',
    schema: SYMPTOM_SCHEMA_VERSION + 1,
  };
  const read = readSymptom(fromNewerInstance);
  assert.deepEqual(read, { category: 'SYM_TIMING', detail: undefined });
});

test('D43: an unrecognised category is rejected, because nothing remains to fall back to', () => {
  const read = readSymptom({
    category: 'SYM_INVENTED' as never,
    detail: 'SYM_REQUEST_BURST',
    schema: SYMPTOM_SCHEMA_VERSION,
  });
  assert.equal(read, undefined);
});

test('D43: an unknown detail cannot be reported outward', () => {
  assert.throws(() => reportSymptom('SYM_MADE_UP' as never), /unknown symptom detail/);
});

test('the trust boundary holds in both directions', () => {
  for (const symptom of SYMPTOMS) assert.ok(isSymptom(symptom));
  assert.ok(!isSymptom('SYM_MADE_UP'));
  assert.ok(!isSymptom(null));
  assert.ok(!isSymptom(0));
  for (const category of SYMPTOM_CATEGORIES) assert.ok(isSymptomCategory(category));
  assert.ok(!isSymptomCategory('SYM_REQUEST_BURST'), 'a detail is not a category');
});

test('symptom tokens carry shape, never a measured value', () => {
  for (const symptom of SYMPTOMS) {
    assert.doesNotMatch(symptom, /\d/, `${symptom} embeds a number; symptoms are shapes`);
  }
});
