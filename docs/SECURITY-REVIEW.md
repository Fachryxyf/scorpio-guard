# Directed security review: the scope packet (M4.3)

**Status: open.** No reviewer outside the author has signed this. This document is the
packet that makes the review executable. It is not the review, and nothing in it closes a
finding, because a finding requires someone who did not write the code to look for one.

## Why this exists

H13 and T7 in the roadmap: functional tests are not an audit. A test asserts the behaviour
the author thought of, and the suite here is good at that, which is exactly the blind spot.
The review looks for the behaviour the author did not think of, in five named surfaces, and
then decides whether a claim in the README, the design record, or the site has to be
withdrawn.

The exit criterion is the one in `docs/ROADMAP.md`: a report exists, and no critical finding
is open without a written reason.

## What the reviewer needs

- The repository at one commit. Record the sha in the sign-off section.
- Node 22.13 or newer. `npm ci` needs the network once, for development dependencies only.
  The published package has none (D59).
- For the lab harness only: Chrome, and the three targets described in `docs/DATASET.md`.
  The review does not need the lab; it is one of the ways to check the calibration claim.
- No npm account, no server, no cloud.

Effort estimate: one working session per surface for reading and probing. The harnesses that
produce numbers run on their own schedules, so the reading is the long part, not the waiting.

## The five surfaces

Each surface has a claim, the code that makes it, three attacks worth trying, and what would
falsify the claim. The attacks are a starting list, not the list.

### 1. Failure of the adapter

**Claim.** A broken store does not silently invent trust or distrust. Fail-open is legal only
with a witness: `kvStore` refuses `failOpen` without `onError` at construction (D62), and the
sink is called with the operation that failed.

**Where.** `src/core/guard.ts`, `src/core/store.ts`, `src/store/kv.ts` (the union at line 81,
the refusal at line 105), `src/store/sqlite.ts`, `examples/integration/`.

**Try.** A transport that throws on `get`, on `set`, and on `delete`, one at a time. A
transport that resolves with a body of the wrong shape. A transport that never resolves. A
store that returns the state of a different entity. A SQLite file removed between two calls.
Two evaluations of the same entity in flight at once, in one process and in two.

**What falsifies it.** Any path where an error changes a decision and the sink is not called,
or where the process dies instead of returning an `OBSERVE` that the host can see. A hang
with no bound is a finding too, even if it is the transport that hangs.

### 2. Poisoning by patience

**Claim.** Priced, not solved (D73, with the intake discount of D55). A fresh identity is
treated after three strong negatives. A constant-gap script stops buying tolerance at 5
negatives however much it spends. Removing the pacing tell buys 8, 16, and 31 negatives for
12, 24, and 48 positives, which is 1.71 positives per extra tolerated negative. Turning the
discount off makes both pacings 16, which is how the discount is shown to be the mechanism.

**Where.** `examples/poison/experiment.ts`, `scripts/poison.mjs`, `docs/POISONING.md`,
`src/core/trust.ts`.

**Try.** A mix of strong and weak observations cheaper than the table. Positives at gaps that
look irregular to a machine and regular to a human. A target that already has earned trust.
Soft invariant violations as the negative stream (D38), since they are the strongest
evidence a host can hand over. Two identities interleaved to keep each one below the
cadence floor.

**What falsifies it.** A strategy that reaches tolerance below the stated price, or a number
in `docs/POISONING.md` that `npm run poison` does not reproduce on the reviewer machine.

### 3. The entity key

**Claim.** Rotation is a cost, not a prevention (D72). One changed key discards six
observations of accumulated distrust. Earning the same standing back costs 25 positives. One
shared key poisons a clean visitor. Ten keys cost ten states and stay at `OBSERVE`. Retention
plus silence resets the entity. The library never derives the key.

**Where.** `docs/ROOT-OF-TRUST.md`, `src/core/root-of-trust.test.ts`, and the host contract
described there.

**Try.** Rotate a header inside a session. Churn cookies. Reuse a key that another visitor
already had. Pass an empty string, a number, an object, and a string that differs only in
case or normalization. Derive the key from the transport address in the host and see what the
library does with the result, which is nothing, because the library only measures what it is
given.

**What falsifies it.** A row of the cost table that a host can defeat more cheaply than the
table says, or any code path where the library invents or augments an identity.

### 4. Denial of service and resource bounds

**Claim.** State is bounded by `maxEntities`, evicting the stalest first. Retention deletes
rather than hides. The protocol server refuses a body over 64 KiB, limits 60 requests per
minute per transport address, and keeps hourly aggregates. The soak harness holds state under
the cap, p99 under 5 ms, and retained RSS after warmup under 100 MB on the recorded machine.

