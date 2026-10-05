# Changelog

All notable changes to Logtelligent. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

To release: in a PR, move the "Unreleased" notes under a new version heading and bump `version` in `package.json` to match. Merging tags the release automatically (see ARCHITECTURE.md, "Quality gates and releases").

## [Unreleased]

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
