# Architecture

How Logtelligent is put together, and the rules for changing it. [SPEC.md](SPEC.md) says *what* the app does; this says *how*.

## Overview

A React + TypeScript single-page app, built with Vite and installed as a PWA. There is no backend: all data lives on the device in IndexedDB (via Dexie), and the app works fully offline. A pure-TypeScript **progression engine** turns an exercise's logged history into next session's suggestion. Hosting is static (Cloudflare Workers static assets).

## Folder map

```
src/
  engine/       Progression engine. Pure TypeScript: no React, no Dexie, no I/O (enforced by lint).
    types.ts        Domain types: ExerciseConfig, LoggedSet, ExerciseSession, Plan, ProgressionState, Suggestion
    e1rm.ts         e1RM formulas, reps-to-failure inversion, running e1RM (SPEC §6.4)
    loads.ts        Available loads per equipment, snap/step helpers (SPEC §6.2)
    accessory.ts    Double progression, rep ceiling, rep extension (SPEC §6.2, §6.5)
    progression.ts  Floor rule, fatigue stacks, deloads; deriveState / evaluateSession (SPEC §6.6–6.8)
    suggest.ts      suggestNext: the entry point the UI calls (SPEC §6.4 weight selection)
    rotation.ts     nextDay (SPEC §5.1)
    sets.ts         countedSets: extra sets are recorded but never judged (SPEC §5.2)
  program/      Program model (days → exercises), pure editing functions (add, move, archive, clear…) effort scales (effort.ts), the built-in exercise bank with search (bank.ts), program templates (templates.ts), entering starting numbers: validation, pre-fill, placeholders and stack presets (seeding.ts), the exercise form's fields and validation (exerciseForm.ts), and lifts: same-named exercises (lifts.ts)
  session/      Session types (types.ts) and pure session rules: set editing (one working weight), each exercise's set target,
                the "Only X of Y" tally, the first-set effort check, canFinish and a substitute's weight step (sets.ts); set pre-fill and the set form's
                validation (setForm.ts); each exercise's history and suggestion for a live or finished session (context.ts); note text and the Finish confirm (notes.ts); saving and applying a finished session's prescription (prescription.ts);
                warm-up ramp (warmup.ts)
  history/      Pure history helpers: stored sessions → engine history, optionally before a given session (sessions.ts);
                a lift's sessions across the program: the other exercises' sessions for the e1RM, the seed gate,
                the latest weight and gym setup a new exercise copies (lifts.ts);
                the History tab's view-model: a lift's timeline on every day with e1RM (timeline.ts) and the picker's lifts (picker.ts)
                program/, session/ and history/ are pure too: no React, Dexie, storage or UI imports (enforced by lint).
  storage/      Everything that touches IndexedDB: Dexie schema, reads, writes, backup/restore
  components/   React UI (see "UI" below)
  ui/           UI primitives (Button, Card, Field, SegmentedControl), and shared formatters and display labels (format.ts)
  styles/       tokens.css: color, spacing, radius, tap-target and type-scale tokens
  App.tsx       Tabs (Today / History / Program) and the single live query
public/
  _headers        HTTP security headers (served by Cloudflare; applied by `vite preview` too)
  logo.svg        Source for all generated icons (pwa-assets.config.ts)
scripts/
  check-spec-coverage.mjs   CI: every SPEC §7 example ID has a test named with it
  check-conventions.mjs     CI: primitives over raw elements, tokens over raw CSS values, shared formatters
  changelog-section.mjs     CI/release: extracts a version's CHANGELOG section
e2e/            Playwright, against the production build (playwright.config.ts: WebKit and Chromium, at 375px and 320px)
  layout.spec.ts    Every screen: no sideways scrolling, no clipped button labels (TESTING.md)
  smoke.spec.ts     The main flows: template → starting numbers → a session → History; backup restore and export
  support.ts        The phone-width check, flow helpers, and a small fixture backup (typed as the app's Backup)
```

Tests sit next to the code (`*.test.ts`). Every SPEC §7 worked example is a test named with its ID (e.g. `it('B3: …')`). Upgrade tests (`storage/db.test.ts`) run against `fake-indexeddb`, an in-memory IndexedDB. Browser tests live in `e2e/` (`npm run test:e2e`).

## Data flow

