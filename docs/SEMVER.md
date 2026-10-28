# Version policy: what a number promises

The CHANGELOG states the rule for advice. This document states the rule for the API, the
deprecation path, and the gate that keeps both true (D74). M5.3 asks for a final semver
policy, a migration guide, and a deprecation policy; this is the first and third, and
[MIGRATION.md](MIGRATION.md) is the second.

## Where the project is

0.2.0 has been on npm since 2026-10-28, and 0.1.0 stays installable for rollback. How it
was published, and what the earlier account freeze did to it, is recorded in
[RELEASING.md](RELEASING.md), not here. From 0.2.0 onward the exported surface is written
down in `api/v0.2.json` and checked on every push.

## What each number promises

| Bump | API | Advice |
|---|---|---|
| **patch** | unchanged | unchanged for the same input and the same stored state |
| **minor** | additions only, no removals and no kind changes | may change, and every change is recorded in CHANGELOG with a before and after |
| **major** | removals, kind changes, a protocol major, a change to the decision vocabulary | anything, including changes that would otherwise be minor |

Two consequences are deliberate.

**A behaviour change is an API change, but not a major one.** This library exists to give
advice, so freezing the advice would freeze the product. What a minor promises is that the
change is written down where an adopter can find it, with the old behaviour beside the new.

**Removals are major even in 0.x.** Semver would let 0.x break anything. This project does
not, because the alternative is that a 0.x user cannot upgrade without reading the source.
The gate below refuses a removal until the snapshot is rewritten in the same commit that
documents it, so the removal is always a visible act.

## Deprecation

- A name is deprecated in its JSDoc with `@deprecated`, the replacement, and the version
  that deprecated it. Types carry the same note.
- A deprecated name survives at least one minor release. Removal happens in a major.
- **No runtime warnings.** The library never writes to the host standard output or error
  stream, because a dependency that logs into someone else process is a dependency that
  gets removed. The deprecation is visible in the editor, the types, the CHANGELOG entry,
  and the API diff.
- **Types are part of the surface.** Removing a field from an exported type is a removal
  and needs a major, whether or not the runtime still ignores that field.

## The gate

```
npm run api -- --write    # rewrite api/v0.2.json, deliberately
npm run api -- --check    # compare the built package with the snapshot
```

`scripts/api-surface.mjs` reads the emitted declarations with the TypeScript checker and
records every exported name per entry point, plus whether it is a type, a value, or both.
As of 0.2.0 that is 140 names across four entries: 102 in `.`, 27 in `./collect`, 3 in
`./sqlite`, 8 in `./kv`. Additions fail the check as well as removals, so a new export is
never accidental, and the snapshot only moves in a commit that also moves the CHANGELOG.

The gate has one honest limitation: it records exported names and kinds, not the members of
exported types. Narrowing a field from `Decision` to `Decision | undefined` is visible in
the declaration diff and invisible to this check. Member-level changes are reviewed by
reading the diff, and the snapshot is not a substitute for that review.

## Pre-releases and pinning

Adopters should pin an exact version rather than a caret range, as the README says. Minor
releases can move advice, and a caret range pulls that in silently. There is no `next` or
`canary` dist-tag: the only published tag is `latest`, so what the registry serves is what
the project believes.

## What 1.0.0 changes about all of this

Nothing in this document waits for 1.0.0. The freeze is already in force, which is the
point: 1.0.0 is the release that can be trusted because the rule was already being followed,
not the release where the rule starts. What 1.0.0 adds is the three proofs in
[docs/ROADMAP.md](ROADMAP.md) section 1, and the promise that the protocol major and the
decision vocabulary (`ALLOW`, `OBSERVE`, `INCREASE_FRICTION`, `RESTRICT`, `BLOCK`) will not
move without a major release.
