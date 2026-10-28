# Releasing: the runbook, and what the 0.2.x releases cost

## Status as of 2026-10-28

- 0.2.0 is **published**: 2026-10-28T05:24:29Z, from the tag `v0.2.0` on commit `0f426b1`,
  by `.github/workflows/release.yml`. Tarball shasum
  `e38c6e9f3dd131fdac0a2a95ef36cbd660c3b4ee`, 103 files, and the registry holds the
  provenance attestation at
  `https://registry.npmjs.org/-/npm/v1/attestations/@fachryxyf%2Fscorpio-guard@0.2.0`.
- 0.2.1 is **published** too: 2026-10-28T13:26:50Z, from the tag `v0.2.1` on commit
  `b85294a`, by the same workflow through the same trusted publisher entry. Tarball shasum
  `361cd94a420688728ed877f58fa1f6c3d0bb347a`, 103 files, 327,467 bytes unpacked, provenance
  attestation on the same endpoint shape as 0.2.0. It is a documentation-only patch: no
  code, no exported name, and no advice change, which the API gate confirms name for name.
- The registry served 0.2.1's tarball about ninety seconds after the upload, faster than
  the four minutes 0.2.0 took, so the gap is processing load rather than package size.
- The trusted publisher entry was created from the CLI with `npx npm@12 trust github`,
  allowed action `npm publish`. The workflow needed no secret and no one-time password;
  the only human step was approving the second factor in a browser once.
- Two manual attempts on 2026-10-25 had failed, first with `EOTP` and then with `403 Your
  account has been temporarily suspended due to a recent security-sensitive action`. The
  freeze lifted on its own, as npm said it would.
- **A one-time password prompt is not permission.** npm asks for the second factor before
  it checks whether the account may write at all, so a publish that reaches your
  authenticator can still be refused underneath it.
- The registry answered `+ @fachryxyf/scorpio-guard@0.2.0` immediately and served the
  tarball about four minutes later, with `404` on the `.tgz` until then. Verify from the
  registry, not from the local build, and read that gap as processing rather than failure.
- The status notes this section used to carry in the README, the CHANGELOG, and the site
  pages are gone in the commit that published, which is the rule this document set for
  itself. A status paragraph that outlives its cause is the same kind of slow-motion lie
  as a hand-copied number.

### What the tarball cannot say

The README inside the package is the README at the tagged commit, rendered on npmjs.com
and frozen there. It cannot say which version the registry serves: that sentence would be
wrong the moment the next version lands, and it could not be corrected until that release.
0.2.0 moved the fact to the versions page and left the README with the install line. Its
relative links were also rewritten to absolute repository URLs, because on npmjs.com
`docs/TESTING.md` resolves against the package page and ends on a 404.

0.2.1 exists because of that limit, not despite it. The README frozen into the 0.2.0
tarball still told a reader 0.2.0 was unpublished, so the page contradicted the version
number printed above it, and no commit could fix it. A documentation-only patch is cheap;
a public page that argues with the registry is not.

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
   never claims a version the registry does not have. The same commit updates the places
   that name the published version outright, because a page built from `main` cannot read
   the registry: the install block in `site/pages/usage.mjs`, the npm row in the
   `index.html` infobox, the footer line in `site/layout.mjs`, and the install block in
   `README.md`. All of them still said 0.1.0 after 0.2.0 shipped, which is why the list is
   written down instead of assumed.

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

The package has a trusted publisher entry, written from the CLI or from the npm settings
page. Once it names this repository and this workflow, no publish token exists anywhere: npm exchanges the
workflow's OIDC token for a credential that lasts one job, and records a provenance
attestation tying the tarball to the commit and the run.

- Entry: owner `Fachryxyf`, repository `scorpio-guard`, workflow `release.yml`. Allowed
  action `npm publish`, so a tag publishes directly rather than staging first.
- The workflow triggers on `v*` tags and runs the gates before it uploads. It installs
  npm major 11 on the runner, not `npm@latest`: npm 12 refuses a Node older than 22.22.2, and
  a release should not depend on which major was published that morning. The tag is the
  whole trigger; nothing here reads a token.
- Create or repair the entry from a machine where you can approve the second factor in a
  browser: `npx npm@12 trust github @fachryxyf/scorpio-guard
  --repo=Fachryxyf/scorpio-guard --file=release.yml --allow-publish`. It prints a URL,
  waits for the approval, and writes nothing if the approval never comes.
  `npx npm@12 trust list @fachryxyf/scorpio-guard` reads it back.
- Nothing is stored as a secret for this. `id-token: write` is the whole credential, and
  the repository holds no npm token that could leak or go stale.

0.1.0 was published by hand from the maintainer account, so it carries no attestation, and
provenance cannot be added to a version after it is published. 0.2.0 was pushed by the tag
and is the first version of this package with a registry-signed record of where it came
from. Both versions stay on the registry; neither will be unpublished.

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