1. **Read:** `App.tsx` runs one Dexie `useLiveQuery` that loads the program and all sessions. Dexie re-runs it (and React re-renders) whenever those tables change, so there's no client-side cache to keep in sync. The current time (`asOf`) is captured inside the query, which keeps renders pure.
2. **Compute:** views call the engine with plain data: `suggestNext(config, history, asOf, lift)` for suggestions, where `lift` is the other same-named exercises' sessions (`otherLiftSessions`, each marked by its own replay), which share the running e1RM while progression comes from `history` alone (SPEC §6.9); `evaluateSession(config, history, sets)` for the validation message. `history/sessions.ts` maps stored sessions into the engine's `ExerciseSession[]` shape, keeping each one's session id. For a session that's already finished, pass it as `before` so it's judged only against the sessions that came before it.
3. **Write:** components call functions in `storage/` (`saveSets`, `startSession`, `updateProgram`…). The live query picks up the change; nothing is pushed into React state by hand.

### Progression state is derived, never stored

Fatigue stacks, the last successful numbers, deload status and accessory rep extensions are **not stored**. `deriveState` replays an exercise's finished sessions, oldest first, through the same `step` function used to validate a live session. Consequences:

- One source of truth (the logged sets); state can't drift from history.
- Editing or importing history automatically recomputes everything after it. Editing a finished session (SPEC §5.4) relies on this: `session/context.ts` judges it against only the sessions before it, as of when it started.
- Deload and replaced sessions are identified during the replay, which is how they're excluded from e1RM (A5, A6).
- Each session is judged by the rep range it was prescribed (`ExerciseSession.repRange`, from the saved prescription; SPEC §6.8), or the current range for sessions without one. A range change between sessions, or from the last session to today's settings, is a fresh start (`freshStart`): stacks and pending plans are cleared. A finished session's editor uses `prescribedConfig`, so it's judged and counted as it was when finished.
- Cost is negligible at this scale (a few hundred sessions per exercise at most).

## Storage

Dexie wraps IndexedDB. Database `logtelligent`, schema in `storage/db.ts`; the stored types are in `session/types.ts` and `program/types.ts`:

| Version | Tables | Notes |
|---|---|---|
| 1 | `sessions` (`++id, startedAt`) | |
| 2 | + `programs` (`id`) | One row, `id: 'main'`. |
| 3 | (no index change) | Upgrade sets `effortScale: 'rpe'` on an existing program. |
| 4 | (no index change) | Logged sets may carry `extra: true`; no upgrade, since an unmarked set is a counted one. |
| 5 | (no index change) | Sessions may carry a `note` (1–200 characters); no upgrade. |
| 6 | (no index change) | A finished session's exercises may carry a `prescription` (rep range, set count); no upgrade, since one without it is judged by today's settings. |

- **`programs`**: the whole program as one document (`days[] → exercises[]`, each exercise an `ExerciseConfig` plus `archived?`; and `effortScale`, the scale effort is entered and shown in: `rpe`, `repsLeft` or `perceived`). Effort is always stored as RPE, whatever the scale (`program/effort.ts` maps labels ↔ RPE). Edits go through `updateProgram(edit, discardSessions?)`, which reads and writes inside one transaction so quick successive edits can't overwrite each other. Removing a day discards in that same transaction any open session on it with nothing logged, whether the day is deleted or archived (SPEC §6.1; `history/sessions.ts` decides which days and exercises count as having history); changing programs discards every open session (SPEC §5.5).
- **`sessions`**: one row per training session: `dayId`, `startedAt`, `finishedAt?` (unfinished = in progress, editable), `warmupDismissed?`, `note?` (the note for next time), and `exercises[]` of `ExerciseLog` (`exerciseId`, `sets[]`, `substitute? { name, sets }`, `skipped?`, `prescription? { repRange, sets }`, saved on Finish from the stored program in the same transaction). A set is `{ weight, reps, rpe?, extra? }`; extra sets come after the prescribed ones in `sets[]`.
- Archived exercises and days stay in the program so their history still resolves.

### Changing the data model: checklist

Any change to what's stored (a new field, table or shape) needs all of these, in one PR:

