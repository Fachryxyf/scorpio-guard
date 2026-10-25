# Claims Without a Test, and Why

Companion to `docs/CLAIMS.md`, which is generated. A line here says: this design
decision has no test naming it, and this is the reason. `npm run check:claims` fails
when a decision has neither a test nor an entry in this file, so the list cannot grow
by accident.

Where the behaviour *is* covered by something that is not a `*.test.ts`, the reason
names the gate instead of pretending no coverage exists.

- D7: One package, multiple entry points. Checked by `npm run pack:check`, which inspects the tarball and imports every subpath from an installed copy in an empty directory. It is a gate rather than a test file, so no test names this decision.
- D12: Core is framework-agnostic. A property of the imports: nothing under `src/core` touches a platform API except the injectable clock. Enforced by review until the runtime matrix (M5.1) turns it into an executable check.
- D17: No API key in the local core. There is no server to hold a key, so there is nothing to assert yet. It becomes testable when the protocol runs end to end (M3).
- D24: Licence: MIT. `package.json` plus `LICENSE`, and `npm run pack:check` asserts the tarball carries the licence text. No test names the decision.
- D25: npm: `@fachryxyf/scorpio-guard`. Asserted by `pack:check`, which imports the installed tarball under exactly that name and fails if the subpaths do not resolve.
- D26: Node floor: `>=22.6`. `engines` plus a runner that executes `.ts` directly with no build step. The floor is exercised by CI on 22.x; a floor set too low would fail there rather than in a test.
- D27: CI now: typecheck and test. Superseded in practice by the workflow, which is now eleven steps across two jobs. The workflow file is the claim; nothing else should restate it.
- D28: Site stays where it is. A hosting choice. The generator is covered by `npm run site:check`; which domain serves the output is not something a test can hold.
- D28.1: The site indexes the record; it does not restate it. The generator reads `DECISIONS.md` at build time, so a restated copy cannot exist to drift. Covered by the generator, not by a unit test.
- D29: No empty repositories. A hygiene decision about repositories other than this one. Nothing in this repository can test it.
- D30: PoC must run against a real application flow. Satisfied by `examples/healthme` and `examples/ixfe`, whose replay tests name D34 and D47. The decision itself is a scope choice, and the scope is what those tests carry.
- D31: `Relationship : E x E -> R` is deferred out of the PoC. A deferral: the absence of an API is not something a test can assert. Its consequence (trust is per entity, not per pair) is covered where D2 is.
- D58: The site is generated from the library, not hand-copied from it. Gate: `npm run site:check` renders every page and fails on a broken generator. It runs in CI and is not a `*.test.ts`, so this index does not see it.
- D59: Published, and running in production as an observer. A claim about a deployment rather than about code. Its consequence is the missing durability the measurement exposed, which is D60, and `src/deployment.test.ts` covers that.
- D63: The traffic lab is one browser per persona, labelled in the sink. A harness design, not a behaviour of the library. Its observable consequences are in `examples/lab/lab.test.ts` (unique user agents per persona, the per-persona summary, the two mistakes by name) and its first record is `docs/DATASET.md`; no test names the decision itself.
- D64: Calibration refuses a dataset it cannot learn from. A policy about what may be published, not a behaviour of the library. The refusals, the grid and the per-persona counting are all in `examples/lab/calibration.test.ts`, verified by mutation; what no test can hold is the rule that a refusal must be printed instead of a table.
- D65: The frozen fixture is how a treatment change becomes visible. The freeze itself is a script, and its consequences are in `examples/lab/fixture.test.ts` (a fixture exists, replays to its frozen decisions, and holds no hashed identifier), verified by mutation; what no test can hold is the promise that a fixture is only regenerated on purpose.
- D66: A persona is a population, and a repetition is a different visitor. The identity rule is a function in `examples/lab/personas.ts` and its consequences are in `examples/lab/lab.test.ts` (eight repetitions claim eight stable, distinct identities; one treated repetition is a false positive for the persona), verified by mutation; what no test can hold is the judgement that eight scripted runs of one trace are enough of a population to publish a threshold against.
