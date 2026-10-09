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
  program/      Program model (days → exercises), pure editing functions (add, move, archive, clear…) effort scales (effort.ts), the built-in exercise bank with search (bank.ts), program templates (templates.ts), entering starting numbers: validation, pre-fill, placeholders and stack presets (seeding.ts), the exercise form's fields and validation (exerciseForm.ts), and lifts: same-named exercises (lifts.ts)
  session/      Session types (types.ts) and pure session rules: set editing (one working weight), each exercise's set target,
                the "Only X of Y" tally, the first-set effort check and canFinish (sets.ts); set pre-fill and the set form's
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
2. **Compute:** views call the engine with plain data: `suggestNext(config, history, asOf, lift)` for suggestions, where `lift` is the other same-named exercises' sessions (`otherLiftSessions`, each marked by its own replay), which share the running e1RM while progression comes from `history` alone (SPEC §9.4 slice 2); `evaluateSession(config, history, sets)` for the validation message. `history/sessions.ts` maps stored sessions into the engine's `ExerciseSession[]` shape, keeping each one's session id. For a session that's already finished, pass it as `before` so it's judged only against the sessions that came before it.
3. **Write:** components call functions in `storage/` (`saveSets`, `startSession`, `updateProgram`…). The live query picks up the change; nothing is pushed into React state by hand.

### Progression state is derived, never stored

Fatigue stacks, the last successful numbers, deload status and accessory rep extensions are **not stored**. `deriveState` replays an exercise's finished sessions, oldest first, through the same `step` function used to validate a live session. Consequences:

- One source of truth (the logged sets); state can't drift from history.
- Editing or importing history automatically recomputes everything after it. Editing a finished session (SPEC §9.2, slice 1) relies on this: `session/context.ts` judges it against only the sessions before it, as of when it started.
- Deload and replaced sessions are identified during the replay, which is how they're excluded from e1RM (A5, A6).
- Each session is judged by the rep range it was prescribed (`ExerciseSession.repRange`, from the saved prescription; SPEC §9.4 slice 1), or the current range for sessions finished before v1.3.0. A range change between sessions, or from the last session to today's settings, is a fresh start (`freshStart`): stacks and pending plans are cleared. A finished session's editor uses `prescribedConfig`, so it's judged and counted as it was when finished.
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
| 6 | (no index change) | v1.3.0 slice 1. A finished session's exercises may carry a `prescription` (rep range, set count); no upgrade, since one without it is judged by today's settings. |

- **`programs`**: the whole program as one document (`days[] → exercises[]`, each exercise an `ExerciseConfig` plus `archived?`; and `effortScale`, the scale effort is entered and shown in: `rpe`, `repsLeft` or `perceived`). Effort is always stored as RPE, whatever the scale (`program/effort.ts` maps labels ↔ RPE). Edits go through `updateProgram(edit, discardSessions?)`, which reads and writes inside one transaction so quick successive edits can't overwrite each other. Removing a day discards in that same transaction any open session on it with nothing logged, whether the day is deleted or archived; changing programs discards every open session (SPEC §9.4 slice 3) (SPEC §9.4 slice 0; `history/sessions.ts` decides which days and exercises count as having history).
- **`sessions`**: one row per training session: `dayId`, `startedAt`, `finishedAt?` (unfinished = in progress, editable), `warmupDismissed?`, `note?` (the note for next time), and `exercises[]` of `ExerciseLog` (`exerciseId`, `sets[]`, `substitute? { name, sets }`, `skipped?`, `prescription? { repRange, sets }`, saved on Finish from the stored program in the same transaction). A set is `{ weight, reps, rpe?, extra? }`; extra sets come after the prescribed ones in `sets[]`.
- Archived exercises and days stay in the program so their history still resolves.

### Changing the data model: checklist

Any change to what's stored (a new field, table or shape) needs all of these, in one PR:

