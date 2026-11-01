# The integration targets: the 0.2.x record

This folder keeps the record of the targets the project measured while its first
integration targets were alive, exactly as the README told it at the time. IXFE
(`ixfe.pro`) and HealthMe are both offline (checked 2026-10-25: the first times out,
the second no longer resolves), so every claim below is about what was measured while
they were up, kept under the names it was measured under. Renaming measured rows to
look current would be invention. The lab now observes `aufsicht.dev` and
`talkhere.life`, declared in `examples/lab/targets.ts`.

What superseded this era: the frozen lab fixtures still replay in CI
(`examples/lab/fixtures/`, [docs/DATASET.md](../DATASET.md)), and the first real
integration's journal is recorded in
[docs/v0.3.0/HOST-DATASET.md](../v0.3.0/HOST-DATASET.md).

## The targets

**The targets, since 2026-10-25.** `ixfe.pro` and the HealthMe app are offline: the first
times out and the second no longer resolves, both checked from this machine on that date. The
lab observes `aufsicht.dev` and `talkhere.life` now, both answering, declared in
`examples/lab/targets.ts` by origin with an optional local build. Everything below that names
IXFE or HealthMe is the record of what was measured while those sites were up, kept under the
names it was measured under, because renaming measured rows to look current would be
invention. What that record has and the live pair does not is a declared invariant, so a
proven violation is not available from two static sites until a live target declares one
again.

`examples/ixfe/`, the primary target while it was online (D47): invariants declared across all
six proof sources, and personas read off IXFE's own defences.

`examples/healthme/`, the first target (D34), kept as the small-application
regression: two scopes, one user.

`examples/ixfe/live/`, the observing proxy, a real-browser visitor generator, and
their report (D56, D57). A transparent hop in front of a live IXFE deployment: the
origin's response goes out untouched, and the guard is consulted afterwards, so a bug
in SG costs a log line rather than a visitor's pre-order. `cdp.ts` is a ~180-line
DevTools Protocol client over Node's `WebSocket` global, written instead of installing
Puppeteer so the zero-dependency promise holds in the examples too.

