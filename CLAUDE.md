# CLAUDE.md

Standing instructions for any Claude session working in this repo.

## Read first

- **SPEC.md**: what the app does and why (the source of truth). §9.1 and §9.2 hold the scope of v1.1.0 (released) and v1.2.0 (being built); §11 holds ideas for later versions.
- **ARCHITECTURE.md**: how it's built: folder map, data flow, storage, hosting, gates, releases, and Proposed strategies.
- **TESTING.md**: how to verify changes in the preview, its known quirks, and the on-device checklist.
- **CHANGELOG.md**: what shipped in each version.

## Source of truth

- **SPEC.md is the source of truth** for what the app does and why. Read it before starting work.
- Items in SPEC.md and ARCHITECTURE.md are tagged **Decided**, **Proposed**, or **Open**. Build to Decided.
- **Ask the project owner before** implementing anything marked Proposed or Open, or any behavior the spec doesn't cover. Do not guess and move on. Say what's undecided, offer a recommended default, and wait for an answer.
- When the owner makes a decision, **update SPEC.md** in the same change (status tag, the relevant section, and §10 Open questions), so the spec never drifts from the code.

## Stack

- React + TypeScript, built with Vite.
- Dexie (IndexedDB) for local-only storage. No backend; data never leaves the device except by user export.
- vite-plugin-pwa for install + offline.
- Vitest for tests; oxlint for lint; Prettier for formatting.
- Hosted on Cloudflare (Workers static assets, `wrangler.jsonc`), with security headers in `public/_headers`.

## Architecture rules

- The **progression engine is pure TypeScript**: no React, no Dexie, no I/O. Inputs in, outputs out. It lives in `src/engine/` and must be testable in isolation. A lint rule fails any engine import from outside `src/engine/`.
- UI and storage call the engine; the engine never calls them.
- Progression state (stacks, deloads, rep extensions) is **derived by replaying history**, never stored (ARCHITECTURE.md).
- **Changing what's stored** needs a new Dexie version, an updated backup validator (or new fields are silently dropped on restore), and possibly a backup `FORMAT` bump. Follow the checklist in ARCHITECTURE.md.
- **The Content-Security-Policy allows only the app's own files.** Images or fonts from other hosts, analytics, or any API call need `public/_headers` changed. Prefer bundling assets.

## Tests

- Every worked example in SPEC.md §7 becomes a unit test, named with its ID, e.g. `it('B3: 225x7 @ RPE 7 on a 5-7 range suggests 235 x 6', ...)`. CI fails if an ID has no test.
- Numeric e1RM assertions allow ±0.1 lb (SPEC §7).
- If a test and the spec disagree, the spec wins. If the spec looks wrong, stop and ask rather than changing the expected value.
- Verify UI changes in the preview per TESTING.md, including sideways-scroll checks at 375px and 320px.

## How to work

- **`main` is protected.** Never push to it. Work on a branch, keep changes small with a commit per meaningful step, push the branch, and open a PR (the template has the checklist). The owner reviews and merges.
- Before pushing, run what CI runs: `npm run format:check`, `npm run lint`, `npm run check:spec`, `npm run check:changelog`, `npm test`, `npm run build`.
- Add user-facing changes to the "Unreleased" section of CHANGELOG.md. A release is a PR that bumps `package.json`'s version and moves those notes under it; merging it tags the release automatically (semantic versioning).
- New work is scoped as versions from SPEC §11 (v1.2.0 is scoped in §9.2), recorded the way v1.1.0 is in §9.1. Settle the scope and any Open/Proposed items with the owner before building.

Personal working preferences, if any, live in `CLAUDE.local.md` (git-ignored, never committed).
