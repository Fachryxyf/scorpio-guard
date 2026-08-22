# Scorpio Guard

[![CI](https://img.shields.io/github/actions/workflow/status/Fachryxyf/scorpio-guard/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/Fachryxyf/scorpio-guard/actions/workflows/ci.yml)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Stage](https://img.shields.io/badge/stage-implementation-blue?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Model](https://img.shields.io/badge/model-open%20core-6f42c1?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Issues](https://img.shields.io/github/issues/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/issues)
[![Last commit](https://img.shields.io/github/last-commit/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/commits)
[![Stars](https://img.shields.io/github/stars/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/stargazers)
[![Site](https://img.shields.io/badge/site-scorpio--guard.fachryxyf.com-2ea44f?style=flat-square)](https://scorpio-guard.fachryxyf.com)

> **Trust is a spectrum, not a verdict.** Adaptive trust evaluation for web interactions — a local library, not a centralized gatekeeper.

**Status: pre-alpha, implementation phase.** The core model is built and tested; nothing is calibrated against real traffic, and no server or protocol exists yet. What follows is the design, and where the code has caught up to it.

---

## The Premise

No web behavior is inherently human. Mouse movement, timing, DOM interaction, navigation patterns — all of it can be recorded, learned, and replayed. So Scorpio Guard does not try to answer:

```
human / bot
```

It continuously estimates:

```
how much trust does this interaction currently deserve?
```

Trust is built from many weak signals evaluated together over time. Identity is a history, not a fingerprint. Volume is evidence, not guilt. The goal is not perfect detection — it is **asymmetric cost**: near-zero friction for legitimate users, increasingly expensive for sustained abuse.

## Product Shape

Scorpio Guard is **not** Turnstile or reCAPTCHA. There is no round trip to a central service that issues a verdict token.

- An **open-source library** installed inside your own ecosystem. No API key, and no network surface at all in the current scope.
- **One-way flow** — it evaluates and advises *within* your environment.
- **Advisory only** — it never unilaterally blocks or rejects. Every action belongs to the owner of the system it runs in.
- **No phoning home** per request. Raw traffic and history stay local.

Learning happens at the *project* level (slow, human-mediated, via issues and review), not at the *instance* level (fast, automatic, per-request).

## Prescription, Not Diagnosis

The communication model, in one analogy: a patient says *"I have a headache."* That is a category of complaint — a few bytes of information, not a transfer of the headache itself.

```
library  ──  symptom (abstract pattern shape)  ──▶  server
library  ◀──  prescription (handling strategy)  ──   server
library  ──▶  acts locally, on local data only
```

- **Symptom** — an abstracted description of a pattern class. No raw request data, no identity, no PII.
- **Prescription** — a general strategy for handling that pattern class.
- **Action** — always local, always the operator's.

The vocabulary is **two tiers, split by rate of change** (D43), because a deployed
instance speaks the vocabulary it shipped with and cannot negotiate with a server
that has moved on. Six principle-level *categories* form a stable skeleton expected
never to grow; the *details* under them are free to evolve release to release, and a
detail a receiver has never heard of degrades to its category instead of failing.
Symptoms carry shape and never values — `SYM_REQUEST_BURST` says volume arrived
compressed in time, with no count, no interval and no endpoint.

Consequences: privacy by design (raw data never leaves), cross-ecosystem learning at the pattern level, and local speed for the overwhelming majority of decisions.

## Two Kinds of Signal

The core design breakthrough: these are not blended into one score.

| | Hard constraints | Weak signals |
|---|---|---|
| Nature | Physically/logically impossible | Unusual, not impossible |
| Role | Stable **skeleton** — always on, precise | **Reinforcement** — only meaningful in combination |
| Learned? | Never | Yes, statistically |
| Enumerated | Seven classes, closed (D41) | Ten signals over six sources (D42) |
| Reaches a decision | On its own authority | Never — only as trust mass |
| Examples | Form filled with zero corresponding interaction; a reference the system never issued | Repeated identical patterns, *too*-uniform randomized delays, breadth of enumeration |

Weak signals operate *around* the hard constraints, which relieves them of carrying full-precision weight alone. That is what lets the system use statistical signals without inheriting a false-positive problem.

The tell in a bot's randomized delay is rarely the delay itself — it is the **shape of the randomness**. Humans do not produce uniform distributions.

Both lists are closed, and closed the same way: by enumerating what the guard can
*know* rather than what an attacker might do. Hard constraints are bounded by the
six kinds of fact a host can prove something from — reachability, precondition,
causality, order, issuance, exclusivity. Weak signals are bounded by the six kinds
of thing SG can observe — timing, repetition, interaction, sequence, target,
environment. Anything outside the first list is measurement rather than proof, which
is precisely what makes it belong to the second.

The weak-signal catalogue deliberately contains **no thresholds**. Each entry names
what is measured, never when it fires, because publishing `flag if interval < 220ms`
in an open-source library hands an attacker the number to route around. Every entry
also records a plausible *innocent cause*: a signal whose false-positive path cannot
be written down is not understood well enough to weigh.

Weak signals cannot escalate on their own, and that is arithmetic rather than
intent. Tripping every signal in the catalogue at once contributes the mass of one
weak observation, which leaves a fresh entity below the evidence threshold where the
trust dimension is allowed to ask for anything at all.

## Open Protocol, Not a Proprietary Backend

An open-core split, with one important refinement.

- **Open** — the library *and* the protocol: how a symptom is formatted, how a prescription is structured, the shared vocabulary.
- **Closed** — the *rule content* of any given server implementation. Publishing exact thresholds hands attackers a fixed target to route around.

The reference server is **one implementation**, not a structural requirement. Anyone — a company, another community, even a competitor — can run their own against the same protocol. Same shape as DNS, SMTP, ActivityPub, Let's Encrypt.

This removes the single point of failure, lets compliance-sensitive adopters self-host, and reframes the project as a standard rather than a lock-in. The cost: the symptom vocabulary becomes a **public spec** — versioned, conservative, extensible, and load-bearing for everyone downstream.

## Open Problems

Named honestly, not hidden.

- **Symptom vocabulary** — the two-tier *structure* is settled (D43) and the detail list is a first pass. What remains is the wire format, which belongs to `scorpio-guard-protocol`, and the fact that nothing has been round-tripped against a real server because nothing transmits.
- **Signal encoding** — the transmitted representation should be decodable *only* by the server, even though the library's source is public. Edges into one-way embeddings and server-issued transformation recipes. Research direction, not a resolved design.
- **Cold start & sybil churn** — history-based trust is gamed by attackers who simply discard identities. Now measured rather than feared: the floor is one request per identity, at which point nothing accumulates at all. Two requests per identity and the guard engages.
- **Root of trust** — explicitly outside the library. It accepts an entity reference as a basis for measurement, never as proof of identity. If the host supplies a reference that is cheap to discard, every history-based defence goes with it — and that is the host's responsibility, not the library's.
- **Poisoning resistance** — gradual baseline shifts where every individual step looks legitimate. Bounded, not solved: ten honest days buy roughly eleven abuse calls before `RESTRICT`.
- **Privacy/legal basis** — behavioral history is personal data under GDPR and Indonesia's UU PDP.
- **Sequencing** — is a durable public protocol worth designing *before* a proof-of-concept exists?

## Repositories

Three repositories, not a monorepo — see [REPOSITORIES.md](REPOSITORIES.md) for the reasoning and the planned scope of each.

| Repository | Visibility | Contains |
|---|---|---|
| `scorpio-guard` | Public | The TypeScript library. This repo. |
| `scorpio-guard-protocol` | Public | Symptom vocabulary and wire format. Spec only. Not started. |
| `scorpio-guard-server` | Private | Rust reference server. Rule content. Not started. |

## Design Record

Every design decision is recorded in [DECISIONS.md](DECISIONS.md): the question,
the answer, the reasoning, and what each answer commits the implementation to.
Read it before proposing a change to the model — several obvious-looking
alternatives were considered and rejected there for reasons worth knowing.

Forty-nine entries is more than anyone reads front to back, so the site carries a
[decision index](https://scorpio-guard.fachryxyf.com/#decisions) — every entry
grouped by what it decides, with the file it turned into — and a
[glossary](https://scorpio-guard.fachryxyf.com/#glossary) for the terms used in a
narrower sense than usual: entity, evidence mass, hard versus soft, diversity,
advisory.

Settled so far: the entity as reference unit, trust as a Beta distribution,
half-life decay over real elapsed time, evidence weights, decision bands with an
uncertainty ceiling, retention, the hard-constraint taxonomy and its closure
argument, the weak-signal catalogue, the epistemic stage over evidence mass, the
anomaly feature space, and the two-tier symptom vocabulary. Still open: the anomaly
*algorithm* over that space, entity relationships, and a target that can validate
the thesis rather than smoke-test it.

## Install

Not on npm yet: `@fachryxyf/scorpio-guard` is reserved but unpublished until the
evaluation API stops moving (D25). Install the repository directly — it builds
itself on install.

```
npm install github:Fachryxyf/scorpio-guard
```

Node 22.6 or newer, ESM only, no runtime dependencies. Two entry points: `.` for
the model, `./collect` for the browser collector, on one version number so they
cannot be installed mismatched.

## Usage

Start observational. The guard advises; it never acts. Record what it would have
said next to what your existing defences actually did, and only wire the advice to
behavior once you believe it.

```js
import { createGuard, transitionGraph } from '@fachryxyf/scorpio-guard';

// Declaring `hard` asserts this edge set is *complete* for the scope.
// If you cannot enumerate it honestly, declare `soft`: evidence, not proof.
const checkoutOrder = transitionGraph({
  id: 'checkout-order',
  scope: 'checkout',
  strength: 'hard',
  allowed: [
    { from: 'cart', to: 'address' },
    { from: 'address', to: 'payment' },
  ],
});

// Once per process, not per request: the default store lives inside the guard.
const guard = createGuard({ invariants: [checkoutOrder] });

const result = await guard.evaluate({
  entity: sessionId, // any stable reference; SG never interprets it
  observation: { scope: 'checkout', data: { from: 'cart', to: 'payment' } },
  context: { endpoint: '/pay' },
});

result.decision;     // 'RESTRICT' — advice, never enforcement
result.trust.stage;  // 'unknown' | 'developing' | 'established'
result.hardViolated; // true when a proof, not a probability, decided it
result.coldStart;    // true when no retained state existed
result.trace;        // why, in the order that decided it
```

Log `trace` from the first day. Four independent dimensions feed one outcome, so an
unexplained decision cannot be debugged after the fact — which is why the trace is
part of the return value rather than a debug flag.

A first-time entity is advised `ALLOW` at stage `unknown`: lack of evidence is not
negative evidence. A brand-new entity that breaks a `hard` invariant is still
restricted.

Weak signals are passed by catalogue id, and are treated as measurement rather than
proof — they become negative evidence and nothing more:

```js
import { WEAK_SIGNALS } from '@fachryxyf/scorpio-guard';

await guard.evaluate({
  entity: sessionId,
  observation: { signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_BROAD_ENUMERATION'] },
});
```

Ids the catalogue does not know are ignored rather than treated as suspicious.
`WEAK_SIGNALS` documents each one: what it measures, what it is worth, a plausible
innocent cause, and whether SG already computes it for you.

The default store is process-local, so trust does not survive a restart. For
anything that restarts — serverless, a supervised process, a container — use the
durable store:

```js
import { createGuard } from '@fachryxyf/scorpio-guard';
import { sqliteStore } from '@fachryxyf/scorpio-guard/sqlite';

const guard = createGuard({ store: sqliteStore({ path: './trust.db' }) });
```

Still no dependencies: `node:sqlite` is in the standard library. Behavioral history
is personal data, so treat that file as such — `guard.forget()` deletes a row, and
retention expiry deletes it for you.

Deleting an entity's history is one call, and it is the same code path retention
uses with the horizon forced to zero:

```js
await guard.forget(entity);
```

Every tunable number lives in `src/core/policy.ts` and is overridable per guard —
half-life, retention, evidence weights, the epistemic stage thresholds, what a
proven violation advises, the diversity thresholds. All of them are reasoned
guesses set leniently, so being wrong withholds escalation rather than
manufacturing a false positive. The [documentation site](https://scorpio-guard.fachryxyf.com)
tabulates each one with what changing it means.

## Development

Requires Node 22.6 or newer — tests run TypeScript directly, with no build step.

```
npm install
npm test          # node:test, no framework
npm run replay    # persona traffic against the HealthMe flow
npm run typecheck
npm run build     # emits dist/
```

### What exists

`src/core/` — the model, with no platform dependencies:

- `trust.ts` — Beta-Bernoulli state, half-life decay over real elapsed time, retention.
- `assess.ts` — trust and uncertainty bands, and the ceiling that caps escalation.
- `decision.ts` — the five-rung decision spectrum.
- `symptoms.ts` — the two-tier symptom vocabulary. Not exported: nothing transmits yet.
- `behavior.ts` — the anomaly feature space, and the diversity signal it feeds.
- `constraints.ts`, `transitions.ts` — declared invariants, the seven classes, and what a violation means.
- `signals.ts` — the weak-signal catalogue and how observed signals become mass.
- `store.ts` — the `StateStore` interface and an in-memory implementation.
- `conformance.ts` — runnable contract checks for any store you write.
- `guard.ts` — `createGuard()` and `evaluate()`, composing the above.
- `policy.ts`, `clock.ts` — tunable values in one place, and an injectable clock.

`src/collect/` — browser-side observation, imported from `@fachryxyf/scorpio-guard/collect`. Counts interaction; records nothing about content.

`src/store/sqlite.ts` — a durable store on `node:sqlite`, imported from
`@fachryxyf/scorpio-guard/sqlite`. Still zero dependencies, since it is in the
standard library. The in-memory default is process-local, so every restart is a cold
start; this one survives a restart and is shared across processes on one host. Both
pass the same conformance kit.

`examples/healthme/` — the first integration target (D34), declared invariants and
an observational harness that records advice without acting on it, plus the seeded
personas (D45) that drive it and the replay that reports what happened.

One hundred and forty-three tests, which double as the record of every numeric and
semantic property the design depends on.

Writing your own store? Prove it works before trusting it:

```js
import { checkStoreConformance, assertConformant } from '@fachryxyf/scorpio-guard';

assertConformant(await checkStoreConformance(() => myRedisStore()));
```

Eleven checks, no framework. They exist because a store that is subtly wrong
produces a guard that is subtly wrong, silently — a second-resolution timestamp
column breaks decay, dropping the observation window disables anomaly detection,
and trimming a key merges two entities. The kit caught the reference in-memory
store handing back a mutable object on its first run.

Trust is read through an epistemic stage over evidence mass `n = alpha + beta`, so
an unknown entity contributes nothing to the decision — while a hard-constraint
violation still decides on its own authority. See D39 and D40 in the design record
for how that was arrived at.

### What does not exist

An anomaly *classifier* over the feature space, and the prescription client. Both
wait on decisions in the design record rather than on effort.

More importantly: nothing has met real production traffic. Every threshold in the
model is a reasoned guess. The HealthMe harness replays its real flow, which is
enough to catch a contradiction but not enough to calibrate a threshold.

## What the First Integration Shows

The first integration target is HealthMe, an existing PIN-gated personal health
app (`examples/healthme/`). Its flow is replayed against its own hand-rolled
defences: a three-strike lockout in `localStorage`, and IP rate limiting in a map
that resets whenever the serverless function cold-starts.

| Scenario | HealthMe does | The guard advises |
|---|---|---|
| Normal daily unlock, one week | allows | `ALLOW` / `OBSERVE` — never friction |
| Three mistyped PINs | 5-minute lockout | `OBSERVE`, stage `developing` |
| `POST /api/chat` with no unlock in session | **allows** | `RESTRICT` — provable violation |
| Session restore from `sessionStorage` | allows | `ALLOW` — not mistaken for replay |
| 20 scripted attempts | rejects, counter resets on cold start | `INCREASE_FRICTION`, stage `established` |

Two disagreements. A forged API call passes HealthMe's origin check and its
cold-start-porous IP limit, while the guard sees that `js/core.js` — the only
caller — could not have been loaded. And three mistyped PINs cost a real user five
minutes under a 3-strike rule, where the guard reads `n = 3.5` as *developing*:
not enough evidence to act on.

### What it does not show

Stated plainly, because the temptation is to read more into this than it carries:

- **The library works against a real flow. That is a smoke test, not a validated
  thesis.** HealthMe has one user, so there is no sustained abuse for asymmetric
  cost to act against.
- **The interesting finding came from the hard-constraint layer**, which is the
  least novel part of the design — set membership, expressible as one `if`. The
  parts that are actually new (Beta trust, half-life decay, the epistemic stage,
  the diversity signal) were never exercised, because no traffic here can exercise
  them.
- **No threshold is calibrated by this.** Every number in the model remains a
  reasoned guess.

A target that can validate the thesis needs unauthenticated traffic, data worth
scraping, and a real adversary. See D34 in the design record.

## Generated Traffic

HealthMe has one user, so its production traffic cannot exercise the statistical
layer. Its *flow* can. Rather than wait for an adversarial target to appear, seeded
personas drive that flow through the same declared invariants:

```
npm run replay
```

```
persona                kind       worst advice       at        stage        verdict
daily-ritual           legit      OBSERVE            @4/79     established  as intended
fat-finger             legit      OBSERVE            @3/3      developing   as intended
password-manager       legit      OBSERVE            @1/2      developing   as intended
session-restore        legit      OBSERVE            @3/6      developing   as intended
power-user             legit      OBSERVE            @4/26     established  as intended
forged-api-call        adversary  RESTRICT           @1/1      unknown      as intended
scripted-brute-force   adversary  INCREASE_FRICTION  @2/30     established  as intended
jittered-brute-force   adversary  INCREASE_FRICTION  @2/30     established  as intended
slow-poisoner          adversary  RESTRICT           @32/60    established  as intended
```

Two claims are asserted as tests: no legitimate persona is ever advised anything a
user would feel, and no adversary walks through untouched. The rest is output meant
to be read, because a threshold gets argued about from numbers rather than prose.

**This falsifies; it does not calibrate.** If a persona built from honest usage gets
escalated, a threshold is wrong regardless of where the traffic came from. But real
populations are not drawn from these distributions, and an attacker who reads the
file can shape traffic around it — so numbers derived here are hypotheses, never
conclusions.

It found two wrong numbers immediately, both erring toward friction for legitimate
users:

- **The `developing` stage ceiling was one rung too high.** Two mistyped PINs, and
  an autofilled password manager, were both advised `INCREASE_FRICTION`. The middle
  stage is meant to let trust *influence* a treatment without *driving* it, and
  `OBSERVE` is the only rung that does that. The old value also made the stage
  boundary a cliff: silence at `n = 2.9`, friction at `n = 3`.
- **Scope entropy was normalised against the window size**, which made it depend on
  how many scopes the *application* has rather than how varied the *entity* was. A
  two-scope app like HealthMe could not reach the diversity threshold at all, so its
  most honest user was scored monotonous for the entire run. Now normalised against
  the scopes actually observed, so it measures balance while `distinctScopes`
  measures breadth.

Three findings are measurements rather than fixes:

- **Uniform jitter buys an attacker nothing.** Fixed-sleep and `uniform(1.2s, 2.3s)`
  brute forces escalate at the same step, which is the design's own claim about the
  shape of randomness surviving its counterexample.
- **Identity churn works, and the floor is two requests.** Three attempts per
  identity and every identity is felt; **one** attempt per identity and none ever
  is, because nothing accumulates when nothing is asked twice. That is the
  root-of-trust problem, and it belongs to the host.
- **Ten honest days buy about eleven abuse calls** before `RESTRICT`. That head
  start is the price of having a memory; the bound is now asserted.

## Roadmap

Done: the core model, the pluggable store with its conformance kit and a durable
SQLite implementation, the browser collector, one observational integration against
a real flow, the three enumeration tasks — the constraint taxonomy closed over proof
sources (D41), the weak-signal catalogue (D42), the two-tier symptom vocabulary
(D43) — and generated persona traffic that exercises the probabilistic model (D45).

Generated persona traffic now exercises the statistical layer and has already
falsified two thresholds. What remains, in order:

1. Collectors for the seven catalogued signals that nothing computes yet — most need host cooperation, and each needs a false-positive story before it earns a threshold.
2. Choose an anomaly algorithm over the settled feature space, using the personas to compare candidates.
3. A real population to calibrate against: unauthenticated traffic, data worth scraping, a real adversary. Generated traffic falsifies; only real traffic calibrates.
4. Publish the symptom vocabulary as a `scorpio-guard-protocol` v0.1 wire spec — the structure is settled, the format is not.
5. Only then: investigate encoding schemes for symptom transmission.

## Contributing

The library and protocol are the community surface: hard-constraint discoveries,
pattern reports, false-positive cases. At this stage discussion is worth more than
code — the most valuable contribution is evidence that a number is wrong, not a
patch that changes it. See [CONTRIBUTING.md](CONTRIBUTING.md) for what helps most
and the house rules, and [SECURITY.md](SECURITY.md) for what the guard does and
does not claim, plus private vulnerability reporting.

## Links

- Site: [scorpio-guard.fachryxyf.com](https://scorpio-guard.fachryxyf.com)
- Author: [@Fachryxyf](https://github.com/Fachryxyf)
