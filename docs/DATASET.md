# The recorded lab dataset

Two runs of the traffic lab, written down with their composition and their result. The
harness is [`examples/lab`](../examples/lab/README.md); this page is what it produced
and what may and may not be concluded from it.

Run 1 pointed the lab at two static builds and found that a page view carries no
evidence. Run 2 added the IXFE landing service, where a form post and a hidden field can
be priced, and ran every persona as eight different visitors so that a short visit could
still contribute a sample (D66). Run 2 is the one calibration reads.

## Run 1: two static builds, one visit each

| field | value |
| --- | --- |
| run | `var/lab/2026-10-24T15-28-22-310Z/` |
| command | `npm run lab -- --target=aufsicht,talkhere` |
| node | v22.16.0, darwin-x64 |
| browser | Chrome/150.0.7871.125, one instance per persona |
| seed | 1 |
| targets | 2 |
| persona runs | 14 |
| recorded requests | 129 |
| false positives | 0 |
| false negatives | 6, being `scanner`, `patient` and `hammer` on both targets |

Entity keys were hashed with a per-run random salt, so these rows correlate inside the
run and with nothing outside it. The trust store is kept next to the records
(`<target>.sqlite`) so any decision can be replayed against the state that made it.

### Run 1 composition

Two shipped static builds, served from disk, with seven personas each. Ground truth is
known by construction: the lab launched every visitor and declared what it was.

| persona | ground truth | what it did |
| --- | --- | --- |
| `reader` | legitimate | landed, read, followed three links |
| `skimmer` | legitimate | landed on a phone-shaped viewport, scrolled, left |
| `monitor` | legitimate | eight fixed-interval reads, 700 ms apart |
| `crawler` | legitimate | read every link it found, 150 ms apart |
| `scanner` | adversarial | asked for eight paths no page links to |
| `patient` | adversarial | sixteen requests over about thirty seconds, four of them hidden paths |
| `hammer` | adversarial | twenty reads of one URL, back to back |

### Run 1 result

`aufsicht.dev`, 63 requests:

| persona | requests | decisions | treatment |
| --- | --- | --- | --- |
| reader | 2 | ALLOW x2 | none |
| skimmer | 1 | ALLOW x1 | none |
| monitor | 8 | ALLOW x8 | none |
| crawler | 8 | ALLOW x8 | none |
| scanner | 8 | ALLOW x2, OBSERVE x6 | none |
| patient | 16 | ALLOW x8, OBSERVE x8 | none |
| hammer | 20 | ALLOW x20 | none |

`talkhere.life`, 66 requests:

| persona | requests | decisions | treatment |
| --- | --- | --- | --- |
| reader | 4 | ALLOW x4 | none |
| skimmer | 1 | ALLOW x1 | none |
| monitor | 8 | ALLOW x8 | none |
| crawler | 9 | ALLOW x5, OBSERVE x4 | none |
| scanner | 8 | ALLOW x2, OBSERVE x6 | none |
| patient | 16 | ALLOW x8, OBSERVE x8 | none |
| hammer | 20 | ALLOW x20 | none |

### What run 1 found

#### F1. A page view carries no evidence, so an unknown entity stays unknown

Every persona that only ever read pages kept an evidence mass of 2.00, which is the prior
and nothing else, so their epistemic stage never left `unknown`, whose ceiling on the
trust dimension is `ALLOW` (`src/core/assess.ts`, D5). `hammer` asked for the same URL
twenty times and its anomaly score reached 0.963 on the fourth request; the advice stayed
`ALLOW` on all twenty, because the anomaly score is reported and does not decide (D37,
H8). The same pattern reproduces without a browser: twenty observations with no evidence,
110 ms apart, leave the mass at 2.00 and the decision at `ALLOW`.

This is the mechanism behind all six false negatives, and it is not a threshold placed
wrongly. On a target that declares nothing, behaviour alone never changes the advice.
Changing that is M2.4, and it is the single largest decision left before 1.0.

#### F2. A refusal is evidence, and it is what moved anything at all

`scanner` and `patient` asked for paths the origin does not have. A 404 on a page scope is
weak negative evidence (`evidenceFor` in `examples/ixfe/live/proxy.ts`), so their mass
grew, their stage reached `developing`, and its ceiling is `OBSERVE` (D46). They were
watched and nothing more, which is the correct shape of the answer for a prober whose
worst case is a 404: there is nothing to block, and `OBSERVE` says so without costing the
visitor anything.

#### F3. A legitimate indexer inherits the site's dead links

