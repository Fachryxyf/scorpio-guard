/**
 * The weak-signal catalogue. D42.
 *
 * The counterpart to `constraints.ts`. A hard constraint is proof and reaches the
 * decision layer as its own dimension (D15); a weak signal is *measurement* and
 * can only ever become trust mass. The design notes call these the "good
 * bacteria": individually inconclusive, meaningful in combination, and never a
 * standalone trigger.
 *
 * Two properties of this file are load-bearing:
 *
 * 1. It contains no thresholds. Every entry names what is measured and what
 *    observing it is worth, and the host — or a later calibration against real
 *    traffic — decides when it fires. Publishing `flag if interval < 220ms` in an
 *    open-source library hands an attacker the exact number to route around
 *    (design notes §7).
 * 2. It cannot escalate on its own. `signalMass` returns negative evidence, and
 *    negative evidence moves through decay, the epistemic stage, the uncertainty
 *    ceiling and the diversity check like any other observation. There is no path
 *    from this file to a decision that skips them.
 *
 * ponytail: a flat catalogue with per-signal weights, combined by summation.
 * Correct while signals are treated as independent. Upgrade path: correlated
 * groups, once real traffic shows which of these co-occur — three signals that
 * always fire together should not count three times.
 */
import { DEFAULT_WEIGHTS } from './policy.ts';

/**
 * What a weak signal is measured *from*. The dual of `ProofSource` in
 * `constraints.ts`, and the reason this catalogue is bounded too: a signal SG
 * cannot observe is not a signal it can carry.
 *
 * - `timing` — when things happened, and the shape of the gaps
 * - `repetition` — how similar this interaction is to previous ones
 * - `interaction` — the presence and texture of human input
 * - `sequence` — the path taken, where no invariant forbids it
 * - `target` — what is being asked for, and how broadly
 * - `environment` — coarse client-side facts, never fingerprints
 */
export const SIGNAL_SOURCES = [
  'timing',
  'repetition',
  'interaction',
  'sequence',
  'target',
  'environment',
] as const;

export type SignalSource = (typeof SIGNAL_SOURCES)[number];

/**
 * How much observing a signal is worth, in evidence mass.
 *
 * Deliberately three coarse levels rather than a per-signal number. A continuous
 * weight would imply calibration nobody has done (D36), and the ordering is the
 * only part that survives contact with real traffic anyway.
 */
export const SIGNAL_WEIGHTS = {
  /** Common in legitimate traffic too. Barely moves anything alone. */
  faint: DEFAULT_WEIGHTS.weak / 4,
  /** Unusual enough to be worth mass, inconclusive enough to need company. */
  notable: DEFAULT_WEIGHTS.weak / 2,
  /** Rarely innocent, but still measured rather than proven. */
  pronounced: DEFAULT_WEIGHTS.weak,
} as const;

/**
 * The most mass all the weak signals of a single interaction may contribute.
 *
 * One weak observation — the least the trust model recognises. This is what
 * "never a standalone trigger" means numerically, and it is a stronger guarantee
 * than the wording alone: with the prior at `n = 2` and `developingAt` at `3`, an
 * interaction that trips *every* signal in the catalogue still leaves the entity
 * in the `unknown` stage, where the trust dimension asks for nothing (D40).
 *
 * So measurement cannot manufacture a treatment on its own. It takes repeated
 * interactions to accumulate past the stage boundary — which is exactly the
 * "meaningful in combination" the design notes ask for, combination over time
 * rather than a single well-instrumented request.
 */
export const SIGNAL_MASS_CAP = DEFAULT_WEIGHTS.weak;

export type SignalWeight = keyof typeof SIGNAL_WEIGHTS;

export type WeakSignal = {
  readonly id: string;
  readonly source: SignalSource;
  readonly weight: SignalWeight;
  /** What is measured. Never a threshold — see the header. */
  readonly measures: string;
  /** Why a legitimate user might trigger it. The honest false-positive path. */
  readonly innocentCause: string;
  /**
   * Whether `behaviorFeatures` (D36) derives this server-side.
   *
   * `false` does not mean uncollectable: D51 added a collector for every entry in
   * this catalogue. It means the observation arrives from `./collect` or from the
   * host rather than being derived from the retained window.
   */
  readonly computed: boolean;
};

/**
 * The catalogue.
 *
 * The first four entries are drawn from the design notes §6B, which came from the
 * author's own scraping experience; the rest close the enumeration over
 * `SIGNAL_SOURCES`. `computed: true` marks the ones the anomaly feature space
 * (D36) derives from the retained window; the rest arrive from `./collect`, which
 * has a collector for each of them since D51.
 */
