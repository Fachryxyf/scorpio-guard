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
  escalation, not how to trigger a false positive against someone else.

## Handling personal data

Behavioral history is personal data under GDPR and Indonesia's UU PDP. The guard
stores trust state and a bounded observation window per entity, keyed by a
reference the host supplies. `guard.forget(entity)` deletes it outright — the same
code path retention uses, with the horizon forced to zero. Consent and the legal
basis stay with the host.

The browser collector counts interaction and records nothing about content: not
which keys, not field values, not pointer coordinates.

## Reporting a vulnerability

Report privately through
[GitHub's private vulnerability reporting](https://github.com/Fachryxyf/scorpio-guard/security/advisories/new).
Do not open a public issue for something exploitable.

Include what you can reproduce, and the trace if the guard produced one. Expect a
first response within a week. There is one maintainer, so that is a realistic
estimate rather than a service level.

### In scope

- A way to make the guard advise `ALLOW` for a proven `hard` invariant violation.
- State corruption or cross-entity leakage through the store interface.
- A trace that misreports which layer decided an outcome.
- Anything that causes the collector to record content.

### Out of scope

- Thresholds being avoidable. They are public and uncalibrated; see above.
- Trust being resettable by discarding an entity reference. Recorded as an open
  problem, and the reference is the host's to make expensive.
- A `hard` invariant declared incorrectly by the host. Declaring `hard` asserts
  the edge set is complete for that scope; a forgotten edge is a declaration bug.
