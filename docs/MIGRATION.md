# Migrating from 0.1.0 to 0.2.0

0.1.0 is what npm serves. 0.2.0 is set in `package.json` on `main` and waits for a publish
window; the reason is in [RELEASING.md](RELEASING.md). This document is what changes when
0.2.0 becomes installable, measured against the published tarball rather than remembered.

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
- [RELEASING.md](RELEASING.md): why 0.2.0 is set and not published, with dates.
- CHANGELOG.md: the same changes with the release grouping.
