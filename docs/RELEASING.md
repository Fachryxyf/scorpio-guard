# Releasing: the runbook, and why 0.2.0 is waiting

## Status as of 2026-10-25

- 0.2.0 is set in `package.json` on `main` and is **not** published.
- The npm account that owns the package is **suspended for 72 hours as of 2026-10-25**,
  which blocks publishing until roughly 2026-10-28. This is an account problem, not a code
  problem: every gate below is green on `main`, and CI has passed on the commit that holds
  the version.
- The registry is expected to keep serving 0.1.0. Check rather than assume before
  announcing anything: `npm view @fachryxyf/scorpio-guard versions`.
- When the suspension lifts, run the runbook below and then delete this section, together
  with the dated status note on the site. A status paragraph that outlives its cause is the
  same kind of slow-motion lie as a hand-copied number.

## Preconditions, all automated

Run from a clean tree on `main`, after CI is green:

```
npm ci
npm run typecheck
npm test
npm run build
npm run smoke
npm run site:check
npm run check:docs
npm run check:claims
npm run check:api
npm run check:manifest
npm run pack:check
npm run bench
npm run protocol:check
npm run example:integration
```

`check:api` is the freeze: it compares the built declarations with `api/v0.2.json` and
fails on any added, removed, or re-kinded name. If it fails, the release commit is the one
that has to explain why.

## The runbook

1. Confirm the tree is clean and CI is green on the exact commit being released.
2. Set the version in `package.json`, and turn the CHANGELOG `unreleased` heading into the
   dated release heading. No other content changes in the same commit unless they are part
   of the same release note.
3. If the API moved on purpose, run `npm run api -- --write` and list every added and
   removed name in the CHANGELOG entry. A snapshot rewrite without a written reason is the
   one thing this gate exists to prevent.
4. `npm run build`, then `npm run check:api` against the built output.
5. `npm run pack:check`: it packs the tarball, installs it into an empty directory, imports
   it, and evaluates one request. A package that imports locally but not from a tarball is
   the failure this step exists for.
6. `npm publish --access public` with the maintainer account. There is no token in this
   repository and none in CI; publishing is a person with a second factor, not an
   automation.
7. `git tag v0.2.0` and push the commit and the tag. The tag is what ties the registry to a
   commit, and npm records it as `gitHead` in the package metadata.
8. Verify from the registry, not from the local build: `npm view @fachryxyf/scorpio-guard
   dist-tags`, then install into an empty directory and run `node -e` with an import and
   one evaluation.
9. Update the versions page on the site in the same commit as the release, so the site
   never claims a version the registry does not have.

### If a tag was missed

0.1.0 was published on 2026-08-24 with no tag, and was tagged `v0.1.0` on 2026-10-25 instead.
The repair is mechanical, and it must not be done from memory:

```
npm view @fachryxyf/scorpio-guard@0.1.0 gitHead
```

That is the commit the tarball was built from, and that is the commit the tag goes on, never
the current tip. The CHANGELOG says the tag was made late and why, so the gap reads as a gap
and not as a release that always had a tag.

## What never happens

- No publish from a dirty tree, and no publish with a red gate.
- No unpublish of 0.1.0. A published version stays; fixes go forward.
- No `latest` tag moved to an unreleased version. The tag points at what is installed by
  default, and the default should be something a stranger can actually get.
- No release notes written after the fact from memory. The CHANGELOG entry is written while
  the change is being made, which is why 0.1.0 has a short entry: back-filling it would be
  invention.

## After the release

- Check the site build against the registry version (`npm run site:check` after updating the
  versions page).
- If the release moved advice, the versions page and `MIGRATION.md` get the row in the same
  commit. An advisory change that is real but undocumented is the failure mode this whole
  document is written against.
