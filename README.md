# Scorpio Guard

[![CI](https://img.shields.io/github/actions/workflow/status/Fachryxyf/scorpio-guard/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/Fachryxyf/scorpio-guard/actions/workflows/ci.yml)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Stage](https://img.shields.io/badge/stage-design-blue?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Model](https://img.shields.io/badge/model-open%20core-6f42c1?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard)
[![Issues](https://img.shields.io/github/issues/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/issues)
[![Last commit](https://img.shields.io/github/last-commit/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/commits)
[![Stars](https://img.shields.io/github/stars/Fachryxyf/scorpio-guard?style=flat-square)](https://github.com/Fachryxyf/scorpio-guard/stargazers)
[![Site](https://img.shields.io/badge/site-scorpio--guard.fachryxyf.com-2ea44f?style=flat-square)](https://scorpio-guard.fachryxyf.com)

> **Trust is a spectrum, not a verdict.** Adaptive trust evaluation for web interactions — a local library, not a centralized gatekeeper.

**Status: design phase.** A skeleton exists; the models do not. What follows is the design the implementation is being built against.

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

Consequences: privacy by design (raw data never leaves), cross-ecosystem learning at the pattern level, and local speed for the overwhelming majority of decisions.

## Two Kinds of Signal

The core design breakthrough: these are not blended into one score.

| | Hard constraints | Weak signals |
|---|---|---|
| Nature | Physically/logically impossible | Unusual, not impossible |
| Role | Stable **skeleton** — always on, precise | **Reinforcement** — only meaningful in combination |
| Learned? | Never | Yes, statistically |
| Examples | Form filled with zero corresponding interaction | Sub-70ms actions, repeated identical patterns, *too*-uniform randomized delays |

Weak signals operate *around* the hard constraints, which relieves them of carrying full-precision weight alone. That is what lets the system use statistical signals without inheriting a false-positive problem.

The tell in a bot's randomized delay is rarely the delay itself — it is the **shape of the randomness**. Humans do not produce uniform distributions.

## Open Protocol, Not a Proprietary Backend

An open-core split, with one important refinement.

- **Open** — the library *and* the protocol: how a symptom is formatted, how a prescription is structured, the shared vocabulary.
- **Closed** — the *rule content* of any given server implementation. Publishing exact thresholds hands attackers a fixed target to route around.

The reference server is **one implementation**, not a structural requirement. Anyone — a company, another community, even a competitor — can run their own against the same protocol. Same shape as DNS, SMTP, ActivityPub, Let's Encrypt.

This removes the single point of failure, lets compliance-sensitive adopters self-host, and reframes the project as a standard rather than a lock-in. The cost: the symptom vocabulary becomes a **public spec** — versioned, conservative, extensible, and load-bearing for everyone downstream.

## Open Problems

Named honestly, not hidden.

- **Symptom vocabulary** — the actual open problem. Needs a concrete two-tier v0.1 spec.
- **Signal encoding** — the transmitted representation should be decodable *only* by the server, even though the library's source is public. Edges into one-way embeddings and server-issued transformation recipes. Research direction, not a resolved design.
- **Cold start & sybil churn** — history-based trust is gamed by attackers who simply discard identities.
- **Root of trust** — explicitly outside the library. It accepts an entity reference as a basis for measurement, never as proof of identity. If the host supplies a reference that is cheap to discard, every history-based defence goes with it — and that is the host's responsibility, not the library's.
- **Poisoning resistance** — gradual baseline shifts where every individual step looks legitimate.
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

Settled so far: the entity as reference unit, trust as a Beta distribution,
half-life decay over real elapsed time, evidence weights, decision bands with an
uncertainty ceiling, retention, and the hard-constraint model. Still open: the
anomaly feature space, entity relationships, and which real application the proof
of concept runs against.

## Development

Requires Node 22.6 or newer — tests run TypeScript directly, with no build step.

```
npm install
npm test          # node:test, no framework
npm run typecheck
npm run build     # emits dist/
```

### What exists

`src/core/` — the model, with no platform dependencies:

- `trust.ts` — Beta-Bernoulli state, half-life decay over real elapsed time, retention.
- `assess.ts` — trust and uncertainty bands, and the ceiling that caps escalation.
- `decision.ts` — the five-rung decision spectrum.
- `symptoms.ts` — the v1 symptom vocabulary. Not exported: nothing transmits yet.
- `behavior.ts` — the anomaly feature space, and the diversity signal it feeds.
- `constraints.ts`, `transitions.ts` — declared invariants, and what a violation means.
- `store.ts` — the `StateStore` interface and an in-memory implementation.
- `conformance.ts` — runnable contract checks for any store you write.
- `guard.ts` — `createGuard()` and `evaluate()`, composing the above.
- `policy.ts`, `clock.ts` — tunable values in one place, and an injectable clock.

`src/collect/` — browser-side observation, imported from `@fachryxyf/scorpio-guard/collect`. Counts interaction; records nothing about content.

`examples/healthme/` — the first integration target (D34), declared invariants and
an observational harness that records advice without acting on it.

One hundred and five tests, which double as the record of every numeric and
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

```js
import { createGuard, transitionGraph } from '@fachryxyf/scorpio-guard';

const guard = createGuard({
  invariants: [
    transitionGraph({
      id: 'checkout-order',
      scope: 'checkout',
      strength: 'hard', // asserts this edge set is complete for this scope
      allowed: [
        { from: 'cart', to: 'address' },
        { from: 'address', to: 'payment' },
      ],
    }),
  ],
});

const result = await guard.evaluate({
  entity: sessionId, // any stable reference; SG never interprets it
  observation: { scope: 'checkout', data: { from: 'cart', to: 'payment' } },
  context: { endpoint: '/pay' },
});

result.decision; // 'RESTRICT' — advice, never enforcement
result.trust.stage; // 'unknown' | 'developing' | 'established'
result.diversity; // was the volume varied, or mechanical?
result.trace; // why, in the order that decided it
```

A first-time visitor is advised `ALLOW`. Trust is read through an epistemic stage
over evidence mass `n = alpha + beta`, so an unknown entity contributes nothing to
the decision — while a hard-constraint violation still decides on its own
authority. See D39 and D40 in the design record for how that was arrived at.

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

## Roadmap

1. Smallest possible proof-of-concept — library only, hard constraints only, no server.
2. Enumerate hard constraints exhaustively.
3. Enumerate weak signals and their combination into observe / restrict / block tiers.
4. Draft the two-tier symptom vocabulary as a v0.1 spec.
5. Only then: investigate encoding schemes for symptom transmission.

## Contributing

The library and protocol are the community surface: hard-constraint discoveries, pattern reports, false-positive cases. Open an issue — at this stage, discussion is worth more than code.

## Links

- Site: [scorpio-guard.fachryxyf.com](https://scorpio-guard.fachryxyf.com)
- Author: [@Fachryxyf](https://github.com/Fachryxyf)