`crawler` reached `OBSERVE` four times on `talkhere.life` and none on `aufsicht.dev`. The
difference is the build: TalkHere's `dist/` ships pages that link to paths it does not
contain, so its crawler walked into 404s that the site itself published. The observer
cannot tell that refusal from a guess at a hidden path, because a 404 is a 404 on the
wire.

That is a real defect with a real cost: a site with dead links makes every honest crawler
look worse, and a site owner would read the `OBSERVE` rate as a bot problem they do not
have. It is recorded as H19 in the roadmap, with the fix sketched: the observer already
sees the pages it serves, so a 404 for a path those pages linked earns nothing.

#### F4. No legitimate visitor was ever given friction

The uptime monitor made eight reads at exactly 700 ms intervals and was allowed every
time. The human personas, the mobile one, and the indexer were also never treated. That
is the D46 ceiling doing its job: with a handful of page views and no evidence, the most
the trust dimension may ask for is `OBSERVE`, so regular intervals alone cannot become
friction. The false positive count for this run is zero and it is zero for a reason that
can be pointed at in the code, not because the sample was small.

## Run 2: three targets, eight visitors each

| field | value |
| --- | --- |
| run | `var/lab/2026-10-25T00-45-46-089Z/` |
| command | `npm run lab -- --repeat=8` |
| node | v22.16.0, darwin-x64 |
| browser | Chrome/150.0.7871.125, one instance per visitor |
| seed | 1 |
| targets | 3: `ixfe` on `http://127.0.0.1:4002`, `aufsicht`, `talkhere` |
| personas | 24, eight instances each |
| recorded requests | 1656 (ixfe 608, aufsicht 520, talkhere 528) |
| false positives | 0 |
| false negatives | 7 |

The second run exists because the first could not be calibrated: 129 rows against a floor
of 240, and personas defined as a two-request visit. D66 made a persona a population of
eight instances, each a different visitor with its own identity, its own seeded timing and
its own browser profile, so a short visit still contributes a sample and a repetition
cannot inherit the history of the one before it.

The IXFE target is the landing service from the IXFE project, served on loopback.
`https://ixfe.pro` timed out from the machine that made this run, so no row here came from
the production deployment.

### Run 2 composition

The seven personas from run 1 against each static build, plus ten against IXFE. Every one
ran eight times.

| persona | ground truth | what it did |
| --- | --- | --- |
| `ixfe-skimmer` | legitimate | landed, scrolled, left without acting |
| `ixfe-researcher` | legitimate | read pricing, opened the order page, did not submit |
| `ixfe-mobile-visitor` | legitimate | phone viewport, fast scroll, short session |
| `ixfe-stale-bookmark` | legitimate | submitted the waitlist from a cached pre-launch page, and was refused |
| `ixfe-returning-visitor` | legitimate | two visits separated by a real gap |
| `ixfe-uptime-monitor` | legitimate | twenty `GET /` on a fixed interval |
| `ixfe-endpoint-shooter` | adversarial | posted the waitlist endpoint directly, no page involved |
| `ixfe-honeypot-filler` | adversarial | filled the hidden website field with a plausible dwell |
| `ixfe-path-scanner` | adversarial | walked scanner paths at machine pace |
| `ixfe-silent-crawler` | adversarial | crawled every page at a fixed interval |

### Run 2 result

`ixfe`, 608 requests:

| persona | requests | decisions | treatment |
| --- | --- | --- | --- |
| ixfe-skimmer | 16 | ALLOW x16 | none |
| ixfe-researcher | 32 | ALLOW x32 | none |
| ixfe-mobile-visitor | 24 | ALLOW x24 | none |
| ixfe-stale-bookmark | 16 | ALLOW x16 | none |
| ixfe-returning-visitor | 24 | ALLOW x24 | none |
| ixfe-uptime-monitor | 160 | ALLOW x160 | none |
| ixfe-endpoint-shooter | 96 | RESTRICT x96 | at request 1 |
| ixfe-honeypot-filler | 80 | OBSERVE x16, INCREASE_FRICTION x64 | at request 3 |
| ixfe-path-scanner | 80 | ALLOW x16, OBSERVE x56, INCREASE_FRICTION x8 | at request 10 |
| ixfe-silent-crawler | 80 | ALLOW x80 | none |

`aufsicht.dev`, 520 requests:

| persona | requests | decisions | treatment |
| --- | --- | --- | --- |
| reader | 32 | ALLOW x32 | none |
| skimmer | 8 | ALLOW x8 | none |
| monitor | 64 | ALLOW x64 | none |
| crawler | 64 | ALLOW x64 | none |
| scanner | 64 | ALLOW x16, OBSERVE x48 | none |
| patient | 128 | ALLOW x64, OBSERVE x64 | none |
| hammer | 160 | ALLOW x160 | none |

