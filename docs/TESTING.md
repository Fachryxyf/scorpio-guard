# Testing 0.2.0

A stranger should be able to install this, wire it into one application, and have
something worth reporting back inside a working session. This page is that session,
written for someone who has never read the rest of the repository.

It covers what 0.2.0 asks you to test, the four parts of an integration, the two
mistakes that make results meaningless, both reporting paths, and the limits you should
not read past.

## What the library does

Scorpio Guard estimates how much trust one client currently deserves, from behaviour:
the gaps between requests, repetition, sequence, and how varied the targets are. It
returns a point on a five-value spectrum, `ALLOW`, `OBSERVE`, `INCREASE_FRICTION`,
`RESTRICT`, `BLOCK`, plus the reasoning behind it.

It does not read message content, does not store credentials, and never blocks on its
own. The host writes the code that acts, which is the point of it being a library
(D9, D14).

## What 0.2.0 asks you to test

1. False positives on your own traffic. A legitimate client that is advised friction is
   the failure this design treats as central, more than a missed attacker.
2. That the integration does not disturb the application, including when the guard is
   slow, when its store is unreachable, and when it throws.
3. That the decision journal you keep can support calibration later. Advice without an
   outcome next to it cannot be calibrated, only believed.

What is not under test: automatic enforcement. Nothing in 0.2.0 acts on your behalf.

## Install

Node 22.13 or newer. The `./sqlite` entry uses `node:sqlite`, which is why the floor is
higher than the runtime the rest of the library needs.

While the registry serves a version older than 0.2.0, build a tarball from `main`:

```
git clone https://github.com/Fachryxyf/scorpio-guard.git
cd scorpio-guard
npm ci
npm run build
npm pack
```

That writes `fachryxyf-scorpio-guard-0.2.0.tgz`. Install it into the application you are
testing:

```
npm install /path/to/fachryxyf-scorpio-guard-0.2.0.tgz
```

Then check that the entry point loads:

```
node -e "import('@fachryxyf/scorpio-guard').then(m => console.log(m.DECISIONS.join(' ')))"
```

The line it prints is `ALLOW OBSERVE INCREASE_FRICTION RESTRICT BLOCK`. If it does not,
that is the first report you send.

Pin the exact version rather than a caret range. No threshold in this library is
calibrated against a real population yet, so a minor bump can move the advice, and a
range would pull that in silently. The current blocker on publishing 0.2.0 and the
commit that removes it are in [RELEASING.md](RELEASING.md).

## An integration is four things

Entity, scope, invariant, and what the host does with the advice. Everything else is
detail.

### 1. Entity

The entity is the state key. Every history, every window, and every decision belongs to
one entity. Choosing it badly is the most common integration mistake, and it fails
quietly.

| context | entity |
| --- | --- |
| authenticated request | session id, or user id when one user is one session |
| before login | address and user agent, which is all you have |
| credential stuffing or brute force | a key derived from the credential being tried, not from the address |

Two traps:

- **One office, one address.** A team behind one NAT gateway presents one address and
  often one user agent string. Keyed on address plus user agent, eighty people collapse
  into one entity and their histories mix. For authenticated requests, key on the
  session or the user.
- **Rotating identities defeat the wrong key.** Keyed on the address, an attacker who
  rotates addresses resets its own history on every attempt. Key the brute-force scope
  on the credential instead, so the history follows the thing being attacked.

Never use an email address, a phone number, or a name as a raw entity. Hash it with a
salt you keep in configuration (D72).

### 2. Scope

A scope names a group of endpoints whose rules are the same. Five to eight scopes for
one application is the useful range:

```
auth.login  auth.refresh  chat.read  chat.send  admin.action  outbound.send
```

Two rules:

- **Do not use one scope per route.** The diversity feature reads the spread of scopes
  (D36, D46), and a scope per route makes diversity impossible to reach, which removes
  evidence from every decision.
- **Do not put identifiers in scope names.** Scope names are quoted in `trace`, and the
  trace is part of the event that leaves your process.

### 3. Invariant

An invariant is a rule the host declares for a scope, checked against facts the host
sends. The host owns the facts. The library only reads them.

- `hard`: the host asserts that no legitimate client violates this, across the whole
  scope. A violation of a hard invariant sets the outcome directly. That is a claim of
  completeness, so declare it only where the host enforces the rule and would refuse the
  action anyway.
- `soft`: a violation adds negative mass, and accumulation decides.

The seven classes (D41):

```
IMPOSSIBLE_SEGMENT_JUMP        IMPOSSIBLE_IDLE_ACTION
IMPOSSIBLE_TEMPORAL_ORDER      IMPOSSIBLE_STATE_TRANSITION
IMPOSSIBLE_ACTION_PREREQUISITE IMPOSSIBLE_UNISSUED_REFERENCE
IMPOSSIBLE_EXCLUSIVE_STATE
```

