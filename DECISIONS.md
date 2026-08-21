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

Status: all thirty original questions are answered, plus D33 and D37 arising from
review. Five questions remain open. D34 — choosing the proof-of-concept target —
is the highest priority among them, since several decisions cannot be validated
without one.

Last updated: 2026-08-21

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

**Part IV — Hard constraints**

- [D13 — Hard constraints are violated invariants, in five classes](#d13--hard-constraints-are-violated-invariants-in-five-classes)
- [D14 — "Hard" describes certainty, not severity](#d14--hard-describes-certainty-not-severity)
- [D15 — Hard constraints stay outside the Beta model](#d15--hard-constraints-stay-outside-the-beta-model)
- [D16 — Invariants are declared, never learned](#d16--invariants-are-declared-never-learned)

**Part V — Anomaly model**

- [D18 — Anomaly: feature space first, algorithm later](#d18--anomaly-feature-space-first-algorithm-later)

**Part VI — Architecture and API**

- [D7 — One package, multiple entry points](#d7--one-package-multiple-entry-points)
- [D8 — Pluggable `StateStore`, in-memory default, async](#d8--pluggable-statestore-in-memory-default-async)
- [D9 — `guard.evaluate({ entity, observation, context })`](#d9--guardevaluate-entity-observation-context-)
- [D10 — All public evaluation and storage APIs are async](#d10--all-public-evaluation-and-storage-apis-are-async)
- [D11 — Time is injected through a `Clock` interface](#d11--time-is-injected-through-a-clock-interface)
- [D12 — Core is framework-agnostic](#d12--core-is-framework-agnostic)
- [D20 — A serverless guard is fully functional](#d20--a-serverless-guard-is-fully-functional)

**Part VII — Protocol and privacy**

- [D17 — No API key in the local core](#d17--no-api-key-in-the-local-core)
- [D19 — Symptoms are local-first, never per request](#d19--symptoms-are-local-first-never-per-request)
- [D21 — Cold start, restated](#d21--cold-start-restated)
- [D22 — Purge primitive from the start; consent belongs to the host](#d22--purge-primitive-from-the-start-consent-belongs-to-the-host)
- [D23 — Decision trace is mandatory](#d23--decision-trace-is-mandatory)

**Part VIII — Project and tooling**

- [D24 — Licence: MIT](#d24--licence-mit)
- [D25 — npm: `@fachryxyf/scorpio-guard`](#d25--npm-fachryxyfscorpio-guard)
- [D26 — Node floor: `>=22.6`](#d26--node-floor-226)
- [D27 — CI now: typecheck and test](#d27--ci-now-typecheck-and-test)
- [D28 — Site stays where it is](#d28--site-stays-where-it-is)
- [D29 — No empty repositories](#d29--no-empty-repositories)
- [D30 — PoC must run against a real application flow](#d30--poc-must-run-against-a-real-application-flow)

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

**Decided.**

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

### What this commits the code to

- The host declares an application model — at minimum a transition graph `G`
  with an explicit allowed-edge set `T`.
- The check is set membership, not scoring. It has no threshold and no
  calibration, which is what makes it free of false positives *given a correct
  declaration*.
- An incomplete declaration produces false positives — a legitimate edge the host
  forgot to declare reads as provably impossible. So the declaration is safety
  critical, and the API must make partial declarations obviously partial rather
  than silently treating unlisted edges as forbidden. A strict and a permissive
  mode is the likely shape; not yet decided.
- Constraint classes need a shared result type carrying which class fired, which
  invariant, and what was observed — required for D23-style explainability, since
  a violation claim must be inspectable to be trustworthy.

---

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

---

# Part VIII — Project and tooling

Licence, packaging, toolchain, and where the proof of concept has to run.

## D24 — Licence: MIT

**Decided.** Matches the current `package.json`. A `LICENSE` file is still
missing and needs adding.

## D25 — npm: `@fachryxyf/scorpio-guard`

**Decided.** Scoped. Publish after the PoC API is stable, so `private: true`
stays in `package.json` until then.

## D26 — Node floor: `>=22.6`

**Decided.** Keeps tests running TypeScript directly with no build step and no
extra dependency.

## D27 — CI now: typecheck and test

**Decided.** One GitHub Actions workflow.

## D28 — Site stays where it is

**Decided.** `index.html` and `404.html` remain at the repository root. Migration
to `docs/` later if needed.

## D29 — No empty repositories

**Decided.** `scorpio-guard-protocol` and `scorpio-guard-server` are not created
until they have real content and lifecycle. `REPOSITORIES.md` holds the plan
meanwhile.

## D30 — PoC must run against a real application flow

**Decided.**

The PoC must use a real application flow. The initial target should be an
application with stateful, authenticated and unauthenticated, and
security-sensitive flows.

Follows necessarily from D16: invariants are declared from an actual application
model, so a synthetic fixture would only prove the code runs, not that the
declared invariants hold against real traffic.

### Still needed

Which application. The requirements are now specific enough to choose one, but no
target is named yet, and the hard-constraint classes of D13 cannot be validated
without it.

---

# Open questions

All numbered questions 1-30 are answered. What remains open was raised *by* those
answers:

| Ref | Question | Blocks |
|---|---|---|
| D31 | What is `Relationship : E x E -> R` — correlation, shared origin, or a coordination graph? | Nothing — declared out of scope for the PoC, and its signature is withheld from D1 until defined |
| D32 | With a partially declared flow, are undeclared edges forbidden (strict) or unknown and passed to the probabilistic path (permissive)? Which is the default? | Hard-constraint API |
| D34 | **Which real application is the PoC target?** Highest priority — not a closing task | D13 classes, D16 invariants, D30, and validating D37 against real traffic |
| D35 | Does an anomaly observation with no trust evidence count as a meaningful update for retention? | D6 retention, blocked by D18 |
| D36 | Which numeric features make up the anomaly feature space, including the diversity signal D37 requires? | Anomaly model, and closing the D37 saturation gap |

Recommendation on D32: permissive by default, strict as opt-in. A wrong default
here manufactures false positives, and false positives are the stated central
constraint.

D34 is listed first deliberately. It was originally treated as a closing task,
but D16 declares invariants from a real application model and D37 can only be
validated against real traffic, so roughly half of this document cannot be
confirmed until a target exists.
