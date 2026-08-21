/**
 * Every tunable number in one place.
 *
 * These are policy, not law. The design record (DECISIONS.md) fixes the shape of
 * the model; the values here are PoC defaults chosen to be revised once the proof
 * of concept meets real traffic.
 */

/** Hours. Time for existing evidence to lose half its weight. D3. */
export const DEFAULT_HALF_LIFE_HOURS = 24;

/** Hours without a meaningful update before state is deleted outright. D6. */
export const DEFAULT_RETENTION_HOURS = 7 * 24;

/** Evidence mass per observation, by strength. D4. */
export const DEFAULT_WEIGHTS = {
  weak: 0.5,
  strong: 2,
} as const;

/** Trust bands over E[p], read as "at least this mean". D5. */
export const DEFAULT_TRUST_BANDS = [
  { atLeast: 0.8, band: 'trusted' },
  { atLeast: 0.6, band: 'observe' },
  { atLeast: 0.4, band: 'friction' },
  { atLeast: 0.2, band: 'restrict' },
  { atLeast: 0, band: 'deny' },
] as const;

/** Uncertainty bands over Var[p], read as "at most this variance". D5. */
export const DEFAULT_UNCERTAINTY_BANDS = [
  { atMost: 0.02, level: 'low' },
  { atMost: 0.05, level: 'medium' },
  { atMost: Infinity, level: 'high' },
] as const;

export type TrustBand = (typeof DEFAULT_TRUST_BANDS)[number]['band'];
export type UncertaintyLevel = (typeof DEFAULT_UNCERTAINTY_BANDS)[number]['level'];

export type Policy = {
  readonly halfLifeHours: number;
  readonly retentionHours: number;
  readonly weights: { readonly weak: number; readonly strong: number };
};

export const DEFAULT_POLICY: Policy = {
  halfLifeHours: DEFAULT_HALF_LIFE_HOURS,
  retentionHours: DEFAULT_RETENTION_HOURS,
  weights: DEFAULT_WEIGHTS,
};
