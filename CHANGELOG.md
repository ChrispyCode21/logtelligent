# Changelog

All notable changes to Logtelligent. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

To release: in a PR, move the "Unreleased" notes under a new version heading and bump `version` in `package.json` to match. Merging tags the release automatically (see ARCHITECTURE.md, "Quality gates and releases").

## [Unreleased]

### Changed

- **Effort is asked only where it's used:** "How hard was it?" (or your scale's question) now appears only on a primary lift's first set, where it sets your estimated 1RM. Later sets, accessories and substitutes no longer ask. Efforts you already logged are kept.

### Fixed

- **Logged sets:** the "Set 1 · 225 × 5" rows have their text centred.
- **Effort scale card:** it keeps the same height when you switch scales, so the Program tab no longer shifts.

## [1.2.0] - 2026-10-06

Logging fidelity: fix past sessions, log extra sets, and leave yourself a note for next time.

### Added

- **Edit finished sessions:** each session in History has an **Edit** button that opens the whole session. Fix a set's weight, reps or effort, delete a set, or delete the session. Suggestions and messages after it update to match.
- **Deleting a first set asks for the next set's effort:** on a primary lift, deleting set 1 when set 2 has no effort asks for one, so the session still counts toward your estimated 1RM. Before, Finish just stayed disabled.
- **Add a set on the fly:** once an exercise's sets are done, **+ Add set** logs an extra one, such as a lighter back-off set at its own weight. Extra sets show in the session and in History ("Extra: 185 × 8"), but never change your suggestions or estimated 1RM.
- **Session notes:** leave a note for next time above Finish (up to 200 characters). It shows as "Last time: …" on Today and at the top of the session the next time that day comes up, and on that session's History rows. Finishing a short session without one reminds you.

### Changed

- **Starting numbers look and read the same everywhere:** the guided walkthrough uses the same prompt and layout as the exercise form ("Enter a weight and reps you're confident you could do…").
- **Suggested starting weight follows your gym's weights:** when adding an exercise from the list, the suggested starting weight now rounds down to one of the weights you've typed for it.
- **One way to describe an exercise:** the Program tab, the exercise list and the starting-numbers walkthrough all show the same line, e.g. "Primary · 3 × 5–7 · Barbell", with "per side" for one-sided exercises. The exercise list now shows sets and reps too.

### Fixed

- **Bigger weight and reps fields while logging:** they were meant to be larger than other fields, but a general input style overrode them before v1.0.0 shipped.
- **Starting numbers with a typed weight stack:** a stack typed out of order (e.g. "40, 10, 20, 30") now suggests the right starting weight, and a stack with a typo in it no longer suggests "NaN".

## [1.1.0] - 2026-10-04

Answers the first round of feedback from friends: effort that doesn't require knowing RPE, an exercise list to pick from, and a ready-made program to start with.

### Added

- **Effort scale, chosen per program:** rate sets in RPE, **reps left** (0 to 4+) or **perceived effort** (Easy to Failed on the last rep). Set it at the top of the Program tab; a new program starts on Reps left, and existing ones stay on RPE. Every scale feeds the same 1-rep-max estimate, and switching never changes logged data.
- **Exercise bank:** "+ Add exercise" now opens a list of about 50 common exercises, grouped by body area and searchable by name or nickname (e.g. "RDL", "OHP"). Picking one fills in sensible defaults, a short description and a suggested starting weight; "Custom exercise…" is still there for anything else.
- **Ready-made program:** a 4-day Upper/Lower to start from, offered on an empty Program tab (or to replace your program, after a confirm; days with history are archived).
- **Guided starting numbers:** enter each exercise's starting numbers one screen at a time, pre-filled with a suggestion, with quick picks for cable and machine weight stacks. You can finish later; the Today tab picks up where you left off.

## [1.0.0] - 2026-10-04

The MVP: an intelligent lifting log that suggests next session's weights and reps from your own history.

### Added

- **Progression engine:** e1RM from the first set (Epley, Brzycki and Lombardi averaged, adjusted for RPE), a running e1RM over up to 3 sessions in 4 weeks, and data-driven weight selection for primary lifts.
- **Accessory double progression** with per-equipment load steps, rep extension when the next load is too big a jump, and a rep ceiling.
- **Floor-rule validation, fatigue stacks, reverts, retries and deloads**, tracked per exercise.
- **Program setup:** training days in rotation, exercises per day, per-exercise settings, starting numbers, reorder and archive.
- **Sessions:** the next day in rotation with suggestions, a warm-up ramp, fast set logging with pre-fill and RPE buttons, a validation message after the last set, and choosing a different day.
- **Exercise menu:** replace with a volume-only substitute, or skip for today, with undo until the session is finished.
- **History** per exercise, with a chart of session e1RM.
- **JSON backup** export and validated restore.
- **Installable, offline-capable PWA** for iPhone, hosted on Cloudflare with strict security headers.
- **Quality gates:** CI (format, lint including engine purity, SPEC test coverage, tests, build), CodeQL, dependency review, Dependabot, and a protected `main`.
