## What and why

<!-- What changed, and which SPEC.md section it traces to. -->

## Checklist

CI checks formatting, lint (including engine purity), SPEC §7 test coverage, tests and the build. These need a human:

- [ ] Builds only to **Decided** items in SPEC.md; anything Proposed, Open or uncovered was asked about first.
- [ ] SPEC.md is updated for any decision made (status tag, the section, and §10 Open questions).
- [ ] New worked examples in SPEC §7 have tests named with their IDs.
- [ ] The engine (`src/engine/`) stays pure: no React, Dexie or I/O.
- [ ] UI changes were checked on a phone-width screen (see TESTING.md for preview caveats).
