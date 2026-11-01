# The first real integration — a CRM host on 0.2.x

This is the 0.3.0 record of the library's first deployment outside the lab: a
WhatsApp CRM running 0.2.0 (vendored tarball, commit `2c401ef`) through 92 hours of
production traffic and a full adversarial pentest on staging. The partner's raw data
lives in their own export (`report-sg/`, gitignored — it is their data, not this
repository's); everything below is the aggregate, zero-PII reading of it. Two
documents split the record: this one tells what happened;
[HOST-DATASET.md](HOST-DATASET.md) tells what the policy grid made of it.

## The deployment

| Item | Value |
|---|---|
| Integration | NestJS + Express, evaluation on response `finish` via global middleware |
| Guard | 0.2.0, vendored tarball, default policy, no overrides |
| Store | Redis `kvStore`, prefix `sg:crm`, single process |
| Host action | `none (silent)` — every decision journaled, nothing enforced |
| Journal | Postgres `GuardJournal`, 30-day retention, sweep every 6 h |
| Entity keys | `user:<id>` authenticated, `session:<id>` refresh, `cred:<hmac(email)>` credential scope, `ipua:<hmac(ip+ua)>` pre-auth |
| Topology | one API instance; multi-instance (CAS/sharding) recorded open |

## Production traffic — 92 hours, every request journaled

578,365 evaluations over 92 h 06 m, 723 distinct entities, PII-scanned twice (Node
streaming and Postgres full-text; both scans zero, patterns verified against samples
first):

| Decision | Rows | Share |
|---|---:|---:|
| ALLOW | 569,093 | 98.40% |
| OBSERVE | 6,287 | 1.09% |
| INCREASE_FRICTION | 2,052 | 0.35% |
| BLOCK | 905 | 0.16% |
| RESTRICT | 28 | 0.005% |

Guard cost: mean 3.90 ms per evaluation against the 5 ms budget, one 8,218 ms
outlier recorded as-is. Cold starts 734 (0.127%).

Three readings from the production record that no lab could produce:

- **One scope carries the traffic.** `chat.internal` is 92.96% of all rows — one
  page's polling dominates, so population-level rates are effectively that page's.
- **Most of the escalation is dead sessions, not attackers.** 84% of the
  BLOCK+RESTRICT rows carry `UNAUTHENTICATED`/`SESSION_INVALID` (HTTP 401): old tabs
  polling after their token died. Six `ipua` entities account for 1,595 rows with a
  100% failure rate, two still active on the last day. Legitimate clients, failing —
  the largest false-positive pressure in the record, and the clearest argument for
  the host fixing its client behaviour rather than the guard moving a threshold.
- **Every hard violation is explained.** 27 rows across the whole window: 26 are the
  logout false positive below (fixed mid-window), and 1 is an RBAC refusal the host
  itself made (`PERMISSION_DENIED`, 403) — the guard reading a real refusal
  correctly.

## The pentest — 5,123 labelled evaluations on staging

A two-machine pentest (whitebox PC-A, blackbox PC-B) ran fifteen phases against the
CRM, with Scorpio Guard adversarial work as phase 11. All staging traffic used
synthetic accounts with known intent, which makes the export a labelled dataset:
legitimate flows on the `pt_*` test accounts, adversarial scenarios the testers
wrote (credential brute force and leets, ghost-ID probing, cross-scope and
cross-workspace access attempts, compliance-blocked sends, poisoned job queues, a
20-email login flood), and everything in between. 108 entities, 5,123 journal rows.

Phase 11's adversarial suite (~60 observations) was mostly a pass: per-user,
per-credential and per-session entity separation held; cold start never fired a hard
violation; 404/403 stayed soft; trust did not reset on re-login or user-agent
change; re-authenticated flows did not escape their history. Two findings were real:

- **F-P11-1 (P2): every normal logout was a proven violation.** Logout shared the
  `auth.refresh` scope, whose rotation invariant must reject a 2xx that does not
  rotate. Deterministic: 26 of 26 production rows, 14 of 14 staging attempts,
  trust mean of affected entities driven to ~0.02. The library was correct row by
  row; the mapping was the bug. Host fix: a separate `auth.logout` scope — after
  which 0 of 56 rows hard-violated.
- **F-P11-2 (P2): fail-open arrived five minutes late.** With Redis stopped, every
  host request hung ~305 seconds — the transport's retry horizon — before the
  fail-open path ran, including requests that would have ended in 401 anyway.
  Fail-open (D62) was only as fast as the transport admitted.

The 24 admin-scope hard violations in the record are all correct signals: RBAC
refusals the host made in front of the handler, read by the guard as
`IMPOSSIBLE_ACTION_PREREQUISITE` exactly as declared.

## The four defects the record caught, and the verification

The 92-hour journal and the pentest found four defects in the integration, each
fixed and re-verified on the partner side (window post-fix: all ten gate conditions
pass, honest about its 18.49-minute length):

1. **404 read as evidence of probing.** The `chat-channel-member` invariant took
   `notFound || permissionDenied`, so archived channels and old links fed negative
   mass into legitimate requests: 11,438 units of misattributed mass, 1,968
   INCREASE_FRICTION and 453 BLOCK on one scope. Fix: 404 is "not there", only
   `permissionDenied` is evidence.
2. **Logout mapped into `auth.refresh`** — F-P11-1 above; 26/26 → 0/56 after the
   scope split.
3. **Concurrent evaluations lost updates.** The store contract is `get`/`set`, so
   two concurrent evaluations of one entity overwrote each other: 5,817 rows
   (1.229%) fell below their decay-adjusted floor. Fix on the host: a per-entity
   promise queue — 20 concurrent evaluations then produce a contiguous sequence
   with zero lost updates. This is the fix D77 ports into the library.
4. **The journal could not audit its own decisions.** Status code and host code
   mixed, the recorded state was the read rather than the write, no per-entity
   write sequence, and the summary counted firings from flagged rows only: 370
   counted against 5,719 present in the rows. Fix: split columns, post-set
   recorder, `sequenceNumber`, `synthetic` marker, all-row firing counts — and
   post-fix, the same check reports 0 = 0.

## Data discipline

No PII in the journal by construction — boolean facts, enums, and salted HMAC
entity hashes only; the export was scanned for email/phone/JWT/secret patterns on
two machines with the patterns verified against synthetic samples first. The salt
never travels with the export, because whoever holds it can enumerate the hashes.
Two recorded-data defects surfaced during reconciliation and are part of this
record: the `hardViolated` column disagrees with its own `violations` array on 14
rows (the logout false positives), and the observation evidence the host
attributed is not journaled at all — the calibration replay had to derive it
backwards from trust-mass deltas, which is inference where a lookup should be.

## What came back to the library

Everything 0.3.0 carries from the field traces to this record: the store deadline
(D76, from F-P11-2), per-entity serialization (D77, from defect 3), the
degenerate-scope warning (D78, from F-P11-1), the terminal-transition and
ninth-scope guidance (D79, from F-P11-1), and the entity-hash override
documentation (D80, from the host's kinded HMAC diverging from `hashEntity()`).
The calibration replay of the labelled dataset — and what it did and did not move
— is in [HOST-DATASET.md](HOST-DATASET.md).