The class is not decoration. It is what the person reading the trace sees when the
decision is questioned, so pick the one that describes the rule rather than the one that
sounds closest.

### 4. What the host does with the advice

The library returns `assessment.decision` and `assessment.trace`. The host maps that to
its own actions. A minimal mapping:

| decision | host behaviour |
| --- | --- |
| `ALLOW` | serve |
| `OBSERVE` | serve, record |
| `INCREASE_FRICTION` | serve later, or add one challenge |
| `RESTRICT` | refuse this action, keep the session |
| `BLOCK` | refuse, end the session |

Start with the first two rows only. Wire the rest after you have run the journal review
in the section below, not before.

### Code

The example below is the shape, not a framework. The repository carries the full
versions for `node:http` and Express in
[`examples/integration/`](../examples/integration/).

```js
import { createGuard } from '@fachryxyf/scorpio-guard';
import { sqliteStore } from '@fachryxyf/scorpio-guard/sqlite';

const LOGIN = 'auth.login';
const SEND = 'chat.send';

const invariants = [
  {
    id: 'login-session-unissued',
    class: 'IMPOSSIBLE_UNISSUED_REFERENCE',
    strength: 'hard',
    scope: LOGIN,
    holds: (observation) => observation.sessionWasIssued !== false,
  },
  {
    id: 'send-without-membership',
    class: 'IMPOSSIBLE_ACTION_PREREQUISITE',
    strength: 'hard',
    scope: SEND,
    holds: (observation) => observation.member !== false,
  },
];

const guard = createGuard({
  invariants,
  // The parent directory must exist: sqliteStore does not create it.
  store: sqliteStore({ path: 'var/guard.sqlite' }),
  // journal is your own module; its table is under "Report path one" below.
  onAssessment: (event) => journal.write(event),
});

// In TypeScript the cast on the observation is yours, as in examples/integration/core.ts.
async function decide(entity, scope, facts, signals) {
  try {
    const assessment = await guard.evaluate({
      entity,
      observation: { scope, data: facts, signals },
      context: { route: scope },
    });
    journal.note({ assessment, entity, hostAction: 'none (silent)' });
    return 'ALLOW';
  } catch {
    // Advice is never a failure point. The request proceeds as it did before.
    return 'ALLOW';
  }
}
```

Two properties worth keeping in your own version:

- **The call is wrapped.** Without that wrapper a store outage becomes an outage of your
  login, which is a worse outcome than the abuse you were pricing.
- **One evaluation point per scope.** An invariant that reads the handler result has to
  be evaluated after the handler, and its advice then applies to the next request. Mixing
  the two orders scrambles the trust accumulation and makes two sessions incomparable.
  Write down which order you chose.

### Signals

`observation.signals` accepts only ids from the catalogue. An unknown id is ignored
rather than guessed at, so a typo silently removes evidence:

```
SIG_SUBHUMAN_LATENCY       SIG_UNIFORM_DELAY_SHAPE     SIG_OFF_WINDOW_ACCESS
SIG_REPEATED_PATTERN       SIG_IMMEDIATE_REPEAT        SIG_UNINTERACTED_INPUT
SIG_UNUSUAL_SEQUENCE       SIG_BREADTH_OF_TARGET       SIG_SENSITIVE_TARGET
SIG_ENVIRONMENT_MISMATCH
```

What each one measures, and the innocent cause it can be confused with, is in
[`src/core/signals.ts`](../src/core/signals.ts). Some of them the browser collector
computes for you through the `./collect` entry: `measureLatency`, `trackBreadth`,
`checkSequence`, `checkAccessWindow`, `checkEnvironment`, `watchInteraction`,
`collectSignalIds`.

### Store

| situation | store |
| --- | --- |
| one API process | `sqliteStore({ path })` |
| more than one process or host | `kvStore({ transport })` with your own transport |
| unit tests | `memoryStore()`, the default |

`KvTransport` is three methods: `get(key)`, `set(key, value, ttlSeconds)`, `del(key)`.
A Redis implementation is short.

Running several processes with a local sqlite file each splits the per-entity window.
The result looks like a library bug and is not one: you will see false positives and
false negatives at the same time, and neither will reproduce on one process. Retained
state expires after seven days by default, so an entity that goes quiet for a week comes
back cold.

## What leaves your process, and what never does

| sent to the guard | never sent |
| --- | --- |
| `entity`, ideally a hash | message or chat content |
| `observation.scope` | passwords, password hashes, session tokens |
| `observation.data`, booleans and enums | phone numbers, email addresses, customer names |
| `observation.signals`, catalogue ids | form bodies, attachments, documents |
| `context`, light metadata | any customer record |

