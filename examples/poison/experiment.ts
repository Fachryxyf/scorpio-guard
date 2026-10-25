/**
 * The poisoning experiment: what an attacker buys with patience, and what it costs.
 *
 * A patient attacker does not farm in a burst, which D50 and D55 already handle. It
 * earns trust with positives first, then spends it on one malicious action, and the
 * question is how many negatives the guard needs before it treats that action. The
 * answer is a price, not a detection: the guard does not know the account is the same
 * person, it only knows how much evidence is stacked against the behaviour.
 *
 * Two things are varied. How many positives were spent, and whether the gaps between
 * them look like a machine (constant) or like a person (jittered by a fixed seed). The
 * second axis is the shipped discount of D55, and the experiment is how it is priced.
 */
import { createGuard, severity, type Decision, type GuardOptions } from '../../src/index.ts';

export type GapPattern = {
  readonly name: string;
  next: () => number;
};

/** A script that does not bother to hide: one request per minute, exactly. */
export const REGULAR: GapPattern = {
  name: 'regular',
  next: () => 60_000,
};

/** The same script with the most obvious tell removed. Fixed seed, so it reproduces. */
export function irregular(seed = 7): GapPattern {
  let state = seed;
  return {
    name: 'irregular',
    next: () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return Math.floor(20_000 + (state / 2147483648) * 400_000);
    },
  };
}

export type Row = {
  readonly positives: number;
  readonly gaps: string;
  readonly trustAfterPositives: number;
  readonly decisionAfterPositives: string;
  readonly negativesToTreatment: number;
  readonly decision: string;
};

export type PoisonOptions = {
  readonly guard?: GuardOptions;
  /** Upper bound on the attack, so a row always terminates. */
  readonly maxNegatives?: number;
};

function treated(decision: Decision): boolean {
  return severity(decision) >= severity('INCREASE_FRICTION');
}

/**
 * Spend positives at the given pacing, then attack until the guard treats the entity.
 *
 * The clock is the experiment, not the wall clock: every row is a clean run from zero,
 * so the numbers are about the policy rather than about when the suite happened to run.
 */
export async function runPoison(
  positives: number,
  gaps: GapPattern,
  settings: PoisonOptions = {},
): Promise<Row> {
  const clock = { t: 0, now: () => clock.t };
  const guard = createGuard({ ...settings.guard, clock });
  const entity = 'attacker';

  for (let i = 0; i < positives; i += 1) {
    clock.t += gaps.next();
    await guard.evaluate({ entity, observation: { evidence: { positive: 'strong' } } });
  }

  const before = await guard.evaluate({ entity });
  const max = settings.maxNegatives ?? 40;
  let negatives = 0;
  let decision: Decision = before.decision;

  while (negatives < max) {
    negatives += 1;
    clock.t += 30_000;
    const assessed = await guard.evaluate({ entity, observation: { evidence: { negative: 'strong' } } });
    decision = assessed.decision;
    if (treated(decision)) break;
  }

  return {
    positives,
    gaps: gaps.name,
    trustAfterPositives: Number(before.trust.mean.toFixed(3)),
    decisionAfterPositives: before.decision,
    negativesToTreatment: negatives,
    decision,
  };
}

/** The rows the script prints and the tests assert. */
export async function runMatrix(): Promise<Row[]> {
  const rows: Row[] = [];

  for (const positives of [0, 6, 12, 24, 48]) {
    rows.push(await runPoison(positives, REGULAR));
    rows.push(await runPoison(positives, irregular()));
  }

  rows.push(await runPoison(24, REGULAR, { guard: { discountRegularPositives: false } }));
  rows.push(await runPoison(24, irregular(), { guard: { discountRegularPositives: false } }));

  return rows;
}
