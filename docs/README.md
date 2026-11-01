# Documentation layout

`docs/` holds two kinds of document, and the folder rule keeps them apart:

- **Living documents** sit at the root: `TESTING.md`, `SEMVER.md`, `DEPLOYMENT.md`,
  `ROOT-OF-TRUST.md`, `POISONING.md`, `RUNTIME.md`, `RELEASING.md`, `ROADMAP.md`,
  `SECURITY-REVIEW.md`, `SOAK.md`, `MIGRATION.md` (an index), `DATASET.md` (the lab
  dataset, still replayed in CI), and the generated `CLAIMS.md`. They describe the
  current version and are updated in place.
- **Version folders** hold what was written for, or measured against, one version:
  `v0.1.0/`, `v0.2.0/`, `v0.3.0/`. A document moved into a version folder is a record,
  not a claim about the present; it is not edited to look current, for the same reason
  measured rows keep the names they were measured under.

| Folder | Contents |
|---|---|
| `v0.1.0/` | The first registry release's record: published by hand, no attestation, rollback target. |
| `v0.2.0/` | The MVP-era records: the product audit (2026-10-18), the 0.1.0 → 0.2.0 migration guide, and the integration targets that era measured (IXFE, HealthMe, the lab). |
| `v0.3.0/` | The current version's additions: the first real integration's record (`INTEGRATION.md` — 92 hours of production traffic and the pentest), its calibration replay (`HOST-DATASET.md`), and the 0.2.1 → 0.3.0 migration guide. |
