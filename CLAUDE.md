# CLAUDE.md

Standing instructions for any Claude session working in this repo.

## Source of truth

- **SPEC.md is the source of truth** for what the app does and why. Read it before starting work.
- Items in SPEC.md are tagged **Decided**, **Proposed**, or **Open**. Build to Decided.
- **Ask Chris before** implementing anything marked Proposed or Open, or any behavior the spec doesn't cover. Do not guess and move on. Say what's undecided, offer a recommended default, and wait for an answer.
- When Chris makes a decision, **update SPEC.md** in the same change (status tag, the relevant section, and §10 Open questions), so the spec never drifts from the code.

## Stack

- React + TypeScript, built with Vite.
- Dexie (IndexedDB) for local-only storage. No backend.
- vite-plugin-pwa for install + offline.
- Vitest for tests.
- Static hosting (GitHub Pages or Cloudflare Pages).

## Architecture rules

- The **progression engine is pure TypeScript**: no React, no Dexie, no I/O. Inputs in, outputs out. It lives in its own folder (e.g. `src/engine/`) and must be testable in isolation.
- UI and storage call the engine; the engine never calls them.

## Tests

- Every worked example in SPEC.md §7 becomes a unit test, named with its ID, e.g. `it('B3: 225x7 @ RPE 7 on a 5-7 range suggests 235 x 6', ...)`.
- Numeric e1RM assertions allow ±0.1 lb (SPEC §7).
- If a test and the spec disagree, the spec wins. If the spec looks wrong, stop and ask rather than changing the expected value.

## How to work

- Build in the **vertical-slice order in SPEC.md §9**. Finish and test one slice before starting the next.
- Slice 1 starts with the engine and its tests, before any UI.
- Keep changes small and commit per meaningful step.

## About Chris

- Full-stack developer who works in React + TypeScript day to day.
- Explain tools, libraries, and concepts when they come up rather than assuming familiarity.
