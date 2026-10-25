# Runtime support: what is promised, what is tested, and what is only argued

H14 asks for a runtime matrix with a smoke test per target. This document says which
targets the package supports, how each one is checked, and which boxes are still empty.
The distinction matters because \"works in the browser\" and \"imports nothing from Node\"
are different claims, and only the second one is executable here.

## The matrix

| Target | Status | How it is checked |
|---|---|---|
| Node 22.6.0 (the floor in `engines`) | supported | CI job `Node 22.6.0`: full suite, build, and a smoke import of `dist/` |
| Node 22.x (current LTS line) | supported | CI job `Node 22.x` runs the same three steps |
| Node 24.x | supported | CI job `Node 24.x` runs the same three steps |
| Browser, through a bundler | supported by construction, not executed | `src/core/runtime-surface.test.ts` walks the import graph from `.` and `./collect` and fails on any Node-only global |
| Edge runtime (workerd, Deno-like) | supported by construction, not executed | the same walk, plus the entry point audit below |
| Deno and Bun | untested | no claim |
| React Native, Electron renderer | untested | no claim |

The three Node jobs are a matrix in CI, so the floor cannot drift away from the tests
without a red build. The floor itself is `engines.node` at 22.6 or newer, the version
where native TypeScript stripping arrived; the package does not need a build step to be
tested on that version.

## The boundary, as a test

Three tests in `src/core/runtime-surface.test.ts`:

1. **The root entry point reaches nothing Node-only.** Starting at `src/index.ts`, every
   relative import is followed, and each file is scanned for node: specifiers, `require()`,
   `process.`, `Buffer`, `setImmediate`, and `__dirname`.
2. **The browser collector entry point reaches nothing Node-only.** The same walk from
   `src/collect/index.ts`.
3. **The Node-only entry point is a separate graph.** `src/store/sqlite.ts` is asserted to
   import `node:sqlite`, to be unreachable from `.`, and to be the reason the split exists.

Verified by mutation: adding `import { hostname } from \"node:os\"` to `src/core/clock.ts`
fails test 1 with `core/clock.ts: node: import`, and removing it passes. The third test is
what stops the boundary from being vacuous, since a walk that finds nothing proves nothing.

## What each entry point needs

| Entry | Node globals | Works in a browser or edge runtime |
|---|---|---|
| `.` (core guard, memory store, assessment, protocol codec) | none | yes by the walk |
| `./collect` (browser-side observation) | none | yes by the walk |
| `./kv` (fetch-based key-value adapter) | none | yes, if the runtime has `fetch` |
| `./sqlite` (single-host durable store) | `node:sqlite` | no, Node 22.5 and newer only |

Adapters are separate entry points for the same reason: the guard decides, the host
serves the request, and the package does not pick a framework for it.

## What is still not shown

- **No bundle is built in CI.** The property that a bundler needs holds (standard ECMAScript
  and no Node globals), but no bundler configuration is tested, and there is no claim about
  bundle size or tree shaking.
- **No real browser executes the library.** The collector is exercised in the lab runs
  through a real Chrome, which is a different path: that is the observer, not `./collect`
  inside a page.
- **No edge deployment exists.** No workerd, no Vercel, no Cloudflare run. The argument is
  the import graph, and H14 stays open until a deployment consumes the package.
- **No Deno or Bun run.** Both could probably import `dist/`, and until someone does it, it
  is not a support claim.
- **The Node matrix covers one operating system.** All three jobs are ubuntu-latest; the
  soak numbers in [SOAK.md](SOAK.md) came from macOS.

## Reproducing

```
node --experimental-strip-types --test src/core/runtime-surface.test.ts
npm test
```

The first command is the boundary check alone; the second runs it with everything else,
which is what the three Node jobs do.
