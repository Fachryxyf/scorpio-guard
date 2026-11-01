# Scorpio Guard

[![CI](https://img.shields.io/github/actions/workflow/status/Fachryxyf/scorpio-guard/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/Fachryxyf/scorpio-guard/actions/workflows/ci.yml)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Stage](https://img.shields.io/badge/stage-implementation-blue?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Model](https://img.shields.io/badge/model-open%20core-6f42c1?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Issues](https://img.shields.io/github/issues/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/issues)
[![Last commit](https://img.shields.io/github/last-commit/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/commits)
[![Stars](https://img.shields.io/github/stars/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/stargazers)
[![Site](https://img.shields.io/badge/site-scorpio--guard.fachryxyf.com-2ea44f?style=flat-square)](https://scorpio-guard.fachryxyf.com)

> **Trust is a spectrum, not a verdict.** Adaptive trust evaluation for web interactions, a local library, not a centralized gatekeeper.

**Status: 0.3.0, pre-1.0.** Install with `npm install @fachryxyf/scorpio-guard`. Which version the registry serves today, and the date each one landed, are on the [versions page](https://scorpio-guard.fachryxyf.com/versions.html), because a README carried inside a tarball cannot keep that fact true. The npm account behind the package was suspended for 72 hours on 2026-10-25 after a security-sensitive action; [docs/RELEASING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/RELEASING.md) carries the record and the runbook. The core model is built and tested, the package installs from its tarball, and the v0.1 protocol has fixtures, a reference receiver, and a batching sender. Two things still stand between this and 1.0.0: an independent security review, and thresholds that hold against a real traffic mix — the first integration's journal has now been replayed against the grid (docs/v0.3.0/HOST-DATASET.md) and moved no constant, but a population it is not. The 24 hour soak is done (docs/SOAK.md). What remains short of the proof is recorded in [docs/DATASET.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/DATASET.md). The claims a gate enforces today, the risks that are priced instead, and the size of each gap are on the [guarantees page](https://scorpio-guard.fachryxyf.com/guarantees.html), with the test or decision behind every row (D75). What follows is the design, and where the code has caught up to it.

**In a hurry:** [Install](#install), [Usage](#usage), [docs/TESTING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/TESTING.md). The design below is why the code looks like that.

---

## The Premise

No web behavior is inherently human. Mouse movement, timing, DOM interaction, navigation patterns: all of it can be recorded, learned, and replayed. So Scorpio Guard does not try to answer:

```
human / bot
```

It continuously estimates:

```
how much trust does this interaction currently deserve?
```

Trust is built from many weak signals evaluated together over time. Identity is a history, not a fingerprint. Volume is evidence, not guilt. The goal is not perfect detection; it is **asymmetric cost**: near-zero friction for legitimate users, increasingly expensive for sustained abuse.

## Product Shape

Scorpio Guard is **not** Turnstile or reCAPTCHA. There is no round trip to a central service that issues a verdict token.

- An **open-source library** installed inside your own ecosystem. No API key, and no network surface at all in the current scope.
- **One-way flow**: it evaluates and advises *within* your environment.
- **Advisory only**: it never unilaterally blocks or rejects. Every action belongs to the owner of the system it runs in.
- **No phoning home** per request. Raw traffic and history stay local.
- **Built toward a shared protocol**: the vocabulary for symptoms and prescriptions is public and versioned, but nothing in this package talks to a server and no import opens a socket. The design is [at the end of this page](#open-protocol-not-a-proprietary-backend).

Learning happens at the *project* level (slow, human-mediated, via issues and review), not at the *instance* level (fast, automatic, per-request).

## Prescription, Not Diagnosis

The communication model, in one analogy: a patient says *"I have a headache."* That is a category of complaint, a few bytes of information, not a transfer of the headache itself.

```
library  ──  symptom (abstract pattern shape)  ──▶  server
library  ◀──  prescription (handling strategy)  ──   server
library  ──▶  acts locally, on local data only
```

- **Symptom**: an abstracted description of a pattern class. No raw request data, no identity, no PII.
- **Prescription**: a general strategy for handling that pattern class.
- **Action**: always local, always the operator's.

The vocabulary is **two tiers, split by rate of change** (D43), because a deployed
instance speaks the vocabulary it shipped with and cannot negotiate with a server
that has moved on. Six principle-level *categories* form a stable skeleton expected
never to grow; the *details* under them are free to evolve release to release, and a
detail a receiver has never heard of degrades to its category instead of failing.
Symptoms carry shape and never values: `SYM_REQUEST_BURST` says volume arrived
compressed in time, with no count, no interval and no endpoint.

Consequences: privacy by design (raw data never leaves), cross-ecosystem learning at the pattern level, and local speed for the overwhelming majority of decisions.

## Two Kinds of Signal

The core design breakthrough: these are not blended into one score.

| | Hard constraints | Weak signals |
|---|---|---|
| Nature | Physically/logically impossible | Unusual, not impossible |
| Role | Stable **skeleton**, always on, precise | **Reinforcement**, only meaningful in combination |
| Learned? | Never | Yes, statistically |
| Enumerated | Seven classes, closed (D41) | Ten signals over six sources (D42) |
| Test of a `hard` claim | can you enumerate the legitimate set? Being *enforced* is not the same as being *provable* (D48) | n/a, a signal never claims completeness |
| Reaches a decision | On its own authority | Never, only as trust mass |
| Examples | Form filled with zero corresponding interaction; a reference the system never issued | Repeated identical patterns, *too*-uniform randomized delays, breadth of enumeration |

Weak signals operate *around* the hard constraints, which relieves them of carrying full-precision weight alone. That is what lets the system use statistical signals without inheriting a false-positive problem.

The two accept different shapes, which is the distinction in one screen:

```ts
const hard: Invariant = {
  id: 'checkout-without-cart',
  class: 'IMPOSSIBLE_ACTION_PREREQUISITE',
  strength: 'hard',
  scope: 'checkout',
  holds: (o) => (o as { cartWasCheckedOut?: boolean }).cartWasCheckedOut !== false,
};

await guard.evaluate({
  entity,
  observation: { scope: 'checkout', signals: ['SIG_UNIFORM_DELAY_SHAPE'] },
});
```

A hard constraint is a declaration the host makes and can defend, so it needs no
history and no threshold. A weak signal has nothing to declare: it travels as
measurement and can only add mass. [Usage](#usage) wires the whole call, including
what the host does with the answer.

The tell in a bot's randomized delay is rarely the delay itself: it is the **shape of the randomness**. Humans do not produce uniform distributions.

Both lists are closed, and closed the same way: by enumerating what the guard can
*know* rather than what an attacker might do. Hard constraints are bounded by the
six kinds of fact a host can prove something from, reachability, precondition,
causality, order, issuance, exclusivity. Weak signals are bounded by the six kinds
of thing SG can observe, timing, repetition, interaction, sequence, target,
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

## Open Problems

Named honestly, not hidden.

- **Symptom vocabulary**: the two-tier structure is settled (D43) and the v0.1 wire format is in [PROTOCOL.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/PROTOCOL.md), with its degradation rules tested (D53), its cases in `protocol/fixtures/v0.1/`, and a reference receiver plus a batching sender in `examples/protocol/` (D70, D71). The library itself still transmits nothing: no import opens a socket, and the sender is an example rather than a default.
- **Signal encoding**: the transmitted representation should be decodable *only* by the server, even though the library's source is public. Edges into one-way embeddings and server-issued transformation recipes. Research direction, not a resolved design.
- **Cold start & sybil churn**: history-based trust is gamed by attackers who simply discard identities. Now measured rather than feared: the floor is one request per identity, at which point nothing accumulates at all. Two requests per identity and the guard engages.
- **Root of trust**: explicitly outside the library. It accepts an entity reference as a basis for measurement, never as proof of identity. [docs/ROOT-OF-TRUST.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/ROOT-OF-TRUST.md) states the rule and the measured price of every way to break it (D72): one changed key discards six observations of distrust, earning the same standing back costs 25 positives, and a per-request proof is the one thing a rotated key cannot erase.
- **Poisoning resistance**: gradual baseline shifts where every individual step looks legitimate. Priced, not solved: [docs/POISONING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/POISONING.md) measures what patience buys (D73). A fresh identity is treated after three strong negatives, a constant-gap script stops buying tolerance at five however much it spends, and a script that removes the pacing tell buys one extra tolerated negative per 1.71 positives.
- **Saturation / farming**: closed in generated traffic by D55, after two failed attempts at the decision layer. A positive is priced by the shape of the gaps it arrived in, so machine-regular volume accrues almost nothing; negatives are never discounted. Every farmer tested now pays on the first abuse call, and positive-only automation tops out at `OBSERVE`. Uncalibrated: the threshold is inherited from D36.
- **Privacy/legal basis**: behavioral history is personal data under GDPR and Indonesia's UU PDP.
- **Sequencing**: is a durable public protocol worth designing *before* a proof-of-concept exists?

## Repositories

Three repositories, not a monorepo, see [REPOSITORIES.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/REPOSITORIES.md) for the reasoning and the planned scope of each.

| Repository | Visibility | Contains |
|---|---|---|
| `scorpio-guard` | Public | The TypeScript library. This repo. |
| `scorpio-guard-protocol` | Public | Symptom vocabulary and wire format. Spec only. Not started. |
| `scorpio-guard-server` | Private | Rust reference server. Rule content. Not started. |

## Design Record

Every design decision is recorded in [DECISIONS.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/DECISIONS.md): the question,
the answer, the reasoning, and what each answer commits the implementation to.
Read it before proposing a change to the model, several obvious-looking
alternatives were considered and rejected there for reasons worth knowing.

Eighty-three entries is more than anyone reads front to back, so the site carries a
[decision index](https://scorpio-guard.fachryxyf.com/#decisions), every entry
grouped by what it decides, with the file it turned into, and a
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

```
npm install @fachryxyf/scorpio-guard
```

`0.2.1` was a documentation-only patch: no code, no exported name, and no advice for the
same input and the same stored state changed. It exists because the README inside the
`0.2.0` tarball still told a reader that `0.2.0` was unpublished, and that text is frozen
at publish time. Every release since `0.2.0` is uploaded by the tag-triggered workflow
with an attestation that `npm audit signatures` verifies in a clean install; `0.1.0` has
none. MIT, zero runtime dependencies (D59). The date each version landed, and what the
registry serves today, are on the [versions page](https://scorpio-guard.fachryxyf.com/versions.html).

Pin the exact version rather than a caret range: no threshold in this library is
calibrated, so a minor bump can change advisory behavior, and `^0.3.0` would pull that in
silently.

```
npm install @fachryxyf/scorpio-guard@0.3.0   # recommended
npm install github:Fachryxyf/scorpio-guard   # from source, builds on install
```

`0.2.0` added the networked KV store (D60), the only way to get durable trust state on
serverless. The soak runs behind this release cover the memory and sqlite stores; the KV
store has not run in production here, and the [limits page](https://scorpio-guard.fachryxyf.com/limits.html)
records what that leaves unproven.

The version policy is in [docs/SEMVER.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/SEMVER.md): a patch keeps the advice, a
minor may move it and records every move, and a removal is always a major. The upgrade
from 0.1.0 is [docs/MIGRATION.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/MIGRATION.md), measured against the published
tarball: the API only gained names, and the advice changes are listed with what they
replace. The surface is held by the API check against `api/v0.3.json`, decided in D74.

Node 22.13 or newer, ESM only. Four entry points: `.` for the model, `./collect` for
the browser collector, `./sqlite` for the single-host durable store, `./kv` for the
networked one: on one version number so they cannot be installed mismatched.

A first integration is written out as a checklist in [docs/TESTING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/TESTING.md):
the four parts an integration has, the two mistakes that make results meaningless (the
entity key and the scope granularity), the decision journal that makes calibration
possible later, and what to send back when the advice looks wrong.

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

// The key is yours: any stable reference your app already has. SG never interprets it.
const sessionId = 'session_9f2c';

const result = await guard.evaluate({
  entity: sessionId,
  observation: { scope: 'checkout', data: { from: 'cart', to: 'payment' } },
  context: { endpoint: '/pay' },
});

result.decision;   // 'RESTRICT', advice, never enforcement
result.trust.stage; // 'unknown' | 'developing' | 'established'
result.hardViolated; // true when a proof, not a probability, decided it
result.coldStart;  // true when no retained state existed
result.trace;      // why, in the order that decided it
```

The advice is a rung, not an action. `ALLOW` proceeds, `OBSERVE` records without
user-visible cost, `INCREASE_FRICTION` adds a challenge or a delay, `RESTRICT` refuses
this action, and `BLOCK` refuses everything for the entity. The mapping from rung to status
code is yours; the [usage page](https://scorpio-guard.fachryxyf.com/usage.html#decisions)
writes one out as code, and `result.trust.proposed`, `result.trust.capped` and
`result.hardViolated` say which dimension decided it.

Log `trace` from the first day. Four independent dimensions feed one outcome, so an
unexplained decision cannot be debugged after the fact: which is why the trace is
part of the return value rather than a debug flag.

If you already run a collector, take the same occasion as a structured event instead
of parsing log lines (D61):

```js
const metrics = []; // your sink: a metrics client, a table, a log

const guard = createGuard({
  invariants: [checkoutOrder],
  onAssessment: (event) => metrics.push(event),
  identity: { kind: 'hash', salt: process.env.GUARD_SALT },
});

event.schemaVersion; // 1, bumped only when a field changes meaning
event.decision;      // the advice
event.stage;         // 'unknown' | 'developing' | 'established'
event.trust;         // mean, variance, mass, band, proposed, ceiling, capped
event.violations;    // which invariant, which class, which strength
event.durationMs;    // measured, not inferred from the clock
event.entity;        // absent unless `identity` asks: a hash, never the reference
event.storeDegraded; // true when a store operation missed its deadline (D76)
event.integrationWarning; // present when the integration itself looks misconfigured (D78)
```

The reference is withheld by default, because an event log leaves your process with
weaker retention rules than the state it describes. Reporting cannot change the
advice: the sink is called after the decision is final, and the guard does not wait
for it, so a slow collector costs you events rather than latency.

A first-time entity is advised `ALLOW` at stage `unknown`: lack of evidence is not
negative evidence. A brand-new entity that breaks a `hard` invariant is still
restricted.

Weak signals are passed by catalogue id, and are treated as measurement rather than
proof: they become negative evidence and nothing more:

```js
import { WEAK_SIGNALS } from '@fachryxyf/scorpio-guard';

await guard.evaluate({
  entity: sessionId,
  observation: { signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_BREADTH_OF_TARGET'] },
});
```

Ids the catalogue does not know are ignored rather than treated as suspicious.
`WEAK_SIGNALS` documents each one: what it measures, what it is worth, a plausible
innocent cause, and whether SG already computes it for you.

The default store is process-local, so trust does not survive a restart. For
anything that restarts, serverless, a supervised process, a container, use the
durable store:

```js
import { createGuard } from '@fachryxyf/scorpio-guard';
import { sqliteStore } from '@fachryxyf/scorpio-guard/sqlite';

const guard = createGuard({ store: sqliteStore({ path: './trust.db' }) });
```

Still no dependencies: `node:sqlite` is in the standard library. Behavioral history
is personal data, so treat that file as such: `guard.forget()` deletes a row, and
retention expiry deletes it for you.

On serverless, the filesystem is as ephemeral as the process, so neither store above
survives a cold start. Use the networked one (D60); it talks HTTP through `fetch`,
so there is still no dependency to install:

```js
import { createGuard } from '@fachryxyf/scorpio-guard';
import { kvStore, upstashTransport } from '@fachryxyf/scorpio-guard/kv';

const guard = createGuard({
  store: kvStore({
    transport: upstashTransport({ url: process.env.KV_URL, token: process.env.KV_TOKEN }),
    onError: (error, operation) => log.warn({ error, operation }, 'trust store degraded'),
  }),
});
```

A transport failure reads as a cold start rather than throwing, because the guard is
advisory and a KV outage must not take your request path down with it. Failing open
is not free to do silently, though: `kvStore` refuses to be constructed without
`onError` unless you pass `failOpen: false` (D62). Wire that sink to an alert. A
store that has been failing quietly for a month looks exactly like one that works,
and the dimension it feeds never recovers on its own.

The wait itself is bounded since 0.3.0: the evaluation's store operations share a
deadline, `storeDeadlineMs` (default 100 ms, D76), measured in the field at about
305 seconds of hang per request before it existed. Past the deadline the evaluation
answers without retained state and carries `storeDegraded: true` — alert on a run
of those, because they are an outage, not traffic.

Deleting an entity's history is one call, and it is the same code path retention
uses with the horizon forced to zero:

```js
await guard.forget(entity);
```

Every tunable number lives in `src/core/policy.ts` (the store's own deadline default
lives beside the store, in `src/core/store.ts`) and is overridable per guard:
half-life, retention, evidence weights, the epistemic stage thresholds, what a
proven violation advises, the diversity thresholds. All of them are reasoned
guesses set leniently, so being wrong withholds escalation rather than
manufacturing a false positive. The [documentation site](https://scorpio-guard.fachryxyf.com) tabulates each one
with what changing it means, generated from source at build time (D58).

## Development

Requires Node 22.13 or newer, tests run TypeScript directly, with no build step.

```
npm install
npm test          # node:test, no framework
npm run replay    # persona traffic against the HealthMe flow (the 0.2.x-era target)
npm run observe   # observing proxy in front of a live origin (D56)
npm run visitors  # drive a real browser at it (D57)
npm run observed  # read what the observer recorded (var/live-traffic.jsonl)
npm run example:integration  # the worked node:http and Express integration
npm run site      # build the documentation site into site/dist (gitignored)
npm run typecheck
npm run build     # emits dist/
npm run bench     # evaluation cost per store, checked against bench/budget.json
npm run soak      # bounded state and memory under a fixed pool (docs/SOAK.md)
npm run soak:flood  # the same checks while every request mints a fresh reference
npm run calibrate # the policy grid over the recorded lab runs (docs/DATASET.md)
npm run calibrate:host  # the same grid over the first real integration's journal (partner data)
npm run poison    # what patience buys an attacker, priced (docs/POISONING.md)
npm run protocol:serve  # the reference receiver for the v0.1 wire format
npm run protocol:check  # both implementations against the fixtures, plus HTTP behaviour
npm run pack:check            # pack, inspect, install the tarball somewhere empty
npm run claims    # regenerate docs/CLAIMS.md from DECISIONS.md and the tests
npm run api       # record or rewrite the frozen API surface (api/v0.3.json)
npm run check:api # the built declarations must match the frozen surface
npm run check:manifest        # manifest and lockfile must agree
npm run check:docs            # numbers in the README must match the rendered site
npm run check:claims          # docs/CLAIMS.md must not be stale
```

Every command in that last group fails when a claim is false rather than when a file
is missing, which is the only kind of gate worth having: they caught a pnpm field
sneaking back into a repository that installs with npm, a lockfile two version bumps
behind, and a test count that had been stale in the README since the suite grew.

The observer writes into `var/`: `live-traffic.jsonl` for the record and
`sg-live.db` for its trust state. That directory is ignored: the record is real
visitors' shape, never committed.

The documentation site is generated into `site/dist` and published from there by
`.github/workflows/pages.yml`. No generated HTML is committed, so the site cannot
drift from the code that renders it.

### What exists

`src/core/`, the model, with no platform dependencies:

- `trust.ts`: Beta-Bernoulli state, half-life decay over real elapsed time, retention.
- `assess.ts`: trust and uncertainty bands, and the ceiling that caps escalation.
- `decision.ts`: the five-rung decision spectrum.
- `symptoms.ts`: the two-tier symptom vocabulary. Not exported: nothing transmits yet.
- `behavior.ts`: the anomaly feature space, and the diversity signal it feeds.
- `constraints.ts`, `transitions.ts`: declared invariants, the seven classes, and what a violation means.
- `signals.ts`: the weak-signal catalogue and how observed signals become mass.
- `store.ts`: the `StateStore` interface and an in-memory implementation.
- `conformance.ts`: runnable contract checks for any store you write.
- `event.ts`: the versioned assessment event and its optional hashed identity (D61).
- `guard.ts`, `createGuard()` and `evaluate()`: composing the above.
- `policy.ts`, `clock.ts`: tunable values in one place, and an injectable clock.

`src/collect/`, browser-side observation, imported from `@fachryxyf/scorpio-guard/collect`. Counts interaction; records nothing about content.

`src/store/sqlite.ts`, a durable store on `node:sqlite`, imported from
`@fachryxyf/scorpio-guard/sqlite`. Still zero dependencies, since it is in the
standard library. The in-memory default is process-local, so every restart is a cold
start; this one survives a restart and is shared across processes on one host. All
three pass the same conformance kit.

`src/store/kv.ts`, a networked store over an injected KV transport, imported from
`@fachryxyf/scorpio-guard/kv` (D60). This is the only adapter that survives a
serverless deployment, where every invocation is a fresh process. Its default failure
policy is fail-open: a transport error is read as missing state, which keeps the host
available and the hard invariants enforced, but lets an attacker who can cause an
outage reset an entity's statistical history to cold start. Failing open therefore
requires an `onError` sink, in the type and at construction, because a store failing
open in silence is indistinguishable from one that works (D62). Set `failOpen: false`
if that trade is wrong for the deployment. All four topologies, and what each one
loses when it fails, are in [docs/DEPLOYMENT.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/DEPLOYMENT.md).

`examples/harness/`, `examples/lab/`, and the observing proxy in `examples/ixfe/live/`
are the traffic instruments, not product code: a persona is a sequence of interactions
with the gaps between them, the lab drives real Chrome instances against shipped sites,
one declared persona per instance, and `cdp.ts` is a ~180-line DevTools Protocol client
over Node's `WebSocket` global, written instead of installing Puppeteer so the
zero-dependency promise holds in the examples too.

**Integration evidence, in the order it was gathered.** Two lab runs — 129 and 1,656
labelled requests, zero false positives, frozen into fixtures that replay on every push
(D63-D67) — are the falsification instrument, recorded in
[docs/DATASET.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/DATASET.md).
The first real deployment — a CRM host running 0.2.0 for 92 hours of production traffic —
produced 578,365 journaled evaluations and a 5,123-row labelled staging export, replayed
against the policy grid in 0.3.0: the shipped constants held, and the findings became
D76-D80
([docs/v0.3.0/HOST-DATASET.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/v0.3.0/HOST-DATASET.md)).
The earlier targets of that era, IXFE and HealthMe, are offline; their record lives in
[docs/v0.2.0/TARGETS.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/v0.2.0/TARGETS.md),
kept under the names it was measured under.

Three hundred and seventy-eight tests, which double as the record of every numeric and
semantic property the design depends on. [docs/CLAIMS.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/CLAIMS.md) maps each
design decision to the test that names it, and lists the ones that are still prose
only, generated rather than maintained by hand.

Writing your own store? Prove it works before trusting it:

```js
import { checkStoreConformance, assertConformant } from '@fachryxyf/scorpio-guard';

assertConformant(await checkStoreConformance(() => myRedisStore()));
```

Eleven checks, no framework. They exist because a store that is subtly wrong
produces a guard that is subtly wrong, silently: a second-resolution timestamp
column breaks decay, dropping the observation window disables anomaly detection,
and trimming a key merges two entities. The kit caught the reference in-memory
store handing back a mutable object on its first run.

Trust is read through an epistemic stage over evidence mass `n = alpha + beta`, so
an unknown entity contributes nothing to the decision, while a hard-constraint
violation still decides on its own authority. See D39 and D40 in the design record
for how that was arrived at.

### What does not exist

The prescription client, and a server to receive symptom reports. Both wait on
decisions in the design record rather than on effort.

An anomaly *classifier* over the feature space now exists: `src/core/anomaly.ts`,
D52: and its score is reported on every assessment. It does not drive the decision by
default: it is a distance-to-reference model rather than a trained one, because no
labelled traffic exists to train against (D34), and training on generated personas
would report the author's assumptions back as findings.

More importantly: the thresholds have met exactly one real deployment. The first
host integration ran 0.2.0 for 92 hours of production traffic and its labelled
staging journal has been replayed against the policy grid (`docs/DATASET.md`, host
section): the shipped constants held, and the integration's false positives traced
to host-side attribution, not to the model. That is one deployment, not a
population — every threshold remains a reasoned guess that one dataset failed to
falsify. The HealthMe harness (`examples/healthme/`) replays its real flow, which is
enough to catch a contradiction but not enough to calibrate a threshold.

## The integration record, and what it cannot claim

The first two integration targets, IXFE and HealthMe, are offline. What they showed,
what that traffic measured without fixing, and what it falsified are archived in
[docs/v0.2.0/TARGETS.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/v0.2.0/TARGETS.md).
Two claims from that era are asserted as tests and still hold: no legitimate persona is
advised anything a user would feel, and no adversary walks through untouched. Its
falsifications — the `developing` ceiling, scope entropy, an unprovable `hard`
declaration, the saturation gate — are recorded in the decisions of that version and
corrected the model in place.

The live evidence is the lab and the first real deployment, both linked from
[What exists](#what-exists) above. What the lab cannot do is stated in
[docs/DATASET.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/DATASET.md)
and what one deployment cannot do in
[docs/v0.3.0/HOST-DATASET.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/v0.3.0/HOST-DATASET.md):
neither is a population, so every threshold remains a reasoned guess that two datasets
have failed to falsify.

## Roadmap

Stages, the list of holes, and the exit criteria for each milestone: [docs/ROADMAP.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/ROADMAP.md).

Done: the core model, three stores behind one conformance kit, the browser collector,
the enumeration tasks closed over proof sources (D41-D43), generated persona traffic
that corrected the model four times (D45-D49), the lab with frozen fixtures replayed in
CI (D63-D67), the v0.1 wire format running end to end (D70, D71), the 0.2.0 release
gates (D74, D75), and 0.3.0's field-driven changes (D76-D80).

What remains needs real traffic, in order:

1. A real population. Not visits; those can be produced, but their *distribution*: how many real clients look like each persona. This is the honest residue of D45 and the one thing generated traffic can never supply.
2. Calibrate the intake discount. `maxInterArrivalCv = 0.25` is inherited from D36, and it decides how much trust a legitimate machine client is denied.
3. Calibrate the anomaly reference profile, and decide from measurement whether the classifier or the threshold conjunction should drive the D37 concurrence.
4. Give each collector its false-positive story from real traffic before any of them earns a production threshold.
5. Move the wire format to its own repository and build a server that speaks it.
6. Only then: investigate encoding schemes for symptom transmission.

## Open Protocol, Not a Proprietary Backend

An open-core split, with one important refinement.

- **Open**: the library *and* the protocol: how a symptom is formatted, how a prescription is structured, the shared vocabulary.
- **Closed**: the *rule content* of any given server implementation. Publishing exact thresholds hands attackers a fixed target to route around.

The reference server is **one implementation**, not a structural requirement. Anyone, a company, another community, even a competitor, can run their own against the same protocol. Same shape as DNS, SMTP, ActivityPub, Let's Encrypt.

This removes the single point of failure, lets compliance-sensitive adopters self-host, and reframes the project as a standard rather than a lock-in. The cost: the symptom vocabulary becomes a **public spec**, versioned, conservative, extensible, and load-bearing for everyone downstream.

## Contributing

The library and protocol are the community surface: hard-constraint discoveries,
pattern reports, false-positive cases. At this stage discussion is worth more than
code, the most valuable contribution is evidence that a number is wrong, not a
patch that changes it. See [CONTRIBUTING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/CONTRIBUTING.md) for what helps most
and the house rules, and [SECURITY.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/SECURITY.md) for what the guard does and
does not claim, plus private vulnerability reporting.

## Links

- Site: [scorpio-guard.fachryxyf.com](https://scorpio-guard.fachryxyf.com)
- Audit: [docs/PROJECT_AUDIT.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/PROJECT_AUDIT.md)
- Author: [@Fachryxyf](https://github.com/Fachryxyf)