A traffic lab in `examples/lab/`: real Chrome instances against shipped sites, one
declared persona per instance, each run recorded as a labelled dataset with its seed
and browser version. [docs/DATASET.md](https://github.com/Fachryxyf/scorpio-guard/blob/main/docs/DATASET.md) carries both recorded runs and
reports what they found rather than what they hoped. The first, 129 requests across two
static builds, showed that a page view carries no evidence: zero false positives, six
adversarial misses, all with one cause (D63). The second added the IXFE landing service,
where a form post and a hidden field can be priced, and ran every persona as eight
different visitors so a short visit still counts: 1656 requests, 24 personas, zero false
positives, seven misses (D66). `npm run calibrate` replays those rows under a grid of
nine policies; the shipped cell is the best of the nine, and the half-life axis is a
measured plateau because the run lasts minutes (D64). The anomaly score is not one of
the axes: on the recorded traffic no threshold on it beat the evidence policy, so it
stays reported and does not decide (D67). Both runs are frozen into
`examples/lab/fixtures/` and replayed on every push, so a change that moves any decision
fails CI rather than being found in production (D65).


## What the First Integration Shows

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

### What it does not show

Stated plainly, because the temptation is to read more into this than it carries:

- **The library works against a real flow. That is a smoke test, not a validated
  thesis.** HealthMe has one user, so there is no sustained abuse for asymmetric
  cost to act against.
- **The interesting finding came from the hard-constraint layer**: which is the
  least novel part of the design, set membership, expressible as one `if`. The
  parts that are actually new (Beta trust, half-life decay, the epistemic stage,
  the diversity signal) were never exercised, because no traffic here can exercise
  them.
- **No threshold is calibrated by this.** Every number in the model remains a
  reasoned guess.

A target that can validate the thesis needs unauthenticated traffic, data worth
scraping, and a real adversary. See D34 in the design record.

## Generated Traffic

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

**This falsifies; it does not calibrate.** If a persona built from honest usage gets
escalated, a threshold is wrong regardless of where the traffic came from. But real
populations are not drawn from these distributions, and an attacker who reads the file
can shape traffic around it, so numbers derived here are hypotheses, never
conclusions.

### What it measured, without fixing

- **Uniform jitter buys an attacker nothing.** Fixed-sleep and `uniform(1.2s, 2.3s)`
  brute forces escalate at the same step, which is the design's own claim about the
  shape of randomness surviving its counterexample.
- **Identity churn works against accumulation, and proof ignores it.** Against
  accumulated evidence the floor is two requests per identity, at one, nothing ever
  accumulates. But where a violation is *provable*, churn buys nothing at all:
  IXFE's endpoint-shooter is caught on request one, with no history, because a missing
  `dwell` is a proof rather than a guess.
- **A 404 is not a memory.** IXFE already answers correctly at every one of these
  endpoints. What it cannot do is remember: the webhook forger can guess `external_id`
  forever and each refusal is a discarded log line. Turning refusals into accumulating
  evidence about the caller is the argument for the library, in a place where it is
  checkable.
- **Ten honest days buy about eleven abuse calls** before `RESTRICT`. That head start
  is the price of having a memory; the bound is now asserted.

### What it falsified

- **The `developing` stage ceiling was one rung too high.** Two mistyped PINs, and an
  autofilled password manager, were both advised `INCREASE_FRICTION`. The middle stage
  is meant to let trust *influence* a treatment without *driving* it, and `OBSERVE` is
  the only rung that does that. The old value also made the stage boundary a cliff:
  silence at `n = 2.9`, friction at `n = 3`.
- **Scope entropy was normalised against the window size**: which made it depend on
  how many scopes the *application* has rather than how varied the *entity* was. A
  two-scope app could not reach the diversity threshold at all, so its most honest
  user was scored monotonous for the entire run. Now normalised against the scopes
  actually observed, so it measures balance while `distinctScopes` measures breadth.
- **A `hard` declaration that was not provable.** "Paid work requires enough credits"
  looks provable and is not: the client's view of its balance is stale by construction,
  since jobs bill asynchronously and another tab may have spent the difference. One
  refused request is how a person discovers their balance; a hundred is a script. Now
  `soft`. Being *enforced by the server* is not the same as being *provable*.
- **The saturation guard does not do what it claimed.** `D37` was recorded as the fix
  for an attacker farming uniform volume into unearned confidence. It cannot be:
  farming produces a high mean, a high mean proposes `ALLOW`, and a ceiling can only
  *lower* a decision: so the gate is unobservable for exactly the entity it targeted.
  Measured: 300 uniform positives absorb **17** strong negatives before leaving
  `ALLOW`. The claim is withdrawn and farming is an open problem again.

## From the roadmap of that era

Done: the core model, the pluggable store with its conformance kit and a durable
SQLite implementation, the browser collector, two integration targets with declared
invariants, the three enumeration tasks, the constraint taxonomy closed over proof
sources (D41), the weak-signal catalogue (D42), the two-tier symptom vocabulary
(D43): and generated persona traffic that exercises the probabilistic model and has
corrected it four times (D45–D49).

Since then, four things that needed no traffic: farming answered on mass through a
velocity ceiling (D50), a collector for every catalogued signal (D51), the anomaly
classifier built as distance-to-reference rather than trained (D52), and a v0.1 wire
format with its degradation rules tested (D53).

Since then, the instrument for real traffic exists (D56) and has been used (D57).
Looking for IXFE's real logs found there were none to read, neither service records
one row per request, and per-request rows are the only shape the behavioral window can
be computed from: so an observing proxy now sits in front of the live origin and
writes them. A real Chrome is then driven at it, because the site has no audience to
wait for.

That falsified four things, all of them in the integration rather than the model: a
200 carrying the SPA fallback was being credited as a success, one scope for every
page reproduced D46's entropy bug, weak signals on page views made the operator's own
uptime check a false positive, and two harness bugs would have read as model
behavior. See D57.