1. **Dexie:** add a new `db.version(n)` (never edit an old one); add an `.upgrade()` if existing rows need transforming.
2. **Backup validator:** update `storage/backup.ts`. It copies only known, validated fields, so **a new field that isn't added there is silently dropped on restore**. Each validator passes its type to `compact<T>`, which requires every field of `T`, so a field left out fails to compile. Validate it properly, then add a round-trip test.
3. **Backup format:** if old backups can no longer be read as-is, bump `FORMAT` and teach `parseBackup` to read the older format.
4. **SPEC.md:** record the decision.
5. **Upgrade tests** in `storage/db.test.ts`: a database saved at the previous version opens with its data intact (and transformed, if there's an `.upgrade()`), and a backup from before the change still restores. Its version test fails until the new version is acknowledged there, as a reminder.

## Backup format

`logtelligent-YYYY-MM-DD.json`: `{ app: 'logtelligent', format: 1, exportedAt, program, sessions }`. Restore validates every field (types, ranges, enums), copies into fresh objects, drops unknown fields, and replaces all data in one transaction. Errors name the bad field. A program without `effortScale` (backups from before v1.1.0) is read as `rpe`, so `format` is still 1.

## UI

- **Tabs:** `TodayView` (next day, suggestions, seed gate → `SeedWalkthrough`, active `SessionView`), `HistoryView` (picker of lifts, `E1rmChart` with high-rep points hollow, the lift's timeline on every day tagged by day; a row's Edit opens that session in `SessionView`), `ProgramView` (`EffortScaleCard`, `TemplateCard` while there are no active days, days, `ExercisePicker` → `ExerciseForm`, `ChangeProgramCard` once there are, `BackupCard`).
- **Templates and seeding:** `TemplateCard` applies `program/templates.ts` to a program with no active days and tells `App` to open the walkthrough on Today. Switching from another program is `ChangeProgramCard` first: after a confirm, `clearProgram` archives the days with finished history and deletes the rest, and any open session is discarded in the same transaction (SPEC §9.4 slice 3); the template card then shows. `SeedWalkthrough` always shows the first exercise still missing starting numbers and saves each one on Next, so leaving and coming back resumes without any stored progress. The bank match for pre-fill is by name, since programs store no link to the bank. Both `SeedWalkthrough` and `ExerciseForm` enter starting numbers through `SeedFields` (stateless; each keeps its own state) and the rules in `program/seeding.ts`.
- **Adding an exercise:** `ExercisePicker` browses `program/bank.ts` by body area or search; picking one opens `ExerciseForm` with `preset` (the bank defaults are copied in, nothing links back), and "Custom exercise…" opens it blank.
- **Session:** `SessionView` (warm-up banner, "Last time" note, `NoteField`, finish/discard) → `ExerciseLogger` per exercise (⋯ menu, substitute, validation message) → `SetEditor` (set list + form, shared by originals and substitutes) → `EffortPicker` (the program's effort scale; shown only on a primary's first set, SPEC §6.3). A finished session uses the same components in a finished mode (no warm-up, menu or new-set form; Done and Delete session), opened from History. Edits save through the same `storage/sessions.ts` writes as a live session. Once the prescribed sets are in, a live session offers "+ Add set" for extra sets: own weight, no effort, and left out of validation and e1RM by the engine (`countedSets`), so callers pass all sets.
- **Styling:** design tokens (colors with light/dark values, spacing, radius, tap target, type scale) in `src/styles/tokens.css`; use a token rather than a raw value, except 1px hairlines and one-off optical tweaks. All component styles are in `src/App.css` as shared classes (`.card`, `.field`, `.actions`, `.note`, `.tag`, `.muted`, `.list-button`, `button.primary` / `.danger`), sectioned by slice. Any `aria-pressed` button gets the pressed style from one rule, so a new toggle group needs no CSS of its own.
- **Primitives (`src/ui/`):** `Button` (`variant` primary / secondary / danger, `block`; defaults to `type="button"`), `Card` (`as` section / li / form), `Field` (label or fieldset, optional `hint`) and `SegmentedControl` (a row of `aria-pressed` toggles, one pressed; `className` sets the layout). New UI uses them instead of raw elements with class names. Display formatting goes through `src/ui/format.ts`, including an exercise's summary line (`formatPrescription`) and the equipment and tier labels. Single-column grids use `minmax(0, 1fr)` so content can't widen the page on small phones (see TESTING.md).
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
- **Playwright** (`ci.yml`, check "Playwright"): `e2e/` in WebKit and Chromium at 375px and 320px: every screen for sideways scrolling and clipped button labels, and smoke tests of the main flows. On failure the traces are kept as a run artifact (open with `npx playwright show-trace`).
- **Security** (`security.yml`): CodeQL on the app and the workflows; dependency review on PRs.
  - **"Code scanning results / CodeQL" neutral, "1 configuration not found":** GitHub didn't finish processing one of the scan uploads (the job logs "Timed out waiting for analysis to finish processing"), so it can't compare the PR with `main`. It isn't a required check and isn't caused by the code; re-run the Security workflow to get it green.
- **Dependabot:** weekly npm and GitHub Actions update PRs. Actions are pinned to commit SHAs.
- **`main` is protected** (`.github/rulesets/main.json`): changes arrive by PR, all checks must pass, and there are no force-pushes or deletions.
- **Releases** (`release.yml`), semantic versioning:
  1. In a PR, bump `version` in `package.json`, move `CHANGELOG.md`'s "Unreleased" notes under the new version, and replace TESTING.md's "Current release" phone checklist with checks drawn from those notes.
  2. When it merges, the workflow sees a version with no release yet, creates the `vX.Y.Z` tag and publishes a GitHub Release with that CHANGELOG section.
- **Production is every merge to `main`**, not the release tag: Workers Builds deploys `main` as it lands (see Hosting). The tag and GitHub Release only record the version.
- **Agent pipeline:** issues labeled `agent-ready` are built by Claude in GitHub Actions and arrive as PRs through the same gates (see "Agent pipeline" below).

## Agent pipeline

*Status: **Decided 2026-10-09.** Built in the PRs listed under "Build order" below; each PR marks its part built there. Built so far: steps 2, 3 and 4.*

Work can start from a GitHub issue instead of a desktop session: an issue labeled `agent-ready` triggers Claude in GitHub Actions, which checks the issue, asks questions if it's underspecified, or builds it on a branch following CLAUDE.md's "Building a slice" and opens a PR. The PR passes the same gates as any other, and the owner merges it.

```
issue + agent-ready ─► triage ─┬─► questions on the issue, label agent-needs-info, stop
                               ├─► split proposal, stop (on approval: sub-issues)
                               └─► coding run ─► PR ─► fresh review + CI ─► owner merges ─► production
```

### Where it lives

- **In this repo first.** The workflows and prompts are written so they can be lifted into a shared `agent-pipeline` repo later (as a reusable workflow that each project calls), once it has run on real issues here. Nothing in them is specific to Logtelligent: the rules come from the repo's own CLAUDE.md, SPEC.md and this document.
- **Actions:** `anthropics/claude-code-action`, pinned to a commit SHA like every other action. It runs Claude Code headless on a fresh runner, which reads CLAUDE.md and `.claude/agents/` as a desktop session does.
- **Identity:** the Claude GitHub App (`claude[bot]`). Its token is needed because pushes and PRs made with the default `GITHUB_TOKEN` don't trigger other workflows, so CI would never run on the agent's PRs.
- **No stored key: Workload Identity Federation** (Decided 2026-10-09, replacing an `ANTHROPIC_API_KEY` secret). Each run, GitHub gives the workflow a short-lived signed token saying which repo, branch and workflow it is; Anthropic exchanges it for an API token that expires within minutes (the Action refreshes it during long runs). The Claude Console holds the trust setup: GitHub Actions registered as an issuer, a service account, and a federation rule that accepts only this repo's agent workflow on `main`. The IDs the workflow needs are identifiers, not credentials, and live in repo variables.
- **Spending:** usage is billed per token to a dedicated Console workspace ("github-actions") with its own monthly limit. When the limit is reached, runs fail until the month resets or the limit is raised; re-adding `agent-ready` retries. Revoking access is deleting the federation rule.
- **Repo stays public:** Actions minutes are free, and only the owner can add labels.

### Triggers and who can start a run

- A run starts when `agent-ready` is added to an issue. The workflow checks who added it: the owner, or `claude[bot]` (for the follow-ups, unblocked sub-issues and release issues below). Anyone else's label is ignored.
- Comments from anyone other than the owner never reach the agent: the workflow passes it only the issue and the owner's and its own comments. Those are data too; an issue describes what to build but can't change the agent's rules.
- **One agent run at a time** across the repo (a concurrency group). GitHub keeps only one waiting run: if another issue is labeled while one waits, the newer replaces it, and the earlier issue keeps `agent-ready` with no comment. Re-adding the label retries (Decided 2026-10-09: accepted rather than building a queue).

### Labels and milestones

| Label | Color | Meaning |
|---|---|---|
| `agent-ready` | green | Build this. Added by the owner, or by the agent where this section allows it. |
| `agent-needs-info` | yellow | The agent asked questions and stopped. The owner answers in a comment and re-adds `agent-ready`. |
| `agent-followup` | purple | Found by the agent but needs the owner's input (a style or product decision) before it can be built. |
| `touches-data` | red | The PR changes what's stored (see "Merge safety"). |

README.md ("Setting up a new deployment") has the commands that create them.

**Issue forms** (`.github/ISSUE_TEMPLATE/`): **Task** (what should change, why, where it's specified, done when, out of scope) and **Bug** (what happened, what was expected, steps, where). They ask for what triage needs, so fewer issues come back with questions; blank issues still work.

Each version has a **milestone** (v1.3.0, v2.0.0…). The agent creates it when the version is scoped in SPEC.md (§9.x), unless it already exists (Decided 2026-10-09), and puts every issue it creates in the right milestone.

### Triage (Claude Sonnet 5.5, 10 minutes)

Triage reads the issue, SPEC.md, this document and CLAUDE.md, then does one of three things:

1. **Questions.** If the issue leaves behavior open, or touches anything Proposed or Open, it comments numbered questions, each with a recommended default (CLAUDE.md, "Building a slice" step 1), swaps `agent-ready` for `agent-needs-info`, and stops. The owner answers with numbered replies and re-adds the label; the next run reads the whole thread.
2. **Split.** If the issue has natural seams (e.g. several new components and the work that wires them in), it comments a proposed split and stops. On the owner's approval it creates the sub-issues, linked with GitHub's "blocked by" where one depends on another, in the issue's milestone. Sub-issues with no blockers get `agent-ready` straight away; a blocked one gets it when its last blocker closes. Independent ones can be open as PRs at the same time.
3. **Ready.** Otherwise it comments a short plan and the coding run starts.

**How it runs** (`.github/workflows/agent.yml`, built): the **Triage** job checks out `main`, writes the issue (as it was when labeled, from the event) and its filtered thread to `.agent-input/`, and runs Claude with the prompt in `.github/agent/triage.md`. The job holds only read permissions, and the Action is given that job's token rather than a Claude App token. Claude has read-only tools (Read, Grep, Glob; no shell, no web, no edits) and returns its answer as structured output, `{ decision, comment }`, checked against a schema. The **Respond** job, which holds the only write permission (`issues: write`), posts the comment with a footer (the run and its cost) and sets the labels: `agent-ready` always comes off, so re-adding it starts the next run, and `agent-needs-info` goes on for questions and splits. If triage fails or returns nothing usable, Respond says so on the issue instead. Until step 5, a ready issue stops at the plan, and nothing acts on an approved split (creating sub-issues comes with step 5), so splits wait until then.

Any `agent-ready` issue is in scope, new features included. New features are scoped in SPEC.md from the owner's answers, as a desktop session would.

### Coding run (Claude Opus 5.5, 45 minutes)

On branch `agent/issue-<n>-<slug>`, the agent follows CLAUDE.md's "Building a slice", with two differences: step 1 happened in triage (the answers are on the issue, and step 2 records them in SPEC.md first), and step 5's preview check is replaced by the Playwright check in CI plus a line in the PR saying the preview wasn't used. It runs every CI command and the `architecture-reviewer` subagent before opening the PR, which links the issue (`Closes #n`). Each run posts its cost on the issue if the Action reports it.

The agent never merges, and never edits its own guardrails: `.github/workflows/`, `.github/rulesets/`, `.github/agent/` (its prompts) and `.claude/` (its reviewer subagent and any Claude settings) (Decided 2026-10-09). Everything else, release PRs included, it may do.

### What the agent writes (Decided 2026-10-09)

Everything the agent writes on GitHub (PR descriptions, issue comments, commit messages) is public and unreviewed until the owner reads it. Secret scanning catches known key formats; these rules cover the rest.

1. **Nothing sensitive:** no environment variables, no secret or token values (even masked or partial), no personal details (emails, account IDs). Command output is read before it's quoted, and quoted only as far as needed. Text from issues and comments is never pasted back as if it were the agent's own.
2. **Short PR descriptions:** what changed and why, how it was verified, and what needs the owner. A few lines each, not a log of the work. Anything longer belongs in the docs and is linked.

### PR follow-through

- **Fresh review:** when the agent opens a PR, a separate run reviews it from scratch (correctness, plus `architecture-reviewer`) and posts its findings. Must-fix findings are fixed on the branch.
- **Out-of-scope findings** become follow-up issues, linked from the PR ("Seen. Out of scope for this task; tracked in #n"):
  - `agent-ready` when the problem and the fix are both clear (a bug with an obvious cause);
  - `agent-followup` when it needs a decision (e.g. how dates should look).
  - **One level deep:** a follow-up found while working on an agent-created follow-up is always `agent-followup`, so the agent can't keep queuing work for itself.
- **CI auto-fix:** if a check fails on an agent PR, the agent tries to fix it, at most 2 times per PR.
- **Keeping PRs current:** the ruleset requires a PR to be up to date with `main`, so after each merge a workflow updates the agent's open PRs, and the agent resolves any conflicts. (GitHub's merge queue does this, but only on organization-owned repos.)

### Releases

When the last open issue in a version's milestone closes, the agent creates a "Release vX.Y.Z" issue in it, labeled `agent-ready`. Issues in other milestones don't hold it back. Its PR bumps `package.json` and moves CHANGELOG.md's "Unreleased" notes under the version; merging it tags the release as before.

### Merge safety

The owner may merge an agent PR once it's green. That rests on the required checks:

- the existing ones (CI "Checks", CodeQL, dependency review);
- a **Playwright check**: every screen at 375px and 320px for sideways scrolling and clipped labels, with seeded data, plus smoke tests of the main flows (TESTING.md's preview checks, automated; `e2e/`);
- for stored-data changes, **upgrade tests** (see "Changing the data model", step 5).

A PR that changes what's stored gets `touches-data`. Code review stays optional; the one thing it asks of the owner is to **export a backup on the phone before merging**, because reverting the PR can't undo an upgrade already applied to real data.

### Build order

1. These decisions (this section, and CLAUDE.md's note on headless runs).
2. Playwright check in CI, and the upgrade-test setup (`fake-indexeddb`). The owner adds the new check to the ruleset. **Built.**
3. Issue template and labels. **Built.**
4. Triage workflow. Before it: the owner installs the Claude GitHub App, sets up federation in the Claude Console, and adds the repo variables (README.md). **Built.**
5. Coding run: branch, slice, PR, sub-issues and release issues.
6. PR follow-through: fresh review, follow-up issues, CI auto-fix, keeping PRs current.
7. Later: lift it into a shared `agent-pipeline` repo.

## Cleanup backlog

Smaller findings from the v1.2.0 `architecture-reviewer` passes, deferred because they didn't belong in a feature PR. None is a bug. Fold them into whichever slice next touches the file, or batch a few into a small no-visual-change PR (verify with a style snapshot, TESTING.md).

- **`ExerciseLogger`:**
  - Extract the ⋯ menu and replace form into an `ExerciseMenu` component (about 90 of its lines).
  - Move the substitute's weight step (5 lb, never below 0) into `session/sets.ts` with a test.
  - Compute `canAdd`/`canAddExtra` once.
- **`HistoryView`:**
  - Move a row into a `HistoryRow` component, and drop the dead `history-row` class.
  - Build the chart series in `history/timeline.ts` (`e1rmSeries`) rather than inline.
- **`E1rmChart`:**
  - The aria-label formats by hand; use `formatE1rm`.
  - The middle gridline can land on x.5.
- **`SuggestionCard`:** the `heading` prop always equals `config.name`.
- **`App.tsx`:** the three tab buttons are written out; map over a list.
- **`program/`:**
  - `EffortOption` and `RPE_SCALE` are exported but used only in `effort.ts`.
  - The new-exercise target RPE (8) is written in both `bank.ts` and `exerciseForm.ts`.
- **`storage/sessions.ts`:** `saveNote` could use `db.sessions.update`.
- **`App.css`:**
  - `minmax(0, 1fr)` columns are set in two ways (in each rule, and in a list at the end).
  - Two raw `10px` values sit between spacing tokens.
  - The textarea's padding is set twice.

## Proposed: UI component layer and design tokens

*Status: **Built (trimmed) in v1.1.0** (SPEC §9.1, slice 0): steps 1, 4, and step 2 limited to `Button`, `Field` and `Card`. The token scale as built is `--space-1…6` (4, 6, 8, 12, 16, 24px), `--radius-sm/md/lg/pill`, `--tap-target` / `--tap-target-lg` (44, 52px) and `--text-xs…display`, matching the existing values one-to-one. The other primitives, and moving every component to CSS Modules (step 3), stay **Proposed** and come as they're needed. **`SegmentedControl` was built in v1.3.0** (SPEC §9.4, slice 0), for the four `aria-pressed` toggle groups, not the tabs.*

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
