# Scorpio Guard

[![CI](https://img.shields.io/github/actions/workflow/status/Fachryxyf/scorpio-guard/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/Fachryxyf/scorpio-guard/actions/workflows/ci.yml)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Stage](https://img.shields.io/badge/stage-implementation-blue?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Model](https://img.shields.io/badge/model-open%20core-6f42c1?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Issues](https://img.shields.io/github/issues/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/issues)
[![Last commit](https://img.shields.io/github/last-commit/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/commits)
[![Stars](https://img.shields.io/github/stars/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/stargazers)
[![Site](https://img.shields.io/badge/site-scorpio--guard.fachryxyf.com-2ea44f?style=flat-square)](https://scorpio-guard.fachryxyf.com)

> Trust is a spectrum, not a verdict. Adaptive trust evaluation for web interactions, a local library, not a centralized gatekeeper.

**Status: 0.3.0, pre-1.0.** Install with `npm install @fachryxyf/scorpio-guard`. Which version the registry serves today, and the date each one landed, are on the [versions page](https://scorpio-guard.fachryxyf.com/versions.html), because a README carried inside a tarball cannot keep that fact true. npm suspended the account behind the package for 72 hours on 2026-10-25 after a security-sensitive action; [docs/RELEASING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/RELEASING.md) carries the record and the runbook. The core model is built and tested, the package installs from its tarball, and the v0.1 protocol has fixtures, a reference receiver, and a batching sender. Two things still stand between this and 1.0.0: an independent security review, and thresholds calibrated against a real traffic mix rather than the two lab runs recorded in [docs/DATASET.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/DATASET.md). The 24 hour soak that was the third proof finished on 2026-10-28 and is recorded in [docs/SOAK.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/SOAK.md). The claims a gate enforces today, the risks that are priced instead, and the size of each gap are on the [guarantees page](https://scorpio-guard.fachryxyf.com/guarantees.html), with the test or decision behind every row (D75).

**In a hurry:** [Install](#install), [Usage](#usage), [docs/TESTING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/TESTING.md). The design and its boundaries are in [ARCHITECTURE.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/ARCHITECTURE.md).

## Install

```
npm install @fachryxyf/scorpio-guard
```

`0.3.0` is the finalization release: no code, no exported name, and no advice for the
same input and the same stored state changed (D76). It exists because the README inside
the `0.2.0` tarball still told a reader that `0.2.0` was unpublished, and that text is
frozen at publish time; the record and the landing page had drifted from what shipped,
and `0.3.0` closes that gap. Every release since `0.2.0` is uploaded by the tag-triggered
workflow with an attestation that `npm audit signatures` verifies in a clean install;
`0.1.0` has none. MIT, zero runtime dependencies (D59). The date each version landed, and
what the registry serves today, are on the [versions page](https://scorpio-guard.fachryxyf.com/versions.html).

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
replace. The surface is held by the API check against `api/v0.2.json`, decided in D74.

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

## What exists

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
and browser version. [docs/DATASET.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/DATASET.md) carries both recorded runs and
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

More importantly: nothing has met real production traffic. Every threshold in the
model is a reasoned guess. The HealthMe harness replays its real flow, which is
enough to catch a contradiction but not enough to calibrate a threshold.

## Evidence so far

The full record of both integrations and the falsifications they produced is in
[ARCHITECTURE.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/ARCHITECTURE.md). In brief: HealthMe's replayed flow disagrees with its
own defences exactly twice, once in the guard's favor (a forged API call the origin
check passes) and once in the user's (a three-strike lockout where no evidence
exists to act on). Generated IXFE persona traffic leaves every legitimate persona at
`OBSERVE` or below and restricts every adversary, and it corrected the model four
times along the way (D45-D49): a stage ceiling one rung too high, entropy normalized
against the wrong base, a `hard` declaration that was not provable, and a saturation
guard that could not observe the entity it targeted. Two lab runs against static
sites add the calibration grid and the finding that a page view carries no evidence
(D63, D66), recorded in [docs/DATASET.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/DATASET.md).

| Scenario | HealthMe does | The guard advises |
|---|---|---|
| Normal daily unlock, one week | allows | `ALLOW` / `OBSERVE`, never friction |
| Three mistyped PINs | 5-minute lockout | `OBSERVE`, stage `developing` |
| `POST /api/chat` with no unlock in session | **allows** | `RESTRICT`, provable violation |
| Session restore from `sessionStorage` | allows | `ALLOW`, not mistaken for replay |
| 20 scripted attempts | rejects, counter resets on cold start | `INCREASE_FRICTION`, stage `established` |

## Open problems

- Symptom vocabulary: the two-tier structure is settled (D43) and the v0.1 wire format is in [PROTOCOL.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/PROTOCOL.md), with its degradation rules tested (D53), its cases in `protocol/fixtures/v0.1/`, and a reference receiver plus a batching sender in `examples/protocol/` (D70, D71). The library itself still transmits nothing: no import opens a socket, and the sender is an example rather than a default.
- Signal encoding: the transmitted representation should be decodable *only* by the server, even though the library's source is public. Edges into one-way embeddings and server-issued transformation recipes. Research direction, not a resolved design.
- Cold start & sybil churn: history-based trust is gamed by attackers who simply discard identities. Now measured rather than feared: the floor is one request per identity, at which point nothing accumulates at all. Two requests per identity and the guard engages.
- Root of trust: explicitly outside the library. It accepts an entity reference as a basis for measurement, never as proof of identity. [docs/ROOT-OF-TRUST.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/ROOT-OF-TRUST.md) states the rule and the measured price of every way to break it (D72): one changed key discards six observations of distrust, earning the same standing back costs 25 positives, and a per-request proof is the one thing a rotated key cannot erase.
- Poisoning resistance: gradual baseline shifts where every individual step looks legitimate. Priced, not solved: [docs/POISONING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/POISONING.md) measures what patience buys (D73). A fresh identity is treated after three strong negatives, a constant-gap script stops buying tolerance at five however much it spends, and a script that removes the pacing tell buys one extra tolerated negative per 1.71 positives.
- Saturation / farming: closed in generated traffic by D55, after two failed attempts at the decision layer. A positive is priced by the shape of the gaps it arrived in, so machine-regular volume accrues almost nothing; negatives are never discounted. Every farmer tested now pays on the first abuse call, and positive-only automation tops out at `OBSERVE`. Uncalibrated: the threshold is inherited from D36.
- Privacy/legal basis: behavioral history is personal data under GDPR and Indonesia's UU PDP.
- Sequencing: is a durable public protocol worth designing *before* a proof-of-concept exists?

## Design record

Every design decision is recorded in [DECISIONS.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/DECISIONS.md): the question,
the answer, the reasoning, and what each answer commits the implementation to.
Read it before proposing a change to the model, several obvious-looking
alternatives were considered and rejected there for reasons worth knowing.

Seventy-nine entries is more than anyone reads front to back, so the site carries a
[decision index](https://scorpio-guard.fachryxyf.com/#decisions), every entry
grouped by what it decides, with the file it turned into, and a
[glossary](https://scorpio-guard.fachryxyf.com/#glossary) for the terms used in a
narrower sense than usual: entity, evidence mass, hard versus soft, diversity,
advisory.

## Documentation map

| Document | What it is |
|---|---|
| [ARCHITECTURE.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/ARCHITECTURE.md) | The design: the premise, the two signal kinds, the recorded integrations, and what the traffic falsified. |
| [PROTOCOL.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/PROTOCOL.md) | The v0.1 wire contract: MUST-level rules, schemas, and degradation behavior. The protocol spec. |
| [DECISIONS.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/DECISIONS.md) | The design record: every decision, its reasoning, and what it commits the code to. Appended to, never renumbered. |
| [docs/TESTING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/TESTING.md) | How to integrate, test, and report a false positive. |
| [docs/ROADMAP.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/ROADMAP.md) | The hole list, the milestones, and the exit criteria for 1.0.0. |
| [docs/DATASET.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/DATASET.md) | The two recorded lab runs and what they found. |
| [docs/SOAK.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/SOAK.md) | The soak harness, its limits, and the recorded runs including the 24 hour run. |
| [docs/POISONING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/POISONING.md) | What sustained poisoning costs an attacker, priced by measurement (D73). |
| [docs/ROOT-OF-TRUST.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/ROOT-OF-TRUST.md) | The entity-key rule and the measured price of every way to break it (D72). |
| [docs/DEPLOYMENT.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/DEPLOYMENT.md) | Four store topologies and what each one loses when it fails. |
| [docs/RUNTIME.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/RUNTIME.md) | Where the library is promised, tested, and only argued to run. |
| [docs/SEMVER.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/SEMVER.md) | What a version number promises here, and how deprecation works. |
| [docs/MIGRATION.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/MIGRATION.md) | Upgrading from 0.1.0, and what 0.3.0 changes (nothing). |
| [docs/RELEASING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/RELEASING.md) | How a release ships, and the record of the npm account suspension. |
| [docs/SECURITY-REVIEW.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/SECURITY-REVIEW.md) | The packet for the independent security review, which is still open. |
| [docs/CLAIMS.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/CLAIMS.md) | Generated map of which decision is named by which test. |
| [docs/CLAIMS-NOTES.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/CLAIMS-NOTES.md) | Written reasons for the decisions no test can name. |
| [docs/archive/PROJECT-AUDIT.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/archive/PROJECT-AUDIT.md) | The October 2026 product audit, kept as a dated record. |
| [REPOSITORIES.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/REPOSITORIES.md) | The three-repository split, the reasoning, and the planned scope of each. |

## Repositories

Three repositories, not a monorepo. The reasoning and the planned scope of each are
in [REPOSITORIES.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/REPOSITORIES.md): the TypeScript library in this repo, the protocol
spec in `scorpio-guard-protocol`, and the Rust reference server, private, in
`scorpio-guard-server`. The last two are not started, by design (D29).

## Roadmap

The hole list, the milestones with their exit criteria, and the current status of
each are in [docs/ROADMAP.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/ROADMAP.md). Closed so far: the core model, the stores with
their conformance kit, the browser collector, the constraint taxonomy closed over
proof sources (D41), the weak-signal catalogue (D42), the two-tier symptom
vocabulary (D43), generated persona traffic that corrected the model four times
(D45-D49), farming answered on mass (D55), the anomaly classifier (D52), the
wire format (D53), the observing proxy and its real-browser driver (D56, D57), and
the 24 hour soak (H18). What remains needs real traffic: a real population,
calibration of the intake discount and the anomaly reference, false-positive
stories per collector, and only then the encoding work (D50-D57).

## Contributing

The library and protocol are the community surface: hard-constraint discoveries,
pattern reports, false-positive cases. What helps most, the house rules, and the
governance are in [CONTRIBUTING.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/CONTRIBUTING.md);
[SECURITY.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/SECURITY.md) says what the guard does and
does not claim, plus private vulnerability reporting.

## Links

- Site: [scorpio-guard.fachryxyf.com](https://scorpio-guard.fachryxyf.com)
- Audit record: [docs/archive/PROJECT-AUDIT.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/archive/PROJECT-AUDIT.md)
- Author: [@Fachryxyf](https://github.com/Fachryxyf)
