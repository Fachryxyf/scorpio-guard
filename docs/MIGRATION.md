# Migrating from 0.1.0 to 0.2.0

0.2.0 is the last version that changed behavior, published on 2026-10-28 with a provenance
attestation; 0.2.1 is a documentation-only patch over it, and 0.1.0 stays installable for
rollback. This document is what changes when you upgrade from 0.1.0, measured against the
published tarballs rather than remembered.

## The API moved additively, measured

```
npm pack @fachryxyf/scorpio-guard@0.1.0
tar -xzf fachryxyf-scorpio-guard-0.1.0.tgz
node scripts/api-surface.mjs --from ./package   # 0.1.0 surface
node scripts/api-surface.mjs                    # 0.2.0 surface, from dist/
```

Both surfaces, compared name by name:

| Entry | 0.1.0 | 0.2.0 | Added | Removed | Kind changed |
|---|---|---|---|---|---|
| `.` | 95 | 102 | 7 | 0 | 0 |
| `./collect` | 27 | 27 | 0 | 0 | 0 |
| `./sqlite` | 3 | 3 | 0 | 0 | 0 |
| `./kv` | absent | 8 | 8 | 0 | 0 |

The seven names added to `.` are the assessment-event group: `ASSESSMENT_EVENT_SCHEMA`,
`AssessmentEvent`, `AssessmentEventOptions`, `AssessmentEventViolation`, `AssessmentIdentity`,
`hashEntity`, and `toAssessmentEvent`. The eight in `./kv` are a new entry point: `kvStore`,
`KvStore`, `KvStoreOptions`, `KvTransport`, `KvFailureHandler`, `memoryTransport`,
`upstashTransport`, and `UpstashTransportOptions`.

No name was removed and no name changed kind. If that is all an upgrade had to survive, the
work would be a version bump. It is not, because the advice moves.

## The advice moved, and that is the migration

0.2.0 is a minor release by the rule in [SEMVER.md](SEMVER.md): the API only gains names,
and the advice is allowed to change as long as each change is written down. These are the
changes a 0.1.0 adopter can feel.

| What changed | If you built on the old behaviour | What happens now |
|---|---|---|
| An epistemic stage precedes trust and uncertainty; `developing` permits at most `OBSERVE` (D40, D46) | A third observation could turn silence into friction | Silence stays `OBSERVE` until the stage has evidence enough to say more |
| A soft invariant violation is strong negative evidence (D38) | It arrived as its own decision input | It arrives as evidence, and the decision follows from the policy like every other observation |
| The cold-start band is gone (D39) | An entity with no history landed in a suspicion band | It is `unknown`, which is not the same as suspicious, and the trace says so |
| Positive evidence at machine-regular gaps is discounted at intake; negatives never are (D54, D55) | Regular positive volume built trust at full weight | It builds almost none, and the trace names the discount |
| The farming rate floor no longer escalates (D54, superseded by D55) | A velocity threshold produced friction | Velocity is still computed and reported; nothing escalates on it. If you want to act on farming, act on the report |
| Erasure and retention are proved against every shipped store (D69) | Forget and retention were asserted | They are tested against storage, and the decision event carries no identity by default |
| The anomaly score is reported and never decides (D67) | It was a candidate decision input | It stays outside the decision, now for a measured reason |
| A 404 for a path the site linked is not negative evidence (D68) | Every 404 counted | Only unlinked 404s count, and each record says which case it was |

If your integration declared soft invariants, read the second row twice: the violation still
fires, but what it does to the decision now goes through the trust policy instead of around
it.

## Stored state

There is no state migration step.

- `EntityState` in the emitted declarations has the same fields in both versions, including
  the bounded observation window.
- The SQLite table is the same three columns in both tarballs, with the state as one JSON
  column, so a database written by 0.1.0 is readable by 0.2.0.
- `./kv` is new, so there is nothing to migrate into it. It starts empty and that is a valid
  state for every entity.

What differs after an upgrade is the advice computed from that state, not the state itself.

## How to tell whether your traffic moves

1. Pin the exact version. A caret range would hide this release and the next one.
2. Replay your own recorded requests through both versions and compare the decided advice,
   not only the exit codes. The library ships `npm run replay` for its own persona traffic,
   which is a worked example of doing that, not a substitute for your traffic.
3. Read the trace on the rows that disagree. Every changed rule above writes a reason into
   it, which is how the decision is auditable rather than merely different.
4. Keep the old version pinned if you depend on the old advice and cannot retune in one step.
   0.1.0 stays on the registry and is not going to be unpublished.

## Rollback

`npm install @fachryxyf/scorpio-guard@0.1.0` is a complete rollback. The stored state stays
readable, so the rollback is a version change rather than a data operation.

## See also

- [SEMVER.md](SEMVER.md): what each number promises, and the API gate that enforces it.
- [RELEASING.md](RELEASING.md): the runbook, and the account history behind the 0.2.0
  release.
- CHANGELOG.md: the same changes with the release grouping.

---

# Migrating from 0.2.1 to 0.3.0

0.3.0 is a minor release by the same rule: the API only gains names (four, listed in the
CHANGELOG's frozen-surface section), no removals, no kind changes, and the stored state
needs no migration — the trust state, the journal, and the event schema (still 1) all read
as they did in 0.2.1. What changes is behavior under concurrency and under store outage,
both measured on the first real integration rather than argued; see D76 and D77.

| What changed | If you built on the old behaviour | What happens now |
|---|---|---|
| Evaluations of one entity are serialized (D77) | Concurrent requests for one entity silently lost updates — 1.229% of the integration's journal rows carried evidence that had been erased by the last writer | They queue per entity; no advice changes for serial callers, and `forget` waits behind an in-flight evaluation |
| Store operations are bounded by `storeDeadlineMs` = 100 (D76) | A hung transport hung every evaluation for as long as the transport retried — about 305 seconds per request on the integration when Redis was down | The evaluation answers within the deadline without retained state, `storeDegraded: true` rides the assessment and event, and a lost state write says so in the trace. Pass `storeDeadlineMs: 0` to restore the unbounded wait |
| `forget` can throw `StoreDeadlineError` (D76) | A delete that hung hung `forget` silently | An erasure that did not land within the deadline throws; catch it if "asked and not confirmed" is acceptable for your retention path |
| `integrationWarning` may appear on the assessment and event (D78) | Nothing in the output said a scope was degenerate; you found out by reading the whole journal | A uniform hard-violation pattern names itself. It never changes the advice; turn it off with `integrationWarnings: false` |

To tell whether your traffic moves: the deadline changes nothing for a healthy store
(recorded decisions on the host dataset replay at 98% agreement), and serialization changes
nothing that was already serial. Pin the exact version, run your journal review as before,
and read `docs/DATASET.md`'s host section for what the grid did and did not move.
