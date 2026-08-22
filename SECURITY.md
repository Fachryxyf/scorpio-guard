# Security

## Status

Pre-alpha. Not calibrated against real traffic, and not audited. Do not deploy it
as your only defence for anything that matters.

## What the guard is, and is not

It is advisory. `evaluate()` returns a point on a five-rung spectrum and the
reasoning behind it; every action belongs to the host application. So the most
important thing to understand about its security posture is what it does not
claim:

- **It does not establish identity.** It accepts an entity reference as a basis
  for measurement, never as proof. If the host supplies a reference that is cheap
  to discard, every history-based defence goes with it. That is the host's
  responsibility.
- **It does not resist a determined adversary yet.** Sybil churn — discarding
  identities rather than building trust — is an open problem, recorded as such.
- **It has no network surface.** No API key, no phoning home, no runtime request
  forwarding. There is nothing to intercept because nothing is sent.
- **Thresholds are public.** The library and its policy defaults are open by
  design. They are set leniently, so knowing them tells an attacker how to avoid
  escalation, not how to trigger a false positive against someone else. The weak
  signal *catalogue* is deliberately threshold-free for the same reason: it names
  what is measured, never when it fires.
- **Weak signals cannot escalate on their own.** Every catalogued signal an
  interaction trips contributes at most the mass of one weak observation in total,
  which leaves a fresh entity below the evidence threshold where trust may ask for
  anything. Anything that escalates on measurement alone is a bug, not a policy
  choice.

## Handling personal data

Behavioral history is personal data under GDPR and Indonesia's UU PDP. The guard
stores trust state and a bounded observation window per entity, keyed by a
reference the host supplies. `guard.forget(entity)` deletes it outright — the same
code path retention uses, with the horizon forced to zero. Consent and the legal
basis stay with the host.

The browser collector counts interaction and records nothing about content: not
which keys, not field values, not pointer coordinates.

The durable store (`./sqlite`) writes that state to a file you choose. It holds the
same data the in-memory store holds, with the same deletion path — but it survives a
restart, which is the point, so treat the file as personal data at rest and back it
up or encrypt it accordingly.

## Reporting a vulnerability

Report privately through
[GitHub's private vulnerability reporting](https://github.com/Fachryxyf/scorpio-guard/security/advisories/new).
Do not open a public issue for something exploitable.

Include what you can reproduce, and the trace if the guard produced one. Expect a
first response within a week. There is one maintainer, so that is a realistic
estimate rather than a service level.

### In scope

- A way to make the guard advise `ALLOW` for a proven `hard` invariant violation.
- State corruption or cross-entity leakage through the store interface, in either
  store implementation.
- A trace that misreports which layer decided an outcome.
- Anything that causes the collector to record content.
- Weak signals reaching a treatment without accumulating evidence, or an unknown
  signal id being treated as suspicious rather than ignored.
- SQL injection through any value or identifier reaching the SQLite store.

### Known, and recorded rather than fixed

- **Saturation / farming.** Uniform high-volume interaction converges on a large
  positive evidence mass that resists negative evidence: 300 uniform positives absorb
  seventeen strong negatives before the advice changes. The decision-layer gate that
  was recorded as the mitigation cannot reach it, and that claim is withdrawn — see
  D49. Reports demonstrating this are welcome but will be closed as duplicates of D49.
- **Identity churn.** At one request per identity reference, nothing accumulates and
  no history-based defence can engage. That is the root-of-trust problem, and the
  reference is the host's to make expensive.

### Out of scope

- Thresholds being avoidable. They are public and uncalibrated; see above.
- Trust being resettable by discarding an entity reference. Recorded as an open
  problem, and the reference is the host's to make expensive.
- A `hard` invariant declared incorrectly by the host. Declaring `hard` asserts
  the edge set is complete for that scope; a forgotten edge is a declaration bug.
