# Migrating from 0.2.1 to 0.3.0

0.3.0 is a minor release by the same rule: the API only gains names (four, listed in the
CHANGELOG's frozen-surface section), no removals, no kind changes, and the stored state
needs no migration: the trust state, the journal, and the event schema (still 1) all read
as they did in 0.2.1. What changes is behavior under concurrency and under store outage,
both measured on the first real integration rather than argued; see D76 and D77.

| What changed | If you built on the old behaviour | What happens now |
|---|---|---|
| Evaluations of one entity are serialized (D77) | Concurrent requests for one entity silently lost updates; 1.229% of the integration's journal rows carried evidence that had been erased by the last writer | They queue per entity; no advice changes for serial callers, and `forget` waits behind an in-flight evaluation |
| Store operations are bounded by `storeDeadlineMs` = 100 (D76) | A hung transport hung every evaluation for as long as the transport retried, about 305 seconds per request on the integration when Redis was down | The evaluation answers within the deadline without retained state, `storeDegraded: true` rides the assessment and event, and a lost state write says so in the trace. Pass `storeDeadlineMs: 0` to restore the unbounded wait |
| `forget` can throw `StoreDeadlineError` (D76) | A delete that hung hung `forget` silently | An erasure that did not land within the deadline throws; catch it if "asked and not confirmed" is acceptable for your retention path |
| `integrationWarning` may appear on the assessment and event (D78) | Nothing in the output said a scope was degenerate; you found out by reading the whole journal | A uniform hard-violation pattern names itself. It never changes the advice; turn it off with `integrationWarnings: false` |

To tell whether your traffic moves: the deadline changes nothing for a healthy store
(recorded decisions on the host dataset replay at 98% agreement), and serialization changes
nothing that was already serial. Pin the exact version, run your journal review as before,
and read `docs/DATASET.md`'s host section for what the grid did and did not move.