If an invariant needs a fact that cannot be expressed as a boolean or an enum, do not
send the fact. Send the result of your own check, which is what the invariant reads
anyway.

## Report path one: your own telemetry

This is the part to build now, before traffic arrives, because it is the only thing that
makes the second month worth more than the first.

### The assessment event

`createGuard({ onAssessment })` receives one event per evaluation, built after the
decision is final. The guard does not await the sink, so a slow collector cannot slow the
advice and a broken one cannot fail the request (D61).

| field | content |
| --- | --- |
| `schemaVersion` | 1 |
| `at` | evaluation time, on the injected clock |
| `durationMs` | measured evaluation time |
| `entity` | present only when `identity` asks for it |
| `decision` | the advice |
| `stage`, `uncertainty` | epistemic stage and uncertainty level |
| `trust` | `mean`, `variance`, `mass`, `band`, `proposed`, `ceiling`, `capped` |
| `violations[]` | `invariant`, `class`, `strength` |
| `hardViolated` | whether a proven violation set the outcome |
| `coldStart` | absent state, or state past retention |
| `trace` | the same explanation a person reads |

The entity reference is omitted by default: an event log leaves the process and lands
somewhere with a retention policy you did not write, and carrying the raw reference
would make it a second copy of your user table with weaker rules. If you need to
correlate, ask for the hashed form:

```js
createGuard({
  invariants,
  identity: { kind: 'hash', salt: process.env.GUARD_EVENT_SALT },
  onAssessment: (event) => journal.write(event),
});
```

Keep the salt in configuration. Rotating it breaks correlation in the log, not in the
state.

### The decision journal

Your own table, next to your own audit trail:

```sql
create table guard_journal (
  id            integer primary key autoincrement,
  at            integer not null,          -- epoch ms
  scope         text    not null,
  decision      text    not null,
  hard_violated integer not null,
  violations    text    not null,          -- json array of invariant ids
  entity_hash   text,                      -- hash, not the raw key
  host_action   text    not null,          -- none (silent), challenged, refused
  outcome       text,                      -- served, refused, locked-out
  trace         text    not null
);
create index guard_journal_scope_at on guard_journal (scope, at);
```

Thirty days of retention is a reasonable start: longer than the guard keeps state,
because the journal is what you calibrate from, and shorter than you will regret.

`outcome` is filled by your own code when the handler finishes. Without it the journal
records what the guard thought, not what happened, and the review below has nothing to
compare against.

### The weekly review

1. Select the rows where `decision` is above `OBSERVE` for the scopes under test.
2. For each row, check your existing audit log: was the request legitimate. You already
   have an audit trail; this step needs no new tool.
3. Count two numbers per scope: false positives (legitimate but advised friction) and
   false negatives (abusive but left at `ALLOW`).
4. For each false positive, find the invariant that fired. A `hard` invariant firing is an
   invariant bug or a class bug, not a threshold to move. Mass-driven movement is
   calibration material.
5. Only then move a threshold, and write down why in the journal or in your integration
   notes.

Without step two you have a count of advice, and a count of advice cannot be calibrated.

## Report path two: back to this repository

Three channels, kept separate:

