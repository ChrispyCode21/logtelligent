# Architecture

How Logtelligent is put together, and why. [SPEC.md](SPEC.md) says *what* the app does; this says *how*. The last section holds **Proposed** strategies that need a decision before they're built.

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
    progression.ts  Floor rule, fatigue stacks, deloads; deriveState / evaluateSession (SPEC §6.6–6.7)
    suggest.ts      suggestNext: the entry point the UI calls (SPEC §6.4 weight selection)
    rotation.ts     nextDay (SPEC §5.1)
    sets.ts         countedSets: extra sets are recorded but never judged (SPEC §9.2 slice 2)
  program/      Program model (days → exercises), pure editing functions (add, move, archive…) effort scales (effort.ts), the built-in exercise bank with search (bank.ts), program templates (templates.ts), entering starting numbers: validation, pre-fill, placeholders and stack presets (seeding.ts), and the exercise form's fields and validation (exerciseForm.ts)
  session/      Session types (types.ts) and pure session rules: set editing (one working weight), each exercise's set target,
                the "Only X of Y" tally, the first-set effort check and canFinish (sets.ts); set pre-fill and the set form's
                validation (setForm.ts); each exercise's history and suggestion for a live or finished session (context.ts); note text and the Finish confirm (notes.ts);
                warm-up ramp (warmup.ts)
  history/      Pure history helpers: stored sessions → engine history, optionally before a given session (sessions.ts);
                the History tab's view-model: a timeline of sessions with e1RM (timeline.ts) and the exercise picker's groups (picker.ts)
                program/, session/ and history/ are pure too: no React, Dexie, storage or UI imports (enforced by lint).
  storage/      Everything that touches IndexedDB: Dexie schema, reads, writes, backup/restore
  components/   React UI (see "UI" below)
  ui/           UI primitives (Button, Card, Field), and shared formatters and display labels (format.ts)
  styles/       tokens.css: color, spacing, radius, tap-target and type-scale tokens
  App.tsx       Tabs (Today / History / Program) and the single live query
public/
  _headers        HTTP security headers (served by Cloudflare; applied by `vite preview` too)
  logo.svg        Source for all generated icons (pwa-assets.config.ts)
scripts/
  check-spec-coverage.mjs   CI: every SPEC §7 example ID has a test named with it
  changelog-section.mjs     CI/release: extracts a version's CHANGELOG section
