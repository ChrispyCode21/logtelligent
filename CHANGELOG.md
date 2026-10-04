# Changelog

All notable changes to Logtelligent. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

To release: in a PR, move the "Unreleased" notes under a new version heading and bump `version` in `package.json` to match. Merging tags the release automatically (see ARCHITECTURE.md, "Quality gates and releases").

## [Unreleased]

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
