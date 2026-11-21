# Architecture

This document is the why behind the code: the model, its boundaries, and the reasoning
it rests on. How to install and call the library is in the
[README](https://github.com/Fachryxyf/scorpio-guard/blob/main/README.md). What each
decision commits the implementation to, and which alternatives lost, is in
[DECISIONS.md](DECISIONS.md). The wire contract is [PROTOCOL.md](PROTOCOL.md).

## The premise

No web behavior is inherently human. Mouse movement, timing, DOM interaction, navigation patterns: all of it can be recorded, learned, and replayed. So Scorpio Guard does not try to answer:

```
human / bot
```

It continuously estimates:

```
how much trust does this interaction currently deserve?
```

Trust is built from many weak signals evaluated together over time. Identity is a history, not a fingerprint. Volume is evidence, not guilt. The goal is not perfect detection; it is **asymmetric cost**: near-zero friction for legitimate users, increasingly expensive for sustained abuse.

## Product shape

Scorpio Guard is **not** Turnstile or reCAPTCHA. There is no round trip to a central service that issues a verdict token.

- An open-source library installed inside your own ecosystem. No API key, and no network surface at all in the current scope.
- One-way flow: it evaluates and advises *within* your environment.
- Advisory only: it never unilaterally blocks or rejects. Every action belongs to the owner of the system it runs in.
- No phoning home per request. Raw traffic and history stay local.
- Built toward a shared protocol: the vocabulary for symptoms and prescriptions is public and versioned, but nothing in this package talks to a server and no import opens a socket. The design is [at the end of this document](#open-protocol-not-a-proprietary-backend).

Learning happens at the *project* level (slow, human-mediated, via issues and review), not at the *instance* level (fast, automatic, per-request).

## Prescription, not diagnosis

The communication model, in one analogy: a patient says *"I have a headache."* That is a category of complaint, a few bytes of information, not a transfer of the headache itself.

```
library  ──  symptom (abstract pattern shape)  ──▶  server
library  ◀──  prescription (handling strategy)  ──   server
library  ──▶  acts locally, on local data only
```

- Symptom: an abstracted description of a pattern class. No raw request data, no identity, no PII.
- Prescription: a general strategy for handling that pattern class.
- Action: always local, always the operator's.

The vocabulary is **two tiers, split by rate of change** (D43), because a deployed
instance speaks the vocabulary it shipped with and cannot negotiate with a server
that has moved on. Six principle-level *categories* form a stable skeleton expected
never to grow; the *details* under them are free to evolve release to release, and a
detail a receiver has never heard of degrades to its category instead of failing.
Symptoms carry shape and never values: `SYM_REQUEST_BURST` says volume arrived
compressed in time, with no count, no interval and no endpoint.

Consequences: privacy by design (raw data never leaves), cross-ecosystem learning at the pattern level, and local speed for the overwhelming majority of decisions.

## Two kinds of signal

The two are not blended into one score.

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
measurement and can only add mass. [Usage](https://github.com/Fachryxyf/scorpio-guard/blob/main/README.md#usage) wires the whole call, including
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

## The first integration (HealthMe)

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

What this does not show, stated plainly, because the temptation is to read more into
it than it carries:

- The library works against a real flow. That is a smoke test, not a validated
  thesis. HealthMe has one user, so there is no sustained abuse for asymmetric
  cost to act against.
- The interesting finding came from the hard-constraint layer: which is the
  least novel part of the design, set membership, expressible as one `if`. The
  parts that are actually new (Beta trust, half-life decay, the epistemic stage,
  the diversity signal) were never exercised, because no traffic here can exercise
  them.
- No threshold is calibrated by this. Every number in the model remains a
  reasoned guess.

A target that can validate the thesis needs unauthenticated traffic, data worth
scraping, and a real adversary. See D34 in the design record.

## Generated traffic

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

This falsifies; it does not calibrate. If a persona built from honest usage gets
escalated, a threshold is wrong regardless of where the traffic came from. But real
populations are not drawn from these distributions, and an attacker who reads the file
can shape traffic around it, so numbers derived here are hypotheses, never
conclusions.

What it measured, without fixing:

- Uniform jitter buys an attacker nothing. Fixed-sleep and `uniform(1.2s, 2.3s)`
  brute forces escalate at the same step, which is the design's own claim about the
  shape of randomness surviving its counterexample.
- Identity churn works against accumulation, and proof ignores it. Against
  accumulated evidence the floor is two requests per identity, at one, nothing ever
  accumulates. But where a violation is *provable*, churn buys nothing at all:
  IXFE's endpoint-shooter is caught on request one, with no history, because a missing
  `dwell` is a proof rather than a guess.
- A 404 is not a memory. IXFE already answers correctly at every one of these
  endpoints. What it cannot do is remember: the webhook forger can guess `external_id`
  forever and each refusal is a discarded log line. Turning refusals into accumulating
  evidence about the caller is the argument for the library, in a place where it is
  checkable.
- Ten honest days buy about eleven abuse calls before `RESTRICT`. That head start
  is the price of having a memory; the bound is now asserted.

What it falsified:

- The `developing` stage ceiling was one rung too high. Two mistyped PINs, and an
  autofilled password manager, were both advised `INCREASE_FRICTION`. The middle stage
  is meant to let trust *influence* a treatment without *driving* it, and `OBSERVE` is
  the only rung that does that. The old value also made the stage boundary a cliff:
  silence at `n = 2.9`, friction at `n = 3`.
- Scope entropy was normalised against the window size: which made it depend on
  how many scopes the *application* has rather than how varied the *entity* was. A
  two-scope app could not reach the diversity threshold at all, so its most honest
  user was scored monotonous for the entire run. Now normalised against the scopes
  actually observed, so it measures balance while `distinctScopes` measures breadth.
- A `hard` declaration that was not provable. "Paid work requires enough credits"
  looks provable and is not: the client's view of its balance is stale by construction,
  since jobs bill asynchronously and another tab may have spent the difference. One
  refused request is how a person discovers their balance; a hundred is a script. Now
  `soft`. Being *enforced by the server* is not the same as being *provable*.
- The saturation guard does not do what it claimed. `D37` was recorded as the fix
  for an attacker farming uniform volume into unearned confidence. It cannot be:
  farming produces a high mean, a high mean proposes `ALLOW`, and a ceiling can only
  *lower* a decision: so the gate is unobservable for exactly the entity it targeted.
  Measured: 300 uniform positives absorb **17** strong negatives before leaving
  `ALLOW`. The claim is withdrawn and farming is an open problem again.

## Open protocol, not a proprietary backend

An open-core split, with one important refinement.

- Open: the library *and* the protocol: how a symptom is formatted, how a prescription is structured, the shared vocabulary.
- Closed: the *rule content* of any given server implementation. Publishing exact thresholds hands attackers a fixed target to route around.

The reference server is **one implementation**, not a structural requirement. Anyone, a company, another community, even a competitor, can run their own against the same protocol. Same shape as DNS, SMTP, ActivityPub, Let's Encrypt.

This removes the single point of failure, lets compliance-sensitive adopters self-host, and reframes the project as a standard rather than a lock-in. The cost: the symptom vocabulary becomes a **public spec**, versioned, conservative, extensible, and load-bearing for everyone downstream.

## Where each concern lives

- The design record: [DECISIONS.md](DECISIONS.md). Seventy-eight entries, each with the question, the answer, the reasoning, and what the answer commits the code to.
- The wire contract: [PROTOCOL.md](PROTOCOL.md), with fixtures in `protocol/fixtures/v0.1/` and a reference receiver plus a batching sender in `examples/protocol/`.
- The recorded lab runs: [docs/DATASET.md](docs/DATASET.md), which reports what the runs found rather than what they hoped.
- What remains before 1.0.0: [docs/ROADMAP.md](docs/ROADMAP.md), with the exit criteria for each milestone.
- Where the repositories split and why: [REPOSITORIES.md](REPOSITORIES.md).
