# The recorded lab dataset

One run of the traffic lab, written down with its composition and its result. The
harness is [`examples/lab`](../examples/lab/README.md); this page is what it produced
and what may and may not be concluded from it.

## The run

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

## The composition

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

## The result

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

## What the run found

### F1. A page view carries no evidence, so an unknown entity stays unknown

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

### F2. A refusal is evidence, and it is what moved anything at all

`scanner` and `patient` asked for paths the origin does not have. A 404 on a page scope is
weak negative evidence (`evidenceFor` in `examples/ixfe/live/proxy.ts`), so their mass
grew, their stage reached `developing`, and its ceiling is `OBSERVE` (D46). They were
watched and nothing more, which is the correct shape of the answer for a prober whose
worst case is a 404: there is nothing to block, and `OBSERVE` says so without costing the
visitor anything.

### F3. A legitimate indexer inherits the site's dead links

`crawler` reached `OBSERVE` four times on `talkhere.life` and none on `aufsicht.dev`. The
difference is the build: TalkHere's `dist/` ships pages that link to paths it does not
contain, so its crawler walked into 404s that the site itself published. The observer
cannot tell that refusal from a guess at a hidden path, because a 404 is a 404 on the
wire.

That is a real defect with a real cost: a site with dead links makes every honest crawler
look worse, and a site owner would read the `OBSERVE` rate as a bot problem they do not
have. It is recorded as H19 in the roadmap, with the fix sketched: the observer already
sees the pages it serves, so a 404 for a path those pages linked earns nothing.

### F4. No legitimate visitor was ever given friction

The uptime monitor made eight reads at exactly 700 ms intervals and was allowed every
time. The human personas, the mobile one, and the indexer were also never treated. That
is the D46 ceiling doing its job: with a handful of page views and no evidence, the most
the trust dimension may ask for is `OBSERVE`, so regular intervals alone cannot become
friction. The false positive count for this run is zero and it is zero for a reason that
can be pointed at in the code, not because the sample was small.

## Calibration against this run (M2.2)

`npm run calibrate` replays these rows under a grid of policies, half-life 24, 72 and 168
hours against developing thresholds 3, 4 and 5, and counts the two mistakes per cell.
It refuses this run instead, and says why:

    the run has 129 recorded requests, below the 240 a grid needs to say anything
    aufsicht:reader has 2 requests, below the 8 that makes its label mean anything
    aufsicht:skimmer has 1 requests, below the 8 that makes its label mean anything
    talkhere:reader has 4 requests, below the 8 that makes its label mean anything
    talkhere:skimmer has 1 requests, below the 8 that makes its label mean anything

The refusal is the output, not a failure to produce one. Two personas leave after a
single request, which is honest behaviour and useless as a labelled segment, and the run
as a whole is about half the size a nine-cell grid needs before its cells differ from
noise. Lowering the floor would make the table appear without making it mean anything.

Every row also carries the observation that was evaluated, so a replay cannot drift from
the recorded run: calibration reads the same object the guard read instead of rebuilding
it from the row's other fields.

## What this dataset cannot do

It cannot calibrate the thresholds M2.2 was written for, and the reason is structural
rather than a matter of more runs.

- **Neither target has an action to succeed at.** No form, no write, no declared
  invariant, so there is no positive evidence to accumulate and no proven violation to
  price. Every row is either neutral or weakly negative.
- **The false negatives are not threshold placements.** Moving a threshold cannot make
  behaviour decisive; that is a decision (M2.4), not a constant.
- **The composition is not a population.** Seven personas were written here. Their share
  of the traffic is a design choice, so no rate read off this table describes a real site.

What it can do, and does, is hold the current behaviour still: 129 labelled rows, 14
persona runs, zero false positives on legitimate automation, and a written reason for
each adversarial miss. The next run that changes the treatment of any row here will show
up as a diff against this table, which is what M2.3 freezes into CI.

To calibrate, the lab needs a target where an honest visitor can do something and an
attacker can get it wrong: `npm run lab -- --target=ixfe` runs the D56 and D57 sessions
against the live deployment, where the waitlist and order endpoints do carry declared
fields and invariants.

## Reproducing it

```sh
npm run lab -- --target=aufsicht,talkhere --seed=1
npm run lab -- --report=2026-10-24T15-28-22-310Z
```

The second command re-reads the recorded files and prints the same tables without a
browser. A repeated run is not expected to be identical request for request, because
Chrome's own scheduling is not seeded; the seed controls the personas' pauses, which is
the part that was ours to control.