`talkhere.life`, 528 requests:

| persona | requests | decisions | treatment |
| --- | --- | --- | --- |
| reader | 32 | ALLOW x32 | none |
| skimmer | 8 | ALLOW x8 | none |
| monitor | 64 | ALLOW x64 | none |
| crawler | 72 | ALLOW x40, OBSERVE x32 | none |
| scanner | 64 | ALLOW x16, OBSERVE x48 | none |
| patient | 128 | ALLOW x64, OBSERVE x64 | none |
| hammer | 160 | ALLOW x160 | none |

The table is the recording. The calibration replay of the same rows reproduces every one
of these counts, which is what the frozen fixture checks on each push.

### What run 2 found

#### F5. Reading pages is still not an achievement, so a crawler that only reads is invisible

`ixfe-silent-crawler` read eighty pages and was allowed all eighty. The static
`scanner`, `patient` and `hammer` misses are the same shape. D57 removed signals from page
views on purpose: from HTTP alone an uptime monitor and a crawler are the same client, so
pricing page views would have cost the monitor a false positive to catch the crawler. Run
2 shows the price with an evidence-bearing target present: every IXFE session that acts
(post a form, fill a hidden field, guess a path) was treated correctly, and the one
adversary that only reads was not touched.

#### F6. A form post with no page view is a proven violation, and it is priced at the first request

`ixfe-endpoint-shooter` produced 96 rows, 96 hard violations of
`WAITLIST_FORM_REQUIRES_PAGE_VIEW`, and 96 `RESTRICT` decisions. Nothing about that is
statistical: the profile declares that the form may only be posted after the page that
carries it, and the session posts without loading anything.

That is the correct answer for a labelled adversary and a warning for a host. An invariant
like that says no client may post without first loading the page, and a native app, a form
prefetched hours earlier, or a POST from an email link is not a browser session. A host
that cannot make that statement should not declare the invariant as hard; the library is
not wrong to believe it.

#### F7. The anomaly score measures novelty, not intent

Every row carries an anomaly score and the score never decides. Run 2 makes that choice
measurable instead of philosophical. The maximum score per persona:

| persona | ground truth | max anomaly | rows scored |
| --- | --- | --- | --- |
| `ixfe:endpoint-shooter` | adversarial | 0.9611 | 72 of 96 |
| `ixfe:uptime-monitor` | legitimate | 0.9610 | 136 of 160 |
| `talkhere:scanner` | adversarial | 0.9433 | 40 of 64 |
| `talkhere:monitor` | legitimate | 0.9362 | 40 of 64 |
| `talkhere:crawler` | legitimate | 0.9361 | 48 of 72 |
| `talkhere:patient` | adversarial | 0.9101 | 104 of 128 |
| `aufsicht:hammer` | adversarial | 0.7037 | 136 of 160 |
| `ixfe:path-scanner` | adversarial | 0.3966 | 56 of 80 |

An hypothesis that the score could drive a decision would have to pick a threshold. At
each one, counting the personas it gets wrong:

| threshold | false positives | misses | correct |
| --- | --- | --- | --- |
| 0.80 | 6 | 4 | 14/24 |
| 0.90 | 4 | 5 | 15/24 |
| 0.95 | 1 | 8 | 15/24 |
| 0.99 | 0 | 10 | 14/24 |
| the shipped evidence policy | 0 | 7 | 17/24 |

The reason is visible in the first table. A monitor on a fixed cadence is as unlike the
reference profile as an attacker posting a form, and an attacker crowding one URL with
160 requests is familiar, because that is what a tight client shape looks like. The score
answers "how unusual is this client's shape", and the label is about intent. D67 records
the consequence: the anomaly stays reported and does not decide, and M2.4 is closed with a
measurement rather than an argument.

## What run 2 got wrong before it was kept

Three defects, all found by reading the run instead of trusting the totals. They are here
because the next person to change the lab will hit the same three.

### F8. A replay without invariants reported drift that was missing input

The first freeze of run 2 reported two drifting personas: `ixfe-endpoint-shooter` was
recorded as `RESTRICT` 96 times and replayed as `ALLOW`, `OBSERVE` and
`INCREASE_FRICTION`. The fixture carried each row's observation but not the profile, so
the replay built a guard that declared no invariants and could not see a proven violation.

The fix is that the profile id travels with the row and with the fixture, and the replay
resolves it with `invariantsFor`. After the fix the same replay reports zero drifting
personas. The general rule: a fixture of a target that proves something has to carry what
the target declared, or the frozen decisions describe a weaker observer than the one that
recorded them.