export const WEAK_SIGNALS: readonly WeakSignal[] = [
  {
    id: 'SIG_SUBHUMAN_LATENCY',
    source: 'timing',
    weight: 'notable',
    measures: 'action completed faster than deliberate human input plausibly allows',
    innocentCause: 'autofill, a password manager, a paste, or genuine keyboard fluency',
    computed: false,
  },
  {
    id: 'SIG_UNIFORM_DELAY_SHAPE',
    source: 'timing',
    weight: 'pronounced',
    measures:
      'inter-arrival gaps too evenly distributed: the coefficient of variation sits far below bursty human traffic',
    innocentCause: 'a polling widget or a background sync on a fixed interval',
    computed: true,
  },
  {
    id: 'SIG_OFF_WINDOW_ACCESS',
    source: 'timing',
    weight: 'faint',
    measures: 'activity outside the hours this entity, or the application, normally sees',
    innocentCause: 'travel, shift work, insomnia — a signal that is mostly noise alone',
    computed: false,
  },
  {
    id: 'SIG_REPEATED_PATTERN',
    source: 'repetition',
    weight: 'notable',
    measures: 'the same path repeated with little variation: low scope entropy over the window',
    innocentCause: 'a power user with one routine task, or a single-purpose page',
    computed: true,
  },
  {
    id: 'SIG_IMMEDIATE_REPEAT',
    source: 'repetition',
    weight: 'faint',
    measures: 'the same scope re-entered immediately, over and over',
    innocentCause: 'a retry after a failure, or an impatient refresh',
    computed: true,
  },
  {
    id: 'SIG_UNINTERACTED_INPUT',
    source: 'interaction',
    weight: 'pronounced',
    measures: 'a field populated with fewer interaction events than filling it requires',
    innocentCause:
      'assistive technology, autofill, or a browser SG has no interaction API for — this is exactly why it is a signal and not the IMPOSSIBLE_IDLE_ACTION invariant',
    computed: false,
  },
  {
    id: 'SIG_UNUSUAL_SEQUENCE',
    source: 'sequence',
    weight: 'notable',
    measures: 'a path no invariant forbids but this entity has not taken before',
    innocentCause: 'a first visit to a legitimate feature, which is most first visits',
    computed: false,
  },
  {
    id: 'SIG_BREADTH_OF_TARGET',
    source: 'target',
    weight: 'notable',
    measures: 'requests spread across far more distinct records than a session needs',
    innocentCause: 'legitimate research, or a shared exit address behind one entity key',
    computed: false,
  },
  {
    id: 'SIG_SENSITIVE_TARGET',
    source: 'target',
    weight: 'faint',
    measures: 'attention concentrated on the endpoints the host marked expensive or sensitive',
    innocentCause: 'the endpoint exists to be used; this only matters in combination',
    computed: false,
  },
  {
    id: 'SIG_ENVIRONMENT_MISMATCH',
    source: 'environment',
    weight: 'faint',
    measures:
      'coarse client-side facts that disagree with each other, such as a declared platform whose expected input modality never appears',
    innocentCause: 'privacy tooling, an unusual browser, or a corporate managed device',
    computed: false,
  },
];

export function isWeakSignal(value: unknown): value is WeakSignal['id'] {
  return (
    typeof value === 'string' && WEAK_SIGNALS.some((signal) => signal.id === value)
  );
}

/**
 * Negative evidence mass owed by a set of observed signals.
 *
 * Summed, not averaged: the notes are explicit that weak signals matter *in
 * combination*, and an average would make a second signal weaken the first.
 *
 * Capped at `SIGNAL_MASS_CAP`. A weak signal is measurement, and no pile of
 * measurements should outweigh what a host declared — nor should a catalogue that
 * grows over time quietly become more punitive per interaction than it was when
 * these thresholds were reasoned about.
 */
export function signalMass(
  observed: readonly string[],
  catalogue: readonly WeakSignal[] = WEAK_SIGNALS,
): number {
  let mass = 0;
  for (const id of new Set(observed)) {
    const signal = catalogue.find((entry) => entry.id === id);
    if (!signal) continue; // unknown ids are ignored, never guessed at
    mass += SIGNAL_WEIGHTS[signal.weight];
  }
  return Math.min(mass, SIGNAL_MASS_CAP);
}

/** The catalogue grouped by what it is measured from. For docs and coverage checks. */
export function signalsBySource(
  catalogue: readonly WeakSignal[] = WEAK_SIGNALS,
): Record<SignalSource, readonly WeakSignal[]> {
  const grouped = Object.fromEntries(
    SIGNAL_SOURCES.map((source) => [source, [] as WeakSignal[]]),
  ) as Record<SignalSource, WeakSignal[]>;

  for (const signal of catalogue) grouped[signal.source].push(signal);
  return grouped;
}
