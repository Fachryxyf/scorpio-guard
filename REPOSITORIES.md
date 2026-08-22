# Repository Layout

Three repositories, not a monorepo. The split is deliberate: the server holds
rule content that must stay private, and keeping it in a separate folder of a
shared repo is not a boundary — commit history, CI logs, and one bad
`.gitignore` line all leak across folders. A repository boundary is the only
boundary that actually holds.

| Repository | Visibility | Contains |
|---|---|---|
| `scorpio-guard` | Public | The TypeScript library. This repo. |
| `scorpio-guard-protocol` | Public | Symptom vocabulary and wire format. Spec only. |
| `scorpio-guard-server` | Private | Rust reference server. Rule content lives here. |

Status: only `scorpio-guard` exists. The other two are planned below and not
started.

---

## `scorpio-guard` — library (public, TypeScript)

Installed inside the adopter's own ecosystem. Observes, scores, and advises
locally; never enforces on its own authority.

TypeScript because the hard constraints are largely client-side observations —
pointer events, DOM interaction, event ordering. Those cannot be reconstructed
from a backend request log.

Layout, per D7 in the design record — one package, several entry points, with
`src/core/` free of platform APIs so the same model serves both sides:

```
src/core/       the model: trust, decay, decision, constraints, signals, storage contract
src/collect/    browser-side observation, exported as ./collect
src/store/      platform-backed stores, exported as ./sqlite
examples/harness/  application-independent persona traffic and replay
examples/ixfe/     primary target: invariants across all six proof sources
examples/healthme/ small-application regression: two scopes, one user
```

Not built yet: an anomaly classifier over the feature space, the prescription
client, and collectors for seven of the ten catalogued weak signals. There is no
`src/server/`: the core is framework-agnostic and needs no host-specific layer
until an adapter is written.

`src/store/` is the one deliberate exception to "no platform APIs", and it is why
platform code lives in its own directory rather than in `src/core/`: a durable store
needs a filesystem, and the model still has to run in a browser.

`examples/` stays outside the published package entirely. It generates *test* traffic,
and shipping a traffic generator in an adopter's bundle would blur the line the design
rests on — SG observes, it never produces.

---

## `scorpio-guard-protocol` — spec (public, planned)

The protocol is what makes the reference server replaceable. If only the library
were open, the ecosystem would still have exactly one brain and exactly one point
of failure.

Scope:

- The symptom vocabulary, in two tiers: stable skeleton categories that rarely
  change, and flexible technical detail underneath. The **structure** is settled in
  D43 and lives in `src/core/symptoms.ts` — six categories, details that degrade to
  their category, and a schema version that moves only for the detail tier. This
  repository inherits it rather than inventing it.
- Request and response shapes for symptom and prescription exchange.
- A version negotiation rule, so a v1 library and a v2 server can still talk. Note
  that D43 makes strict negotiation optional rather than necessary: an unrecognised
  detail already degrades to its category, so a v2 library and a v1 server remain
  mutually intelligible without one.
- A conformance checklist for anyone implementing a compatible server.

Explicitly out of scope: any actual rule, threshold, or heuristic. The protocol
says how to ask, never what the answer should be.

This carries the discipline of designing DNS record types or HTTP status codes:
conservative, versioned, extensible without redefinition. Once another
implementer depends on it, it cannot be casually changed.

Open question, unresolved: whether a durable public spec is worth formalizing
before a first proof of concept exists, or whether that is solving a scaling
problem with nothing yet to scale. The current lean is unchanged — keep the
vocabulary inside the library until real usage shows which categories are
load-bearing, then extract it. D43 makes that lean cheaper to hold: the structure
is already designed and tested in place, so extraction is a move rather than a
design exercise.

---

## `scorpio-guard-server` — reference server (private, planned)

Rust, for a long-lived network service where predictable latency and memory
behavior matter more than iteration speed.

Scope:

- Accept a symptom, return a prescription. Nothing else.
- Rule content, thresholds, and pattern history — the part that stays private,
  because published rules are rules an attacker can route around.

Constraints that follow from the architecture:

- It never receives raw requests, payloads, IPs, sessions, DOM state, or
  behavioral telemetry. If an endpoint would need any of those, the design is
  wrong.
- It is not in the request path. A library instance that cannot reach it keeps
  working on its existing prescriptions.
- It is one implementation of the protocol, not a required component. A
  compliance-bound organization must be able to self-host a compatible server
  instead of trusting this one.

Private, but the boundary is stated publicly: what the server does is open
knowledge, which specific rules it uses is not.
