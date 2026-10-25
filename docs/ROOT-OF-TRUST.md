# Root of trust: the entity key belongs to the host

The library accepts a reference and never verifies what it represents (D1.1). Every
defence that depends on history therefore depends on one thing the library cannot check:
whether the reference is expensive to discard. This document states the rule for choosing
it, the cost of getting it wrong as measured by the test suite, and what stays unprotected
even when the rule is followed (D72).

## What the library sees, and what it stores

The input is an `entity` string plus observations. The state is a trust distribution, a
behavioral window, and counters, all keyed by that string and bounded by retention. IP
addresses, user agents, cookies, email addresses, and names are never inputs: there is no
field for them, which is why the key is not a leak surface but a correctness surface.

That distinction is the point of this document. A bad key is not a privacy bug in the
library. It is a hole in the protection the host believes it bought.

## The rule

A key has to satisfy three properties, and the host has to be able to state them:

1. **Issued, not observed.** The value comes from something the host created: an account
   id, a session id minted at login, a signed cookie the host set. It does not come from
   the request.
2. **Stable for as long as the history is meant to matter.** History follows the key. If
   the key changes every request, there is no history; if it changes every session, the
   history is one session long.
3. **Revocable, at a cost the host chooses.** A subject can discard the key (logout,
   cleared cookie, deleted account). That cost is the real strength of every history-based
   defence, and it is a product decision rather than a library setting.

Never derive the key from an IP address, a user agent, an endpoint path, a header the
client writes, an unverified email address, or a single shared value such as `anonymous`.
Each of those is either shared by many subjects, chosen by the subject, or both.

## What getting it wrong costs, measured

Every row below is a test in `src/core/root-of-trust.test.ts`, run on every push against
the shipped policy.

| Mistake | What happens | Number |
|---|---|---|
| The client picks its key | Ten keys with one strong negative each never leave `OBSERVE`; distrust never reaches `INCREASE_FRICTION` | 10 decisions, 10 states |
| One shared key for everyone | A legitimate visitor with a clean observation inherits `INCREASE_FRICTION` from six bad observations made by someone else | 1 key, whole population |
| Rotation instead of atonement | Six strong negatives reach `INCREASE_FRICTION`; one changed string returns to `ALLOW` at the prior | 6 observations to build, 1 change to discard |
| Staying and earning it back | Returning to `ALLOW` after those six negatives takes 25 strong positives | 25 observations |
| Waiting | With `retentionHours: 1`, two hours of silence reset the entity to `ALLOW` | retention is part of the key policy |
| Per-request proof | A hard invariant violation is `RESTRICT` on first contact and `RESTRICT` for a fresh key | rotation cannot erase proof |

The asymmetry in the third and fourth rows is the whole argument. Building distrust costs
the defender six observations and the attacker one string. Atonement costs 25. Any design
where the subject can change the key more cheaply than that is a design where the history
matters only for subjects that do not try to escape it.

## What is not protected

- **Rotation is invisible.** The library cannot distinguish a hundred new visitors from one
  attacker with a hundred keys. D1.1 records a first-seen-rate diagnostic as a possibility;
  it is not implemented, and if it lands it will not be a claim that the rate means abuse.
- **A key derived from a client-controlled value is a capability.** If the value is a
  cookie the client can rewrite, then the client owns the history. Treat that value the way
  a password reset is treated: a step that costs something.
- **The library does not authenticate the key.** A host that trusts an upstream header
  inherits the weakness of whatever wrote that header.
- **No history, no history-based advice.** With a key that changes per request, the guard
  still checks declared invariants and transitions per request. Everything else degrades to
  a cold start, which is `ALLOW` with a trace that says so.

## Checklist before adopting

1. Derive the key from issuance, not from transport.
2. One key per subject. A shared key is a shared history, in both directions.
3. Choose retention as part of the rotation cost, not as a storage setting.
4. For anonymous traffic, issue a signed cookie from the host yourself, and write down that
   clearing it resets history.
5. On logout or account deletion, call `forget` (D22). That is the only rotation the host
   controls, and it should be the cheap one.

## What to do when the rule cannot be met

Write it into the risk register instead of leaving it implied. The honest statement is
"trust is per session, not per subject", and the useful parts that remain are the per-request
proofs: declared invariants and transition checks need no history at all.

## Gates

`src/core/root-of-trust.test.ts`: six tests, one per row of the table. Verified by mutation:
making the guard load one shared state for every key fails four of them. The numbers in the
table are values the tests assert, so a policy change that moves any of them fails the suite
and this document has to be updated with it.
