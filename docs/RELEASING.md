# Releasing: the runbook, and why 0.2.0 is waiting

## Status as of 2026-10-25

- 0.2.0 is set in `package.json` on `main` and is **not** published.
- A publish attempt on 2026-10-25 at 12:15 UTC was refused by the registry:
  `403 Your account has been temporarily suspended due to a recent security-sensitive
  action`. The account record shows its last change at 2026-10-25 02:52 UTC, and npm's
  freeze for this class of action lasts 72 hours and lifts on its own, so the expected
  window is around 2026-10-28 02:52 UTC. The email npm sent for that action names the
  exact moment. Read that, not the arithmetic.
- The attempt before it returned `EOTP` instead. **A one-time password prompt is not
  permission.** npm asks for the second factor before it checks whether the account may
  write at all, so a publish that reaches your authenticator can still be refused
  underneath it. Both attempts are in the account's log; neither is evidence of clearance.
- Everything else is green on `main`: every gate in this file, and CI on the commit that
  holds the version. The registry keeps serving 0.1.0; check before announcing anything
  (`npm view @fachryxyf/scorpio-guard versions`).
- When the freeze lifts, publish through the workflow below if the trusted publisher entry
  is saved, or use the manual path. Then delete this section together with the dated status
  notes in the README, the CHANGELOG, and the site pages. A status paragraph that outlives
  its cause is the same kind of slow-motion lie as a hand-copied number.

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
6. Push the release commit to `main` first, then tag it. The tag is what publishes when
   the trusted publisher entry is in place, so it has to point at a commit that is already
   on the branch.
7. `git tag -a v0.2.0 -m "..."` and `git push origin v0.2.0`. That runs
   `.github/workflows/release.yml`, which refuses to publish unless the tag equals
   `v` + the `package.json` version, then uploads with `--provenance`. The tag also ties
   the registry to a commit, and npm records it as `gitHead`. Manual alternative, when the
   workflow is not configured: `npm publish --access public` from the maintainer account,
   same tarball, no attestation.
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

## Publishing from CI (trusted publishing)

The npm settings page for the package holds a trusted publisher entry. Once it names this
repository and this workflow, no publish token exists anywhere: npm exchanges the
workflow's OIDC token for a credential that lasts one job, and records a provenance
attestation tying the tarball to the commit and the run.

- Entry: owner `Fachryxyf`, repository `scorpio-guard`, workflow `release.yml`. Allowed
  action `npm publish`, so a tag publishes directly rather than staging first.
- The workflow triggers on `v*` tags and runs the gates before it uploads. It installs
  `npm@latest` on the runner, prints the version, and fails rather than publish with a CLI
  too old for OIDC.
- Nothing is stored as a secret for this. `id-token: write` is the whole credential, and
  the repository holds no npm token that could leak or go stale.

0.1.0 and 0.2.0 were published by hand from the maintainer account, so neither carries an
attestation, and provenance cannot be added to a version after it is published. That makes
the first version published through this workflow the first one this project can point at
with a registry-signed record of where it came from. That is the reason to prefer the tag
path, rather than a taste for automation.

## What never happens

- No publish from a dirty tree, and no publish with a red gate.
- No retry loop against a refusal. A `403` after an authenticator prompt means the account
  cannot write yet; the fix is time or npm support, not another code.
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
