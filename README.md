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

**Status: 0.2.0, pre-1.0, not on npm yet.** The npm account behind the package is suspended for 72 hours as of 2026-10-25, so publishing is blocked until roughly 2026-10-28; the registry still serves 0.1.0. [docs/RELEASING.md](docs/RELEASING.md) carries the blocker and the runbook, and the versions page carries the dates.  The core model is built and tested, the package installs from its tarball, and the v0.1 protocol has fixtures, a reference receiver, and a batching sender. Three things still stand between this and 1.0.0: an independent security review, a 24 hour soak, and thresholds calibrated against a real traffic mix rather than the two lab runs recorded in [docs/DATASET.md](docs/DATASET.md). The claims a gate enforces today, the risks that are priced instead, and the size of each gap are on the [guarantees page](https://scorpio-guard.fachryxyf.com/guarantees.html), with the test or decision behind every row (D75). What follows is the design, and where the code has caught up to it.

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

## Open Protocol, Not a Proprietary Backend

An open-core split, with one important refinement.

- **Open**: the library *and* the protocol: how a symptom is formatted, how a prescription is structured, the shared vocabulary.
- **Closed**: the *rule content* of any given server implementation. Publishing exact thresholds hands attackers a fixed target to route around.

The reference server is **one implementation**, not a structural requirement. Anyone, a company, another community, even a competitor, can run their own against the same protocol. Same shape as DNS, SMTP, ActivityPub, Let's Encrypt.

This removes the single point of failure, lets compliance-sensitive adopters self-host, and reframes the project as a standard rather than a lock-in. The cost: the symptom vocabulary becomes a **public spec**, versioned, conservative, extensible, and load-bearing for everyone downstream.

## Open Problems

Named honestly, not hidden.

- **Symptom vocabulary**: the two-tier structure is settled (D43) and the v0.1 wire format is in [PROTOCOL.md](PROTOCOL.md), with its degradation rules tested (D53), its cases in `protocol/fixtures/v0.1/`, and a reference receiver plus a batching sender in `examples/protocol/` (D70, D71). The library itself still transmits nothing: no import opens a socket, and the sender is an example rather than a default.
- **Signal encoding**: the transmitted representation should be decodable *only* by the server, even though the library's source is public. Edges into one-way embeddings and server-issued transformation recipes. Research direction, not a resolved design.
- **Cold start & sybil churn**: history-based trust is gamed by attackers who simply discard identities. Now measured rather than feared: the floor is one request per identity, at which point nothing accumulates at all. Two requests per identity and the guard engages.
- **Root of trust**: explicitly outside the library. It accepts an entity reference as a basis for measurement, never as proof of identity. [docs/ROOT-OF-TRUST.md](docs/ROOT-OF-TRUST.md) states the rule and the measured price of every way to break it (D72): one changed key discards six observations of distrust, earning the same standing back costs 25 positives, and a per-request proof is the one thing a rotated key cannot erase.
- **Poisoning resistance**: gradual baseline shifts where every individual step looks legitimate. Priced, not solved: [docs/POISONING.md](docs/POISONING.md) measures what patience buys (D73). A fresh identity is treated after three strong negatives, a constant-gap script stops buying tolerance at five however much it spends, and a script that removes the pacing tell buys one extra tolerated negative per 1.71 positives.
- **Saturation / farming**: closed in generated traffic by D55, after two failed attempts at the decision layer. A positive is priced by the shape of the gaps it arrived in, so machine-regular volume accrues almost nothing; negatives are never discounted. Every farmer tested now pays on the first abuse call, and positive-only automation tops out at `OBSERVE`. Uncalibrated: the threshold is inherited from D36.
- **Privacy/legal basis**: behavioral history is personal data under GDPR and Indonesia's UU PDP.
- **Sequencing**: is a durable public protocol worth designing *before* a proof-of-concept exists?

## Repositories

Three repositories, not a monorepo, see [REPOSITORIES.md](REPOSITORIES.md) for the reasoning and the planned scope of each.

| Repository | Visibility | Contains |
|---|---|---|
| `scorpio-guard` | Public | The TypeScript library. This repo. |
| `scorpio-guard-protocol` | Public | Symptom vocabulary and wire format. Spec only. Not started. |
| `scorpio-guard-server` | Private | Rust reference server. Rule content. Not started. |

## Design Record

Every design decision is recorded in [DECISIONS.md](DECISIONS.md): the question,
the answer, the reasoning, and what each answer commits the implementation to.
Read it before proposing a change to the model, several obvious-looking
alternatives were considered and rejected there for reasons worth knowing.

Sixty-three entries is more than anyone reads front to back, so the site carries a
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

Published at `0.1.0`, MIT, zero runtime dependencies (D59). Pin the exact version
rather than a caret range: no threshold in this library is calibrated, so a minor
bump can change advisory behavior, and `^0.1.0` would pull that in silently.

```
npm install @fachryxyf/scorpio-guard@0.1.0   # recommended
npm install github:Fachryxyf/scorpio-guard   # from source, builds on install
```

`0.2.0` is set in `package.json` on `main` and blocked from publishing by the account
suspension above, not by a gate. It adds the networked KV store (D60), the only way to get
durable trust state on serverless, so install from source until it is published.

The version policy is in [docs/SEMVER.md](docs/SEMVER.md): a patch keeps the advice, a
minor may move it and records every move, and a removal is always a major. The upgrade
from 0.1.0 is [docs/MIGRATION.md](docs/MIGRATION.md), measured against the published
tarball: the API only gained names, and the advice changes are listed with what they
replace. The surface is held by the API check against `api/v0.2.json`, decided in D74.

Node 22.13 or newer, ESM only. Four entry points: `.` for the model, `./collect` for
the browser collector, `./sqlite` for the single-host durable store, `./kv` for the
networked one (unreleased): on one version number so they cannot be installed
mismatched.

A first integration is written out as a checklist in [docs/TESTING.md](docs/TESTING.md):
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

const result = await guard.evaluate({
  entity: sessionId, // any stable reference; SG never interprets it
  observation: { scope: 'checkout', data: { from: 'cart', to: 'payment' } },
  context: { endpoint: '/pay' },
});

result.decision;   // 'RESTRICT', advice, never enforcement
result.trust.stage; // 'unknown' | 'developing' | 'established'
result.hardViolated; // true when a proof, not a probability, decided it
result.coldStart;  // true when no retained state existed
result.trace;      // why, in the order that decided it
```

Log `trace` from the first day. Four independent dimensions feed one outcome, so an
unexplained decision cannot be debugged after the fact: which is why the trace is
part of the return value rather than a debug flag.

If you already run a collector, take the same occasion as a structured event instead
of parsing log lines (D61):

```js
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
  observation: { signals: ['SIG_UNIFORM_DELAY_SHAPE', 'SIG_BROAD_ENUMERATION'] },
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

Deleting an entity's history is one call, and it is the same code path retention
uses with the horizon forced to zero:

```js
await guard.forget(entity);
```

Every tunable number lives in `src/core/policy.ts` and is overridable per guard:
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
npm run replay    # persona traffic against the HealthMe flow
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
npm run poison    # what patience buys an attacker, priced (docs/POISONING.md)
npm run protocol:serve  # the reference receiver for the v0.1 wire format
npm run protocol:check  # both implementations against the fixtures, plus HTTP behaviour
npm run pack:check            # pack, inspect, install the tarball somewhere empty
npm run claims    # regenerate docs/CLAIMS.md from DECISIONS.md and the tests
npm run api       # record or rewrite the frozen API surface (api/v0.2.json)
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
loses when it fails, are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

`examples/harness/`: the application-independent parts: a persona is a sequence of
interactions with the gaps between them, and the replay drives one through a guard.
Outside `src/` on purpose, since it generates *test* traffic.

**The targets, since 2026-10-25.** `ixfe.pro` and the HealthMe app are offline: the first
times out and the second no longer resolves, both checked from this machine on that date. The
lab observes `aufsicht.dev` and `talkhere.life` now, both answering, declared in
`examples/lab/targets.ts` by origin with an optional local build. Everything below that names
IXFE or HealthMe is the record of what was measured while those sites were up, kept under the
names it was measured under, because renaming measured rows to look current would be
invention. What that record has and the live pair does not is a declared invariant, so a
proven violation is not available from two static sites until a live target declares one
again.

`examples/ixfe/`, the primary target while it was online (D47): invariants declared across all
six proof sources, and personas read off IXFE's own defences.

`examples/healthme/`, the first target (D34), kept as the small-application
regression: two scopes, one user.

`examples/ixfe/live/`, the observing proxy, a real-browser visitor generator, and
their report (D56, D57). A transparent hop in front of a live IXFE deployment: the
origin's response goes out untouched, and the guard is consulted afterwards, so a bug
in SG costs a log line rather than a visitor's pre-order. `cdp.ts` is a ~180-line
DevTools Protocol client over Node's `WebSocket` global, written instead of installing
Puppeteer so the zero-dependency promise holds in the examples too.

A traffic lab in `examples/lab/`: real Chrome instances against shipped sites, one
declared persona per instance, each run recorded as a labelled dataset with its seed
and browser version. [docs/DATASET.md](docs/DATASET.md) carries both recorded runs and
reports what they found rather than what they hoped. The first, 129 requests across two
static builds, showed that a page view carries no evidence: zero false positives, six
adversarial misses, all with one cause (D63). The second added the IXFE landing service,
where a form post and a hidden field can be priced, and ran every persona as eight
different visitors so a short visit still counts: 1656 requests, 24 personas, zero false
positives, seven misses (D66). `npm run calibrate` replays those rows under a grid of
nine policies; the shipped cell is the best of the nine, and the half-life axis is a
measured plateau because the run lasts minutes (D64). The anomaly score is not one of
the axes: on the recorded traffic no threshold on it beat the evidence policy, so it
stays reported and does not decide (D67). Both runs are frozen into
`examples/lab/fixtures/` and replayed on every push, so a change that moves any decision
fails CI rather than being found in production (D65).

Three hundred and fifty-six tests, which double as the record of every numeric and
semantic property the design depends on. [docs/CLAIMS.md](docs/CLAIMS.md) maps each
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
| Normal daily unlock, one week | allows | `ALLOW` / `OBSERVE`, never friction |
| Three mistyped PINs | 5-minute lockout | `OBSERVE`, stage `developing` |
| `POST /api/chat` with no unlock in session | **allows** | `RESTRICT`, provable violation |
| Session restore from `sessionStorage` | allows | `ALLOW`, not mistaken for replay |
| 20 scripted attempts | rejects, counter resets on cold start | `INCREASE_FRICTION`, stage `established` |

Two disagreements. A forged API call passes HealthMe's origin check and its
cold-start-porous IP limit, while the guard sees that `js/core.js`, the only
caller: could not have been loaded. And three mistyped PINs cost a real user five
minutes under a 3-strike rule, where the guard reads `n = 3.5` as *developing*:
not enough evidence to act on.

### What it does not show

Stated plainly, because the temptation is to read more into this than it carries:

- **The library works against a real flow. That is a smoke test, not a validated
  thesis.** HealthMe has one user, so there is no sustained abuse for asymmetric
  cost to act against.
- **The interesting finding came from the hard-constraint layer**: which is the
  least novel part of the design, set membership, expressible as one `if`. The
  parts that are actually new (Beta trust, half-life decay, the epistemic stage,
  the diversity signal) were never exercised, because no traffic here can exercise
  them.
- **No threshold is calibrated by this.** Every number in the model remains a
  reasoned guess.

A target that can validate the thesis needs unauthenticated traffic, data worth
scraping, and a real adversary. See D34 in the design record.

## Generated Traffic

The primary target was **IXFE** (`ixfe.pro`), a competitor-intelligence platform with
three deployables, an unauthenticated pre-launch funnel, and a credit ledger where one
request spends real money: `marketplace_global` costs 12 credits and makes a Google
Places call per market, billed to the operator whether or not the caller was
legitimate. An attacker needs a motive, and that is one.

Its production traffic is one operator's, so the traffic is generated: seeded personas
driven through the invariants declared from IXFE's own flow.

```
npm run replay
```

```
persona                kind       worst advice       at        stage        verdict
preorder-buyer         legit      OBSERVE            @5/6      developing   as intended
typo-retry             legit      OBSERVE            @4/4      developing   as intended
working-customer       legit      OBSERVE            @4/82     established  as intended
ran-out-of-credits     legit      OBSERVE            @3/4      developing   as intended
activated-founder      legit      OBSERVE            @3/4      developing   as intended
endpoint-shooter       adversary  RESTRICT           @1/30     established  as intended
honeypot-filler        adversary  INCREASE_FRICTION  @3/20     established  as intended
otp-grinder            adversary  RESTRICT           @7/35     established  as intended
webhook-forger         adversary  RESTRICT           @1/25     established  as intended
activation-replayer    adversary  RESTRICT           @2/10     developing   as intended
credit-drainer         adversary  INCREASE_FRICTION  @12/42    established  as intended
post-launch-replayer   adversary  RESTRICT           @1/12     developing   as intended
pending-freeloader     adversary  RESTRICT           @1/15     established  as intended
```

The adversaries are not invented. Every mitigation already in IXFE's code records an
attack its author expected, so each persona is read off a real defence: the honeypot
field, the `dwell` time-trap, the per-code OTP cap, the 404 on an unknown
`external_id`, the `activation_consumed` primary key, the 410 after launch. One
persona has no matching defence: `credit-drainer` holds a valid session and every
request is correctly authorised: which is exactly why it has to be caught by the
statistical layer or not at all.

HealthMe is kept as the small-application regression: two scopes, one user. That is
what caught the entropy bug below, and a harness that only ran against a large surface
would have missed it.

Two claims are asserted as tests: no legitimate persona is ever advised anything a user
would feel, and no adversary walks through untouched. The rest is output meant to be
read, because a threshold gets argued about from numbers rather than prose.

**This falsifies; it does not calibrate.** If a persona built from honest usage gets
escalated, a threshold is wrong regardless of where the traffic came from. But real
populations are not drawn from these distributions, and an attacker who reads the file
can shape traffic around it, so numbers derived here are hypotheses, never
conclusions.

### What it falsified

- **The `developing` stage ceiling was one rung too high.** Two mistyped PINs, and an
  autofilled password manager, were both advised `INCREASE_FRICTION`. The middle stage
  is meant to let trust *influence* a treatment without *driving* it, and `OBSERVE` is
  the only rung that does that. The old value also made the stage boundary a cliff:
  silence at `n = 2.9`, friction at `n = 3`.
- **Scope entropy was normalised against the window size**: which made it depend on
  how many scopes the *application* has rather than how varied the *entity* was. A
  two-scope app could not reach the diversity threshold at all, so its most honest
  user was scored monotonous for the entire run. Now normalised against the scopes
  actually observed, so it measures balance while `distinctScopes` measures breadth.
- **A `hard` declaration that was not provable.** "Paid work requires enough credits"
  looks provable and is not: the client's view of its balance is stale by construction,
  since jobs bill asynchronously and another tab may have spent the difference. One
  refused request is how a person discovers their balance; a hundred is a script. Now
  `soft`. Being *enforced by the server* is not the same as being *provable*.
- **The saturation guard does not do what it claimed.** `D37` was recorded as the fix
  for an attacker farming uniform volume into unearned confidence. It cannot be:
  farming produces a high mean, a high mean proposes `ALLOW`, and a ceiling can only
  *lower* a decision: so the gate is unobservable for exactly the entity it targeted.
  Measured: 300 uniform positives absorb **17** strong negatives before leaving
  `ALLOW`. The claim is withdrawn and farming is an open problem again.

### What it measured, without fixing

- **Uniform jitter buys an attacker nothing.** Fixed-sleep and `uniform(1.2s, 2.3s)`
  brute forces escalate at the same step, which is the design's own claim about the
  shape of randomness surviving its counterexample.
- **Identity churn works against accumulation, and proof ignores it.** Against
  accumulated evidence the floor is two requests per identity, at one, nothing ever
  accumulates. But where a violation is *provable*, churn buys nothing at all:
  IXFE's endpoint-shooter is caught on request one, with no history, because a missing
  `dwell` is a proof rather than a guess.
- **A 404 is not a memory.** IXFE already answers correctly at every one of these
  endpoints. What it cannot do is remember: the webhook forger can guess `external_id`
  forever and each refusal is a discarded log line. Turning refusals into accumulating
  evidence about the caller is the argument for the library, in a place where it is
  checkable.
- **Ten honest days buy about eleven abuse calls** before `RESTRICT`. That head start
  is the price of having a memory; the bound is now asserted.

## Roadmap

Rencana bertahap, daftar hole, dan exit criteria tiap milestone: [docs/ROADMAP.md](docs/ROADMAP.md).

Done: the core model, the pluggable store with its conformance kit and a durable
SQLite implementation, the browser collector, two integration targets with declared
invariants, the three enumeration tasks, the constraint taxonomy closed over proof
sources (D41), the weak-signal catalogue (D42), the two-tier symptom vocabulary
(D43): and generated persona traffic that exercises the probabilistic model and has
corrected it four times (D45–D49).

Generated persona traffic against IXFE exercises the statistical layer and has
falsified four claims so far.


Since then, four things that needed no traffic: farming answered on mass through a
velocity ceiling (D50), a collector for every catalogued signal (D51), the anomaly
classifier built as distance-to-reference rather than trained (D52), and a v0.1 wire
format with its degradation rules tested (D53).

Since then, the instrument for real traffic exists (D56) and has been used (D57).
Looking for IXFE's real logs found there were none to read, neither service records
one row per request, and per-request rows are the only shape the behavioral window can
be computed from: so an observing proxy now sits in front of the live origin and
writes them. A real Chrome is then driven at it, because the site has no audience to
wait for.

That falsified four things, all of them in the integration rather than the model: a
200 carrying the SPA fallback was being credited as a success, one scope for every
page reproduced D46's entropy bug, weak signals on page views made the operator's own
uptime check a false positive, and two harness bugs would have read as model
behavior. See D57.

What remains needs real traffic, in order:

1. A real population. Not visits; those can be produced, but their *distribution*: how many real clients look like each persona. This is the honest residue of D45 and the one thing generated traffic can never supply.
2. Calibrate the intake discount. `maxInterArrivalCv = 0.25` is inherited from D36, and it decides how much trust a legitimate machine client is denied.
3. Calibrate the anomaly reference profile, and decide from measurement whether the classifier or the threshold conjunction should drive the D37 concurrence.
4. Give each collector its false-positive story from real traffic before any of them earns a production threshold.
5. Move the wire format to its own repository and build a server that speaks it.
6. Only then: investigate encoding schemes for symptom transmission.

## Contributing

The library and protocol are the community surface: hard-constraint discoveries,
pattern reports, false-positive cases. At this stage discussion is worth more than
code, the most valuable contribution is evidence that a number is wrong, not a
patch that changes it. See [CONTRIBUTING.md](CONTRIBUTING.md) for what helps most
and the house rules, and [SECURITY.md](SECURITY.md) for what the guard does and
does not claim, plus private vulnerability reporting.

## Links

- Site: [scorpio-guard.fachryxyf.com](https://scorpio-guard.fachryxyf.com)
- Audit: [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md)
- Author: [@Fachryxyf](https://github.com/Fachryxyf)
