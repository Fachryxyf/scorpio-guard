/**
 * Injected time source. D11.
 *
 * Decay (D3) and retention (D6) are both functions of real elapsed time, so an
 * injectable clock is what makes them testable without waiting.
 */
export type Clock = {
  /** Milliseconds since the Unix epoch. */
  now(): number;
};

export const systemClock: Clock = {
  now: () => Date.now(),
};