```

Tests sit next to the code (`*.test.ts`). Every SPEC §7 worked example is a test named with its ID (e.g. `it('B3: …')`).

## Data flow

1. **Read:** `App.tsx` runs one Dexie `useLiveQuery` that loads the program and all sessions. Dexie re-runs it (and React re-renders) whenever those tables change, so there's no client-side cache to keep in sync. The current time (`asOf`) is captured inside the query, which keeps renders pure.
2. **Compute:** views call the engine with plain data: `suggestNext(config, history, asOf)` for suggestions, `evaluateSession(config, history, sets)` for the validation message. `history/sessions.ts` maps stored sessions into the engine's `ExerciseSession[]` shape, keeping each one's session id. For a session that's already finished, pass it as `before` so it's judged only against the sessions that came before it.
3. **Write:** components call functions in `storage/` (`saveSets`, `startSession`, `updateProgram`…). The live query picks up the change; nothing is pushed into React state by hand.

### Progression state is derived, never stored

Fatigue stacks, the last successful numbers, deload status and accessory rep extensions are **not stored**. `deriveState` replays an exercise's finished sessions, oldest first, through the same `step` function used to validate a live session. Consequences:

- One source of truth (the logged sets); state can't drift from history.
- Editing or importing history automatically recomputes everything after it. Editing a finished session (SPEC §9.2, slice 1) relies on this: `session/context.ts` judges it against only the sessions before it, as of when it started.
- Deload and replaced sessions are identified during the replay, which is how they're excluded from e1RM (A5, A6).
- Cost is negligible at this scale (a few hundred sessions per exercise at most).

## Storage

Dexie wraps IndexedDB. Database `logtelligent`, schema in `storage/db.ts`; the stored types are in `session/types.ts` and `program/types.ts`:

| Version | Tables | Notes |
|---|---|---|
| 1 | `sessions` (`++id, startedAt`) | Slice 1 |
| 2 | + `programs` (`id`) | Slice 3. One row, `id: 'main'`. |
| 3 | (no index change) | v1.1.0 slice 1. Upgrade sets `effortScale: 'rpe'` on an existing program. |
| 4 | (no index change) | v1.2.0 slice 2. Logged sets may carry `extra: true`; no upgrade, since an unmarked set is a counted one. |
| 5 | (no index change) | v1.2.0 slice 3. Sessions may carry a `note` (1–200 characters); no upgrade. |

- **`programs`**: the whole program as one document (`days[] → exercises[]`, each exercise an `ExerciseConfig` plus `archived?`; and `effortScale`, the scale effort is entered and shown in: `rpe`, `repsLeft` or `perceived`). Effort is always stored as RPE, whatever the scale (`program/effort.ts` maps labels ↔ RPE). Edits go through `updateProgram(edit)`, which reads and writes inside one transaction so quick successive edits can't overwrite each other.
- **`sessions`**: one row per training session: `dayId`, `startedAt`, `finishedAt?` (unfinished = in progress, editable), `warmupDismissed?`, `note?` (the note for next time), and `exercises[]` of `ExerciseLog` (`exerciseId`, `sets[]`, `substitute? { name, sets }`, `skipped?`). A set is `{ weight, reps, rpe?, extra? }`; extra sets come after the prescribed ones in `sets[]`.
- Archived exercises and days stay in the program so their history still resolves.

### Changing the data model: checklist

Any change to what's stored (a new field, table or shape) needs all of these, in one PR:

1. **Dexie:** add a new `db.version(n)` (never edit an old one); add an `.upgrade()` if existing rows need transforming.
2. **Backup validator:** update `storage/backup.ts`. It copies only known, validated fields, so **a new field that isn't added there is silently dropped on restore**. Each validator passes its type to `compact<T>`, which requires every field of `T`, so a field left out fails to compile. Validate it properly, then add a round-trip test.
3. **Backup format:** if old backups can no longer be read as-is, bump `FORMAT` and teach `parseBackup` to read the older format.
4. **SPEC.md:** record the decision.

## Backup format

`logtelligent-YYYY-MM-DD.json`: `{ app: 'logtelligent', format: 1, exportedAt, program, sessions }`. Restore validates every field (types, ranges, enums), copies into fresh objects, drops unknown fields, and replaces all data in one transaction. Errors name the bad field. A program without `effortScale` (backups from before v1.1.0) is read as `rpe`, so `format` is still 1.

## UI

- **Tabs:** `TodayView` (next day, suggestions, seed gate → `SeedWalkthrough`, active `SessionView`), `HistoryView` (picker, `E1rmChart`, timeline; a row's Edit opens that session in `SessionView`), `ProgramView` (`EffortScaleCard`, `TemplateCard`, days, `ExercisePicker` → `ExerciseForm`, `BackupCard`).
- **Templates and seeding:** `TemplateCard` applies `program/templates.ts` (first on an empty program; above Backup, as a replace after a confirm, otherwise) and tells `App` to open the walkthrough on Today. `SeedWalkthrough` always shows the first exercise still missing starting numbers and saves each one on Next, so leaving and coming back resumes without any stored progress. The bank match for pre-fill is by name, since programs store no link to the bank. Both `SeedWalkthrough` and `ExerciseForm` enter starting numbers through `SeedFields` (stateless; each keeps its own state) and the rules in `program/seeding.ts`.
- **Adding an exercise:** `ExercisePicker` browses `program/bank.ts` by body area or search; picking one opens `ExerciseForm` with `preset` (the bank defaults are copied in, nothing links back), and "Custom exercise…" opens it blank.
- **Session:** `SessionView` (warm-up banner, "Last time" note, `NoteField`, finish/discard) → `ExerciseLogger` per exercise (⋯ menu, substitute, validation message) → `SetEditor` (set list + form, shared by originals and substitutes) → `EffortPicker` (the program's effort scale). A finished session uses the same components in a finished mode (no warm-up, menu or new-set form; Done and Delete session), opened from History. Edits save through the same `storage/sessions.ts` writes as a live session. Once the prescribed sets are in, a live session offers "+ Add set" for extra sets: own weight, no effort, and left out of validation and e1RM by the engine (`countedSets`), so callers pass all sets.
- **Styling:** design tokens (colors with light/dark values, spacing, radius, tap target, type scale) in `src/styles/tokens.css`; use a token rather than a raw value, except 1px hairlines and one-off optical tweaks. All component styles are in `src/App.css` as shared classes (`.card`, `.field`, `.actions`, `.note`, `.tag`, `.muted`, `.list-button`, `button.primary` / `.danger`), sectioned by slice. Any `aria-pressed` button gets the pressed style from one rule, so a new toggle group needs no CSS of its own.
- **Primitives (`src/ui/`):** `Button` (`variant` primary / secondary / danger, `block`; defaults to `type="button"`), `Card` (`as` section / li / form) and `Field` (label or fieldset, optional `hint`). New UI uses them instead of raw elements with class names. Display formatting goes through `src/ui/format.ts`, including an exercise's summary line (`formatPrescription`) and the equipment and tier labels. Single-column grids use `minmax(0, 1fr)` so content can't widen the page on small phones (see TESTING.md).
- **Dialogs:** native `confirm()` for destructive or unusual actions.

## PWA and offline

`vite-plugin-pwa` generates the web app manifest and a Workbox service worker that precaches the built app (`registerType: 'autoUpdate'`: new versions download in the background and apply on the next open). `sw.js` is served `no-cache` so updates are noticed promptly. On startup the app asks for persistent storage (best effort; JSON export is the real backup).

## Hosting and security

- **Cloudflare Workers static assets**, configured by `wrangler.jsonc`. Workers Builds deploys `main` to production (`npx wrangler deploy`) and other branches to preview URLs (`npx wrangler preview`, which needs the `previews` block). Unknown paths serve `index.html`.
- **Own origin:** the app must not share an origin with other sites, because IndexedDB is per-origin. (It moved off `*.github.io` for this reason.)
- **Headers (`public/_headers`):** a strict Content-Security-Policy where everything is `'self'`; no framing; `nosniff`; `no-referrer`; a locked-down permissions policy; COOP; HSTS.
- **CSP constraint for future features:** the app may load only its own files and may not call any other host. Exercise images from a CDN, web fonts, analytics or any API (e.g. an LLM) will be **blocked** until the matching directive (`img-src`, `font-src`, `connect-src`…) in `_headers` is widened. Prefer bundling assets into the app over allowing third-party hosts.
- **Data:** never leaves the device except through a user-initiated export.

## Quality gates and releases

- **CI** (`.github/workflows/ci.yml`, check "Checks"): Prettier, oxlint (including the purity rules for the engine and for program/, session/ and history/), UI conventions (`scripts/check-conventions.mjs`: primitives over raw elements, tokens over raw CSS values, shared formatters), SPEC §7 coverage, CHANGELOG has the current version, unit tests, type-check and build.
- **Architecture and quality review:** the `architecture-reviewer` subagent (`.claude/agents/architecture-reviewer.md`) reviews a branch or a module against this document and CLAUDE.md and reports ranked findings; it is read-only. Run it before opening a PR (CLAUDE.md, "Building a slice").
- **Security** (`security.yml`): CodeQL on the app and the workflows; dependency review on PRs.
- **Dependabot:** weekly npm and GitHub Actions update PRs. Actions are pinned to commit SHAs.
- **`main` is protected** (`.github/rulesets/main.json`): changes arrive by PR, all checks must pass, and there are no force-pushes or deletions.
- **Releases** (`release.yml`), semantic versioning:
  1. In a PR, bump `version` in `package.json` and move `CHANGELOG.md`'s "Unreleased" notes under the new version.
  2. When it merges, the workflow sees a version with no release yet, creates the `vX.Y.Z` tag and publishes a GitHub Release with that CHANGELOG section.

## Proposed: UI component layer and design tokens

*Status: **Built (trimmed) in v1.1.0** (SPEC §9.1, slice 0): steps 1, 4, and step 2 limited to `Button`, `Field` and `Card`. The token scale as built is `--space-1…6` (4, 6, 8, 12, 16, 24px), `--radius-sm/md/lg/pill`, `--tap-target` / `--tap-target-lg` (44, 52px) and `--text-xs…display`, matching the existing values one-to-one. The other primitives, and moving every component to CSS Modules (step 3), stay **Proposed** and come as they're needed.*

An audit of v1.0.0 found:

- **Colors are already tokenized** (`--accent`, `--surface`, `--muted`…, light and dark). No hard-coded colors.
- **Spacing, radii and sizes are not.** Raw values repeat: `8px` ×23, `12px` ×14, the 44px minimum tap target ×5, radii of 8/10/12px.
- **There is no component layer.** Buttons, fields, cards, notes and steppers are raw elements plus shared class names, re-assembled in each component (e.g. the weight and reps steppers in `SetEditor` repeat the same markup).
- **Some logic is duplicated:** the set formatter (`225 × 4 @ 8`) exists 3 times (`SetEditor`, `HistoryView`, `ExerciseLogger`), the RPE scale twice (`RpePicker`, `ExerciseForm`), and there are two date formatters.

Proposed strategy:

1. **Design tokens** in `src/styles/tokens.css`: add spacing (`--space-1…5`), radius (`--radius-sm/md/lg`), size (`--tap-target: 44px`) and type-scale tokens alongside the existing colors, and replace the raw values.
2. **A small primitives layer**, `src/ui/`: `Button` (variants: primary, secondary, danger), `Card`, `Field` (label + control + hint/error), `Stepper`, `Note` (info/warning), `Tag`, `SegmentedControl`. Feature components compose these instead of raw elements and class names.
3. **Co-located styles** via CSS Modules (`Button.module.css`; built into Vite, no new dependency), so each primitive owns its CSS. `App.css` shrinks to layout only.
4. **Shared formatters** in `src/ui/format.ts` (`formatSet`, `formatDate`, `formatWeight`) and the RPE scale as one exported constant.
5. **Do it incrementally:** tokens first (mechanical), then one primitive at a time, each a small PR verified at 375px and 320px.
