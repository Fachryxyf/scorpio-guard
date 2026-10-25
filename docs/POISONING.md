# Poisoning: patience has a price, and the price is measured

A slow poisoning attack does not farm in a burst. It earns trust first, then spends it on
one malicious action, and repeats. D50 and D55 were written against the burst and against
the machine-regular farmer; this document is the measurement of what patience still buys
(D73).

The question is deliberately not "does the guard detect the attacker". It cannot: a patient
attack and a good customer having a bad day produce the same evidence, and the library is
advisory (D8, D9). The question is what the guard charges for the evidence an action needs.
That number is the attack price, and it is measurable.

## The experiment

`examples/poison/experiment.ts`, printed by `npm run poison`. One run spends N strong
positives at a chosen pacing, then sends strong negatives until the guard advises
`INCREASE_FRICTION` or worse, and reports how many negatives that took. The clock is the
experiment rather than the wall clock, so every row starts from zero and reproduces.

Two pacings:

- **constant**: one request every 60 seconds, a script that does not hide.
- **jittered**: the same script with gaps drawn from 20 to 420 seconds by a fixed seed. The
  most obvious tell is removed, and the seed makes the row reproducible.

## The result

```
| positives spent | pacing | trust after positives | decision | negatives to treatment |
|---|---|---|---|---|
| 0 | regular | 0.500 | ALLOW | 3 |
| 0 | irregular | 0.500 | ALLOW | 3 |
| 6 | regular | 0.928 | ALLOW | 4 |
| 6 | irregular | 0.928 | ALLOW | 4 |
| 12 | regular | 0.937 | ALLOW | 5 |
| 12 | irregular | 0.961 | ALLOW | 8 |
| 24 | regular | 0.937 | ALLOW | 5 |
| 24 | irregular | 0.980 | ALLOW | 16 |
| 48 | regular | 0.936 | ALLOW | 5 |
| 48 | irregular | 0.989 | ALLOW | 31 |
| 24 | regular (discount off) | 0.980 | ALLOW | 16 |
| 24 | irregular (discount off) | 0.980 | ALLOW | 16 |
```

## What the table says

- **Three negatives for a fresh identity.** That is the baseline everything else is priced
  against.
- **Constant pacing saturates at five.** Spending 24 positives or 48 buys the same tolerance,
  and trust stops short of saturation (0.936, not 0.99) because the positives keep being
  discounted. A naive script pays twice and gets nothing for it.
- **Jittered pacing scales.** Twelve positives buy 8 negatives, 24 buy 16, 48 buy 31. The
  increments are almost linear: 48 positives buy 28 extra tolerated negatives, so the price
  is 1.71 positives per tolerated negative.
- **The discount is the whole difference.** With `discountRegularPositives: false`, constant
  pacing buys 16 at 24 positives, exactly what jittered pacing buys. Regularity only matters
  because the discount looks at it.

## Is that a mitigation, or a price list

Both, and the distinction matters for what a host does next:

1. **The shipped discount prices the lazy script.** It caps tolerance at five negatives no
   matter how much the attacker spends. That is a mitigation: for a script that keeps its
   automation visible, patience stops working.
2. **The paced script is priced, not prevented.** Removing the tell converts 1.71 positives
   into one extra tolerated negative. A host that wants a different price has to change what
   positives are worth, at its own edge, because the library has no identity to check and no
   authority to decide (D70 is about the wire, this is about the decision).
3. **What a host can add without the library.** Rate-limit positive evidence at the edge,
   require a second factor before the privileged action, and treat "a long run of good
   behaviour that ends in one violation" as a review signal. None of that is advice the
   library can give, because it never sees the action.

## Limits

- **One attack shape.** Strong positives, then strong negatives, on one entity. Mixed
  evidence, weaker evidence, and per-endpoint variation are not measured, and weaker
  evidence would move every number in the table.
- **Deterministic pacing, not real traffic.** The jitter is seeded rather than sampled. The
  rows reproduce, which is why they are testable, and they describe the policy rather than
  the effort of any particular attacker.
- **One policy.** All rows use the shipped defaults. A deployment that changes the discount
  or the weights gets a different price, and should re-run the script instead of quoting this
  document.
- **The ceiling is one entity key.** A patient attacker who also rotates keys is a different
  problem, answered by D72 and not by this experiment.
- **No population claim.** Twelve rows is a price list for a policy, not an estimate of how
  much abuse exists in the world.

## Reproduction

```
npm run poison
npm run poison -- --json
```

Four of the twelve rows are asserted in `examples/poison/experiment.test.ts`, including the
discount-off row that shows the mechanism. Verified by mutation: defaulting
`discountRegularPositives` to `false` fails two of them.