**Where.** `src/core/store.ts` (the cap at lines 86 to 91), `examples/protocol/server.ts`
(line 78), `scripts/soak.mjs`, `docs/SOAK.md`.

**Try.** High-cardinality keys to force eviction churn and measure what the eviction costs the
visitors who were evicted. A body exactly at the limit, one byte over, and a chunked body
that never declares a length. Invalid JSON at the limit. A batch where every record is
rejected, which still costs the walk. Sweep starvation: keep the loop busy and see whether the
sweep still runs. Memory over an hour with the flood profile.

**What falsifies it.** State or memory that grows without a bound, an eviction order that
throws away the wrong entity, or a p99 above the recorded budget on the recorded machine. On
a different machine, record the machine and say so rather than calling it a failure.

### 5. Host integration

**Claim.** The decision event carries no identity by default (D61). Erasure is proved by
counting what is underneath, in every shipped store (D69). The library never writes to the
host standard output or error stream. The core has no runtime dependency (D59) and does not
touch Node-only APIs, which an import-graph walk enforces (D12, M5.1).

**Where.** `src/core/event.ts`, `src/core/erasure.test.ts`,
`src/core/runtime-surface.test.ts`, `examples/integration/`.

**Try.** Write the default event to a host log and look for anything that names a person, a
cookie, or an address. Call `forget`, then count rows in SQLite and keys in the KV store
rather than trusting `get`. Import `./collect` into a server bundle.

**What falsifies it.** One identifier in the default event, one residue after `forget`, or one
write to a host stream.

## Out of scope, with the reason

- **npm supply chain and the registry account.** Outside the code. The account suspension is
  recorded in `docs/RELEASING.md` and is not a security finding.
- **TLS and transport authentication.** The local core is unauthenticated by decision (D17).
  The receiver in `examples/protocol/` is a reference, not a public endpoint, and reviewing it
  as one would produce findings about a deployment that does not exist.
- **Host operating system, container, and database security.**

- **Browser fingerprinting performed by the host.** The collector reports what the page
  reports; a host that fingerprints harder is a host decision.
- **A malicious maintainer.** No amount of structure survives that, and pretending otherwise
  would be a claim the project cannot hold.

## Known open risks, accepted and not findings

These are written down so that the review spends its time on the unknown rather than
rediscovering them. If the reviewer disagrees that one of them is acceptable, that is a
finding against the acceptance, not against the code.

| Risk | Reference | What closing it would cost |
| --- | --- | --- |
| Key rotation cannot be detected by the library | D72 | A per-request proof the host issues, which the host must want |
| Poisoning is priced, not prevented | D73 | A separate mechanism, and the price table says what it would buy |
| The first-seen-rate diagnostic is not implemented | D72 | A new signal with its own calibration, which does not exist yet |
| Thresholds come from lab traffic with a published composition, not a real population | `docs/DATASET.md` | Real mixed traffic, which the project does not have |
| The protocol endpoint is unauthenticated | D17 | A key, a rotation policy, and an argument about where the key lives |
| The framework integration is one example, not a supported set of adapters | M1.1 | A support matrix and the tests behind it |

## How to run the evidence

```
npm ci
npm run typecheck
npm test
npm run build
npm run smoke
npm run check:api
npm run poison -- --json
npm run soak -- --seconds=60 --json
npm run soak:flood
npm run protocol:check
npm run site:check
```

`npm run lab -- --repeat=2` needs Chrome and the three targets, and it writes under `var/`
which is not committed. `docs/DATASET.md` explains what the two recorded runs contain.

## The deliverable

One row per finding, in the reviewer words, in this file under a new heading. Not a summary,
not a rewrite by the author.

| field | content |
| --- | --- |
| id | R1, R2, and so on |
| severity | critical, high, medium, low, informational |
| surface | one of the five above, or the closest one |
| where | path and line |
| reproduction | the command, the test, or the exact sequence |
| observed | what happened |
| expected | the claim that predicted otherwise, with its decision id |
| claim withdrawn | yes or no, and which sentence |
| proposed fix | one paragraph, or "none, the risk is accepted" |
| status | open, closed by commit, or accepted with a reason |

The rule for 1.0.0: no open critical finding. Any other open finding needs a written reason,
and the reason has to be about the risk rather than about the schedule.

## Sign-off

- Reviewer, date, and commit sha:
- Surfaces covered:
- Surfaces skipped, and why:
- Sentence, written by the reviewer: "I attempted to falsify each claim above and report what
  I found."

Until this section is filled by someone who is not the author, M4.3 stays open and 1.0.0
waits, however green the rest is.
