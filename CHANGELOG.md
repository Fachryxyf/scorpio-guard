# Changelog

Notable changes, in the shape [Keep a Changelog](https://keepachangelog.com) describes.
Version numbers follow [Semantic Versioning](https://semver.org).

## What a version number means here

The library gives advice, so a behavior change is an API change even when no
signature moved. The rules are therefore narrower than semver's default reading:

- **Patch**: no change to the advice for the same input and the same stored state.
  Bug fixes that only affect a decision nobody could rely on still count as major,
  and this project has preferred to publish 0.x instead of arguing the difference.
- **Minor**: the advice may change for the same input. Every such change is recorded
  here with a before and after example, so an adopter can tell whether their traffic
  moves.
- **Major**: 1.0.0 is reserved for the release that has the three proofs in
  `docs/ROADMAP.md` §1: a calibration dataset with published composition, the
  protocol running end to end, and a frozen API after a directed security review.

## [0.2.0] - 2026-10-28

### Release status

Published on 2026-10-28T05:24:29Z by `.github/workflows/release.yml`, from the tag `v0.2.0`
on commit `0f426b1`. The upload used a trusted publisher entry rather than a stored token,
so the registry holds a provenance attestation tying this tarball to that commit and that
run: the first version of this package with one. Shasum
`e38c6e9f3dd131fdac0a2a95ef36cbd660c3b4ee`, 103 files, 326,219 bytes unpacked.

Two manual attempts on 2026-10-25 had failed, first with `EOTP` and then with `403 Your
account has been temporarily suspended due to a recent security-sensitive action`. The
freeze lifted on its own, as npm said it would. `docs/RELEASING.md` carries the account
history, the runbook, and what the tarball cannot say.

Release gates that passed on the tagged commit, in CI and locally: `npm run check:manifest`,
`npm run check:docs`, `npm run check:api`, `npm run pack:check`, `npm run bench`, and the
rest of the runbook in `docs/RELEASING.md`.

### Added

- The API surface is recorded and frozen in `api/v0.2.json`, 140 exported names across four
  entry points, checked by `npm run check:api` with the TypeScript checker. Additions,
  removals, and kind changes all fail until the snapshot is rewritten on purpose (D74).
- `docs/SEMVER.md`, `docs/MIGRATION.md`, and `docs/RELEASING.md`: the version policy, the
  0.1.0 to 0.2.0 guide measured against the published tarball rather than remembered, and
  the release runbook with its current blocker.
- A Versions chapter on the site: the state of the package, what each bump promises, the
  deprecation path, the upgrade deltas, and the API gate.
- The soak harness can be paced (`--pace-ms`) and samples at a chosen interval
  (`--sample-every`), and it checks a fourth thing: whether retained RSS trends up between the
  first and last third of a run. A leak is a trend; a few minutes cannot show one, so a 24 hour
  run now measures something a stress run does not. The unpaced 24 hour commands this document
  used to carry would have written roughly 224 million sqlite rows in a day, which is a disk
  test with a memory test label. The run in progress (steady, started 2026-10-25 on a Core i5-5350U, followed by a
  two hour sqlite companion) prints a progress line a minute on stderr, because a day long run
  that writes only at the end cannot be told apart from a hung one. Its numbers are not in
  this file yet, so M4.4 stays open.
- The front page box shows the npm download count for the last month, read from the npm API by
  the browser and labelled as the one number on the site that does not come from the
  repository. The Node floor in the same box now says 22.13, which is what the package
  actually declares.
- The site build stops instead of rendering `n/a` when the test count cannot be read from the
  runner, after one retry. A page that says `n/a` where a number belongs is a number that lies
  by omission.
- A guarantees chapter on the site: the claims a gate enforces today with the test or decision
  that holds each one, the risks that are measured or priced instead of solved with what
  closing each would take, the two lab runs with their composition, and the three proofs
  1.0.0 waits for. The rule that a risk moves to the guarantee table only when a mechanism
  enforces it is D75.
- `docs/SECURITY-REVIEW.md`: the M4.3 packet, so the review is a list of things to break
  rather than a request. It names five surfaces, the claim and the code behind each, attacks
  worth trying, what would falsify each claim, the out of scope list with reasons, the six
  accepted risks, the evidence commands, and the finding format. The sign-off is empty until
  a reviewer who is not the author fills it.

- Declared invariants in seven classes, closed over the kinds of proof a host can
  actually hold rather than over attack shapes, with per-class advice (D41).
  `hard` and `soft` are separate claims: `hard` asserts the enumeration is complete
  and bypasses the trust ceiling, `soft` is negative evidence (D13, D16, D32, D38).
- `transitionGraph()`, so a host can declare allowed flow edges instead of writing a
  check by hand.
- A weak-signal catalogue with per-id weights, deliberately threshold-free (D42),
  and collectors for the entries the library can measure itself (D51).
- Behavioral features over a retained window, and the concurrence condition that
  decides whether low variance is believable (D36, D37).
- An anomaly classifier: distance to a reference profile, reported on every
  assessment whether or not it drives the decision (D52).
- `sqliteStore` on `node:sqlite`: trust survives a restart and is shared by
  processes on one host, with no dependency (D44).
- `kvStore` and `upstashTransport`: durable trust on serverless over HTTP, with an
  injected transport so it is not one vendor's adapter (D60).
- `onAssessment`: one versioned event per evaluation, with the decision, stage,
  uncertainty, trust numbers, violations and trace. The entity reference is withheld
  by default and can be replaced by a salted hash (D61).
- `checkStoreConformance`, a published kit so a host-written store proves itself
  against the same contract as the reference (D8).
- A traffic lab in `examples/lab`: one Chrome per persona, seven declared personas,
  three targets, a labelled dataset written under `var/lab/`, and `docs/DATASET.md`
  recording what the first run found. Development-only, not in the published tarball
  (D63).
- `npm run calibrate`: replays a recorded lab run under a grid of evidence half-lives
  and epistemic thresholds, counts false positives and negatives per persona, and
  refuses a run that cannot answer the question instead of printing a constant table
  (D64).
- `npm run freeze:lab`: freezes a recorded run into `examples/lab/fixtures/`, and a CI
  test replays it on every push, so a model change that moves any decision fails the
  build instead of being found in production (D65).
- `npm run lab -- --repeat=N`: every persona runs as N distinct visitors, each with its
  own identity and profile, so a persona defined as a short visit still contributes
  enough rows to calibrate and one treated repetition counts as a false positive for
  the whole persona (D66).
- `npm run report:lab`: the recorded run becomes a small committed report
  (`examples/lab/report.json`) that the site renders, so the published false-positive and
  miss counts are generated from the recording instead of typed into a page, and
  `examples/lab/report.test.ts` fails if the counters stop adding up or if another policy
  cell beats the shipped one (M2.8).
- A second recorded lab dataset and its frozen fixture: 1656 rows, 24 personas across
  three targets, eight visitors per persona, zero false positives and seven misses. The
  grid it produces has the shipped policy as its best cell, and the fixture replays all
  1656 decisions on every push (D64, D66).
- The protocol runs end to end outside the package: 22 fixtures in `protocol/fixtures/v0.1/`
  that every implementation has to pass, a reference receiver in `examples/protocol/server.ts`
  with its own validator written from `PROTOCOL.md` rather than from the library, and a
  batching sender in `examples/protocol/sender.ts`. The decoder now rejects a field that
  section 1 forbids instead of ignoring it, with a stable code, and both implementations
  answer the same fixture with the same result (D70).
- Operational defaults for the exchange, recorded rather than implied: a send every 20
  shapes or 60 seconds, an undeliverable batch dropped instead of retried, one hour of
  shape aggregates on the receiver, a replay window as long as retention, 60 requests per
  minute per transport address, and a 64 KiB body limit (D71).
- `npm run protocol:serve` starts the reference receiver. The package still transmits
  nothing on its own: no import opens a socket.
- `docs/ROOT-OF-TRUST.md`: the rule for deriving an entity key, the measured cost of every
  way to get it wrong, and a checklist. Six tests in `src/core/root-of-trust.test.ts` hold
  the numbers: one changed key discards six observations of distrust, earning the same
  standing back costs 25 positives, a shared key hands one visitor history to everyone, and
  a per-request proof is the one thing a rotated key cannot erase (D72).
- Runtime matrix in CI: Node 22.13.0 (the floor in `engines`), 22.x, and 24.x each run the
  suite, the build, and a smoke import of `dist/`. `src/core/runtime-surface.test.ts` walks
  the import graph from `.` and `./collect` and fails on any Node-only global, verified by
  mutation, and `docs/RUNTIME.md` records which targets are executed and which are still
  only argued.
- `npm run soak` and `npm run soak:flood`: a fixed pool and a stream of fresh references
  against the entity cap, with the same three checks locally and in CI (state under the cap,
  p99 under 5 ms, retained RSS after warmup). Five short runs are recorded in `docs/SOAK.md`
  and the 24 hour run is not one of them, so M4.4 stays open.
- `npm run poison` and `docs/POISONING.md`: the price of a patient attacker, measured.
  A constant-gap script stops buying tolerance at five negatives no matter how many
  positives it spends; a jittered script buys one extra tolerated negative per 1.71
  positives; turning the regular-gap discount off makes the two identical, which is how the
  discount is shown to be the mechanism. Four rows are asserted (D73).

### Changed

- The traffic lab observes `aufsicht.dev` and `talkhere.life`, both live, by origin with an
  optional local build. The `ixfe` target row is gone: the deployment stopped answering on
  2026-10-25, and a row that can never run only adds a skip line to a report. The recording,
  the frozen fixture, and the invariant declarations stay where they are, labelled as the
  record of a site that is offline, and the dataset keeps the names it was measured under
  (D47, D56, D57 notes).
- The observing proxy speaks TLS when the origin does, and asks for the origin host instead of
  the loopback address the visitor typed. A default https target was observable in name and
  not in fact before this, because the upstream request was plaintext only and every origin
  behind a CDN answered the default vhost. Checked with one persona against aufsicht.dev:
  ten requests recorded, every one ALLOW.
- An epistemic stage now precedes trust and uncertainty, and `developing` permits at
  most `OBSERVE`. Before, a third observation could turn silence into friction (D40,
  D46).
- Erasure and retention are now proved against every shipped store rather than
  asserted: after a forget and after the retention horizon the record is gone from the
  storage itself, not only invisible to `get`, and the entity comes back cold. The event
  stream carries no identity by default, so a host log holds nothing the store would have
  had to erase (D69, H15).
- A 404 for a path the site itself linked no longer counts as negative evidence: the
  observer learns the navigation it serves and treats the site's own dead links as the
  site's problem (D68, H19). Every other 404 is unchanged, and each record now says which
  case it was (`linkedNotFound`).
- The anomaly score stays reported and outside the decision, which is what it already
  did, but the reason is now a measurement instead of a postponed question: on the
  recorded traffic no threshold on the score beat the evidence policy, and the score
  ranks a legitimate monitor and a form-posting attacker almost identically (D67, H8
  closed). No library behaviour changed.
- Positive evidence earned at machine-regular gaps is discounted at intake; negative
  evidence never is (D54, D55).
- A soft invariant violation is strong negative evidence rather than its own
  decision input (D38).
- Farming is answered by pricing evidence at intake instead of by a rate threshold
  that also caught legitimate automation (D50, D55).
- The cold-start band is gone: an entity with no history is `unknown`, which is not
  the same as suspicious (D39).
- The repository states its own governance. `main` cannot be force pushed or deleted, and a
  ruleset enforces that and nothing else. One maintainer has write access, so a pull request
  is the only way in for anyone else. CI green is a rule the maintainer keeps rather than a
  required status check, and CONTRIBUTING.md says that instead of implying a review process
  with one participant. CODE_OF_CONDUCT.md and a pull request template are new.
- GitHub private vulnerability reporting is on. SECURITY.md and the issue template have
  pointed at that form since the first version, and until 0.2.0 it answered 404 for everyone
  except the owner.
- Dependabot alerts and security updates are on, the wiki is off, and a workflow may only use
  actions published by GitHub or a verified publisher.
- The public tree no longer carries one machine disk layout. The two static lab targets and
  the pentest checkout are read from `LAB_*` variables or from `var/lab-paths.json`, which
  git ignores, and a missing path names the variable to set instead of failing quietly.

### Fixed

- The 0.1.0 heading said 2026-08-15. The registry published 0.1.0 on 2026-08-24 from commit
  `c488012`, which is tagged `v0.1.0` now; no tag existed at release time, and the entry says
  so.
- CONTRIBUTING.md said Node 22.6, D26 was titled with 22.6, and the audit document repeated
  it. The floor has been 22.13 since `./sqlite` landed, and `engines` said so the whole time.
- Two thresholds that generated traffic showed to be wrong: the boundary where
  friction begins, and the one that let a third observation escalate (D46).
- `kvStore` no longer accepts fail-open without an error sink. Silence was the
  failure mode: a store failing open looks exactly like one that works (D62). This is
  a **breaking change** to `KvStoreOptions`, which is why it lands in 0.2.0 while
  0.1.0 is the only published version.
- The lab built every IXFE session URL with a doubled slash, so its two form-posting
  adversaries silently recorded nothing and page scopes split between `/order` and
  `//order`. Found by reading the first recorded run, fixed before any number from it
  was used.
- Chrome is launched on a port the kernel chooses instead of a fixed one. The fixed
  range collided with a local service listening on 5432, and the personas that mapped
  to it failed to start while the rest of the run looked healthy.
- A persona instance that fails is recorded as a failed instance instead of ending the
  persona. One hung page used to cost seven of eight reader instances, which shrank the
  sample to whichever instance happened to work (D66).
- The footnote under the front page box had no padding of its own, so it sat on the box
  border and read as broken markup. It is now a footnote: its own padding, a separator that
  matches the table rows, and a smaller sans face. The sentence is shorter too, because it
  was written for the full page width and ended up in an 18rem box.

### Removed

- The rate floor that stood in for a farming decision. It is still computed and
  reported, because "was this entity farming" is worth reading, but nothing escalates
  on it (D54, superseded by D55).

## [0.1.0] - 2026-08-24

First published version: the guard, the trust model, the decision spectrum, the
memory store, and the original thirty design decisions. The npm tarball is the
record, since this file was added in 0.2.0 and back-filling it from memory would be
invention.

The heading said 2026-08-15 until 2026-10-25. The registry is the record for this: 0.1.0
was published on 2026-08-24 from commit `c488012`. That commit is tagged `v0.1.0` now,
retroactively, because no tag was made when the package was released.
