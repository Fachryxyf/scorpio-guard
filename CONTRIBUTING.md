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
| A false positive, with its trace | `evaluate()` returns `trace` for exactly this. Paste it. A decision without its trace cannot be diagnosed. |
| A proof source the taxonomy missed | D41 closes the constraint classes over six kinds of fact a host can prove something from. A *seventh kind of proof* would reopen it — a new attack shape would not, since it should already map to an existing class. Say which of the six yours is not. |
| A weak signal, with its innocent cause | D42 requires the plausible legitimate path to triggering it. A signal whose false-positive story cannot be written down is not understood well enough to weigh. Thresholds are deliberately not part of the catalogue. |
| A store implementation | Run `checkStoreConformance()` against it and paste the result. Eleven checks, and two implementations already pass them. |
| A threshold that is wrong on real traffic | The whole model is reasoned guesses. Say what you observed and how much of it. |
| A persona the generator is missing | `npm run replay` drives seeded personas through two declared targets (D45, D47). A legitimate usage pattern that gets escalated is a bug in the thresholds; an adversary that walks through is a gap in the model. Either is worth more than a patch. |
| An application with something worth stealing | The best target has unauthenticated endpoints and real cost behind them — that is why IXFE replaced a personal app as the primary one (D47). Declared invariants from a flow nobody would bother attacking prove very little. |

## What is not useful yet

- A prescription client or wire format. The vocabulary's *structure* is settled
  (D43) but the wire format is not, and it belongs to `scorpio-guard-protocol`, so
  anything transmitting is premature.
- A new symptom *category*. The stable tier is meant never to grow — that is the
  whole point of splitting it from the detail tier. A new **detail** under an
  existing category is welcome; a seventh category needs an argument that the guard
  can observe a kind of thing none of the six covers.
- An anomaly algorithm. The feature space is settled and the personas now give
  candidates something to be compared against, but choosing one still wants a real
  population — generated traffic can falsify a candidate, not rank it.
- Framework middleware. The core API is still moving, and middleware is an adapter
  over it — never the other way around.

## Working on the code

Requires Node 22.6 or newer. Tests run TypeScript directly, with no build step.

```
npm install
npm test          # node:test, no framework
npm run replay    # persona traffic against the HealthMe flow
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
   Browser code lives in `src/collect/`, platform-backed stores in `src/store/`.
3. **Numbers live in `src/core/policy.ts`.** A threshold inline in a function is
   a threshold nobody can find or override.
4. **Time comes from the injected `Clock`.** Never `Date.now()` in the core.
5. **A deliberate simplification is marked `ponytail:`**, naming its ceiling and
   the upgrade path. An unmarked shortcut reads as an oversight — and a marked one
   is a debt, so removing it counts as a contribution.
6. **`hard` needs an enumeration, not an error code.** Declaring `hard` asserts the
   legitimate set is complete for that scope. That the server already refuses the
   request is not evidence of completeness — see D48, where "paid work requires
   enough credits" turned out to be `soft` because the client's view of its balance
   is stale by construction.
7. **No threshold goes in `signals.ts`.** The catalogue names what is measured,
   never when it fires: the library is public, so a published number is a target to
   route around. Thresholds live in policy an adopter overrides.
8. **The guard advises. It never enforces.** Any API that acts on its own belongs
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
