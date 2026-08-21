# Contributing

At this stage discussion is worth more than code. The model is built but nothing
in it is calibrated against real traffic, so the most valuable contribution is
evidence that a number is wrong — not a patch that changes it.

## Read this first

[DECISIONS.md](DECISIONS.md) records every design decision: the question, the
answer, the reasoning, and what the answer commits the implementation to. Several
obvious-looking alternatives were considered and rejected there. A proposal that
reopens a recorded decision is welcome; one that reopens it without knowing it was
decided will be closed with a pointer to the entry.

## What is most useful

| Contribution | Why it helps |
|---|---|
| A hard constraint the design missed | The constraint list is a starting set, not a complete one. A new class of provable impossibility is the highest-value thing anyone can bring. |
| A false positive, with its trace | `evaluate()` returns `trace` for exactly this. Paste it. A decision without its trace cannot be diagnosed. |
| A weak signal, and how it combines | Signals only mean something in combination. "This is suspicious" is not actionable; "this plus that, at these thresholds" is. |
| A store implementation | Run `checkStoreConformance()` against it and paste the result. Eleven checks. |
| A threshold that is wrong on real traffic | The whole model is reasoned guesses. Say what you observed and how much of it. |

## What is not useful yet

- A prescription client or wire format. The symptom vocabulary is unspecified, so
  anything transmitting is premature.
- An anomaly algorithm. The feature space is settled; the algorithm is deliberately
  deferred until there is traffic to choose it against.
- Framework middleware. The core API is still moving, and middleware is an adapter
  over it — never the other way around.

## Working on the code

Requires Node 22.6 or newer. Tests run TypeScript directly, with no build step.

```
npm install
npm test          # node:test, no framework
npm run typecheck
npm run build
npm run smoke     # verifies the built package, not the source
```

House rules, in order of how likely they are to get a change sent back:

1. **A behavioral change needs a test that names the decision it depends on.**
   The tests double as the record of every numeric and semantic property in the
   design. `D5: evidence mass is n = alpha + beta` is a test name, not a comment.
2. **`src/core/` imports nothing platform-specific.** No DOM types, no `node:`
   modules. That rule is what keeps one model usable on both sides of the wire.
   Browser code lives in `src/collect/`.
3. **Numbers live in `src/core/policy.ts`.** A threshold inline in a function is
   a threshold nobody can find or override.
4. **Time comes from the injected `Clock`.** Never `Date.now()` in the core.
5. **A deliberate simplification is marked `ponytail:`**, naming its ceiling and
   the upgrade path. An unmarked shortcut reads as an oversight.
6. **The guard advises. It never enforces.** Any API that acts on its own belongs
   in the host application, not here.

## Reporting a false positive

Include the trace, the observation shape, and any policy overrides. Without those
three, a report is a guess about a guess.

```js
console.log(JSON.stringify({ decision: result.decision, trace: result.trace }, null, 2));
```

Do not include raw user data. Nothing in the guard needs it, and nothing in a bug
report does either — the trace describes the shape of what happened, which is the
whole point of the design.
