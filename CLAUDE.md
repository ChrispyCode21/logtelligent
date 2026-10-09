# CLAUDE.md

Standing instructions for any Claude session working in this repo.

## Read first

- **SPEC.md**: what the app does and why (the source of truth). §9.1–§9.4 hold v1.1.0, v1.2.0, the v1.2.1 fixes and v1.3.0 (all released); §10 holds open questions; §11 holds ideas for later versions. No version after v1.3.0 is scoped yet.
- **ARCHITECTURE.md**: how it's built: folder map, data flow, storage, hosting, gates, releases, the agent pipeline, and Proposed strategies.
- **TESTING.md**: the Playwright browser tests, the phone checklists (every release, and the current release) and how to verify changes in the preview, with its known quirks.
- **CHANGELOG.md**: what shipped in each version.

## Source of truth

- **SPEC.md is the source of truth** for what the app does and why. Read it before starting work.
- Items in SPEC.md and ARCHITECTURE.md are tagged **Decided**, **Proposed**, or **Open**. Build to Decided.
- **Ask the project owner before** implementing anything marked Proposed or Open, or any behavior the spec doesn't cover. Do not guess and move on. Say what's undecided, offer a recommended default, and wait for an answer.
- When the owner makes a decision, **update SPEC.md** in the same change (status tag, the relevant section, and §10 Open questions), so the spec never drifts from the code.

## Stack

- React + TypeScript, built with Vite.
- Dexie (IndexedDB) for local-only storage. No backend; data never leaves the device except by user export.
- vite-plugin-pwa for install + offline.
- Vitest for tests; oxlint for lint; Prettier for formatting.
- Hosted on Cloudflare (Workers static assets, `wrangler.jsonc`), with security headers in `public/_headers`.

## Architecture rules

- The **progression engine is pure TypeScript**: no React, no Dexie, no I/O. Inputs in, outputs out. It lives in `src/engine/` and must be testable in isolation. A lint rule fails any engine import from outside `src/engine/`.
- UI and storage call the engine; the engine never calls them.
- Progression state (stacks, deloads, rep extensions) is **derived by replaying history**, never stored (ARCHITECTURE.md).
- **Changing what's stored** needs a new Dexie version, an updated backup validator (or new fields are silently dropped on restore), and possibly a backup `FORMAT` bump. Follow the checklist in ARCHITECTURE.md.
- **The Content-Security-Policy allows only the app's own files.** Images or fonts from other hosts, analytics, or any API call need `public/_headers` changed. Prefer bundling assets.

## Tests

- Every worked example in SPEC.md §7 becomes a unit test, named with its ID, e.g. `it('B3: 225x7 @ RPE 7 on a 5-7 range suggests 235 x 6', ...)`. CI fails if an ID has no test.
- Numeric e1RM assertions allow ±0.1 lb (SPEC §7).
- If a test and the spec disagree, the spec wins. If the spec looks wrong, stop and ask rather than changing the expected value.
- Sideways scrolling and clipped labels at 375px and 320px are checked by `npm run test:e2e` (TESTING.md); add new screens to `e2e/layout.spec.ts`. Check anything it can't reach in the preview.

## How to work

- **`main` is protected.** Never push to it. Work on a branch, keep changes small with a commit per meaningful step, push the branch, and open a PR (the template has the checklist). The owner reviews and merges.
- Before pushing, run what CI runs: `npm run format:check`, `npm run lint`, `npm run check:conventions`, `npm run check:spec`, `npm run check:changelog`, `npm test`, `npm run build`, `npm run test:e2e`.
- Add user-facing changes to the "Unreleased" section of CHANGELOG.md. A release is a PR that bumps `package.json`'s version, moves those notes under it, and replaces TESTING.md's "Current release" checklist with checks drawn from them; merging it tags the release automatically (semantic versioning).
- New work is scoped as versions from SPEC §11, recorded the way v1.2.0 is in §9.2 (the next one as §9.5). Settle the scope and any Open/Proposed items (§10) with the owner before building. ARCHITECTURE.md's "Cleanup backlog" holds small refactors to fold into whichever slice next touches those files.

### Building a slice

v1.1.0 was built one slice per PR, in this order (step 7 was added for v1.2.0):

1. **Settle what the spec doesn't cover.** Ask the owner about any behavior the slice's SPEC entry leaves open, with a recommended default for each.
2. **Record the decisions first:** a SPEC.md commit (status tags, the slice's section, §10) before any code.
3. **Pure logic with tests,** outside React and Dexie (`src/program/`, `src/session/`, or `src/engine/` for progression rules), then the UI on top. Data that's still Proposed (e.g. an exercise list) goes in as written and is listed in the PR for review.
4. **Stored-data changes** follow the ARCHITECTURE.md checklist (Dexie version, backup validator, round-trip test).
5. **Verify in the preview** per TESTING.md: the flows by DOM. Sideways scrolling and clipped labels at 375px and 320px are checked by `npm run test:e2e`; add any new screen or state to `e2e/layout.spec.ts`, and a new main flow to `e2e/smoke.spec.ts`. Leave the preview's data as it was.
6. **Update the docs in the same PR:** ARCHITECTURE.md (folder map, UI, storage), CHANGELOG.md "Unreleased" for user-facing changes, SPEC.md (the slice marked built), and, for anything the preview can't check, a note in the PR for the release's phone checklist (TESTING.md).
7. **Review:** run the `architecture-reviewer` subagent (`.claude/agents/`) on the branch's diff. Fix the must-fix findings; fix worth-fixing ones or say in the PR why not; raise its questions with the owner.
8. **Open the PR** with what changed, how it was verified, anything worth the owner's attention, and any Proposed data to review. Run the CI checks first.

### Running from an issue (GitHub Actions)

Issues labeled `agent-ready` are built in GitHub Actions with no one to ask mid-run (ARCHITECTURE.md, "Agent pipeline"; triage is built, the coding run is not yet). The steps above still apply, except:

- **Step 1 becomes a comment.** Post numbered questions on the issue, each with a recommended default, swap `agent-ready` for `agent-needs-info`, and stop. Never guess and carry on. The owner's numbered answers in the thread are the decisions; record them in SPEC.md (step 2) before any code.
- **Step 5 is the Playwright check** (`npm run test:e2e`, also in CI), since there's no preview. Add new screens to `e2e/` as step 5 says, and say in the PR that the preview wasn't used.
- **Never merge, and never edit `.github/workflows/`, `.github/rulesets/` or `.github/agent/`** (the agent's own prompts).
- **Out-of-scope findings become issues**, linked from the PR, with the labels ARCHITECTURE.md sets out.
- **Write as if it's public, because it is:** nothing sensitive and short PR descriptions (ARCHITECTURE.md, "What the agent writes").

Personal working preferences, if any, live in `CLAUDE.local.md` (git-ignored, never committed).