| kind | where |
| --- | --- |
| bug, question, proposal | [an issue](https://github.com/Fachryxyf/scorpio-guard/issues) |
| suspected vulnerability | [a private advisory](https://github.com/Fachryxyf/scorpio-guard/security/advisories/new) |
| test and calibration results | an issue labelled `testing`, or a comment on an existing thread |

A suspected vulnerability never goes in a public issue, even after you have worked around
it on your side. The advisory channel is how it gets looked at before it is described in
public. [SECURITY.md](../SECURITY.md) lists what is in scope.

### Bug report

```
Title: [component] one line

Guard version: 0.2.0, tarball from main at <commit>
Node: v22.x   OS: <os>
Integration: <framework>, store: <sqlite / kv / memory>, processes: <n>

Steps:
1.
2.
3.

Expected:
Actual:
Deterministic: yes / no, <n> of <n> attempts
Trace or event, identifiers removed:
Impact: <cannot log in / friction on a legitimate client / advice never escalates / other>
```

### False positive report

```
Scope: <auth.login / chat.send / ...>
Legitimate scenario: <for example, an agent opening 40 conversations in 10 minutes>
Advice: <decision>, hardViolated: <yes/no>
Invariant that fired: <id, or "none, from negative mass">
Observation sent, without personal data: <scope, signals, boolean facts>
Why it is legitimate: <evidence from your audit trail, no customer data>
Already tried: <different entity key, repetition, different store>
```

### Calibration or test result

```
Period: <start to end>
Scopes: <list>
Observations: <n>, entities: <n>
False positives: <n> (<n> per 1000 observations), short list of causes
False negatives: <n>, how the label was obtained: <audit trail / manual decision>
Proposed change: <threshold, invariant, or none>
Limits: <what this data cannot settle>
```

### Never include

Credentials, tokens, message or chat content, phone numbers, email addresses, customer or
contact names, database dumps, or a trace that carries identifiers. If a scope name in a
trace happens to name a team or a person, rename it in the copy you send.

### Internal triage, if you are running a team of testers

1. Each tester fills one of the templates above into a shared document, one row per
   finding.
2. One person collects them and closes the week with three numbers: findings, false
   positives per scope, and observations.
3. Security findings go to the advisory channel immediately, and do not wait for the
   weekly close, and do not go in the shared document.
4. Everything else becomes one issue per finding, not one issue per session.
5. Run the "never include" list before sending. If you are unsure whether something is
   personal data, treat it as personal data and drop it.

## Scenarios worth running

The expectations are rough. What you report is where reality differs, not whether a
number matches.

| scenario | expectation |
| --- | --- |
| a normal user, 40 requests in 10 minutes, uneven gaps | stays at `ALLOW` or `OBSERVE`, never `INCREASE_FRICTION` |
| brute force, 20 attempts per minute on one credential | `INCREASE_FRICTION` or worse, with no hard invariant firing |
| credential stuffing, 50 accounts from one address | at least `OBSERVE`, ideally `INCREASE_FRICTION` |
| a session token replayed from a different user agent | `RESTRICT` if your issuance invariant is declared |
| flood, 200 messages per minute | `INCREASE_FRICTION` or worse |
| a legitimate member sending 20 messages in a row | `ALLOW` or `OBSERVE` |
| a non-member reading a group | `RESTRICT`, from the hard invariant |
| an uptime monitor every 60 seconds, all day | `ALLOW`, and if it escalates that is a false positive to report |
| a restart, with sqlite or kv | state survives; with `memoryStore` the entity returns cold. Neither is an error |

Two hundred observations per scope is the minimum for a session to say anything. Below
that, everything is still cold start.

## Testing without an application

Everything below runs from the repository and needs no code of your own:

```
npm ci
npm test                       # 356 tests
npm run example:integration    # three scenarios: login, a stolen session, over-consumption
npm run protocol:check         # 54 interop tests for the v0.1 protocol
npm run check:api              # the frozen surface: 140 names across four entries
npm run site:check             # 12 rendered pages
```

`npm run example:integration` prints the advice for each scenario next to what the host
did, which is the shortest way to see the shape of a decision before writing one.

## Definition of done for a session

- [ ] 0.2.0 installed from a tarball, with the commit recorded.
- [ ] Two scopes wired, one of them the login scope.
- [ ] Three to five invariants, each with a written reason for `hard` or `soft`.
- [ ] The entity key verified not to merge two different people on the same network.
- [ ] Silent mode: no response, status code, or latency changed by the guard.
- [ ] The journal is written, including `outcome`.
- [ ] One legitimate scenario and one abusive scenario run, with results recorded.
- [ ] One report sent: a false positive, a bug, or a calibration result.
- [ ] Retention and erasure run once, and you can show the record gone from the store.

## Limits you should not read past

1. **Advisory only.** There is no enforcement in this package. Blocking is your code, and
   your responsibility.
2. **No calibration against a real population.** The published dataset comes from a
   traffic lab, not from production (D45). Its zero false positives describe the
   composition recorded in [DATASET.md](DATASET.md), not your traffic.
3. **No provenance on 0.1.0.** If you installed 0.1.0 from the registry, that is an
   ordinary tarball. 0.2.0 was published by `release.yml` from the tag `v0.2.0` on
   2026-10-28, so the registry holds a provenance attestation for it, and `npm audit
   signatures` checks the signatures and the attestation for what you have installed.
4. **One maintainer.** There are no required status checks and no second reviewer. CI is
   discipline, not a gate. Read the diff before you move a version.
5. **The exported surface is frozen** in `api/v0.2.json`. A removal counts as a major
   change even below 1.0.0 (D74). If your test needs a name that is missing, that is a
   finding, not a reason to patch locally.
6. **Vulnerabilities go to the advisory channel**, not to an issue.

## When something looks wrong

Order of checks, cheapest first:

1. Confirm the entity is unique per person. Most reports of strange advice end here.
2. Confirm one process holds the store, or that the store is shared.
3. Print `assessment.trace` and read the sentence. It names the invariant or the feature
   that decided.
4. Repeat the case against `memoryStore()` with 20 synthetic observations. If the result
   is the same, it is the model. If it differs, it is the integration.

If it still does not add up, send the bug report above with the trace cleaned and the
exact version. A reproducible case with a trace is worth more than a description of the
outcome.
