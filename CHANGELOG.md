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

## [0.2.0] - unreleased

Tagged in `package.json`, not yet published to npm. The registry has 0.1.0, and
0.1.0 is not what this repository now contains. Release gates:
`npm run check:manifest`, `npm run check:docs`, `npm run pack:check`, `npm run bench`.

### Added

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

### Changed

- An epistemic stage now precedes trust and uncertainty, and `developing` permits at
  most `OBSERVE`. Before, a third observation could turn silence into friction (D40,
  D46).
- Positive evidence earned at machine-regular gaps is discounted at intake; negative
  evidence never is (D54, D55).
- A soft invariant violation is strong negative evidence rather than its own
  decision input (D38).
- Farming is answered by pricing evidence at intake instead of by a rate threshold
  that also caught legitimate automation (D50, D55).
- The cold-start band is gone: an entity with no history is `unknown`, which is not
  the same as suspicious (D39).

### Fixed

- Two thresholds that generated traffic showed to be wrong: the boundary where
  friction begins, and the one that let a third observation escalate (D46).
- `kvStore` no longer accepts fail-open without an error sink. Silence was the
  failure mode: a store failing open looks exactly like one that works (D62). This is
  a **breaking change** to `KvStoreOptions`, which is why it lands in 0.2.0 while
  0.1.0 is the only published version.

### Removed

- The rate floor that stood in for a farming decision. It is still computed and
  reported, because "was this entity farming" is worth reading, but nothing escalates
  on it (D54, superseded by D55).

## [0.1.0] - 2026-08-15

First published version: the guard, the trust model, the decision spectrum, the
memory store, and the original thirty design decisions. The npm tarball is the
record, since this file was added in 0.2.0 and back-filling it from memory would be
invention.
