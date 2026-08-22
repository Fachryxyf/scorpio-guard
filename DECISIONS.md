# Design Decisions

Formal record of the design decisions behind Scorpio Guard: the question asked,
the answer given, and what that answer commits the implementation to.

**How to read this**

- Entries are numbered `Dn` and are stable. They are appended, never renumbered.
- A decision is superseded by adding a note to it, not by deleting it — the
  reasoning that was rejected is part of the record.
- Sub-numbered entries (`D1.1`) are consequences derived from a decision rather
  than answers given directly.
- Anything under [Open questions](#open-questions) is **not** decided and must not
  be assumed in code.
- Where a decision was checked numerically, the finding is included and the
  property is locked as a test in `src/core/trust.test.ts`. Values here are
  policy; the tests are what make a policy change visible.

Status: every numbered question is answered — the original thirty, plus D31 to
D53 arising from review, implementation, and a live pentest. Nothing is blocked on
a decision. What remains is validation: the values recorded here have not met real
traffic yet, and D47 names where they will.

Last updated: 2026-08-22

---

## Contents

**Part I — Foundations**

- [D1 — Entity is the fundamental reference unit](#d1--entity-is-the-fundamental-reference-unit)
- [D1.1 — Root of trust is outside SG](#d11--root-of-trust-is-outside-sg)
- [D1.2 — Data deletion is a requirement](#d12--data-deletion-is-a-requirement)
- [D2 — One trust state per entity, not per entity-endpoint](#d2--one-trust-state-per-entity-not-per-entity-endpoint)

**Part II — Trust model**

- [D2a — Trust is stored as a distribution, read as a number](#d2a--trust-is-stored-as-a-distribution-read-as-a-number)
- [D3 — Decay is a half-life over real elapsed time](#d3--decay-is-a-half-life-over-real-elapsed-time)
- [D4 — Evidence weights, symmetric, 4:1 strong to weak](#d4--evidence-weights-symmetric-41-strong-to-weak)
- [D6 — Expiration is a retention boundary, separate from decay](#d6--expiration-is-a-retention-boundary-separate-from-decay)

**Part III — Decision layer**

- [D5 — Decision is a function of trust and uncertainty](#d5--decision-is-a-function-of-trust-and-uncertainty)
- [D37 — Saturation guard belongs in the decision layer, not the trust model](#d37--saturation-guard-belongs-in-the-decision-layer-not-the-trust-model)
- [D40 — An epistemic stage precedes trust and uncertainty](#d40--an-epistemic-stage-precedes-trust-and-uncertainty)
- [D46 — Two thresholds the traffic falsified](#d46--two-thresholds-the-traffic-falsified)
- [D49 — D37 does not do what it claims](#d49--d37-does-not-do-what-it-claims)
- [D39 — The cold-start band contradicted the zero-friction goal](#d39--the-cold-start-band-contradicted-the-zero-friction-goal)

**Part IV — Hard constraints**

- [D13 — Hard constraints are violated invariants, in five classes](#d13--hard-constraints-are-violated-invariants-in-five-classes)
- [D14 — "Hard" describes certainty, not severity](#d14--hard-describes-certainty-not-severity)
- [D15 — Hard constraints stay outside the Beta model](#d15--hard-constraints-stay-outside-the-beta-model)
- [D16 — Invariants are declared, never learned](#d16--invariants-are-declared-never-learned)
- [D32 — Declaring `hard` is itself a claim of completeness](#d32--declaring-hard-is-itself-a-claim-of-completeness)
- [D38 — A violated `soft` invariant is strong negative trust evidence](#d38--a-violated-soft-invariant-is-strong-negative-trust-evidence)
- [D41 — The constraint taxonomy is closed over proof sources, not attacks](#d41--the-constraint-taxonomy-is-closed-over-proof-sources-not-attacks)

**Part V — Anomaly model**

- [D18 — Anomaly: feature space first, algorithm later](#d18--anomaly-feature-space-first-algorithm-later)
- [D36 — The anomaly feature space](#d36--the-anomaly-feature-space)
- [D35 — An observation without evidence is not a meaningful update](#d35--an-observation-without-evidence-is-not-a-meaningful-update)
- [D42 — The weak-signal catalogue, with no thresholds in it](#d42--the-weak-signal-catalogue-with-no-thresholds-in-it)

**Part VI — Architecture and API**

- [D7 — One package, multiple entry points](#d7--one-package-multiple-entry-points)
- [D8 — Pluggable `StateStore`, in-memory default, async](#d8--pluggable-statestore-in-memory-default-async)
- [D44 — A durable store ships, on `node:sqlite`](#d44--a-durable-store-ships-on-nodesqlite)
- [D9 — `guard.evaluate({ entity, observation, context })`](#d9--guardevaluate-entity-observation-context-)
- [D10 — All public evaluation and storage APIs are async](#d10--all-public-evaluation-and-storage-apis-are-async)
- [D11 — Time is injected through a `Clock` interface](#d11--time-is-injected-through-a-clock-interface)
- [D12 — Core is framework-agnostic](#d12--core-is-framework-agnostic)
- [D20 — A serverless guard is fully functional](#d20--a-serverless-guard-is-fully-functional)

**Part VII — Protocol and privacy**

- [D17 — No API key in the local core](#d17--no-api-key-in-the-local-core)
- [D19 — Symptoms are local-first, never per request](#d19--symptoms-are-local-first-never-per-request)
- [D43 — The symptom vocabulary is two tiers, split by rate of change](#d43--the-symptom-vocabulary-is-two-tiers-split-by-rate-of-change)
- [D21 — Cold start, restated](#d21--cold-start-restated)
- [D22 — Purge primitive from the start; consent belongs to the host](#d22--purge-primitive-from-the-start-consent-belongs-to-the-host)
- [D23 — Decision trace is mandatory](#d23--decision-trace-is-mandatory)
- [D31 — `Relationship : E x E -> R` is deferred out of the PoC](#d31--relationship--e-x-e---r-is-deferred-out-of-the-poc)

**Part VIII — Project and tooling**

- [D24 — Licence: MIT](#d24--licence-mit)
- [D25 — npm: `@fachryxyf/scorpio-guard`](#d25--npm-fachryxyfscorpio-guard)
- [D26 — Node floor: `>=22.6`](#d26--node-floor-226)
- [D27 — CI now: typecheck and test](#d27--ci-now-typecheck-and-test)
- [D28 — Site stays where it is](#d28--site-stays-where-it-is)
- [D29 — No empty repositories](#d29--no-empty-repositories)
- [D34 — PoC target: HealthMe, with its limits stated](#d34--poc-target-healthme-with-its-limits-stated)
- [D45 — Generate the traffic; do not wait for it](#d45--generate-the-traffic-do-not-wait-for-it)
- [D47 — Primary target: IXFE, because it has something to steal](#d47--primary-target-ixfe-because-it-has-something-to-steal)
- [D48 — A stale client view is not a proof](#d48--a-stale-client-view-is-not-a-proof)
- [D30 — PoC must run against a real application flow](#d30--poc-must-run-against-a-real-application-flow)
- [D50 — Farming is answered on mass, through velocity](#d50--farming-is-answered-on-mass-through-velocity)
- [D51 — Signal collectors exist for all seven uncovered catalogue entries](#d51--signal-collectors-exist-for-all-seven-uncovered-catalogue-entries)
- [D52 — The anomaly classifier is a distance-to-reference model, not a trained one](#d52--the-anomaly-classifier-is-a-distance-to-reference-model-not-a-trained-one)
- [D53 — Wire format is v0.1, documented and tested, still untransmitting](#d53--wire-format-is-v01-documented-and-tested-still-untransmitting)

**[Open questions](#open-questions)**

---

# Part I — Foundations

What an entity is, what SG is responsible for, and what it explicitly is not.

## D1 — Entity is the fundamental reference unit

**Decided.**

An entity is the reference unit Scorpio Guard uses to bind memory to a sequence
of interactions, so that it can learn from the past and choose a treatment for
what comes next.

An entity is **not** inherently a user, a session, a device, an IP address, or
any particular form of identity. SG does not need to know what an entity
represents. It needs only a reference stable enough to maintain continuity of
state.

### Formal statement

```
E = {e1, e2, ..., en}      set of entities
I = {i1, i2, ..., im}      set of interactions
```

An interaction is associated with an entity by:

```
rho : I -> E
rho(i_t) = e
```

From that association SG builds memory, and from memory it derives state:

```
M_e(t) = { i_k | k <= t, rho(i_k) = e }
S_e(t) = F(M_e(t))
```

State is the basis for evidence, trust, anomaly, behavioral pattern,
uncertainty, and assessment. When a new interaction arrives it is evaluated
against the state of its associated entity, and the assessment is then
translated into a treatment under context `C`:

```
A_(t+1) = G(i_(t+1), S_rho(i_(t+1))(t))
T_(t+1) = PI(A_(t+1), C_(t+1))
```

Pipeline:

```
interaction -> entity association -> entity memory -> entity state
            -> assessment -> treatment
```

### Signatures

```
Trust        : E -> [0,1]
Anomaly      : E x I -> R
Uncertainty  : E -> R>=0
Memory       : E -> M
```

A fifth signature, `Relationship : E x E -> R`, was stated with these. It is
withheld from the formal model until D31 defines what it means — a signature
without semantics would be implemented by guesswork. See D31; out of scope for
the PoC.

### Naming

The formal name of the unit is **SG Reference Unit (SGRU)**. One entity is one
SGRU.

SGRU is not a unit that measures a magnitude, the way a metre measures distance.
It is a unit of **continuity**: it guarantees that two observations refer to the
same reference point over time, not that any quantity attached to it is
comparable across different entities.

That distinction carries D1.1 without restating it — continuity is not identity,
so the root of trust necessarily sits outside SG.

> Entity is the fundamental reference unit of Scorpio Guard.

The public API uses `entity`. `SGRU` stays the formal term in documentation.

### Division of responsibility

SG does not determine the semantic identity of an entity. The host application
is responsible for providing and maintaining the reference. SG is responsible
for the observation, memory, state, assessment, and treatment attached to it.

SG accepts a reference as a basis for measurement — never as proof that the
reference represents a particular identity.

### What this commits the code to

- Trust state is keyed by an opaque `string`. SG never parses, hashes, or
  derives meaning from its content.
- `rho` lives in the host application. `evaluate()` receives the reference as a
  parameter; SG needs no framework adapter to infer a key from a request.
- The storage interface can stay a plain key-value contract — pending D31.
- `S_e(t)` holds `(alpha, beta, last_seen)`, not a scalar. See D2a.

## D1.1 — Root of trust is outside SG

**Consequence of D1.** Restated by the author in D21.

Because SG accepts a reference without verifying what it represents, the root of
trust sits outside SG entirely. Cold start and sybil churn are therefore not
problems SG solves.

This must be stated plainly in the README rather than left implicit. The
consequence is load-bearing: **if the host application supplies a reference that
is cheap to discard, every history-based defence evaporates, and that is the
host's responsibility.** An adopter who does not understand this will believe
they have protection they do not have.

### Noted, not built

SG cannot structurally detect reference rotation — it cannot distinguish a
hundred legitimate new entities from one attacker discarding identity a hundred
times. It may later be worth reporting the rate of first-seen references to the
host as a diagnostic, without SG claiming that rate means abuse. Not
implemented; recorded only.

## D1.2 — Data deletion is a requirement

**Consequence of D1.** Confirmed by the author in D22.

Lighter than first assessed, because SG never touches PII directly — it holds a
blind reference. Not eliminated, because SG still stores behavior bound to that
reference, which on the host's side remains processing of personal data.

A per-entity delete API is still required, and is cheaper to design in now than
to retrofit into storage later.

## D2 — One trust state per entity, not per entity-endpoint

**Decided, as a consequence of D1.**

The signatures settle it: `Trust : E -> [0,1]` and `Uncertainty : E -> R>=0` are
domained on `E` alone, while `Anomaly : E x I -> R` is per-interaction.

So trust is global per entity. Endpoint sensitivity enters as part of context
`C` in `PI(A, C)` at treatment time — it is not part of the state key.

---

# Part II — Trust model

How evidence becomes a distribution, how it ages, and when it is discarded.

## D2a — Trust is stored as a distribution, read as a number

**Confirmed by D3**, which decays evidence mass underneath the distribution
rather than editing a trust scalar.

`Trust : E -> [0,1]` returns a single number, while the design notes insist
trust is a distribution rather than a number. Both hold if what is *stored* is
`Beta(alpha, beta)`, and `Trust` and `Uncertainty` are *derived* from it:

```
Trust(e)       = E[p]   = alpha / (alpha + beta)
Uncertainty(e) = Var[p] = (alpha * beta) / ((alpha+beta)^2 * (alpha+beta+1))
```

The distribution is the state; the two signatures are projections of it. Code
proceeds on this reading unless corrected.

## D3 — Decay is a half-life over real elapsed time

**Decided.**

```
lambda(dt) = 2^(-dt/H)      H > 0
```

`H` is a configurable policy parameter. PoC default:

```
H = 24 hours
```

### Principle

> SG decays the influence of historical evidence over real elapsed time, not per
> request. Decay reduces evidence mass rather than directly changing the
> expected trust value.

If PoC experiments show 24 hours is too aggressive or too slow, the policy
changes — the mathematical model does not.

### Why base-2 over a bare `lambda` constant

Stating decay as a half-life makes the parameter physically meaningful: `H` is
the time for existing evidence to lose half its weight. A bare `lambda` per
request means nothing without also knowing the request rate, and it lets a
high-traffic entity age faster in wall-clock terms than a quiet one for no
defensible reason.

### Consequence: decay is composable, so it needs no background job

```
lambda(dt1 + dt2) = lambda(dt1) * lambda(dt2)
```

Applying decay in one step over the full gap is identical to applying it
incrementally. So SG stores `last_seen` and decays lazily at read time. No
scheduler, no sweep, no cron, and an entity that is never touched again costs
nothing to maintain.

### What "reduces evidence mass" commits the state shape to

Evidence mass is stored **separately from the prior**, and only the mass decays:

```
stored:   (a, b, last_seen)        accumulated evidence mass, starts (0, 0)
derived:  alpha = 1 + a * lambda(dt)
          beta  = 1 + b * lambda(dt)
```

The `Beta(1,1)` prior is structural and never decays. This matters, and the
alternative was tested numerically before choosing:

| Reading | `E[p]` after long silence | Distribution stays proper |
|---|---|---|
| Decay `alpha` and `beta` wholesale | frozen at its last value forever | No — collapses toward `Beta(0,0)` |
| Decay mass only, prior pinned | returns to `0.5` = unknown | Yes — floor at `Beta(1,1)` |

Decaying `alpha` and `beta` wholesale was rejected. It holds `E[p]` constant
while variance grows past the valid range for a unimodal Beta, and an entity
with 8 positive observations two years ago would still read `E[p] = 0.75`
forever. That is precisely the dogmatism the design set out to avoid.

Decaying mass only gives the intended behavior: an entity that goes quiet drifts
back to **unknown, not untrusted** — `E[p] -> 0.5`, `Var[p] -> 1/12`, which is
exactly flat `Beta(1,1)`. Verified numerically: from mass `(8, 2)`, after 96h
`E[p] = 0.571`, after 240h `E[p] = 0.502`.

Reading the principle as "`E[p]` must not change" would force the rejected
option, so it is read as: decay acts on mass, and any movement in `E[p]` is a
consequence of mass shrinking toward the prior, not a direct edit to the trust
value.

### Write-time rule, stated explicitly

Every write decays the stored mass to *now* before adding new evidence, then
advances `last_seen`:

```
dt    = now - last_seen
a_new = a_old * lambda(dt) + w+
b_new = b_old * lambda(dt) + w-
last_seen = now
```

Reads apply `lambda(now - last_seen)` without mutating anything.

This is written out because two readings of "decay lazily" are otherwise both
defensible — decay-then-add, or add-then-decay-at-read — and they do not agree.
Only decay-then-add produces the mass ceiling `m* = w / (1 - lambda(T))` that D4
depends on; the other lets mass grow without bound. Composability from D3 is what
makes the single-step decay exact rather than an approximation.

### What this commits the code to

- State is `(a, b, last_seen)`. Fresh entity is `(0, 0, now)`, which reads as
  exactly `Beta(1,1)`.
- Writes follow decay-then-add, above. Reads decay a copy and mutate nothing.
- `H` is policy, injected as configuration, not a hardcoded constant.
- Needs an injected clock to be testable — see question 11, now effectively
  settled in favour of injection.

## D4 — Evidence weights, symmetric, 4:1 strong to weak

**Decided.**

```
weak positive    = +0.5
strong positive  = +2.0
weak negative    = -0.5
strong negative  = -2.0
```

Positive and negative magnitudes are symmetric. Strength sets how much evidence
mass an observation contributes — it is not SG's confidence in having classified
that evidence correctly.

Signs are notation only. Nothing negative is ever added to a Beta parameter;
evidence is separated into positive and negative mass:

```
alpha' = alpha + w+
beta'  = beta  + w-
```

One strong evidence therefore weighs four weak ones.

```
strong : weak = 4 : 1
```

Policy parameters, configurable after PoC experiments.

### Behavior under these numbers

Checked numerically against D3 with `H = 24h`, since the weights only mean
something in combination with decay.

Accumulation is deliberately slow, which suits a design that treats volume as
evidence rather than guilt:

| Target `E[p]` | Weak positives needed |
|---|---|
| 0.70 | 3 |
| 0.80 | 6 |
| 0.90 | 16 |
| 0.95 | 36 |

A single strong negative bites hardest on entities with little history, and is
absorbed by entities that have earned mass — the intended asymmetry:

| Positive mass | `E[p]` before | after one strong negative | drop |
|---|---|---|---|
| 2 | 0.750 | 0.500 | 0.250 |
| 8 | 0.900 | 0.750 | 0.150 |
| 50 | 0.981 | 0.944 | 0.036 |

A brand-new entity hit once by a strong negative lands at `E[p] = 0.25` with
`Var = 0.038` — low trust held with fairly high confidence, from one
observation. Whether that is too fast is a threshold question, deferred to D5:
the decision layer can require a minimum mass before honouring a low `E[p]`,
so the weights do not have to be softened to compensate.

### Consequence: decay caps accumulated mass, so no clamp is needed

With arrivals every `T` and weight `w`, mass converges rather than growing
without bound:

```
m* = w / (1 - lambda(T))
```

| Interval `T` | Weak ceiling | Strong ceiling |
|---|---|---|
| 1 min | 1039 | 4156 |
| 1 hour | 17.6 | 70.3 |
| 6 hours | 3.1 | 12.6 |
| 24 hours | 1.0 | 4.0 |

Two things follow. Mass is self-limiting, so no artificial clamp is required for
ordinary traffic. But a high-frequency entity does saturate near `E[p] = 1` and
becomes hard to move with negative evidence — a farmable slow-poisoning path.

That is not addressed here. Clamping mass would contradict the finding above, so
it is handled one layer up, in the decision layer: see D37.

Locked as tests in `src/core/trust.test.ts`, not verified once and discarded —
these values are policy and will be revised, so a change has to surface as a
failing test rather than as silent drift.

### What this commits the code to

- Two accumulators, `a` and `b`, both non-negative and monotonically increasing
  before decay. No signed arithmetic on Beta parameters.
- Weights arrive as named policy, not as literals at call sites.
- Evidence is typed `weak | strong` and `positive | negative`; the mapping to a
  number is one lookup, replaceable by configuration.

## D6 — Expiration is a retention boundary, separate from decay

**Decided.**

Decay and expiration are separate mechanisms.

Decay reduces the influence of historical evidence over real elapsed time:

```
lambda(dt) = 2^(-dt/H)
```

Expiration removes accumulated SG state entirely after a retention horizon
passes without a meaningful state update.

PoC defaults:

```
H         = 24 hours
Retention = 7 * H = 7 days
```

If an entity receives no meaningful evidence or state update for 7 days, its SG
state is **EXPIRED** and deleted.

Expiration deletes SG state, not the entity reference. If the same reference
appears again afterwards, SG treats it as an existing reference carrying no
retained state and initializes it from the cold-start prior `Beta(1,1)`.

Retention is measured from meaningful evidence and state updates, not from
arbitrary request activity — trivial traffic must not keep state alive
indefinitely.

> Expiration is a data-retention policy boundary, not a trust judgment.

### Why keeping them separate is the right call

Earlier reasoning under D3 suggested deletion could fall out of the mathematics
alone: after enough half-lives, mass is negligible and the state is
indistinguishable from a new entity. That reasoning is close but not sufficient,
and the numbers show why.

At the 7-day horizon, `lambda(168h) = 0.0078`, so 99.2% of mass is gone. For
ordinary entities that is already effectively flat:

| Mass at last update | `E[p]` after 7 days | `Var` |
|---|---|---|
| (8, 2) | 0.511 | 0.081 |
| (50, 5) | 0.572 | 0.071 |
| (1000, 50) | 0.864 | 0.011 |

The third row is the point. A high-frequency entity can accumulate mass in the
thousands — D4 showed a ceiling of 4156 for strong evidence at one-minute
intervals — and 0.78% of a large number is still a meaningful number. Such an
entity would read `E[p] = 0.86` at **low uncertainty** a full week after going
silent, and would still hold the full decision space under D5.

Decay alone therefore does not converge to *unknown* on a bounded schedule; how
long it takes depends on how much mass was accumulated. An explicit retention
horizon does converge, for every entity, regardless of history. That is what
makes it a defensible retention policy rather than an emergent side effect.

It also matters legally. Under D22, "state disappears eventually, at a rate that
depends on prior traffic volume" is not a retention policy anyone can attest to.
"Deleted after 7 days without meaningful update" is.

### Ambiguity flagged: what counts as a meaningful update

The distinction between a meaningful state update and arbitrary request activity
is load-bearing — it decides whether an attacker can keep state alive cheaply,
and whether a quiet legitimate entity is dropped too early. Current reading:

- **Meaningful**: any evidence applied to the trust model, positive or negative,
  weak or strong. Anything that moved `a` or `b`.
- **Not meaningful**: an interaction that was observed but produced no evidence,
  and a pure read of the trust state.

Under that reading, `last_seen` used for decay and `last_meaningful_update` used
for retention are two different timestamps, and both have to be stored.

Whether an anomaly observation with no trust evidence counts as meaningful is
not decided — it depends on the anomaly model, which is still open under
question 18.

Locked as tests in `src/core/trust.test.ts`, not verified once and discarded —
these values are policy and will be revised, so a change has to surface as a
failing test rather than as silent drift.

### What this commits the code to

- State becomes `(a, b, last_seen, last_meaningful_update)`.
- Expiry check runs on read: if `now - last_meaningful_update > Retention`, treat
  as absent and delete rather than decay. Lazy, consistent with D3, still no
  scheduler required for correctness.
- A sweeper becomes optional and purely about reclaiming storage, not about
  correctness — worth having for a persistent store, unnecessary in memory.
- Retention is policy, expressed as a multiple of `H` by default but
  independently configurable.
- This is the deletion mechanism D22 requires, so a manual per-entity delete is
  the same code path with the horizon forced to zero.

---

# Part III — Decision layer

How state becomes a treatment, and what limits SG’s autonomy in choosing one.

## D5 — Decision is a function of trust and uncertainty

**Decided.**

```
p = E[p]   = alpha / (alpha + beta)
U = Var[p]
D = pi(E[p], Var[p])
```

> Superseded in scope by D15: `pi` takes four dimensions, of which trust is one.
> The bands and the cap below describe how the trust dimension is read.
>
> Extended by D40: an epistemic stage over evidence mass precedes the bands, so a
> mean is not interpreted before enough evidence exists to interpret it. D40 also
> resolves D39.

### Default trust bands

```
p >= 0.80          -> trusted / observe
0.60 <= p < 0.80   -> observe / friction
0.40 <= p < 0.60   -> friction / challenge
0.20 <= p < 0.40   -> restrict
p < 0.20           -> deny / deceive
```

### Default uncertainty bands

```
U <= 0.02          -> low
0.02 < U <= 0.05   -> medium
U > 0.05           -> high
```

### Uncertainty caps escalation

| Uncertainty | Ceiling on autonomous treatment |
|---|---|
| Low | Full decision space |
| Medium | `CHALLENGE` / `INCREASE_FRICTION` |
| High | `INCREASE_FRICTION` |

> Unknown behavior must not be treated as malicious solely because of low
> confidence.

Higher uncertainty must reduce the maximum severity of autonomous treatment,
unless an independent hard constraint or explicit host policy requires
otherwise.

### The cap answers the D4 concern without changing the weights

D4 noted that a brand-new entity hit once by a strong negative reads
`E[p] = 0.25`, which lands in `restrict`. Its variance is `0.038`, which is
medium uncertainty, so the cap holds treatment at `CHALLENGE / INCREASE_FRICTION`
and `restrict` is never reached on one observation. No minimum-mass rule is
needed — variance already encodes "not enough evidence", so the mechanism that
was going to be added by hand is the one already in the model.

### Verified behavior

A fresh entity at `(0, 0)` reads `E[p] = 0.5`, `Var = 0.0833` — the
`friction/challenge` band, but high uncertainty, so it is capped at
`INCREASE_FRICTION`. An unknown entity therefore cannot be restricted or denied,
which is the intended reading of *unknown, not untrusted*.

Trajectory on a stream of weak positives:

| Observations | `E[p]` | `Var` | Uncertainty |
|---|---|---|---|
| 0 | 0.500 | 0.0833 | high |
| 3 | 0.714 | 0.0454 | medium |
| 6 | 0.800 | 0.0267 | medium |
| 10 | 0.857 | 0.0153 | low |
| 16 | 0.900 | 0.0082 | low |

Roughly 10 weak observations to unlock the full decision space, 3 to leave high
uncertainty. Deny requires both a low mean and low variance, which in practice
means sustained negative evidence — `(a=0, b=8)` gives `E[p] = 0.100` with
`Var = 0.0082`, low uncertainty, cap lifted.

### Note: the bands are wide enough that some are unreachable at the top

Worst-case variance inside each trust band:

| Band | Max `Var` | Uncertainty there |
|---|---|---|
| trusted | 0.027 | medium |
| observe / friction | 0.069 | high |
| friction / challenge | 0.083 | high |
| restrict | 0.056 | high |
| deny / deceive | 0.023 | medium |

So `deny` is only ever reachable with real accumulated negative mass, and the
`restrict` band is frequently capped down to friction. That is conservative by
construction, which matches the stated priority that false positives are the
central constraint. Recorded so it is not later mistaken for a bug.

### Vocabulary: `CHALLENGE` and `deceive` are not new rungs

**Decided (D33).** The bands name `CHALLENGE` and `deceive`, which are absent from
the five-rung spectrum in `src/decision.ts`. They are aliases, not additional
severity levels:

```
CHALLENGE  =  INCREASE_FRICTION
deceive    =  host-side variant of BLOCK   (tarpit, silent failure, decoy data)
```

Both describe *how a host executes* a treatment, not a new degree of severity.
This follows D14's own logic: severity and the manner of enforcement are separate
concerns, and SG names severity only. Growing to seven rungs would enlarge the
policy table without adding expressiveness.

The spectrum stays at five.

Locked as tests in `src/core/trust.test.ts`, not verified once and discarded —
these values are policy and will be revised, so a change has to surface as a
failing test rather than as silent drift.

### What this commits the code to

- Bands are policy tables, not inline comparisons — they have to be replaceable
  without touching decision logic.
- Two-stage evaluation: pick a band from `p`, then clamp by the ceiling from `U`.
  The clamp is a `min` against the spectrum ordering, which `severity()` already
  supports.
- A hard constraint bypasses the clamp; explicit host policy may too. Both are
  parameters, not exceptions buried in code.

## D37 — Saturation guard belongs in the decision layer, not the trust model

**Decided. The mitigation claim below is withdrawn by D49** — traffic showed the gate
cannot affect a farmed entity, because farming produces a high mean and a ceiling can
only lower a decision. The reasoning about *where* the fix belongs is left standing;
the conclusion that farming is therefore mitigated is not.

D4 recorded a gap as a passing note: an entity interacting at high frequency
converges on a large mass ceiling, drives `Var[p]` low, and unlocks the full
decision space under D5 — while becoming nearly immovable by negative evidence.
A patient attacker can farm exactly that state.

### Why the fix does not go in the trust model

Clamping mass in D4 would invalidate D4's own finding that mass is self-limiting
and needs no artificial clamp. The mathematics is internally consistent and not
what is wrong.

What is wrong is a premise sitting *underneath* the mathematics: that homogeneous
volume is evidence sufficient to reduce uncertainty. That premise holds for
legitimate traffic and fails for a patient attacker. So the formula does not
change — what changes is the condition under which its output may be trusted
completely.

### The fix

The D5 cap is currently a function of `Var[p]` alone, which is the trust
dimension talking to itself. D15 already established that

```
D = pi(Trust, Anomaly, HardConstraints, Context)
```

has four independent dimensions. Use them: **the uncertainty cap may lift only
when the Anomaly dimension concurs.** Concurrence is expressed as a diversity
signal — not how many interactions were observed, but how varied they were in
kind, timing, and pattern.

An entity farming thousands of uniform interactions fails the diversity condition
even though its `Var[p]` is mathematically small. A legitimate entity with varied
real usage passes it.

```
low Var[p]  AND  diverse behavior   ->  cap lifts
low Var[p]  AND  monotonous behavior ->  cap holds
```

### Why this is not a new mechanism

Diversity versus monotony is one of the features the anomaly feature space would
contain anyway, and D18 already fixed the order: feature space first, algorithm
later. So this adds no machinery — it connects two decisions that were standing
apart, and makes them check each other.

It is also consistent with the notes' own instruction that hard constraints and
weak signals must not be blended into one score: the dimensions stay separate and
one gates the other, rather than being averaged.

### Status and dependencies

- Blocking on D18 more strongly than previously recorded. Without a diversity
  feature the gap cannot be closed at all, so D18 is not merely deferred work.
- Raises the priority of D34. A farming pattern can only be validated against
  real traffic; a synthetic fixture would be built from the same assumption the
  guard is trying to test.
- Until D18 lands, the cap behaves as specified in D5. The gap is open and
  recorded, not silently mitigated.

### What this commits the code to

- The cap is computed from trust *and* anomaly, so its signature takes both
  dimensions from the outset even while the anomaly input is absent.
- Absent anomaly data, the conservative reading applies: no diversity evidence
  means no concurrence, so a fully lifted cap must be an explicit host policy
  choice rather than a silent default. Pending D18.

### As implemented

`assessTrust()` in `src/core/assess.ts` takes `anomalyConcurs`, which is
deliberately three-valued: `true` concurs, `false` denies, `undefined` means no
anomaly data exists — which is the project's current state and is not the same
claim as monotonous behavior.

With low variance and no concurrence, the ceiling holds at `INCREASE_FRICTION`
and the reason string says why. A host may set
`allowEscalationWithoutAnomaly: true` to opt out, but an explicit
`anomalyConcurs: false` still overrides that opt-in — a stated verdict outranks a
blanket permission. Both paths are covered by tests in `assess.test.ts`.

Worth recording: for a *trusted* entity, the D37 guard changes nothing, because
`ALLOW` already sits below every ceiling. The farming concern is entirely about
escalation, and a saturated entity was never being escalated — what farming buys
an attacker is protection against future escalation, not a treatment change now.

---

## D40 — An epistemic stage precedes trust and uncertainty

**Decided. Resolves D39.**

Trust expectation and uncertainty must not be interpreted without considering the
amount of accumulated evidence.

`Beta(1,1)` represents an **unknown** entity, not a neutral-trust entity.

> Lack of evidence is not negative evidence.

So decision evaluation gains an epistemic stage ahead of trust and uncertainty:

```
UNKNOWN      -> default to ALLOW / passive observation when no adverse signal exists
DEVELOPING   -> trust begins influencing treatment
ESTABLISHED  -> full trust/uncertainty decision model applies
```

Evidence mass:

```
n = alpha + beta
```

is the measure of whether the trust state holds enough evidence to influence
treatment.

Unknown entities may still receive friction or stronger treatment when independent
anomaly signals or hard-constraint violations justify it.

> Lack of evidence is not evidence of distrust.

### Why this resolves D39 correctly

D39 recorded three candidate fixes. This is the first of them, and it is the one
that addresses the cause rather than the symptom.

The defect was that `Var[p]` was carrying two different questions at once. For a
Beta distribution:

```
Var[p] = p(1-p) / (n+1)
```

so variance is a function of the mean *and* the mass. A fresh entity and a
long-observed entity with genuinely mixed evidence both read `E[p] = 0.5`, and the
uncertainty band alone cannot tell them apart in a way the decision layer can act
on. Separating mass out as its own stage makes the epistemic question explicit
instead of leaving it entangled in the variance.

Moving the band boundary — D39's second option — would have hidden the same
conflation behind a different threshold. Deferring to the host — the third — would
have exported a question the design has a clear position on.

### Thresholds

```
n < 3    unknown
3 <= n < 7   developing
n >= 7   established
```

Tied to the D5 trajectory rather than chosen freely: a fresh entity is `n = 2`
(prior only), `n = 3` is about where a second observation has landed, and `n = 7`
is about where low uncertainty becomes reachable at all. Policy, configurable.

Reachability was checked against the D3/D4 ceilings, since a stage that cannot be
reached would be decoration:

| Arrival interval | Ceiling `n`, weak only | Ceiling `n`, strong only |
|---|---|---|
| 1 hour | 19.6 | 72.3 |
| 6 hours | 5.1 | 14.6 |
| 24 hours | 3.0 | 6.0 |
| 48 hours | 2.7 | 4.7 |

An entity interacting once a day on weak evidence tops out at `developing` and
never reaches `established`. That is the intended reading: a daily visitor really
does not accumulate enough for the guard to act autonomously against them.

### What this commits the code to

- Three ceilings, and **the lowest binds**: epistemic stage, uncertainty, and
  anomaly concurrence. Each answers a different question, so none subsumes another.
- The `unknown` ceiling is `ALLOW`. Not a floor forcing `ALLOW` — it removes the
  trust dimension's standing to ask for anything, while `HardConstraints` and
  `Anomaly` still reach the decision layer on their own authority. Verified: a
  first-contact entity violating a declared invariant is still advised `RESTRICT`.
- Mass decays with everything else under D3, so an entity that goes quiet can
  fall back from `established` to `unknown`. Correct, and consistent with
  expiry (D6) rather than in tension with it.

### As implemented

`assessTrust(mean, variance, mass, options)` in `src/core/assess.ts`. A first
contact now reads:

```
ALLOW — unknown entity (n=2): lack of evidence is not evidence of distrust
```

Every assessment carries `mass` and `stage` alongside the mean and variance, so
the trace states which ceiling bound and why (D23).

---

## D39 — The cold-start band contradicted the zero-friction goal

**Resolved by D40.** Kept as the record of how the defect was found and which
alternatives were rejected.

**Originally: open, surfaced by implementation rather than by review.**

Composing D5 and D21 produces a result worth stating plainly, because it conflicts
with a stated product goal.

A first-time visitor has state `(0, 0)`, so `E[p] = 0.5`. Under D5 that is the
`friction / challenge` band. High uncertainty caps the treatment, but the cap
lowers to `INCREASE_FRICTION` — it does not lower to `ALLOW`. So the advice
returned for an ordinary new visitor is:

```
INCREASE_FRICTION
```

Trajectory on weak positives, as implemented:

| Observations | `E[p]` | Band | Advice |
|---|---|---|---|
| 0 | 0.500 | friction | `INCREASE_FRICTION` |
| 1 | 0.600 | observe | `OBSERVE` |
| 3 | 0.714 | observe | `OBSERVE` |
| 6 | 0.800 | trusted | `ALLOW` |

### Why this is a contradiction

The design states as a target that legitimate traffic experiences *nothing*, and
that a new entity is unknown rather than untrusted. Advising friction on first
contact is not nothing, and it treats every new visitor as suspect — which is the
behavior the premise set out to reject.

It also lands hardest on exactly the population the design cares about: a
legitimate first-time user, who has no history precisely because they are new.

### Why it is recorded rather than patched

Three fixes are available and they are not equivalent, so this is a decision, not
a bug to be quietly resolved:

1. **The uncertainty ceiling should floor at `ALLOW` or `OBSERVE` when there is no
   negative evidence at all.** Distinguishes "no evidence" from "balanced
   evidence" — both read `E[p] = 0.5`, but they are not the same epistemic state.
2. **The `friction` band should start below 0.5.** Makes the prior sit in
   `observe` rather than `friction`. A threshold change, and the least invasive.
3. **Treatment for `coldStart` is the host's call.** Consistent with SG being
   advisory, but pushes a decision the design has opinions about onto adopters.

Option 1 looks most consistent with the rest of the model: mass is already
separated from the prior in D3, so "has any evidence arrived at all" is a question
the state can answer directly, and `Var[p] = 1/12` exactly identifies the untouched
prior.

**Outcome:** option 1, as D40. The reasoning that settled it: `Var[p] = p(1-p)/(n+1)`
means variance already mixes the mean with the mass, so no threshold on variance
alone could separate *no evidence* from *balanced evidence*. Options 2 and 3 would
each have left that conflation in place.

---

## D46 — Two thresholds the traffic falsified

**Decided, from the D45 replay.**

Two numbers were wrong. Both were found by running traffic rather than by
argument, which is the whole point of D45 — and both were wrong in the direction
the design says matters most: they manufactured friction for legitimate users.

### The `developing` ceiling was one rung too high

D40 describes the middle stage as one where trust may *influence* the treatment
without *driving* it, and the code read that as `INCREASE_FRICTION`. Two personas
built from HealthMe's own honest usage were escalated by it:

| Persona | What it does | Was advised | Now |
|---|---|---|---|
| `fat-finger` | mistypes the PIN twice, then succeeds | `INCREASE_FRICTION` | `OBSERVE` |
| `password-manager` | autofill: populated field, zero keystrokes, correct PIN | `INCREASE_FRICTION` | `OBSERVE` |

The mistake was reading "influence" as "may cost the user a little". Friction is
the *first rung a legitimate user actually feels*; `OBSERVE` costs nothing and
still tells the host something, so it is the only rung that influences without
driving.

Worse, the old value made the `unknown` → `developing` boundary a cliff: at
`n = 2.9` the guard was silent, and at `n = 3` it could ask for friction. A single
additional observation should never be able to do that. `STAGE_CEILING.developing`
is now `OBSERVE`, and the absence of a cliff is asserted directly.

Note what this does *not* weaken. A hard violation still reaches the decision
layer on its own authority, so `fat-finger` being quiet does not make a forged API
call quiet — the replay confirms that unchanged.

### Scope entropy was normalised against the wrong denominator

`scopeEntropy` divided by `log2(count)`, the maximum entropy the *window size*
allows. That made the value depend on how many scopes the **application** has,
not on how varied the **entity** was:

```
same behavior, attention spread perfectly evenly
  in a 2-scope app  ->  0.23   (below the 0.35 threshold)
  in a 5-scope app  ->  0.54   (above it)
```

So a small application could not reach the diversity threshold at all, no matter
how its users behaved. HealthMe has two scopes, and its most honest persona —
fourteen days of daily use — was scored monotonous for the lifetime of the run.
The consequence was not friction, since D37 only withholds escalation, but it was
silent and wrong: the guard could never have escalated that entity later, however
it behaved.

Normalising against `log2(distinctScopes)` makes the feature mean *balance* rather
than breadth, which is what the diversity check already wanted from it — breadth
is `distinctScopes`'s own job, and pairing the two is what makes the conjunction
in `diversityConcurs()` meaningful instead of redundant.

After the change the daily user reads `diversity: true`, and the brute-forcers
still read `false` because a single scope now scores exactly `0`.

### What did not change

The thresholds in `DEFAULT_DIVERSITY` and the epistemic boundaries `3` and `7` are
untouched. The traffic gave no reason to move them, and moving a number because a
synthetic run suggested it would be exactly the overreach D45 warns against.

---

## D49 — D37 does not do what it claims

**Decided, from the D47 traffic. This corrects a claim, not a number.**

D37 records a fix for farming: a patient attacker interacts uniformly at high
volume, drives `Var[p]` down, unlocks the full decision space, and becomes hard to
move. The fix was to gate the uncertainty ceiling on the anomaly dimension
concurring that behavior was varied.

The IXFE personas made it possible to test that, and it does not hold.

### The gate cannot affect the entity it was written for

Farming produces a **high** mean. A high mean proposes `ALLOW` or `OBSERVE`. A
ceiling can only ever *lower* a decision. So for every farmed entity the gate is
unobservable — and this is not a threshold being slightly off, it is a structural
consequence of where the gate sits:

```
mean 0.99  monotonous -> ALLOW    diverse -> ALLOW     gate changed nothing
mean 0.85  monotonous -> ALLOW    diverse -> ALLOW     gate changed nothing
mean 0.70  monotonous -> OBSERVE  diverse -> OBSERVE   gate changed nothing
```

D37 half-noticed this. Its closing paragraph says the guard "changes nothing" for a
trusted entity, and that farming buys "protection against future escalation, not a
treatment change now". That is right, and it is the whole story rather than a
footnote: *the ceiling is not the mechanism that would deliver the protection
either*. What actually protects a farmed entity is accumulated positive mass
resisting negative evidence, which is D3 and D4 arithmetic and has nothing to do
with the anomaly dimension.

Measured: 300 uniform positive interactions, then strong negatives every 90s. It
takes **17** to leave `ALLOW`, and 60 to reach friction. That is farming working
exactly as feared, with the D37 gate in place and irrelevant to it.

### Where the gate *is* observable, it inverts

The gate only ever changes an outcome for `mean < 0.4` — an entity the model already
distrusts — and there it withholds escalation *because* behavior was monotonous:

```
mean 0.10  monotonous -> INCREASE_FRICTION   diverse -> BLOCK
mean 0.30  monotonous -> INCREASE_FRICTION   diverse -> RESTRICT
```

Read plainly: behaving mechanically earns a milder treatment than behaving variedly.
For a deliberate bot that is backwards. The IXFE `credit-drainer` sits exactly here —
authorised, machine-paced, spending real money on Google Places calls — and stops at
`INCREASE_FRICTION` when varied behavior at the same mean would reach `RESTRICT`.

### Why the behavior is left alone anyway

An attempt was made to make the gate directional — engage only when `mean >= 0.5`,
the farming side. It type-checks, it is arguably more honest, and it changes
**nothing observable at all**, because that region proposes `ALLOW` or `OBSERVE`
already. It was reverted: a rule with no effect is worse than no rule, since the next
reader has to work out that it does nothing.

More importantly, the same inversion that hurts the drainer *helps* the case the
design says matters most. A broken-but-legitimate client — a cron with a stale token,
retrying uniformly, failing every time — reaches `mean 0.003` with low variance, and
the gate is what keeps it at `INCREASE_FRICTION` instead of `BLOCK`. False positives
are the central constraint, and that is a false positive avoided.

So one rule produces both effects, and which dominates is a question about real
populations rather than about the mathematics. Changing it now would be picking a
side from synthetic traffic, which is what D45 explicitly forbids.

### What this commits to

- The claim in D37 that farming is mitigated is **withdrawn**. Farming is an open
  problem again, listed as such.
- Both halves are asserted in `assess.test.ts` so the withdrawn claim cannot drift
  back into the documentation: one test fixes that the gate cannot affect a
  positive-dominant entity, another fixes that monotony earns the milder treatment
  where it can.
- The real fix, whatever it is, has to act on **mass** rather than on the ceiling —
  which is what D4 argued against and D37 accepted. That tension is now on the table
  with evidence, instead of settled by assumption.

---

# Part IV — Hard constraints

Provable invariant violations: how they are declared, and why they stay outside the probabilistic model.

## D13 — Hard constraints are violated invariants, in five classes

**Decided.**

Hard constraints represent violations of deterministic, externally defined
invariants. They are **not** intended to be an exhaustive list of behavioral
anomalies.

Initial PoC constraint classes:

```
Impossible Segment Jump
Impossible Idle Action
Impossible Temporal Order
Impossible State Transition
Impossible Action Prerequisite
```

**Superseded in part by D41**, which closes this enumeration at seven classes by
deriving it from what a host can prove rather than from what an attack looks like.
The reframing below is what made that possible and still holds.

A hard constraint must be **provable** from the available observation and the
application's declared invariants.

### This reframes what was asked

The earlier question asked for an exhaustive list, on the assumption that hard
constraints were a catalogue to be enumerated. They are not — they are classes of
invariant violation, and the specific invariants come from the host application
under D16. So the list does not need to be complete before code can be written;
the five classes need a representation, and each host supplies its own instances.

That removes what was recorded as the blocker on the PoC.

## D14 — "Hard" describes certainty, not severity

**Decided.**

Hard constraints are advisory, not inherently enforcing. A hard constraint
indicates that a violation is *provable*; it does not grant SG authority to
decide the final enforcement action.

> "Hard" describes the certainty of the violation, not the severity of the
> treatment.

This resolves the tension recorded earlier between "the guard never enforces" and
"hard constraints are provable, not inferred". Both hold: proof is about
epistemic status, enforcement is about authority, and the two were being
conflated.

### Consequence for D5

D5 says a hard constraint bypasses the uncertainty cap. That remains correct and
is now properly grounded: the cap exists because probabilistic evidence may be
wrong in a way that scales with variance, and a proven violation is not
probabilistic. The cap does not apply because it has nothing to protect against.

Bypassing the cap still does not mean escalating to `BLOCK`. The treatment
remains policy.

## D15 — Hard constraints stay outside the Beta model

**Decided.**

Hard constraint violations do not modify `alpha` or `beta`.

Decision is evaluated across independent dimensions:

```
D = pi(Trust, Anomaly, HardConstraints, Context)
```

A hard constraint may strongly influence the final decision or treatment
according to policy, while leaving the probabilistic trust state intact.

### Why this is the right separation

A proof does not become more or less true by being averaged with a probability.
Folding a violation into `beta` would convert certainty into evidence mass, and
then decay it under D3 — a proven violation would fade at a half-life, which is
incoherent. Keeping it separate means it neither decays nor dilutes.

It also keeps the design honest about the D4 saturation problem: an entity with
enormous accumulated mass is hard to move probabilistically, but a hard
constraint reaches the decision layer regardless of how much trust was banked.

### Correction to D5

D5 was recorded as `D = pi(E[p], Var[p])`, which is now the trust dimension only.
The full function is the four-dimensional one above. The trust bands and the
uncertainty cap still describe how the trust dimension is read; they are one
input among four.

## D16 — Invariants are declared, never learned

**Decided.**

Hard constraints must be declared or supplied by the host application, or derived
from an explicitly defined application model. SG must **not** infer impossibility
from historical frequency.

```
declared invariant   ->  violation is a hard constraint
learned rarity       ->  probabilistic evidence / anomaly
```

Formally, with `G = (V, T)` the application's valid state transition graph, an
observed transition `(vi, vj)` is a hard violation when:

```
(vi, vj) not in T
```

A transition that is merely statistically unlikely is not impossible.

> Scoped by D32: the closed-world reading above applies **within a scope the host
> declared as `hard`**, not to the whole application. Outside any declared scope,
> an unlisted transition is unknown rather than forbidden.

### What this commits the code to

- The host declares an application model — at minimum a transition graph `G`
  with an explicit allowed-edge set `T`.
- The check is set membership, not scoring. It has no threshold and no
  calibration, which is what makes it free of false positives *given a correct
  declaration*.
- An incomplete declaration produces false positives — a legitimate edge the host
  forgot to declare reads as provably impossible. So the declaration is safety
  critical, and the API must make partial declarations obviously partial rather
  than silently treating unlisted edges as forbidden. Settled in D32.
- Constraint classes need a shared result type carrying which class fired, which
  invariant, and what was observed — required for D23-style explainability, since
  a violation claim must be inspectable to be trustworthy.

---

## D32 — Declaring `hard` is itself a claim of completeness

**Decided.**

SG distinguishes declared invariants from inferred behavior.

- Only explicitly declared constraints may produce HARD violations.
- An incomplete declaration does **not** imply that undeclared transitions are
  impossible.
- Inferred or statistically unusual behavior is soft evidence or anomaly, never a
  hard constraint.

Epistemic strength is declared by the host, per constraint:

```
hard  ->  deterministic violation
soft  ->  probabilistic / anomalous evidence
```

### The contradiction this had to resolve

Read literally, the second bullet cancels D16. D16 states that `(vi, vj) not in T`
is a hard violation, which is a closed-world reading: unlisted means forbidden.
"Incomplete declarations do not imply undeclared transitions are impossible" is an
open-world reading. Taken together with no further qualification, D16's formula
would have no domain in which it applies at all.

### Resolution: `hard` declares a complete scope

Declaring a constraint `hard` is not only a claim that violations are
deterministic. It is also a claim of **completeness over the scope declared**:

> Within this scope I have declared every legitimate case, so anything else inside
> it is provably wrong.

Both readings then hold without conflict:

| Where | Reading | Consequence |
|---|---|---|
| Inside a scope declared `hard` | Closed world | `(vi, vj) not in T` is a hard violation. D16 stands. |
| Outside every declared scope | Open world | Unknown, not forbidden. Falls to the probabilistic path. |

This is written out because it is the load-bearing part and was otherwise
implicit.

### Why this is a better answer than a strict/permissive mode

The earlier recommendation was a global permissive default with strict as opt-in.
Per-constraint strength is stronger: a completeness claim is scoped to exactly the
region the host actually understands, instead of being a single switch over the
whole application. A host can be certain about payment-step ordering and
uncertain about navigation, and say so.

It also makes the claim of completeness something the host asserts **knowingly**.
D16 already recorded that the declaration is safety critical; this makes the
assertion visible. A false positive from a `hard` declaration with a missing edge
is then plainly the host's error, in a place the host explicitly signed for — not
a mystery surfacing from SG's defaults.

### Generalisation beyond the transition graph

Strength is per constraint, not per model, so all five classes in D13 are declared
with a strength rather than only the transition graph. `soft` gives a host that is
unsure of completeness a way to contribute a real invariant without claiming
certainty — they are not forced to choose between silence and overreach.

### As implemented

`src/core/constraints.ts` and `src/core/transitions.ts`.

`checkInvariants(observation, scope, invariants)` consults only invariants
declared for that scope and returns `{ declared, violations }`. The `declared`
flag is what distinguishes *nothing was wrong* from *nobody claimed anything
here* — collapsing those two would erase the open-world reading.

`transitionGraph()` requires `strength` explicitly rather than defaulting to
`hard`, so a completeness claim cannot be made by omission.

An invariant returns `holds: true` for observations it does not describe, so a
transition rule stays silent about, say, an idle-action observation instead of
failing it.

---

## D38 — A violated `soft` invariant is strong negative trust evidence

**Decided, extending D32.**

D32 introduced `soft` constraints without stating what a violation does to the
model. Two questions had to be answered together.

**Which weight?** `strong negative`, so mass `2.0` under D4.

A declared-but-soft invariant is not the same as an ordinary weak signal. The host
stated deliberately that this should not happen; that it is not *provable* does
not make it *faint*. Weak weight is for signals SG inferred on its own; a human
declaration carries more than that. The difference is four-fold, so it is recorded
rather than left to a call site.

**Which dimension?** `Trust`, as negative evidence — not `Anomaly`.

In `pi(Trust, Anomaly, HardConstraints, Context)`, the `Anomaly` dimension is
learned from observed behavior. A soft invariant is declared, so routing it
through `Anomaly` would mix a stated expectation into a measured baseline, and
would also let it participate in the D37 diversity check, which it has no business
influencing.

```
hard violation  ->  HardConstraints dimension, no trust mass          (D15)
soft violation  ->  Trust dimension, strong negative mass             (D38)
learned rarity  ->  Anomaly dimension                                 (D18)
```

### Consequences

- Unlike a hard violation, a soft violation **does** decay under D3. That is
  correct: it is evidence, and D3 exists so that evidence stops being a permanent
  sentence.
- It counts as a meaningful update for retention under D6, since it moves `b`.
- The weight is policy, configurable like every other weight in D4.

### As implemented

`softViolationMass(violations, weight?)` in `src/core/constraints.ts`, defaulting
to `DEFAULT_SOFT_VIOLATION_WEIGHT` in `policy.ts`. Hard violations contribute
zero mass by construction, which is asserted directly in `constraints.test.ts`.

---

## D41 — The constraint taxonomy is closed over proof sources, not attacks

**Decided, closing D13.**

D13 recorded five constraint classes and called them an initial set; the design
notes called the list "a starting set, not exhaustive". Both left the enumeration
open, and an open enumeration of *attack shapes* can never close — there is always
another way to misuse an application.

The taxonomy closes when the question changes. A host cannot declare an
impossibility it cannot prove, so the right question is not *what can go wrong*
but **what does a host already hold that makes a violation provable**. Those facts
are finite:

| Proof source | The host holds | Class |
|---|---|---|
| `reachability` | the flow graph it declared | `IMPOSSIBLE_SEGMENT_JUMP`, `IMPOSSIBLE_STATE_TRANSITION` |
| `precondition` | state required before an action is available | `IMPOSSIBLE_ACTION_PREREQUISITE` |
| `causality` | the input that must have produced an effect | `IMPOSSIBLE_IDLE_ACTION` |
| `order` | timestamps the system itself recorded | `IMPOSSIBLE_TEMPORAL_ORDER` |
| `issuance` | values the system itself handed out | `IMPOSSIBLE_UNISSUED_REFERENCE` |
| `exclusivity` | facts that cannot both be true | `IMPOSSIBLE_EXCLUSIVE_STATE` |

Anything not derivable from one of the six is **measurement, not proof**, and
belongs in the weak-signal catalogue of D42 instead. That is the closure argument:
the class list is finite because the proof sources are, and the boundary between
the two files is now a definition rather than a judgement call.

### The two classes this added

Both were missing rather than newly invented, and both come from the scraping
experience in the design notes.

- `IMPOSSIBLE_UNISSUED_REFERENCE` — a reference the system never issued. The notes
  describe *submitting a form without ever having loaded it, with no case ID known
  in advance*; D13's five classes could only express the ordering half of that, not
  the forged identifier itself.
- `IMPOSSIBLE_EXCLUSIVE_STATE` — two facts that cannot both hold. Distinct from a
  transition violation: nothing illegal was traversed, the claimed state is
  internally contradictory.

`IMPOSSIBLE_SEGMENT_JUMP` and `IMPOSSIBLE_STATE_TRANSITION` share `reachability`
and are kept separate anyway: they are the same proof at two declaration
granularities, and the class name is diagnostic for a host reading a trace even
though SG's advice does not depend on the distinction.

### Consequence: advice may be declared per class

D14 keeps treatment as policy, and a single `hardViolationDecision` implied SG had
a view on which impossibilities are worse. It has none — all seven are equally
*proven*, and what a given violation should cost is a property of the host's flow.

So `hardViolationDecision` accepts either one decision or a partial map keyed by
class, and unlisted classes fall back to `RESTRICT`. When several classes are
violated at once the strongest applies, which is the rule the decision layer
already uses.

### As implemented

`CONSTRAINT_CLASSES`, `PROOF_SOURCES` and `PROOF_SOURCE_OF` in
`src/core/constraints.ts`; `hardViolationDecision()` in `policy.ts`. The closure
argument is asserted rather than described: `constraints.test.ts` fails if a class
claims a proof source outside the six, or if a declared source has no class able to
express it.

---

# Part V — Anomaly model

Deliberately the least developed part of the design.

## D18 — Anomaly: feature space first, algorithm later

**Decided.**

The feature space is defined first. No ML algorithm is chosen for the PoC.

This is the right order: the candidate methods recorded in the notes (density
estimation, isolation forest, Gaussian mixture) all consume a feature vector, so
none of them can be evaluated before the vector exists. Defining features is also
independently useful — they are what symptom abstraction reduces.

Consequence for D6: whether an anomaly observation with no trust evidence counts
as a meaningful update stays open until the feature space lands.

## D36 — The anomaly feature space

**Decided.**

Per D18, features come before any algorithm. Every feature is derived from a
bounded window of recent observations, and an observation is reduced to the least
SG needs to measure shape:

```
ObservationTrace = { at: milliseconds, scope: string }
```

No payload, no identity, no request content — consistent with D19 and with the
principle that data stays where the decision happens.

### The features

| Feature | Reads |
|---|---|
| `count` | Observations in the window |
| `distinctScopes` | How many different things were touched |
| `scopeEntropy` | Shannon entropy over scope frequency, normalised to `[0,1]` |
| `interArrivalCv` | Standard deviation over mean of inter-arrival gaps |
| `meanGapMs` | Mean gap, `undefined` below two observations |
| `immediateRepeatRatio` | Fraction that repeated the preceding scope |

`interArrivalCv` is the load-bearing one, and it is the design notes' own
observation made numeric: *the tell is not the delay, it is the shape of the
randomness*. Checked against synthetic timing:

| Timing pattern | CV |
|---|---|
| Fixed 1000ms sleep | 0.00 |
| 1000ms with 5% jitter | 0.03 |
| Flat `uniform(1.2, 2.3)s` | 0.16 - 0.18 |
| Human bursts and pauses | 1.1 - 1.6 |

A flat uniform delay — the exact pattern named in the notes — sits an order of
magnitude below human traffic, because humans are bursty and `random.uniform` is
not. The threshold is set at `0.25`, between the two.

### Diversity verdict

`diversityConcurs()` returns the three-valued answer D37 needs. All conditions
must hold, not any:

```
count          >= 8
distinctScopes >= 2
scopeEntropy   >= 0.35
interArrivalCv >= 0.25
```

Below the observation minimum it returns `undefined` — too small to judge, which
is not the same claim as monotonous.

Verified: varied scopes with mechanical timing still fail. Varying *what* is
touched while keeping a machine's rhythm is the cheaper half to fake, so passing
on scope variety alone would have made the signal easy to defeat.

### Thresholds are guesses, and deliberately lenient

Every number here is unvalidated until D30. They lean permissive on purpose: a
wrong threshold withholds escalation rather than manufacturing a false positive,
which is the correct direction to be wrong in.

### What this commits the code to

- The window lives on `EntityState`, so one store round trip serves both
  dimensions, and a purge (D22) or expiry (D6) removes behavioral history with
  everything else instead of orphaning it. Asserted in `guard.test.ts`.
- The window is bounded (20 by default) and drops oldest first, so per-entity
  memory is constant.
- `evaluate()` computes diversity from the entity's own window; `anomalyConcurs`
  becomes an override for hosts holding a better signal, not the only source.

---

## D35 — An observation without evidence is not a meaningful update

**Decided.**

Deferred under D6 pending the feature space; D36 settles it.

An observation that contributes no trust evidence advances `lastSeen`, which
governs decay, and does **not** advance `lastMeaningfulUpdate`, which governs
retention. Appending to the behavioral window does not count as meaningful either.

### Why

If mere observation refreshed the retention horizon, an attacker could keep state
alive indefinitely with traffic carrying no evidence at all — which is precisely
what D6 set out to prevent by measuring from meaningful updates rather than
sighting. Behavioral features are derived data; they do not earn their own
retention.

The consequence is intended: an entity generating traffic that produces no
evidence for seven days is expired, and its behavioral window goes with it.

---

## D42 — The weak-signal catalogue, with no thresholds in it

**Decided, answering the second open item from the design notes.**

The notes ask for known weak signals to be enumerated "and how they combine into
an observe / restrict / block decision tier". The enumeration is now written down.
The second half of that request is **declined**, and the reason matters more than
the list.

### Weak signals do not map to a decision tier

Nothing in this catalogue reaches a decision. A weak signal becomes negative trust
mass, and that mass then passes through decay (D3), the epistemic stage (D40), the
uncertainty ceiling and the diversity check (D37) like any other evidence. Giving
signals their own tier mapping would create a second path to a treatment that
skips all four, which is exactly the blended score D13/D18 exist to avoid.

The design notes' own wording is the argument: weak signals "operate *around* the
hard constraints as reinforcement, not as standalone triggers". A tier mapping
would make them triggers.

### Cap: the whole catalogue is worth one weak observation

`signalMass()` sums the observed signals — summed rather than averaged, since a
second signal must not weaken the first — and caps the total at one weak
observation's mass (`0.5`).

The cap makes "never a standalone trigger" numeric rather than aspirational. With
the prior at `n = 2` and `developingAt` at `3` (D40), an interaction tripping
*every* signal in the catalogue still leaves the entity in the `unknown` stage,
where the trust dimension asks for nothing at all. Escalation therefore requires
accumulation across interactions — which is the "meaningful in combination" the
notes ask for, read as combination over time rather than within one
well-instrumented request.

It also keeps a growing catalogue from becoming quietly more punitive per
interaction than it was when these numbers were reasoned about.

### No thresholds in the catalogue

Every entry names *what is measured* and never *when it fires*: "gaps too evenly
distributed", not "CV below 0.25". Design notes §7 is explicit — the library is
open source, so publishing `flag if interval < 220ms` hands an attacker the exact
number to route around. Where a threshold is unavoidable it lives in
`DEFAULT_DIVERSITY` (D36) as policy an adopter is expected to change, not as a
published constant of the signal.

`signals.test.ts` enforces this: a `measures` string containing a number with a
unit fails the suite.

### Bounded the same way D41 is

Signals are enumerated over what SG can *observe* — `timing`, `repetition`,
`interaction`, `sequence`, `target`, `environment` — the dual of D41's proof
sources. A signal SG cannot observe is not a signal it can carry, and the test
suite fails if a declared source has no signal under it.

Every entry also carries an `innocentCause`: the plausible legitimate path to
triggering it. That is not documentation courtesy. False positives are the central
constraint (design notes §6), and a signal whose innocent cause cannot be written
down is not understood well enough to weigh.

Three entries are marked `computed` — the ones D36 already derives. The rest
describe what a host must supply, and exist so that "known weak signals" is a
written list rather than folklore.

### As implemented

`src/core/signals.ts`, exported from the package surface, plus
`observation.signals` on `guard.evaluate()`. Ids the catalogue does not know are
ignored rather than guessed at, so a host cannot widen SG's vocabulary by inventing
tokens.

---

# Part VI — Architecture and API

Package shape, storage, time, and the surface a developer actually calls.

## D7 — One package, multiple entry points

**Decided.**

One package with multiple entry points. The browser collector and the backend
core share the same SG model.

Rationale carried forward: the model must not fork. If the collector shipped its
own copy of the trust or decision logic, the two would drift and a symptom
observed in the browser would not mean the same thing on the server.

### What this commits the code to

```
src/core/      the model: trust, decay, decision, symptoms   (no platform APIs)
src/collect/   browser-side observation                       (DOM, pointer events)
src/server/    host-side evaluation and storage
src/index.ts   core surface
```

- `exports` gains subpaths: `.`, `./collect`, `./server`.
- `src/core/` must not import anything platform-specific. That is the rule that
  keeps one model usable from both sides.
- A single `package.json` and one version number, so collector and core cannot
  be installed at mismatched versions.

## D8 — Pluggable `StateStore`, in-memory default, async

**Decided.**

```
StateStore   pluggable interface
default      in-memory
mode         async
```

### What this commits the code to

- The interface stays small — read, write, delete for one entity key. D1 made the
  key an opaque string, so no query surface is needed.
- Async from the start, which suits the lazy decay of D3 and the lazy expiry of
  D6: both are computed on read, so the read path is where the work happens
  either way.
- The in-memory default is a real implementation, not a stub, and doubles as the
  reference for anyone writing a Redis or SQL store.
- Per-entity delete from D22 lives on this interface.

Note: still contingent on D31. If `Relationship : E x E -> R` requires a graph,
key-value is not enough and this decision reopens.

### The contract ships as runnable checks, not as prose

`checkStoreConformance()` in `src/core/conformance.ts`. Eleven assertions any
implementation must satisfy, framework-free so they run under `node:test`, in a
browser, or from a bare script.

The reasoning: a store that is subtly wrong produces a guard that is subtly wrong,
silently, in production. Three of the checks exist because the mistakes are
plausible rather than hypothetical:

- **Millisecond precision.** A second-resolution timestamp column is an ordinary
  schema choice and it corrupts both decay (D3) and retention (D6) invisibly.
- **The observation window.** Persisting only the scalar columns is an easy
  omission that disables the entire anomaly dimension (D36) with no error.
- **Opaque keys.** Trimming or lower-casing a key looks harmless and silently
  merges two distinct entities, which D1 forbids.

Each is covered by a deliberately broken store in `conformance.test.ts`, so the kit
is shown to catch the failure rather than merely to describe it.

### It caught the reference implementation

`memoryStore()` failed its own contract on first run: it returned the live stored
object, so a caller could mutate trust state without going through `set`, making
every write path a lie about what is held. Now frozen on write.

That is the argument for shipping the kit — the reference store had the defect, and
prose describing the contract would not have found it.

---

## D44 — A durable store ships, on `node:sqlite`

**Decided, extending D8.**

D8 shipped an interface and one in-memory implementation, and called the missing
durable store an upgrade path. That left a claim overstated: D20 says a serverless
guard is fully functional, which was true of the decision path and false of its
memory. A process-local store means every restart is a cold start, so an entity's
accumulated trust is discarded without anything reporting it — the failure is
silent, which is the worst shape for it to have.

`sqliteStore()` ships as the durable counterpart, at the `./sqlite` entry point.

### Why SQLite rather than Redis

`node:sqlite` is in the standard library, so durability costs an adopter no
dependency and no infrastructure. A Redis store would need both, and would still be
written against the same three methods — so it remains an adopter's choice rather
than a gap in the library.

The limit is stated rather than papered over: SQLite is one file on one filesystem,
so this covers restart durability and multi-process sharing on a single host. A
multi-host deployment still needs a networked store, and the interface is the same
one.

### It stays out of `src/core/`

Separate entry point, not part of the core, because D12 keeps `src/core/` free of
platform APIs — the same model has to run in a browser. `memoryStore()` remains the
default for the same reason: it needs no filesystem and runs anywhere the core does.

### State is one JSON column

Not normalised into typed columns. The observation window (D36) is a
variable-length array, the trust fields are floats whose exact values matter, and
D1 makes the entity key opaque — so there is nothing to query by, and normalising
would buy queryability nothing needs while adding two ways to lose precision.

Sweeping filters through `isExpired()` rather than through a `WHERE` clause on the
retention boundary. Duplicating that boundary in SQL is how two stores start
disagreeing about when state dies; the timestamp column narrows the candidate set,
and the shared function decides.

### As implemented

`src/store/sqlite.ts`, exported as `./sqlite`. It passes the same
`checkStoreConformance()` kit as the in-memory store — the kit's purpose, finally
exercised by a second implementation — and `sqlite.test.ts` asserts that trust
survives closing and reopening the file, which is the one thing the memory store
provably cannot do. The table name is validated before interpolation, since
`node:sqlite` binds values but not identifiers.

## D9 — `guard.evaluate({ entity, observation, context })`

**Decided.**

The primary API is:

```
guard.evaluate({ entity, observation, context })
```

Middleware is an adapter over the core API, never the other way around.

This maps directly onto D1: `entity` is the reference, `observation` is the
interaction `i_t`, and `context` is `C` in `T = PI(A, C)`. The signature is the
formal model with the names filled in.

### What this commits the code to

- One options object, not positional arguments — the three parts are named the
  same as the model, so the API teaches the model.
- `context` carries endpoint sensitivity, per D2, since it is not part of the
  state key.
- Return value must expose both the treatment and the reasoning behind it
  (`trust`, `uncertainty`, which band, whether a cap applied). Shape not settled;
  see question 23 on explain mode.
- Adapters live outside the core and depend on it in one direction only.

## D10 — All public evaluation and storage APIs are async

**Decided.**

Follows from D8. `evaluate()` returns a promise, and so does every store method.

## D11 — Time is injected through a `Clock` interface

**Decided.**

```
Clock       injected interface
default     Date.now()
```

Required by D3 and D6, both of which are functions of real elapsed time. With an
injected clock, half-life decay and the 7-day retention horizon are testable
deterministically instead of by waiting.

## D12 — Core is framework-agnostic

**Decided.**

No backend framework is required for the PoC. Express may be the first adapter
once the core is stable.

Consistent with D9: middleware is an adapter, so no framework type may appear in
core signatures.

## D20 — A serverless guard is fully functional

**Decided.**

Full functionality without a server. The server is not a dependency.

With D17, the PoC has no network surface at all.

---

# Part VII — Protocol and privacy

What may leave the local instance, and what must never be required to.

## D17 — No API key in the local core

**Decided.**

Not required by the local core. Reserved for future remote services and
prescription fetching.

Corrects the README, which currently says the library is "accessed via an API
key" — accurate for the eventual prescription client, wrong for the PoC.

## D19 — Symptoms are local-first, never per request

**Decided.**

Local-first. Not transmitted per request. Future remote telemetry is async and
batched.

Batching is also a privacy property, not only an efficiency one: per-request
transmission leaks timing and volume through the shape of the traffic even when
payloads are abstract.

---

## D43 — The symptom vocabulary is two tiers, split by rate of change

**Decided, closing the vocabulary item the design notes flagged as the reason for
the whole discussion.**

The notes state the constraint precisely: library and server are **frozen relative
to each other**. A deployed instance speaks the vocabulary it shipped with and
cannot negotiate with a server that has moved on. A flat list therefore makes every
addition a breaking change for every instance already in the field, and waiting to
know all the symptoms before publishing any is the same deadlock in a different
shape.

The vocabulary is split by **rate of change**, which is the only axis that
dissolves it:

- **Category** — a small set of principle-level classes, expected never to grow. A
  server that understands only categories understands every message any version
  will ever send.
- **Detail** — the specific pattern within a category, free to grow release to
  release. An unrecognised detail **degrades to its category** rather than failing.

### The category tier claims exhaustiveness, and earns it

Six categories: `SYM_TIMING`, `SYM_REPETITION`, `SYM_INTERACTION`, `SYM_SEQUENCE`,
`SYM_TARGET`, `SYM_CONSTRAINT`.

These are not chosen by taste. The first five are the observable dimensions
enumerated in D42; the sixth carries proven violations, kept separate so a receiver
never has to infer certainty from a token's name — the same hard/weak split D13 and
D18 draw locally, preserved on the wire.

So the tier is exhaustive for the same reason D41's taxonomy is: it enumerates over
what the guard can know, not over what an attacker might do.

### The category travels with the detail

A report carries both. Deriving the category from the detail would defeat the
entire split — a receiver too old to recognise a detail cannot look up what it does
not have. `readSymptom()` accepts an unknown detail and falls back to the stated
category; an unknown *category* is rejected, because nothing remains to fall back
to.

### `SYM_UNKNOWN_PATTERN` is demoted

It was a peer of the others in the flat v1 list. It is not a principle-level class
— being unable to name something is an admission, and making it a category would
freeze "we don't know" into the stable tier permanently. Inability to name a
pattern is expressed as a category with no recognised detail, which is what an
unrecognised detail already degrades to.

### Symptoms stay shapes, never values

`SYM_REQUEST_BURST` says volume arrived compressed in time. It carries no count, no
interval, no endpoint. That is the privacy claim of the whole symptom model — the
server learns that a shape recurred, not what produced it — and it is asserted:
`symptoms.test.ts` fails if any token contains a digit.

### Still not exported, and still not final

The vocabulary remains internal. D17 removed the API key and D20 makes a serverless
guard fully functional, so nothing transmits; an exported vocabulary with no
transmitter invites use it has no semantics for. What is settled here is the
**structure** — the wire format and the final detail list are owed to
`scorpio-guard-protocol`, which now has a shape to specify rather than a blank
page.

### As implemented

`src/core/symptoms.ts`: `SYMPTOM_CATEGORIES`, `SYMPTOM_DETAILS`, `reportSymptom()`,
`readSymptom()`. `SYMPTOM_SCHEMA_VERSION` now versions the detail tier only — a
change to the category tier would be a new major and a new document, not a bump.

## D21 — Cold start, restated

**Decided, consistent with the earlier D21 entry above.**

```
new entity        -> Beta(1,1)
identity churn    -> open problem, unresolved
root of trust     -> outside SG
```

SG does not solve root of trust. Stated as an open problem rather than an implied
guarantee.

## D22 — Purge primitive from the start; consent belongs to the host

**Decided.**

A deletion and purge primitive is available from the beginning. Consent remains
the host application's responsibility.

Consistent with D6: expiry and manual purge are one code path with the retention
horizon forced to zero.

## D23 — Decision trace is mandatory

**Decided.**

A decision trace and explanation must be available. Not a debug flag bolted on
later.

### What this commits the code to

- `evaluate()` returns the treatment together with its derivation: the trust band
  and the values behind it, the uncertainty band, whether the cap applied and
  what it capped, which hard constraints fired and against which declared
  invariant, and the anomaly contribution once D18 lands.
- The trace is the honest counterweight to the four-dimensional `pi` of D15: with
  independent dimensions feeding one treatment, an unexplained output cannot be
  debugged by the adopter.
- It also addresses the open-core risk recorded in the site copy — "blurred
  debugging responsibility" — by making it visible whether a decision came from
  local computation or from a prescription.

## D31 — `Relationship : E x E -> R` is deferred out of the PoC

**Decided: deferred.**

The signature appeared in D1 without semantics. Rather than guess at one, it is
withheld from the formal model and excluded from the proof of concept.

### Why deferral is the right answer rather than a definition

Three readings are plausible — behavioral correlation, shared origin, coordination
graph — and they are not variations on one feature. They differ in what SG would
have to store, and one of them breaks a decision already made:

| Reading | Storage consequence |
|---|---|
| Behavioral correlation | Comparable feature vectors, per entity. D36 already produces these. |
| Shared origin | Requires an attribute SG deliberately does not hold, per D1. |
| Coordination graph | Edges between entities. Key-value is insufficient; D8 reopens. |

The shared-origin reading is the most interesting one, and it is the one SG
structurally cannot support: D1 makes the reference opaque, so SG has nothing from
which to infer that two references share anything.

Defining this now would therefore either pick the cheap reading by default, or
quietly widen the storage contract to admit a graph. Both are worse than saying
not yet.

### Noted for when it returns

The coordination reading is where the value likely sits — it is the natural answer
to sybil churn, which D21 records as unresolved. It is also where the privacy cost
is highest, since relating entities to one another is exactly the profiling D19
and the non-goals rule out. That tension is the real decision, and it deserves to
be made deliberately rather than absorbed into a signature.

---

---

# Part VIII — Project and tooling

Licence, packaging, toolchain, and where the proof of concept has to run.

## D24 — Licence: MIT

**Decided.** Matches the current `package.json`. A `LICENSE` file is still
missing and needs adding.

## D25 — npm: `@fachryxyf/scorpio-guard`

**Decided.** Scoped. Publish after the PoC API is stable, so `private: true`
stays in `package.json` until then.

### Installable before it is published

`private: true` blocks `npm publish`, not `npm install github:...`. So the package
carries its real scoped name from the start, and a `prepare` script runs the same
`tsc -p tsconfig.build.json` as `build`.

The reasoning: `files` ships `dist` only, and `dist` is git-ignored, so a git
install without a build hook resolves `exports` to files that do not exist. An
adopter would see a module-not-found error and no explanation. `prepare` runs on
install from git and before publish, and is skipped for a consumer installing from
the registry later — one line covers both eras.

Naming it scoped now rather than at publish time means the import path in every
example, the README, and the site is the path that will keep working, instead of a
bare `scorpio-guard` that silently becomes wrong on the day it is published.

## D26 — Node floor: `>=22.6`

**Decided.** Keeps tests running TypeScript directly with no build step and no
extra dependency.

## D27 — CI now: typecheck and test

**Decided.** One GitHub Actions workflow.

## D28 — Site stays where it is

**Decided.** `index.html` and `404.html` remain at the repository root. Migration
to `docs/` later if needed.

## D28.1 — The site indexes the record; it does not restate it

**Decided.** `index.html` carries a glossary and a decision index. Neither
duplicates the reasoning here: the glossary defines terms used in a narrower sense
than ordinary English, and the index maps each entry to the file it turned into.

The reasoning: forty-odd entries is past what anyone reads front to back, and the
alternative to an index is prose repeated in two places that drift apart. The
failure mode is already visible in this repository's own history — the site claimed
no proof-of-concept code existed for several commits after it did.

So the site links into the record by anchor rather than paraphrasing it, and the
index lists the file each decision produced, which is the part the record does not
say and cannot stay current about on its own.

Sidebar filtering is substring matching over link text already in the DOM. Both
languages are present, so a query in either finds the section. No search index,
because there is one page.

## D29 — No empty repositories

**Decided.** `scorpio-guard-protocol` and `scorpio-guard-server` are not created
until they have real content and lifecycle. `REPOSITORIES.md` holds the plan
meanwhile.

## D34 — PoC target: HealthMe, with its limits stated

**Decided, and narrowed after the first replay.**

The proof of concept runs against **HealthMe** (`myhealth`), an existing personal
health PWA, before any greenfield fixture.

> **What this target can and cannot settle.** HealthMe validates that the library
> works against a real flow, and it did find a real defect. Its *production*
> traffic — one user — cannot validate the thesis: there is no sustained abuse for
> asymmetric cost to act against. Recorded here rather than discovered later by an
> adopter — see *What the replay could not reach* below.
>
> **Narrowed again by D45.** "One user" is a fact about the traffic, not about the
> flow. The flow is declared and drivable, so the statistical layer is now exercised
> by generated personas against these same invariants. That falsifies thresholds
> (D46 records two) but still cannot calibrate them, so what follows stays true of
> calibration and no longer true of *exercising the model at all*.
>
> **Superseded as the primary target by D47.** The deeper problem was never volume:
> nothing behind a personal PIN screen is worth an attacker's time, so the adversary
> had to be invented. IXFE has paid compute behind a public endpoint. HealthMe is kept
> as the small-application regression — two scopes, one user — which is the case that
> caught the D46 entropy bug.

### Why it fits the D30 requirements

D30 asked for stateful, authenticated-and-unauthenticated, security-sensitive
flows. HealthMe has all three, and did not have them added for this purpose:

| Requirement | In HealthMe |
|---|---|
| Stateful | A PIN-gated vault; core logic is not even fetched until unlock succeeds |
| Auth boundary | Locked and unlocked are genuinely different application states |
| Security-sensitive | Health data, plus a paid AI endpoint behind the same origin |
| Real abuse surface | `api/chat.js` already carries hand-rolled defences |

That last row is what makes it the right target rather than merely an available
one. The existing protections are exactly the pattern SG argues against, written
before SG existed:

- 3-strike lockout with a 5-minute penalty, stored in `localStorage` — client
  state an attacker controls, and a hard binary with no notion of how much
  evidence there was.
- IP rate limiting at 10 requests/hour in a `Map` that resets whenever the lambda
  cold-starts, so the limit is porous by accident.
- Origin allowlisting, which stops cURL and nothing that runs in a browser.

So the comparison is not against a strawman. It is against what a competent
developer actually ships under time pressure, which is the population SG is for.

### The invariants it supplies for D16

Declarable with confidence, and therefore `hard`:

- Unlock attempted with no prior lock screen render — an impossible segment jump.
- Vault content requested while the state is locked — an impossible action
  prerequisite.
- `api/chat.js` called before any unlock in that session — impossible temporal
  order.
- A form field populated with no corresponding interaction — the impossible idle
  action already named in the design notes.

Scoped narrowly on purpose, per D32: the unlock flow is small enough to enumerate
completely, which is what a `hard` declaration asserts. Navigation inside the
unlocked app is not, so it stays `soft` or undeclared.

### What it cannot validate

Stated plainly, because the temptation is to overclaim:

- **Single-user traffic.** It cannot show that thresholds hold across a population,
  and cannot validate D37 farming against a real adversary. It can show that a
  legitimate user is never given friction, which is the claim most at risk.
- **No server component.** Consistent with D20, and it leaves the protocol
  untested — correctly, since D29 says those repositories do not exist yet.
- **Thresholds stay provisional.** One application's rhythm is not a calibration
  set. Every number in D36 remains a guess afterwards, just a less blind one.

### Sequencing

Integration is observational first: run SG alongside the existing lockout, record
what it would have advised, change no behavior. The existing defences are what SG
is being compared against, so removing them before there is evidence would destroy
the comparison and the app's protection at once.

### First replay: what it found

`examples/healthme/` declares the invariants and replays the real flow. Two
disagreements, which is what the exercise was for:

| Scenario | HealthMe does | Guard advises |
|---|---|---|
| Normal daily unlock, one week | allows | `ALLOW` / `OBSERVE`, never friction |
| Three mistyped PINs | 5-minute lockout | `OBSERVE`, stage `developing` |
| `POST /api/chat` with no session unlock | **allows** | `RESTRICT`, hard violation |
| Session restore from `sessionStorage` | allows | `ALLOW`, not read as replay |
| 20 scripted attempts | rejects, counter resets on cold start | `INCREASE_FRICTION`, `established` |

The forged API call is the substantive finding: it satisfies HealthMe's origin
check and its IP limit, while `apiRequiresUnlock` sees that `js/core.js` — the
only caller — could not have been loaded. The three-mistyped-PIN row is the
converse: a 3-strike rule charges a real user five minutes where `n = 3.5` reads
as *developing*, which is not enough evidence to act on.

Confirmed on the claim most at risk: across a week of normal daily unlocks, no
observation was advised friction or worse.

### Scope choices worth recording

`attemptRequiresInteraction` is declared **soft**, not hard, despite the design
notes listing "form field filled with zero interaction" as a hard constraint.
Assistive technology, password managers and paste all produce a populated field
with few or no interaction events. Under D32 a `hard` declaration asserts
completeness, and that is a claim this scope cannot honestly make — so it
contributes evidence instead of proof.

Navigation inside the unlocked app is not declared at all. It is too large to
enumerate honestly, and D32 makes silence the correct answer there rather than a
guess.

### What the replay could not reach

The honest accounting, since the replay result reads better than it is:

- **The finding came from the least novel layer.** `apiRequiresUnlock` is set
  membership — one `if` statement, and any competent developer would write it
  unaided. It is a good demonstration that declared invariants are worth having,
  and no evidence at all for the probabilistic model.
- **The novel parts were never exercised.** Beta trust (D2a), half-life decay
  (D3), the epistemic stage (D40) and the diversity signal (D36) all describe
  behavior over populations and over time. One user generating a handful of
  unlocks per day cannot move any of them into a regime where they matter.
- **No threshold is calibrated.** `H = 24h`, the weights, the stage boundaries and
  the diversity thresholds are exactly as unvalidated as before.
- **D37 is untestable here.** Farming requires a patient adversary. There is none,
  and a synthetic one would be built from the same assumption the guard is trying
  to test.

What it *did* establish, and this is not nothing: the API is usable against a real
flow rather than a fixture shaped to fit it, the zero-friction claim survived a
week of normal use, and a genuine authorization defect surfaced that is worth
fixing regardless of SG.

**Three of those four are now reached, by D45.** Generated personas drive Beta
trust to `established`, exercise decay across fourteen simulated days, move the
epistemic stage through all three values, and put the diversity signal on both
sides of its threshold — including the farming pattern D37 exists for, which turns
out to be testable synthetically after all: the objection above was that a
synthetic adversary shares the guard's assumptions, and that is true of *whether
farming is realistic* but not of *whether the mechanism engages when it happens*.
The fourth is unchanged: nothing here calibrates a threshold.

### What a thesis-validating target needs

Unauthenticated public traffic, data worth scraping, a public search or lookup
endpoint whose legitimate order can be declared, and ideally a history of real
automation against it. That profile matches the author's own scraping experience
recorded in the design notes — *submitting a form without ever having loaded it,
with no case ID known in advance* — which is a public lookup system, not a
PIN-gated personal app.

Candidate under consideration: **Pusaka** (`github.com/Fachryxyf/pusaka`), a public
catalogue of Indonesian data APIs. It has unauthenticated traffic, a public search
over 215,373 school records, and a declarable endpoint-selection rule. Its own
`SPEC.md` already states the obligation — *don't hammer other people's APIs on
every render* — which reframes the guard usefully: the party needing protection is
the **upstream API**, not the site.

Blocked on an architectural fact rather than on effort: Pusaka is `output:
'export'` on GitHub Pages, so a guard there runs client-side only and is removable
by an attacker. Its `SPEC.md` §10 designs a server-side proxy but records it as
closed. Whether to open it is a decision about Pusaka, not about SG.

---

## D30 — PoC must run against a real application flow

**Decided.**

The PoC must use a real application flow. The initial target should be an
application with stateful, authenticated and unauthenticated, and
security-sensitive flows.

Follows necessarily from D16: invariants are declared from an actual application
model, so a synthetic fixture would only prove the code runs, not that the
declared invariants hold against real traffic.

### Settled

The target is HealthMe. See D34 for why it satisfies these requirements, which
invariants it supplies, and what it explicitly cannot validate.

---

## D45 — Generate the traffic; do not wait for it

**Decided, resolving the sequencing deadlock in D34.**

D34 concluded that HealthMe cannot validate the thesis because it has one user, and
the roadmap therefore waited on finding a target with adversarial traffic. That
conclusion conflated two things: HealthMe's **production traffic** is one user, but
HealthMe's **flow** is real, declared, and drivable by as many kinds of visitor as
anyone cares to write.

Waiting was also self-defeating. The thresholds cannot be argued about without
traffic, no traffic was arriving, and every number stayed a guess indefinitely. So
the traffic is generated: seeded personas driven through the same invariants the
real application supplied, in `examples/healthme/personas.ts`.

### What this can and cannot establish

It **can falsify**, which is the point. If a persona built from HealthMe's own
honest usage gets escalated, a threshold is wrong — and that finding does not
depend on where the traffic came from. Same in reverse for an adversary that walks
through untouched. D46 records two numbers this immediately falsified.

It **cannot calibrate**. Real populations are not drawn from these distributions,
and an attacker who reads the file can shape traffic around it. Numbers derived
here are hypotheses to test against a real population, never conclusions. The
distinction is the same one D34 draws, applied honestly rather than used as a
reason to do nothing.

### The personas, and why each exists

Legitimate — escalating any of these is a false positive, the central constraint:

| Persona | Why it is here |
|---|---|
| `daily-ritual` | fourteen days of the actual HealthMe usage pattern |
| `fat-finger` | mistypes the PIN twice; HealthMe's 3-strike rule punishes this |
| `password-manager` | produces the impossible-idle-action *shape* innocently, which is why that invariant is declared `soft` |
| `session-restore` | HealthMe's own `sessionStorage` unlock, repeated |
| `power-user` | heavy honest use, past HealthMe's 10/hour IP limit |

Adversaries — walking through untouched is the finding:

| Persona | Why it is here |
|---|---|
| `forged-api-call` | the real defect D34 found: HealthMe allows it |
| `scripted-brute-force` | fixed sleep, clearing `localStorage` to reset the lockout |
| `jittered-brute-force` | the same with `uniform(1.2s, 2.3s)` — the exact distribution the design notes name as the tell |
| `slow-poisoner` | earns trust for ten days, then drains the paid endpoint |
| `churningBruteForce` | a fresh identity every few attempts |

### Two findings that are measurements, not fixes

**Jitter buys nothing.** The fixed-sleep and uniform-jitter brute forces escalate
at the same step. The notes' claim that the tell is the shape of the randomness
rather than the delay survives contact with its own counterexample.

**Churn works, and the floor is two requests.** With three attempts per identity,
every identity is felt. With **one** attempt per identity, none ever is — nothing
accumulates because nothing is asked twice. No amount of trust modelling fixes
that: it is the root-of-trust problem (D1.1), and it belongs to the host. Recorded
as a number rather than argued away.

**The slow poisoner costs about eleven calls.** Ten honest days buy roughly six
abuse calls before anything is felt and eleven before `RESTRICT`. That head start
is the price of having a memory at all; what matters is that it is bounded and
small relative to the traffic that paid for it, and the bound is now asserted.

### As implemented

`examples/harness/` holds the application-independent parts — a persona is a sequence
of interactions with the gaps between them, and the replay drives one through a guard.
Targets supply their own invariants and personas: `examples/ixfe/` and
`examples/healthme/`. Asserted in each target's `replay.test.ts`, readable as tables
via `npm run replay`.

The two claims that must not regress — no legitimate persona feels anything, no
adversary walks through — are tests. The rest is output meant to be read, because a
threshold gets argued about from numbers and not from prose.

Deliberately outside `src/`: this generates *test* traffic. Shipping it in the library
would put a traffic generator in an adopter's bundle, and blur the line the design
rests on — SG observes, it never produces.

---

## D47 — Primary target: IXFE, because it has something to steal

**Decided, superseding D34 as the primary target.**

HealthMe was chosen because it was real and available. It is a PIN-gated personal
health app with one user, and the honest reason it cannot validate the thesis is not
the traffic volume — it is that **nothing behind the PIN is worth an attacker's
time**. An adversary needs a motive, and HealthMe supplies none.

IXFE (`ixfe.pro`) does. It is a competitor-intelligence platform: three deployables,
a public pre-launch funnel with no authentication in front of it, and a credit ledger
where a single request spends money — `marketplace_global` costs 12 credits and makes
one Google Places call per market, billed to the operator whether or not the caller
was legitimate.

| Property | HealthMe | IXFE |
|---|---|---|
| Unauthenticated surface | none | `/api/waitlist`, `/api/order`, `/api/auth/*`, the Xendit webhook |
| Worth stealing | one person's health notes | paid compute, competitor data, a payment path |
| Cost of an abusive request | a wasted lambda invocation | real money, per request |
| Scopes | 2 | 5 |
| Proof sources reachable | 4 of 6 | all 6 |
| Threat model | hypothetical | written into its own defences |

### Its own defences are the threat model

This is what makes IXFE a better target than a hypothetical one. Every mitigation in
`landing-service/` and `server/index.js` records an attack its author expected, so the
adversary personas are not invented — they are read off:

| IXFE defence | Persona it names |
|---|---|
| honeypot field, absorbed silently | `honeypot-filler` |
| `dwell` time-trap | `endpoint-shooter` |
| per-code OTP attempt cap | `otp-grinder` |
| 404 on unknown `external_id` | `webhook-forger` |
| `activation_consumed` primary key | `activation-replayer` |
| 410 after launch | `post-launch-replayer` |
| `provisionPending()` granting zero credits | `pending-freeloader` |
| `CF-Connecting-IP` rate limiting | `rotating-shooter` |
| *(none — every request is authorised)* | `credit-drainer` |

That last row is the point of the whole exercise. The `credit-drainer` breaks no
invariant, holds a valid session, and every request is correctly authorised. It has to
be caught by the statistical layer or not at all — and it is what the model was built
for, finally represented by something with money attached.

### All six proof sources, which HealthMe could not reach

D41 closed the constraint taxonomy over six kinds of fact a host can prove from.
HealthMe could express four. IXFE reaches all six, and `replay.test.ts` fails if a
source has no declared invariant:

| Proof source | IXFE invariant |
|---|---|
| `reachability` | the pre-order funnel, and the auth flow |
| `precondition` | paid work requires credits, and an active subscription |
| `causality` | a submission with no `dwell` did not come from the form |
| `order` | a code cannot be submitted before it was requested |
| `issuance` | activation `jti`, `order_id`, invoice `external_id` |
| `exclusivity` | joining a waiting list for a product that is already live |

`issuance` and `exclusivity` are the two classes D41 *added*, and IXFE has three
instances of the first and a clean instance of the second. That is the closure
argument being exercised rather than asserted.

### What IXFE adds that HealthMe could not show

**A 404 is not a memory.** IXFE already answers correctly at every one of these
endpoints — 410, 403, 404, silent absorption. What it does not do is *remember*: the
`webhook-forger` can guess `external_id` forever, and each refusal is a discarded log
line. The guard turns each refusal into accumulating evidence about the caller, which
is the argument for the library stated in a place where it is checkable.

**Silent absorption costs the defender.** IXFE answers `{ slot: 0 }` to a bot so it
cannot tell it failed. Good for confusing the bot, and it leaves IXFE with no record
of who did it. The missing `dwell` is a *proof*, so SG reaches `RESTRICT` on request
one — no history required.

**Proof beats churn.** D45 measured that rotating identities defeats accumulated
evidence below two requests per identity. Against IXFE that floor disappears wherever
the violation is provable: `rotating-shooter` at one request per identity is still
caught, because a proof needs no history. That is a concrete answer to the churn
problem for the subset of cases a host can declare — and it says nothing about the
rest, which stays open.

### HealthMe is kept

Not deleted, demoted — and for a reason found the hard way. HealthMe is the
*small-application* case: two scopes, one user. That is what caught the entropy
denominator in D46, because a two-scope application could not reach the diversity
threshold at all. A harness that only ran against a five-scope surface would not have
found it, so HealthMe stays as the small-surface regression.

### What is unchanged

IXFE traffic is still **generated**, so D45's limit applies exactly as before: this
falsifies, it does not calibrate. IXFE has real users and real logs, and using those
would be a different and better exercise — recorded as the next step rather than
claimed here.

---

## D48 — A stale client view is not a proof

**Decided, from the first IXFE run.**

The first draft of `workRequiresCredits` was declared `hard`: paid work requires a
balance that covers it, and `requireCredits()` already returns 402. The traffic
immediately produced a false positive — `ran-out-of-credits`, a paying customer who
hits a zero balance, is refused once, and tops up. `RESTRICT` on request three.

D32 is what was violated. Declaring `hard` asserts **completeness** over the scope:
that no legitimate client ever asks for work it cannot afford. That claim is false,
and not marginally so — the client's view of its own balance is stale *by
construction*:

- jobs are queued and billed asynchronously, so the balance moves after the response;
- another tab or another device may have spent the difference;
- a lapsed subscription changes the answer without the open page hearing about it.

So one refused request is how a person discovers their balance. A hundred is a script.
That is exactly the shape of evidence rather than proof, and `soft` is the honest
declaration — it contributes strong negative mass (D38) and lets the accumulation
decide.

### The general lesson, which is the reason this is recorded

*Being enforced by the server does not make something provable.* `requireCredits()`
returning 402 proves the server refused; it does not prove the caller was
illegitimate. The two get conflated because both produce an error response, and D14
already separates them — certainty is not severity — but nothing had connected that to
`strength` until traffic forced it.

The counterexample in the same file is `workRequiresActiveSubscription`, which stays
`hard`: `provisionPending()` writes zero credits, so a pending subscription holding a
balance means something is genuinely wrong. Worth naming that a violation there proves
*something* is wrong and not necessarily that the **caller** did it — an internal
accounting bug looks identical. `RESTRICT` is right either way, since withholding paid
compute until a human looks is correct whichever cause it turns out to be.

---

# Open questions

Every numbered question is answered. What remains is not a question but a
dependency: the decisions below are recorded, and their *values* are unvalidated
until the proof of concept meets real traffic.

| Ref | Recorded as | Still unvalidated |
|---|---|---|
| D36 | Feature space and diversity thresholds | Every threshold is a guess. Leniently set, so being wrong withholds escalation rather than manufacturing a false positive. |
| D37 | Saturation guard via anomaly concurrence | Cannot be validated against a real adversary from single-user traffic (D34). |
| D40 | Epistemic stage thresholds | `n >= 3` and `n >= 7` are tied to the D5 trajectory, not to observed populations. |
| D3, D4 | `H = 24h`, weights `0.5` and `2.0` | Policy defaults. Locked as tests, so a revision is visible rather than silent. |
| D31 | `Relationship : E x E -> R` | Deferred out of the PoC. The coordination reading is where the value and the privacy cost both sit, and that tension is a decision for later. |
| D42 | Weak-signal catalogue and its weights | The three coarse weights are ordered by judgement, not measured. Seven of the ten signals have no collector yet, so a host must supply them. |
| D43 | Two-tier symptom vocabulary | The structure is settled; the detail list is a first pass, and the wire format belongs to `scorpio-guard-protocol`. Nothing transmits, so nothing has been round-tripped against a real server. |

D34 has been run and is recorded with its limits: HealthMe establishes that the
library works against a real flow, and its production traffic — one user — cannot
exercise the probabilistic model.

D45 changes what follows from that. The flow is drivable even though the traffic is
not, so the statistical layer is exercised by generated personas rather than by
waiting: two thresholds were falsified immediately (D46), and identity churn is
recorded as a measured floor rather than a worry.

D47 then moved the primary target to **IXFE**, which has what HealthMe never did —
paid compute behind an unauthenticated endpoint, so an attacker has a motive and the
threat model is written into the application's own defences. That surfaced two further
corrections: a `hard` declaration that was not provable (D48), and the discovery that
D37 never mitigated farming (D49).

What generated traffic still cannot do is calibrate. The next step is IXFE's real
logs rather than another synthetic target; Pusaka remains a candidate for a genuinely
unauthenticated public surface, still blocked on whether it gains a server side.

| Ref | Recorded as | Still unvalidated |
|---|---|---|
| D45 | Generated persona traffic | The distributions are invented. Every persona is a hypothesis about how someone behaves, and an attacker who reads the file can shape traffic around it. |
| D46 | Two thresholds corrected | Corrected in the right direction, not calibrated to a value. `OBSERVE` at `developing` is defensible; that `3` and `7` are the right boundaries is still a guess. |
| D37, D49, D50 | Saturation / farming | **Answered, not validated.** D50 acts on mass through a velocity ceiling that raises rather than lowers, which is what D49 said was required. Whether `60/hr` separates a farmer from a power user is unknown, and only real traffic can say. |
| D47 | IXFE as the target | Its invariants are read from its code, which is honest, and its *traffic* is still generated. IXFE has real users and real logs; using those is the next step, not something claimed here. |
| D50 | The velocity threshold | `60/hr` over a 5-minute span stops farming in synthetic traffic. Nothing establishes that it clears a legitimate power user, an integration test suite, or a shared exit address behind one entity key. |
| D51 | Ten collectors, no thresholds | Each collector measures the right thing; not one has met a real false positive. The catalogue's promise that every signal has a written innocent cause is kept on paper, not in evidence. |
| D52 | The anomaly reference profile | Four expected values and four weights, all chosen by judgement. Deliberately not trained, because the only traffic available is invented (D45) — so the classifier is honest about its ignorance rather than free of it. |
| D53 | The v0.1 wire format | Encodes, decodes, and degrades correctly against its own tests. Never round-tripped against a server, because no server exists. The strategy vocabulary is still empty. |

---

## D50 — Farming is answered on mass, through velocity

**Decided, from D49.** D49 established that a real fix has to act on **mass**
rather than on the uncertainty ceiling, and left the tension open. This closes it.

Farming needs *volume* to move the mean. Volume arriving faster than a human
sustains is therefore the farming shape itself, and it is observable without
touching the trust arithmetic D4 defends.

The mechanism: a bounded window of recent observations already exists (D36). The
span of that window over real elapsed time gives an observation rate. When the
rate exceeds a configurable threshold (`maxObsPerHour`, default 60) over a
minimum span (5 minutes — a short burst is normal), the guard applies a
**farming ceiling** that *raises* the minimum decision to `INCREASE_FRICTION`.

Why it works where D37 failed:

- D37 was a ceiling: it could only *lower* a decision. Farming produces high mean
  which proposes `ALLOW`, and there is nothing for a ceiling to lower.
- The velocity ceiling *raises* the decision: it can override the high mean with a
  floor, which is what "act on mass" means.
- It is gated behind a span threshold, so a legitimate burst (refreshing a form,
  rapid page transitions) does not trigger it. Only sustained machine-rate traffic
  does.

Implements as: `velocityExceeded` in `src/core/behavior.ts`, wired in `guard.ts`
after trust assessment. 5 tests in `behavior.test.ts`, 1 in `guard.test.ts`.

---

## D51 — Signal collectors exist for all seven uncovered catalogue entries

**Decided.**

D42 named ten signals and marked three as `computed: true` — derived from
`behaviorFeatures` (interArrivalCv → `SIG_UNIFORM_DELAY_SHAPE`, scopeEntropy →
`SIG_REPEATED_PATTERN`, immediateRepeatRatio → `SIG_IMMEDIATE_REPEAT`). The other
seven need something to produce their observations. That something now exists:

| Signal | Collector | File |
|---|---|---|
| `SIG_SUBHUMAN_LATENCY` | `measureLatency` | `src/collect/timing.ts` |
| `SIG_OFF_WINDOW_ACCESS` | `checkAccessWindow` | `src/collect/timing.ts` |
| `SIG_UNINTERACTED_INPUT` | `watchInteraction` (existing) | `src/collect/interaction.ts` |
| `SIG_BREADTH_OF_TARGET` | `trackBreadth` | `src/collect/target.ts` |
| `SIG_SENSITIVE_TARGET` | `assessSensitiveTargets` | `src/collect/target.ts` |
| `SIG_UNUSUAL_SEQUENCE` | `checkSequence` | `src/collect/sequence.ts` |
| `SIG_ENVIRONMENT_MISMATCH` | `checkEnvironment` | `src/collect/sequence.ts` |

A signal aggregator (`collectSignalIds` in `src/collect/signals.ts`) takes all
collector outputs and returns the catalogue IDs that `guard.evaluate` accepts.
12 tests in `collectors.test.ts`.

Every collector returns a typed observation struct. None contains a threshold —
thresholds remain in the host's policy, per the D42 principle. Each still needs a
false-positive story told against real traffic before it earns a production
threshold.

---

## D52 — The anomaly classifier is a distance-to-reference model, not a trained one

**Decided.**

D18 deferred the choice of algorithm until the feature space settled. It has.

**Chosen: weighted one-sided Manhattan distance against a fixed reference profile.**

Why not a learned model:

- A learned classifier needs labelled traffic. D34 records that none exists.
- Generated personas (D45) are hypotheses, not ground truth. Training on them
  produces a model that has learned the author's assumptions and reports them back
  as findings.
- An interpretable distance where every weight is policy preserves the property
  the rest of the library has: nothing here is a discovered threshold presented as
  a fact.

One-sided per feature: only deviation in the *suspicious* direction counts.
Browsing more diversely than the reference is not anomalous, and a symmetric
distance would report it as such. The `interArrivalCv` feature carries 40% of the
weight because gap shape is what the design notes single out as hardest to fake.

The classifier does not replace `diversityConcurs` (D37) by default. Both are
reported on every evaluation: the classifier as `.anomaly.score`, the conjunction
in `.diversity`. Setting `useAnomalyClassifier: true` makes the classifier drive
the D37 concurrence instead.

Implements as: `anomalyScore`, `anomalyConcurs` in `src/core/anomaly.ts`.
8 tests in `anomaly.test.ts`, 2 integration tests in `guard.test.ts`.

---

## D53 — Wire format is v0.1, documented and tested, still untransmitting

**Decided.**

`PROTOCOL.md` defines what travels and what must not, and the document has an
executable counterpart in `src/core/protocol.ts` that encodes, decodes, and
applies all six degradation rules. 13 tests in `protocol.test.ts`.

Key decisions crystallised by writing it:

- Requests are unauthenticated and carry no instance identity — because a report
  that could be attributed to an instance is a report about a population.
- Entity counts are bucketed (`one | few | several | many`), never exact — because
  an exact count is identifying in a small deployment.
- The strategy vocabulary in responses is intentionally left open. Inventing tokens
  before a server exists would be guessing.
- The format has no field in which raw observation, identity, or trust state would
  fit. That is the privacy argument made structural rather than documented.

Still nothing transmits. D17 and D20 stand.