### F9. A fixed Chrome port collided with a local service, and one failed instance ended a persona

The lab asked Chrome for a debug port from a fixed range. Port 5432 is where a local
PostgreSQL listens, so every persona that mapped to it failed to start while the rest of
the run looked healthy: `scanner` on both static builds and `returning-visitor` on IXFE
recorded zero rows, and the only trace was one line in the manifest. Chrome now gets a
port from the kernel and the lab reads it back from `DevToolsActivePort`.

The same run also stopped a whole persona at its first failed instance, so one hung page
on the aufsicht build cost seven of eight `reader` instances. A failed instance is now
recorded as a failed instance and the persona keeps running; only a browser that will not
start stops the persona, because that is systemic.

### F10. A doubled slash made two adversaries invisible

The first attempt at run 2 recorded 76 rows and is not kept. Its two form-posting sessions
recorded nothing at all: the lab wrapper passed `base + '/'` to sessions that already add
their own slash, so the requests went to `//api/waitlist`, which the scope table does not
recognise, and page scopes split between `/order` and `//order`. No error was printed. It
was found by reading the recorded run, fixed, and the run was repeated before any number
from it was used.

## Calibration against run 2 (M2.2)

The audit that refused run 1 passes here on its own terms: 1656 recorded requests, and
every persona above the eight that makes its label mean something. The smallest is
`skimmer` on a static build at eight, which is eight visits of one page each.

    half-life  developing  established    FP    FN   correct
        24h           3            7     0     7     17/24   (shipped)
        24h           4            8     0     8     16/24
        24h           5            9     0     8     16/24
        72h           3            7     0     7     17/24
        72h           4            8     0     8     16/24
        72h           5            9     0     8     16/24
       168h           3            7     0     7     17/24
       168h           4            8     0     8     16/24
       168h           5            9     0     8     16/24

What the grid says:

- **The shipped cell is the best cell, not a survivor.** Seventeen of twenty-four
  personas labelled correctly, zero false positives, seven misses. Moving
  `developingAt` to 4 or 5 loses one more catch, and at 5 the honeypot filler is allowed
  eight times before it is noticed.
- **The half-life axis did not move a single row.** This run spans minutes, so nothing
  decays inside it and the three columns are identical. That is printed rather than
  hidden: the plateau is a fact about the dataset, not about the constant.
- **Zero false positives is the constraint that held**, with eight instances of every
  legitimate persona in the run, including a monitor making 160 reads and two crawlers.
- **The seven misses are structural.** `ixfe-silent-crawler` and the static `scanner`,
  `patient` and `hammer` never earned evidence. No cell in this grid catches them,
  because a threshold cannot make silence decisive (F1, F5).

The grid is written to `calibration.json` next to the run, and `npm run calibrate`
exits zero only when the audit passes.

## What this dataset cannot do

- **It is not a population.** The personas were written here, and D66 repeats each of them
  eight times with independent timing. That is eight samples of one script, not eight
  kinds of visitor, so the spread inside a cell understates the spread between real
  visitors. D45 applies to every rate on this page.
- **It says nothing about decay.** The run spans minutes; the half-life never bites.
  Thresholds from this dataset are calibrated on a clock that barely moves.
- **The misses are not threshold placements.** Moving a constant cannot make behaviour
  decisive; that is the decision D67 records, and it was refused on this data.
- **The IXFE rows came from a local landing service**, not from `ixfe.pro`. The invariants
  and the endpoints are the shipped ones, the deployment is not.
- **The static targets declare nothing**, so no row from them can prove a violation. Their
  rows can only ever be statistical, and they are labelled as such.

What it can do, and does, is hold behaviour still and give the constants a reading: 1656
labelled rows from 24 personas across three targets in nine cells, with the shipped policy
the best of the nine and zero false positives. The frozen fixtures in
`examples/lab/fixtures/` replay these decisions on every push, and `npm run report:lab`
turns the run into the report the site publishes, so the numbers on the page come from the
recording rather than from memory.

## Reproducing it

```sh
# the IXFE landing service, from the IXFE project root (its .env holds a relative DB path)
node landing-service/server.js

# in this repository
LAB_IXFE_ORIGIN=http://127.0.0.1:4002 npm run lab -- --repeat=8 --seed=1
npm run calibrate
npm run freeze:lab
```

The IXFE target is optional: without `LAB_IXFE_ORIGIN` the two static builds still run and
the run is still calibrated, it just carries the F5 misses without the evidence that the
acting adversaries are caught. A repeated run is not expected to be identical request for
request, because Chrome's own scheduling is not seeded; the seed controls the personas'
pauses, which is the part that was ours to control.
