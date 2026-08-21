/**
 * The symptom vocabulary: the only thing that may ever leave the local instance.
 *
 * NOT EXPORTED from the package surface, deliberately. D17 removes the API key and
 * D20 makes a serverless guard fully functional, so nothing currently transmits
 * anything — and an exported vocabulary with no transmitter invites use it has no
 * semantics for. It returns to the public surface when a prescription client
 * exists, and its final wire format is owed to scorpio-guard-protocol anyway.
 *
 * Raw behavior is reduced to one of these tokens before transmission —
 * `47 requests / 2.3s` becomes `SYM_REQUEST_BURST`, and the requests themselves
 * never travel. An instance may not invent symptoms the ecosystem does not know.
 *
 * ## Two tiers, and why the split is load-bearing (D43)
 *
 * Library and server are frozen relative to each other: an instance speaks the
 * vocabulary it shipped with, and cannot negotiate with a server that has moved
 * on. A flat list makes every addition a breaking change for every deployed
 * instance, so the vocabulary is split by *rate of change*:
 *
 * - The **category** tier is a small set of principle-level classes. It is
 *   expected never to grow. A server that understands only categories still
 *   understands every message any version will ever send.
 * - The **detail** tier names the specific pattern within a category. It is free
 *   to grow release to release, and an unrecognised detail degrades to its
 *   category rather than failing.
 *
 * `SYM_UNKNOWN_PATTERN` is not a category. Being unable to name something is a
 * detail-tier admission inside whichever category was observed — promoting it to
 * a category would make "we don't know" a permanent principle-level class.
 */

/**
 * Bumped when a *detail* is added. The category tier is expected not to move; if
 * it ever does, that is a new major and a new document, not a version bump.
 */
export const SYMPTOM_SCHEMA_VERSION = 1;

/**
 * The stable tier. Principle-level classes, chosen to be exhaustive over *what
 * kind of thing looked wrong* rather than over specific patterns.
 *
 * One category per observable dimension the guard actually has: when it happened,
 * whether it repeated, how it was driven, what path it took, what it wanted, and
 * whether a declared impossibility was violated. `SYM_CONSTRAINT` is the only one
 * carrying proof rather than measurement, and is kept distinct so a server never
 * has to infer certainty from a token's name.
 */
export const SYMPTOM_CATEGORIES = [
  'SYM_TIMING',
  'SYM_REPETITION',
  'SYM_INTERACTION',
  'SYM_SEQUENCE',
  'SYM_TARGET',
  'SYM_CONSTRAINT',
] as const;

export type SymptomCategory = (typeof SYMPTOM_CATEGORIES)[number];

/**
 * The flexible tier, grouped under the category it degrades to.
 *
 * Every detail is a *shape*, never a value: `SYM_REQUEST_BURST` says volume
 * arrived compressed in time, and carries no count, no interval and no endpoint.
 * That is the whole privacy argument of the symptom model — the server learns
 * that a shape recurred, not what produced it.
 */
export const SYMPTOM_DETAILS = {
  SYM_TIMING: [
    'SYM_REQUEST_BURST',
    'SYM_HIGH_VELOCITY',
    'SYM_UNIFORM_DELAY_SHAPE',
    'SYM_OFF_WINDOW_ACCESS',
  ],
  SYM_REPETITION: ['SYM_REPEATED_PATTERN', 'SYM_LOW_VARIETY'],
  SYM_INTERACTION: ['SYM_UNINTERACTED_INPUT', 'SYM_IDENTITY_DRIFT'],
  SYM_SEQUENCE: ['SYM_UNUSUAL_SEQUENCE', 'SYM_NEW_BEHAVIOR'],
  SYM_TARGET: ['SYM_BROAD_ENUMERATION', 'SYM_SENSITIVE_FOCUS'],
  SYM_CONSTRAINT: ['SYM_DECLARED_VIOLATION'],
} as const satisfies Record<SymptomCategory, readonly string[]>;

export type SymptomDetail = (typeof SYMPTOM_DETAILS)[SymptomCategory][number];

/** Every detail token, flat. The list an older server may not fully recognise. */
export const SYMPTOMS: readonly SymptomDetail[] = Object.values(SYMPTOM_DETAILS).flat();

/** Kept as the historical name for a detail token. */
export type Symptom = SymptomDetail;

const CATEGORY_OF = new Map<string, SymptomCategory>(
  SYMPTOM_CATEGORIES.flatMap((category) =>
    SYMPTOM_DETAILS[category].map((detail) => [detail as string, category] as const),
  ),
);

/**
 * Guards the trust boundary in both directions: an unknown token must not be
 * sent out, and must not be accepted from a prescription response.
 */
export function isSymptom(value: unknown): value is SymptomDetail {
  return typeof value === 'string' && CATEGORY_OF.has(value);
}

export function isSymptomCategory(value: unknown): value is SymptomCategory {
  return (
    typeof value === 'string' && (SYMPTOM_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * The category a detail belongs to, or `undefined` if the token is unknown here.
 *
 * `undefined` is the forward-compatibility case, not an error: a newer instance
 * may send a detail this version has never heard of, and the caller is expected to
 * fall back to the category the message carries alongside it.
 */
export function categoryOf(detail: string): SymptomCategory | undefined {
  return CATEGORY_OF.get(detail);
}

/**
 * What actually travels. D43.
 *
 * The category is transmitted *with* the detail rather than derived from it — the
 * whole point of the tier split is that a receiver too old to know the detail can
 * still act on the category, and it cannot look up what it does not have.
 */
export type SymptomReport = {
  readonly category: SymptomCategory;
  readonly detail: SymptomDetail | (string & {});
  readonly schema: number;
};

export function reportSymptom(detail: SymptomDetail): SymptomReport {
  const category = CATEGORY_OF.get(detail);
  if (!category) throw new Error(`unknown symptom detail: ${detail}`);
  return { category, detail, schema: SYMPTOM_SCHEMA_VERSION };
}

/**
 * Read a report, degrading gracefully.
 *
 * An unrecognised detail is not rejected: it falls back to its stated category,
 * which is the behaviour that lets the detail tier evolve without breaking frozen
 * instances. An unrecognised *category* is rejected, because there is nothing
 * left to fall back to.
 */
export function readSymptom(
  report: SymptomReport,
): { category: SymptomCategory; detail: SymptomDetail | undefined } | undefined {
  if (!isSymptomCategory(report.category)) return undefined;
  const known = isSymptom(report.detail) ? report.detail : undefined;
  return { category: report.category, detail: known };
}
