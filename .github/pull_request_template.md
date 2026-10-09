## What and why

<!-- What changed, and which SPEC.md section it traces to. -->

## Checklist

CI checks formatting, lint (including engine purity), SPEC §7 test coverage, tests, the build, and every screen at phone widths (Playwright). These need a human:

- [ ] Builds only to **Decided** items in SPEC.md; anything Proposed, Open or uncovered was asked about first.
- [ ] SPEC.md is updated for any decision made (status tag, the section, and §10 Open questions).
- [ ] New worked examples in SPEC §7 have tests named with their IDs.
- [ ] The engine (`src/engine/`) stays pure: no React, Dexie or I/O.
- [ ] New screens or states are in `e2e/layout.spec.ts` (CI checks them at 375px and 320px); anything Playwright can't check was looked at on a phone-width screen (TESTING.md).
