# The traffic lab

A harness that points real Chrome instances at real sites, one declared persona per
instance, and records what the observer decided about each request. It exists because
the thresholds in this project have to come from somewhere, and the alternative was
inventing them.

This is M2.1 in [`docs/ROADMAP.md`](../../docs/ROADMAP.md). The calibration those
numbers feed is M2.2.

## What it produces

`var/lab/<runId>/`, gitignored, with:

- `manifest.json`: the run, the seed, the browser, and one row per target and persona.
  It also carries the sentence that keeps the dataset honest: this is generated
  traffic, and no rate read off it describes real visitors.
- `<target>.jsonl`: one line per observed request, in the shape
  [`LiveRecord`](../ixfe/live/proxy.ts) already uses, plus `persona` and
  `groundTruth`.
- `summary.json`: per persona, how many requests, which decisions, and the first one
  that changed anything.
- `<target>.sqlite`: the trust store that run accumulated, kept so a record can be
  replayed against the state that produced it.

## The composition

Seven personas for a static target, and the split is the point: four legitimate and
three adversarial, so a run can show both mistakes.

| persona | label | what it does |
| --- | --- | --- |
| `reader` | legitimate | lands, reads, follows three links, leaves |
| `skimmer` | legitimate | lands on a phone, scrolls, decides it is not for them |
| `monitor` | legitimate | uptime monitor, eight fixed-interval reads |
| `crawler` | legitimate | indexer reading every link it finds, quickly |
| `scanner` | adversarial | asks for eight paths no page links to |
| `patient` | adversarial | probes slowly, between page views, staying under any velocity rule |
| `hammer` | adversarial | twenty reads of one URL, back to back |

`monitor` and `crawler` are the interesting legitimate ones. Both are automated and
both are wanted, so friction against either is a false positive that would cost a real
operator something. `scanner` and `patient` are wanted to fail. One asks for surfaces that are not there,
the other asks slowly and between real page views, because a rule that only counts
requests per second would read the second one as a reader.

The third target, `ixfe`, reuses the sessions in
[`examples/ixfe/live/visitors.ts`](../ixfe/live/visitors.ts) so its flows are the ones
D56 and D57 wrote, not a second implementation of them.

## Running it

```sh
npm run lab                                  # every available target
npm run lab -- --target=aufsicht              # one target
npm run lab -- --persona=reader,hammer        # one persona on each target
npm run lab -- --seed=7                       # a different, repeatable stream
npm run lab -- --repeat=8                      # every persona as eight different visitors
npm run lab -- --strict                       # non-zero exit on any false positive or negative
npm run lab -- --report=<runId>               # re-read a run without a browser
```

Chrome is expected at `/Applications/Google Chrome.app`. The two static targets are
built elsewhere on disk; override their locations with `LAB_AUFSICHT_ROOT` and
`LAB_TALKHERE_ROOT`, and the live IXFE origin with `LAB_IXFE_ORIGIN`. A target whose
build is missing is reported and skipped rather than silently dropped.

Ports are fixed per target for the site (`4700+n`) and the observer (`4800+n`).
Chrome gets no port at all: it is launched with `--remote-debugging-port=0` and the
port the kernel chose is read back from `DevToolsActivePort` in its profile directory.
A fixed range was tried first and it collided with a local service on 5432, so every
persona that mapped to that port failed to start while the rest of the run looked
healthy. One Chrome per persona instance, launched with its own `--user-data-dir` and
killed when the instance is done, because a shared instance shares a cache and a cookie
jar and would quietly contaminate the next persona.

## From a run to the published numbers

```sh
npm run calibrate      # replay the newest run under the nine-policy grid
npm run freeze:lab     # rewrite the committed fixture from that run
npm run report:lab     # write examples/lab/report.json for the site
```

`calibrate` refuses a run it cannot learn from and writes nothing. `freeze:lab` writes
the fixture the test suite replays. `report:lab` writes the small committed report the
site renders as its lab section, so the false-positive and miss counts on the page come
from the recording instead of from someone reading a terminal once.

## Repetitions

`--repeat=N` runs every persona N times. Each repetition is a different visitor: its
own identity, its own seeded timing, its own profile directory (D66). Rows from all
repetitions are grouped under the persona, and one treated repetition is a false
positive for the whole persona even when the other seven were allowed.

The identity has to differ for that to be true. The observer keys an entity on address
and user-agent, and every instance here arrives from loopback, so repetitions sharing an
agent would be one client with eight visits of history instead of eight clients. The
declared agent's last number is bumped per repetition, which is generated on purpose and
is not a claim about any released browser.

A repetition varies timing, not behaviour. Eight skimmers are eight runs of the same
script, so the spread inside a cell understates the spread between real visitors. Use it
to get enough rows per persona to calibrate at all, not as a substitute for traffic.

## What the numbers do not say

- **They are not a population.** The personas were written here, so the composition
  is a design decision and not a measurement of who visits a site. D45 applies.
- **Repetitions are not variety.** `--repeat` multiplies instances of one script with
  independent timing. It satisfies the rows a grid needs; it does not estimate how much
  real visitors of the same kind differ from each other.
- **A static site can prove nothing.** Its profile declares no invariants, so a run
  against it measures the statistical dimension only. A `BLOCK` there came from
  behaviour, never from a proven violation.
- **Chromium is not every browser.** One engine, one renderer, one network stack.
  Anything that depends on a different TLS or HTTP fingerprint is out of scope.
- **The targets are local builds.** `aufsicht.dev` and `talkhere.life` are shipped as
  static directories; serving them from disk removes the CDN, the TLS terminator, and
  the edge rules that a real visitor meets.

## Adding a persona

Add it to `staticPersonas()` in [`personas.ts`](./personas.ts) with a label, a
description, and a unique user agent. Uniqueness is enforced by a test, not a comment:
the observer keys an entity on address and user agent, and every persona arrives from
loopback, so two personas sharing an agent would be merged into one entity and the
labels would stop meaning anything.

## Adding a target

Add an entry to `labTargets()` in [`targets.ts`](./targets.ts) with either a `root`
(a directory to serve) or an `origin` (something already running), plus a profile.
`staticProfile()` is the honest default for a site with no provable rules. A target
that can prove something belongs in its own module, the way `ixfe` does.
