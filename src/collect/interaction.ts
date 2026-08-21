/**
 * Browser-side interaction observation. D7.
 *
 * This is the collector, and it collects only what the hard constraints need to
 * be checkable. Notably it does **not** record what was typed, where a pointer
 * moved, or any field value — the impossible-idle-action constraint needs to know
 * *whether* interaction occurred, not what it contained.
 *
 * No platform API is used outside this directory, per D7: `src/core/` stays free
 * of DOM types so the same model runs on either side of the wire.
 */

/** Counters for one field, or for a form as a whole. */
export type InteractionCounts = {
  /** Pointer events: down, move within the element, up. */
  readonly pointer: number;
  /** Key events. Count only — never which keys. */
  readonly keyboard: number;
  /** Paste, drop, and autofill-shaped input with no preceding keystroke. */
  readonly injected: number;
  /** Milliseconds from first interaction to submission, or `undefined`. */
  readonly durationMs: number | undefined;
  /** Whether the field held a value at submission. */
  readonly populated: boolean;
};

export const EMPTY_COUNTS: InteractionCounts = {
  pointer: 0,
  keyboard: 0,
  injected: 0,
  durationMs: undefined,
  populated: false,
};

/**
 * Minimal surface the collector needs, so it can be tested without a DOM and
 * without a headless browser. Any `HTMLElement` satisfies it structurally.
 */
export type Observable = {
  addEventListener(type: string, listener: (event: unknown) => void, options?: unknown): void;
  removeEventListener(type: string, listener: (event: unknown) => void, options?: unknown): void;
};

export type ValueSource = {
  /** Whether the watched input currently holds a value. */
  hasValue(): boolean;
};

export type CollectorOptions = {
  /** Defaults to `Date.now`. Injected for the same reason as D11. */
  readonly now?: () => number;
};

/**
 * Watch one element and report interaction counts.
 *
 * `stop()` removes every listener. Call it on unmount: a collector that outlives
 * its element is a leak, and one that keeps counting after submission reports
 * numbers that describe the wrong interaction.
 */
export function watchInteraction(
  target: Observable,
  value: ValueSource,
  options: CollectorOptions = {},
) {
  const now = options.now ?? Date.now;

  let pointer = 0;
  let keyboard = 0;
  let injected = 0;
  let firstAt: number | undefined;
  let sawKeyBeforeInput = false;

  function mark(): void {
    firstAt ??= now();
  }

  const onPointer = (): void => {
    pointer += 1;
    mark();
  };

  const onKey = (): void => {
    keyboard += 1;
    sawKeyBeforeInput = true;
    mark();
  };

  const onPasteOrDrop = (): void => {
    injected += 1;
    mark();
  };

  /**
   * An `input` event with no keystroke before it did not come from typing.
   * That covers password managers and programmatic assignment alike — which is
   * exactly why the constraint built on this is declared `soft` and not `hard`:
   * a filled field with no keystrokes is suspicious, never provable.
   */
  const onInput = (): void => {
    if (!sawKeyBeforeInput) injected += 1;
    sawKeyBeforeInput = false;
    mark();
  };

  const bindings: ReadonlyArray<readonly [string, (event: unknown) => void]> = [
    ['pointerdown', onPointer],
    ['pointerup', onPointer],
    ['keydown', onKey],
    ['paste', onPasteOrDrop],
    ['drop', onPasteOrDrop],
    ['input', onInput],
  ];

  for (const [type, listener] of bindings) {
    target.addEventListener(type, listener, { passive: true });
  }

  return {
    counts: (): InteractionCounts => ({
      pointer,
      keyboard,
      injected,
      durationMs: firstAt === undefined ? undefined : now() - firstAt,
      populated: value.hasValue(),
    }),

    reset(): void {
      pointer = 0;
      keyboard = 0;
      injected = 0;
      firstAt = undefined;
      sawKeyBeforeInput = false;
    },

    stop(): void {
      for (const [type, listener] of bindings) {
        target.removeEventListener(type, listener, { passive: true });
      }
    },
  };
}

/**
 * Reduce counts to the observation shape a declared invariant reads. D16.
 *
 * The collector produces counters; invariants consume a plain object. Keeping the
 * reduction here means the invariant never sees browser detail, and the core never
 * sees a DOM type.
 */
export function toObservation(counts: InteractionCounts): {
  readonly fieldPopulated: boolean;
  readonly interactions: number;
  readonly injected: number;
  readonly durationMs: number | undefined;
} {
  return {
    fieldPopulated: counts.populated,
    // Injected input is deliberately excluded: it is what the idle-action
    // constraint is looking for, so counting it as interaction would erase the
    // signal.
    interactions: counts.pointer + counts.keyboard,
    injected: counts.injected,
    durationMs: counts.durationMs,
  };
}
