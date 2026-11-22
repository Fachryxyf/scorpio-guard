# Host dataset: the first real integration's journal

This is the calibration half of the 0.3.0 record: the first deployment of the
library outside the lab, replayed against the policy grid. The narrative half (the
92-hour production record, the pentest, and the four defects) is
[INTEGRATION.md](INTEGRATION.md); the lab dataset it should be read beside lives in
[docs/DATASET.md](../DATASET.md). The two-era split follows the version folders, so
the lab runs recorded for 0.2.x stay there and what the first real integration
measured lives here.

## The host dataset: the first integration's journal (2026-10-31)

The library's first deployment outside the lab, a CRM host running 0.2.0
vendored, kept a decision journal, and its pentest produced a staging export of
5,123 evaluations with known ground truth: the testers' own accounts running
their legitimate flows, documented adversarial attempts, and everything the
pentest did to the system in between. The export lives with the partner
(`report-sg/guard-dev-export/`), not in this repository, because it is their
data. `npm run calibrate:host` reads it; the module is
`examples/lab/host-calibration.ts`, and its tests run on an embedded fixture so
CI never needs the dataset.

Three things were measured, in order of how much they can be trusted:

**The journal is reproducible.** With the host's seven invariants reconstructed
from the integration record and the evidence attribution derived backwards from
consecutive trust-mass deltas, the replay reproduces 5,122 of 5,123 recorded
violation sets (99.98%) and 5,020 of 5,123 recorded decisions (98%). The one
violation miss is a 2026-10-27 row whose facts column is empty, so nothing can
fire on it. Two recorded-data defects surfaced on the way, both worth knowing:

- The journal's `hardViolated` column disagrees with the row's own violations
  array: 14 logout rows record `hardViolated: false` while listing the hard
  invariant `auth-refresh-session-rotated` that decided them. The violations
  array is the reliable column; the boolean is not.
- The journal does not record the observation evidence the host attributed. The
  replay needed it, so it was derived (delta mass minus model-computed
  soft-violation mass, sign from the mean's movement). A journal that recorded
  `observation.evidence` would have made this a lookup instead of an inference,
  which is the same lesson Cacat 4 of the integration report teaches.

**The shipped cell is the best of the nine.** The same grid as the lab runs
(half-life 24/72/168h × developing 3/4/5) puts the shipped policy (24h, 3, 7) at
the lowest decision drift: 103 rows, against 128-232 for every other cell. The
false-positive and false-negative counts do not move across cells. That is the
result D64 could not produce from lab traffic: on real integration data, no
constant in the grid is the problem.

**The false positives are real, and they are not thresholds.** On rows where a
pentest test account made a clean request (2xx, no violation), the recorded
journal shows 772 of 1,239 advised treatment, and the replay puts it at 799.
Seven of the eleven resolved entities are affected. The cause is visible in the
journal and it is the integration, not the model: the host attributed weak
negative evidence to failed requests (1,140 such rows derived), the staging
build still carried the pre-Tugas-1 soft invariants that price a 404 at mass 2,
and the pentest drove errors through the same accounts that ran the legitimate
flows. By the time an account made its clean requests, its entity already held
the failures of its probes. No policy cell fixes that, because no policy cell
can: the mass was earned, by an entity key that deliberately merged two phases
of the pentest. The design answers this with D79's scope and fact guidance and
with Tugas 1's 404 fix, both of which the host has since applied.

What this dataset cannot do, on top of what the lab runs cannot:

- **Entity labels are coarse.** The pentest's accounts ran legitimate flows and
  adversarial probes through the same entity, so the FP count above is an upper
  bound and the honest one is "clean rows treated", not "legitimate users
  treated".
- **The evidence attribution is derived, not recorded.** Discounted positives
  (D55) cannot be told from weak ones below mass 1, and lost-update rows from
  the pre-D77 build misderive. 4,584 of 5,123 rows carried derivable evidence.
- **The adversarial label is thin.** Only the 24 documented RBAC-denial rows
  carry a row-level adversarial label, so the false-negative side of the matrix
  is one row (the same empty-facts row as above) and is not a measurement.