1. **Dexie:** add a new `db.version(n)` (never edit an old one); add an `.upgrade()` if existing rows need transforming.
2. **Backup validator:** update `storage/backup.ts`. It copies only known, validated fields, so **a new field that isn't added there is silently dropped on restore**. Each validator passes its type to `compact<T>`, which requires every field of `T`, so a field left out fails to compile. Validate it properly, then add a round-trip test.
3. **Backup format:** if old backups can no longer be read as-is, bump `FORMAT` and teach `parseBackup` to read the older format.
4. **SPEC.md:** describe the new behavior.
5. **Upgrade tests** in `storage/db.test.ts`: a database saved at the previous version opens with its data intact (and transformed, if there's an `.upgrade()`), and a backup from before the change still restores. Its version test fails until the new version is acknowledged there, as a reminder.

## Backup format

`logtelligent-YYYY-MM-DD.json`: `{ app: 'logtelligent', format: 1, exportedAt, program, sessions }`. Restore validates every field (types, ranges, enums), copies into fresh objects, drops unknown fields, and replaces all data in one transaction. Errors name the bad field. A missing optional field means its default (a program without `effortScale` is `rpe`; a session without a prescription is judged by today's settings), so `format` is still 1.

## UI

- **Tabs:** `TodayView` (next day, suggestions, seed gate → `SeedWalkthrough`, active `SessionView`), `HistoryView` (picker of lifts, `E1rmChart` with high-rep points hollow, the lift's timeline on every day tagged by day; a row's Edit opens that session in `SessionView`), `ProgramView` (`EffortScaleCard`, `TemplateCard` while there are no active days, days, `ExercisePicker` → `ExerciseForm`, `ChangeProgramCard` once there are, `BackupCard`).
- **Templates and seeding:** `TemplateCard` applies `program/templates.ts` to a program with no active days and tells `App` to open the walkthrough on Today. Switching from another program is `ChangeProgramCard` first: after a confirm, `clearProgram` archives the days with finished history and deletes the rest, and any open session is discarded in the same transaction (SPEC §5.5); the template card then shows. `SeedWalkthrough` always shows the first exercise still missing starting numbers and saves each one on Next, so leaving and coming back resumes without any stored progress. The bank match for pre-fill is by name, since programs store no link to the bank. Both `SeedWalkthrough` and `ExerciseForm` enter starting numbers through `SeedFields` (stateless; each keeps its own state) and the rules in `program/seeding.ts`.
- **Adding an exercise:** `ExercisePicker` browses `program/bank.ts` by body area or search; picking one opens `ExerciseForm` with `preset` (the bank defaults are copied in, nothing links back), and "Custom exercise…" opens it blank.
- **Session:** `SessionView` (warm-up banner, "Last time" note, `NoteField`, finish/discard) → `ExerciseLogger` per exercise (substitute, validation message; `ExerciseMenu` holds the heading row's ⋯ menu and the replace form) → `SetEditor` (set list + form, shared by originals and substitutes) → `EffortPicker` (the program's effort scale; shown only on a primary's first set, SPEC §6.3). A finished session uses the same components in a finished mode (no warm-up, menu or new-set form; Done and Delete session), opened from History. Edits save through the same `storage/sessions.ts` writes as a live session. Once the prescribed sets are in, a live session offers "+ Add set" for extra sets: own weight, no effort, and left out of validation and e1RM by the engine (`countedSets`), so callers pass all sets.
- **Styling:** design tokens in `src/styles/tokens.css`: colors with light/dark values, `--space-1…6` (4, 6, 8, 12, 16, 24px), `--radius-sm/md/lg/pill`, `--tap-target` / `--tap-target-lg` (44, 52px) and the type scale `--text-xs…display`. Use a token rather than a raw value, except 1px hairlines and one-off optical tweaks. All component styles are in `src/App.css` as shared classes (`.card`, `.field`, `.actions`, `.note`, `.tag`, `.muted`, `.list-button`, `button.primary` / `.danger`), sectioned by feature. Any `aria-pressed` button gets the pressed style from one rule, so a new toggle group needs no CSS of its own.
- **Primitives (`src/ui/`):** `Button` (`variant` primary / secondary / danger, `block`; defaults to `type="button"`), `Card` (`as` section / li / form), `Field` (label or fieldset, optional `hint`) and `SegmentedControl` (a row of `aria-pressed` toggles, one pressed, for toggle groups such as tier, effort scale, stack presets and the effort picker, not the tabs, which are navigation; `className` sets the layout). New UI uses them instead of raw elements with class names. Display formatting goes through `src/ui/format.ts`, including an exercise's summary line (`formatPrescription`) and the equipment and tier labels. Single-column grids use `minmax(0, 1fr)` so content can't widen the page on small phones (see TESTING.md).
- **Dialogs:** native `confirm()` for destructive or unusual actions.

## PWA and offline

`vite-plugin-pwa` generates the web app manifest and a Workbox service worker that precaches the built app (`registerType: 'autoUpdate'`: new versions download in the background and apply on the next open). `sw.js` is served `no-cache` so updates are noticed promptly. On startup the app asks for persistent storage (best effort; JSON export is the real backup).

## Hosting and security

- **Cloudflare Workers static assets**, configured by `wrangler.jsonc`. Workers Builds deploys `main` to production (`npx wrangler deploy`) and other branches to preview URLs (`npx wrangler preview`, which needs the `previews` block). Unknown paths serve `index.html`.
- **Own origin:** the app must not share an origin with other sites (such as `*.github.io`), because IndexedDB is per-origin.
- **Headers (`public/_headers`):** a strict Content-Security-Policy where everything is `'self'`; no framing; `nosniff`; `no-referrer`; a locked-down permissions policy; COOP; HSTS.
- **CSP constraint for future features:** the app may load only its own files and may not call any other host. Exercise images from a CDN, web fonts, analytics or any API (e.g. an LLM) will be **blocked** until the matching directive (`img-src`, `font-src`, `connect-src`…) in `_headers` is widened. Prefer bundling assets into the app over allowing third-party hosts.
- **Data:** never leaves the device except through a user-initiated export.

## Quality gates and releases

- **CI** (`.github/workflows/ci.yml`, check "Checks"): Prettier, oxlint (including the purity rules for the engine and for program/, session/ and history/), UI conventions (`scripts/check-conventions.mjs`: primitives over raw elements, tokens over raw CSS values, shared formatters), SPEC §7 coverage, CHANGELOG has the current version, unit tests, type-check and build.
- **Architecture and quality review:** the read-only `architecture-reviewer` subagent (`.claude/agents/architecture-reviewer.md`) reports ranked findings on a branch or module against this document and CLAUDE.md. Run it before opening a PR (CLAUDE.md, "Building a slice"). Small findings that don't belong in a feature PR go on the cleanup backlog (below).
- **Playwright** (`ci.yml`, check "Playwright"): `e2e/` in WebKit and Chromium at 375px and 320px: every screen for sideways scrolling and clipped button labels, and smoke tests of the main flows. On failure the traces are kept as a run artifact (open with `npx playwright show-trace`).
- **Security** (`security.yml`): CodeQL on the app and the workflows; dependency review on PRs.
  - **"Code scanning results / CodeQL" neutral, "1 configuration not found":** GitHub timed out processing a scan upload, so it can't compare the PR with `main`. Not required and not the code's fault; re-run the Security workflow.
- **Dependabot:** weekly npm and GitHub Actions update PRs. Actions are pinned to commit SHAs.
- **`main` is protected** (`.github/rulesets/main.json`): changes arrive by PR, all checks must pass, and there are no force-pushes or deletions.
- **Releases** (`release.yml`), semantic versioning: a release PR (CLAUDE.md, "How to work") bumps `package.json`; when it merges, the workflow sees a version with no release yet, creates the `vX.Y.Z` tag, publishes a GitHub Release with that CHANGELOG section, and closes the version's milestone.
- **Production is every merge to `main`**, not the release tag (see Hosting). The tag and GitHub Release only record the version.
- **Agent pipeline:** issues labeled `agent-ready` are built by Claude in GitHub Actions and arrive as PRs through the same gates (see "Agent pipeline" below).

## Agent pipeline

Issues labeled `agent-ready` are built by Claude in GitHub Actions and arrive as PRs through the same gates as any other; the owner merges.

- **Labels:** `agent-ready`: build this (the owner adds it). `agent-needs-info`: the agent asked questions and stopped; answer, then re-add `agent-ready`. `agent-followup`: found by the agent, needs the owner's decision first. `touches-data`: the PR changes what's stored. `touches-gates`: the PR changes the checks, lint, config, headers or hosting.
- **Merge safety:** read `touches-data` and `touches-gates` PRs before merging (green means less if the checks changed), and export a backup on the phone before merging a `touches-data` one: reverting can't undo an upgrade already applied to real data.
- The agent never merges, and never edits `.github/workflows/`, `.github/rulesets/`, `.github/agent/` or `.claude/`.

The design and rules: [`.github/agent/PIPELINE.md`](.github/agent/PIPELINE.md).

## Cleanup backlog

Small `architecture-reviewer` findings that didn't belong in a feature PR (none is a bug) are tracked in #74: fold them into whichever change next touches the file, or batch a few into a small no-visual-change PR (verify with a style snapshot, TESTING.md).
