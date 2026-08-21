/**
 * The symptom vocabulary: the only thing that may ever leave the local instance.
 *
 * Raw behavior is reduced to one of these tokens before transmission —
 * `47 requests / 2.3s` becomes `SYM_REQUEST_BURST`, and the requests themselves
 * never travel. An instance may not invent symptoms the ecosystem does not know.
 *
 * ponytail: flat v1 list, matching the notes verbatim. The two-tier structure
 * (stable skeleton categories + flexible technical detail underneath) is not
 * designed yet — it lands in scorpio-guard-protocol, and this file follows it.
 */
export const SYMPTOM_SCHEMA_VERSION = 1;

export const SYMPTOMS = [
  'SYM_REQUEST_BURST',
  'SYM_NEW_BEHAVIOR',
  'SYM_IDENTITY_DRIFT',
  'SYM_UNUSUAL_SEQUENCE',
  'SYM_HIGH_VELOCITY',
  'SYM_UNKNOWN_PATTERN',
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

/**
 * Guards the trust boundary in both directions: an unknown token must not be
 * sent out, and must not be accepted from a prescription response.
 */
export function isSymptom(value: unknown): value is Symptom {
  return typeof value === 'string' && (SYMPTOMS as readonly string[]).includes(value);
}
