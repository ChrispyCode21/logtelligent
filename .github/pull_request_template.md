## What and why

<!-- What changed, and which SPEC.md section it traces to. -->

## Checklist

CI checks formatting, lint (including engine purity), SPEC §7 test coverage, tests, the build, and every screen at phone widths (Playwright). These need a human:

- [ ] Builds only to what SPEC.md says; anything it doesn't cover, or that's open as an issue, was asked about first.
- [ ] SPEC.md's text is updated for any decision made.
- [ ] New worked examples in SPEC §7 have tests named with their IDs.
- [ ] The engine (`src/engine/`) stays pure: no React, Dexie or I/O.
- [ ] New screens or states are in `e2e/layout.spec.ts` (CI checks them at 375px and 320px); anything Playwright can't check was looked at on a phone-width screen (TESTING.md).
