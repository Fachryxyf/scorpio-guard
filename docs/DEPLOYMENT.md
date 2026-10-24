# Deployment

Where the guard keeps trust, and what each choice costs when it fails.

The guard itself is stateless code: it reads state, answers, and writes back. So the
only deployment question that matters is where that state lives, because that decides
whether accumulated trust survives a restart, a scale-out, or an outage. Nothing here
is about enforcement, since the library never enforces (D9, D14).

| Topology | Store | Consistency | Lost when it fails | Status |
|---|---|---|---|---|
| One process | `memoryStore` (default) | one process | all trust state, on restart | supported, default |
| Multi-process, one host | `sqliteStore` | one file, per host | that host's state, if its disk is lost | supported, tested |
| Serverless, or many hosts | `kvStore` over HTTP | the service's own | nothing, but a store outage reads as `unknown` for every entity | supported, tested, requires an alert |
| Multi-region, strong consistency | none | not provided | concurrent writes to one entity | not supported |

## One process

```js
import { createGuard } from '@fachryxyf/scorpio-guard';

const guard = createGuard();
```

The default store lives inside the guard factory. Call `createGuard` once per process
and reuse it: the state is in that instance, so a guard built per request starts cold
every time and the statistical layer never accumulates.

What it gives: no infrastructure, no I/O on the request path, and a clean
`unknown` stage for every entity after a restart. What it does not give: anything that
outlives the process.

## Multi-process, one host

```js
import { createGuard } from '@fachryxyf/scorpio-guard';
import { sqliteStore } from '@fachryxyf/scorpio-guard/sqlite';

const guard = createGuard({ store: sqliteStore({ path: '/var/lib/app/trust.db' }) });
```

Every process on the host opens the same file, so a worker pool or a supervised
process restart reads the state the previous one wrote. SQLite serialises the writes;
the guard's per-entity updates are single statements, so no transaction of yours is
needed and none is opened.

What it does not give: sharing across hosts. A file on one filesystem is one
filesystem, and a second container with its own volume is a second, unrelated trust
history.

## Serverless, or many hosts

```js
import { createGuard } from '@fachryxyf/scorpio-guard';
import { kvStore, upstashTransport } from '@fachryxyf/scorpio-guard/kv';

const guard = createGuard({
  store: kvStore({
    transport: upstashTransport({ url: process.env.KV_URL, token: process.env.KV_TOKEN }),
    onError: (error, operation) => alert.trustStoreDegraded({ error, operation }),
  }),
});
```

The store speaks HTTP through `fetch`, so it works from a function that may be frozen
between requests, and there is still nothing to install (D60).

**The alert is part of the configuration, not an optional extra.** The store fails
open, which means an unreachable KV reads as a cold start for every entity and the
guard answers `ALLOW` on trust alone. That is the intended behaviour for an advisory
library (D9), and it is indistinguishable from a healthy deployment unless the `onError`
sink is wired to something that wakes a person (D62). `kvStore` refuses to construct
without that sink unless `failOpen: false` is set.

What survives a failure: the invariant layer. A proven violation still reaches
`RESTRICT` with no state at all (D15), so an outage degrades the statistical dimension
and not the provable one.

## Multi-region

Not supported, and worth being specific about why: it is not a store adapter away.

Trust is one state per entity, updated by every observation. Two regions observing the
same entity concurrently will each write, and a last-write-wins merge silently discards
one observation's evidence. Making that correct needs a merge rule that knows what an
observation contributed, which means either a CRDT-shaped state or a per-region
conversation with a coordinator. Neither exists in this library, and inventing one in
a deployment guide would be the same mistake as documenting an untested threshold as
if it were calibrated.

What is available today: choose one region as the trust writer, or run separate
histories per region and accept that an entity crossing regions is new in each. The
second is honest but weak against an attacker who moves, so it is stated as a limit
rather than offered as a design.

## What no topology fixes

**The entity key is the root of trust, and it is yours.** An attacker who can present
a fresh entity reference per request gets a fresh `unknown` state per request, and no
store choice changes that (D1.1). This is the largest open problem in the design, and
it is a property of the host's authentication, not of the state layer.

**Retention is data deletion.** Behavioural history is personal data: `guard.forget()`
deletes one entity, and the retention horizon deletes the rest on the read path (D6,
D12, D22). A backup of a store is a backup of that data.

## What is tested

Two rows above are exercised by `src/deployment.test.ts`, because a table in a
document is not evidence:

- two guard instances on one SQLite file: state written through one is read by the
  other with `coldStart: false`;
- two guard instances over one KV transport: the second is a cold process and still
  reads accumulated evidence rather than starting over.

The default row is the memory store, which the store conformance kit already covers
(D8). The multi-region row is documented as unsupported, and nothing tests it because
nothing implements it.
