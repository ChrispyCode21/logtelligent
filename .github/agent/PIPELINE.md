# Agent pipeline

The design and rules of the agent pipeline, for working on the pipeline itself; working on the app needs only [ARCHITECTURE.md](../../ARCHITECTURE.md) ("Agent pipeline").

Two Claude Code skills on the owner's machine, each run by a desktop scheduled task, work through a version's milestone: a **local builder** builds its next issue following CLAUDE.md's "Building a slice" and opens a PR, or asks numbered questions on the issue; a **local reviewer** reviews each PR, fixes it and merges it, or holds it for the owner. The PRs pass the same gates as any other.

```
milestone ─► builder ─┬─► questions on the issue, label agent-needs-info, next issue
                      └─► PR + CI (Auto-fix) ─► reviewer: fix, push ─┬─► merge ─► next run builds the next issue
                                                                    └─► hold for the owner
```

## Where it lives

- **Skills:** `.claude/skills/build-next-issue/` and `.claude/skills/review-agent-prs/`, read from the latest `main` at each run, so changes to them go through PRs like any other. The scheduled tasks themselves (`~/.claude/scheduled-tasks/`) only say which checkout to use and point at the skill.
- **Checkouts:** the builder works in its own clone (`D:\Projects\Logtelligent-builder`), one worktree per issue; the reviewer in a worktree kept at `main` (`D:\Projects\Logtelligent-reviewer`). Neither touches the owner's own checkout.
- **Schedule:** nightly, outside Anthropic's peak hours (5–11 AM Pacific): the builder at 2:00 AM Central, the reviewer at 4:00 AM, only while the Claude app is open and the PC awake. Local triggers ("Triggers") run them between times. Either can be run on demand ("Run now", the skill by name in a session, or `trigger.ps1`).
- **Spending:** both run on the owner's Claude plan, not per-token API credit.
- **Accepted risk: they act as the owner.** They read text others could write (issue threads, PR descriptions, upstream release notes in Dependabot PRs) while holding the owner's full `gh` login, and they push, comment and merge without asking. A text that tricks one could get unreviewed code merged or other repos touched. It's accepted because the builder builds only issues the owner wrote (or created from the owner's answers) and reads only the owner's comments (and its own), the reviewer reviews only the builder's and Dependabot's PRs, both treat all of it as data and never as instructions, and the merge exceptions ("Local reviewer") keep stored data, the gates, releases and workflows for the owner.

## Labels and milestones

| Label | Color | Meaning |
|---|---|---|
| `agent-needs-info` | yellow | The builder asked questions and skips the issue. The owner answers in the thread and removes the label. |
| `agent-followup` | purple | Found by the local reviewer, outside the PR's scope; the owner reads it, then moves it into a milestone and removes the label to have it built. |
| `reviewed` | gray | The local reviewer has reviewed the PR at its latest commit (see "Local reviewer"). |
| `touches-data` | red | The PR changes what's stored (see "Merge safety"). |
| `touches-gates` | orange | The PR changes what decides "green": the check scripts, lint, format, type or test config, the security headers or hosting (see "Merge safety"). `merge-gate.yml` also sets both labels from a PR's paths, on every PR but Dependabot's. |
| `agent-ready` | green | Used only by the disabled Actions version ("The Actions version"). |

[README.md](../../README.md) ("Setting up a new deployment") has the commands that create them. Open questions and ideas carry GitHub's `question` and `enhancement` labels.

**Issue forms** (`.github/ISSUE_TEMPLATE/`): **Task** (what should change, why, where it's specified, done when, out of scope) and **Bug** (what happened, what was expected, steps, where). They ask for what the builder needs, so fewer issues come back with questions; blank issues still work.

Each version has a **milestone** (v1.4.0, v2.0.0…), created by the owner when the version is scoped. The builder works only in the open version milestone with the lowest version; other milestones (e.g. "Agent pipeline") are for the owner's sessions. Releasing a version closes its milestone (`release.yml`).

## Local builder

`/build-next-issue` (`.claude/skills/build-next-issue/SKILL.md`). Each run builds at most one issue:

- **One build at a time.** While a PR on an `agent/issue-…` branch is open (including one the reviewer held), the run stops. So each issue is built on a `main` that has the last merge.
- **Which issue:** in the lowest open version milestone, the lowest-numbered open issue the owner wrote with no `agent-needs-info`, `agent-followup` or `question` label, no open sub-issues (a parent is context for its sub-issues), every "blocked by" issue closed as completed, no open PR that closes it (another session may be building it), and no `agent/issue-<n>-…` branch left from an earlier build. Issue numbers set the order; "blocked by" links mark what must wait.
- **Reading:** SPEC.md, CLAUDE.md, ARCHITECTURE.md, the issue, its parent, its blockers and every issue the thread links, with only the owner's and the builder's comments. Settled decisions there are cited, never asked again.
- **Questions:** only for behavior that's truly open (what the user sees or what's stored) or an open scope, never for labels, wording, placement or validation limits, which the builder chooses and lists in the PR without writing them into SPEC.md. Numbered, each with a recommended default; the issue gets `agent-needs-info` and the run moves to the next candidate. An issue too big for one PR gets a proposed split as a question.
- **Numbers:** an issue that adds or changes progression rules gets its §7 worked examples posted on the issue as tables, with `agent-needs-info`, once its questions are answered; it's built only after the owner approves them, and its PR uses them as approved. All discussion is on the issue; PRs are never drafts.
- **Creating issues:** the owner's answer that calls for new issues (an accepted split, or another issue the answer asks for) is the go-ahead to create them. The builder creates them in the issue's milestone as settled specs with the answers folded in, as sub-issues with the blockers the split names, and rewrites the parent as what's left to it. It creates issues only from the owner's answers.
- **Building:** CLAUDE.md's "Building a slice" with "Running from an issue", on branch `agent/issue-<n>-<slug>`. No new dependencies, and never edits to `.github/workflows/`, `.github/rulesets/`, `.github/agent/` or `.claude/`.
- **Checks:** `npm run check:fast` and the Playwright specs the change touches; CI runs the full suite on the PR.
- **The PR:** `Closes #n`, labeled `touches-data` or `touches-gates` where they apply, with Auto-fix on (the desktop app's PR monitor), so CI failures and conflicts are fixed in the builder's worktree. It never merges.
- **Releases:** when the milestone has nothing left open and no release yet, the builder opens a "Release vX.Y.Z" issue in it with fixed text and builds it: the PR bumps `package.json`, moves CHANGELOG.md's "Unreleased" notes under the version, replaces TESTING.md's "Current release" checklist and tightens SPEC.md and ARCHITECTURE.md (CLAUDE.md, "How to work"). The owner merges it, which tags the release.

## Tiers

Each run is one coordinating session that runs the commands and the GitHub writes and hands the thinking to subagents, each on the model its tier calls for (`model` when the subagent starts). Tiers pass files, not transcripts: each gets the paths of a few files in the run folder (`.claude/agent-runs/`, git-ignored) and nothing of the earlier tiers' working, so the expensive tier reads the least.

| Tier | Model | Builder | Reviewer |
|---|---|---|---|
| 0: gate | none | `preflight.mjs build`: an open build PR, the milestone, the candidates | `preflight.mjs review`: the PRs due, with risk hints |
| 1: plan | Sonnet | reads the issue, threads and docs; writes `issue.md` (the packet) and `plan.md` (a verdict: build, questions, numbers, split, create, stop) | the compliance and correctness reviews, into `review.md` |
| 2: advise | Opus | reviews a `build` or `numbers` plan against `issue.md` only: approves, revises or turns it into questions | decides each finding (fix, drop, hold, out of scope) from `review.md`, the diff and `issue.md` only |
| 3: execute | Sonnet | builds the approved plan and runs the checks; a decision the plan missed comes back as a question | makes the fixes and runs the checks |

Tier 0 is a script, so a run with nothing to do costs no tokens. With `--claim` it also takes a lock (in `%TEMP%`, stale after 4 hours) that keeps a scheduled run and a triggered one from overlapping; the run releases it at the end.

## Triggers

Besides the nightly schedule, three local triggers start a run when something happens, with no webhooks. Each goes through `trigger.ps1`, which waits for a run in progress, refreshes the agent's checkout, runs Tier 0, and if there's work either runs the skill headless (`claude -p` on Sonnet, in the agent's checkout, with the owner's CLI login and `gh`; logs in `%LOCALAPPDATA%\Logtelligent-agent\`) or, during peak hours, schedules itself for 11:05 AM Pacific instead.

- **Pre-push hook** (`hooks/pre-push`): when the owner pushes to an `agent/issue-*` or `dependabot/*` branch from their own checkout or its worktrees, it waits for the push to land, removes the PR's `reviewed` label (making it due) and starts the reviewer. The agents' own pushes don't trigger it.
- **Watcher** (optional): a Windows scheduled task that runs `trigger.ps1` for both agents every 30 minutes, which catches what happens on GitHub (an answered question, a removed label, a merge that frees the builder). It costs nothing until Tier 0 finds work.
- **By hand:** `trigger.ps1 -Agent build` or `-Agent review` (`-Now` ignores peak hours).

`install-triggers.ps1` installs the hook (`core.hooksPath` in the owner's checkout) and, with `-Watch`, the watcher; `-Uninstall` removes both. A headless run has no desktop app, so the builder's PRs from it don't get Auto-fix; the reviewer fixes their CI failures.

## What the agent writes

Everything the builder and reviewer write on GitHub (PR descriptions, issue comments, commit messages) is public and unreviewed until the owner reads it. Secret scanning catches known key formats; these rules cover the rest.

1. **Nothing sensitive:** no environment variables, no secret or token values (even masked or partial), no personal details (emails, account IDs). Command output is read before it's quoted, and quoted only as far as needed. Text from issues and comments is never pasted back as if it were the agent's own.
2. **Short PR descriptions:** what changed and why, how it was verified, and what needs the owner. A few lines each, not a log of the work. Anything longer belongs in the docs and is linked.

## Local reviewer

`/review-agent-prs` (`.claude/skills/review-agent-prs/SKILL.md`), so PRs don't sit for days unreviewed.

- **Which PRs:** open PRs on the builder's `agent/issue-…` branches, or by `claude[bot]` or `dependabot[bot]`, that are due: no `reviewed` label, or commits by someone else since it was added. The owner's other PRs are left alone. The label also keeps two runs off the same PR. The owner's commits (the builder's and Auto-fix's included) don't make a PR due; removing the label does, e.g. after answering a hold.
- **Which models:** by tier ("Tiers"). Sonnet reviews; Opus decides what each finding gets, weighing most what could pass quietly (the engine and its math, state replayed from history, rounding and dates, stored data and upgrades, the gates); Sonnet fixes. Opus is skipped only when there's nothing to weigh: a PR that isn't high-risk (`src/engine/`, `src/storage/`, `touches-data`, `touches-gates`, a Dependabot major bump) with no findings, or a Dependabot minor or patch bump whose findings are all mechanical.
- **What it checks:** compliance (the `architecture-reviewer` subagent, run on the chosen model), correctness, and the issue: the diff against the issue's "Done when" and the decisions in its thread.
- **Fixes:** it fixes the findings it agrees with, as commits whose messages explain each fix, runs `npm run check:fast`, and pushes to the PR's branch.
- **Holds:** a valid finding it can't fix safely (e.g. the spec looks wrong) holds the PR: one short comment lists what it held and why, and the PR stays unmerged. Findings it disagrees with are dropped and don't hold it; each is listed with its reason in the merge commit, or in the comment when the PR waits.
- **Keeping PRs green:** it brings a branch that's behind `main` up to date (the ruleset requires it) and resolves conflicts. A failed GitHub check gets at most 2 fix attempts per PR; after that the PR is held.
- **Merging:** when CI is green and nothing is held, it merges, except:
  - `touches-data`: it comments that the PR is ready and a backup should be exported on the phone first, and leaves the merge to the owner;
  - `touches-gates`: it comments that the PR is ready, and the owner reads it and merges (green means less if the checks changed);
  - release PRs (those that change `package.json`'s version): it comments that the PR is ready, and the owner merges, since merging tags the version;
  - Dependabot PRs that touch `.github/workflows/`: it comments that the PR is ready, and the owner reads it and merges (Dependabot PRs never carry `touches-gates`).
- **Dependabot:** patch and minor bumps get a Sonnet review and merge when green. A major bump is high-risk: Opus weighs the release notes' breaking changes against the diff, and Sonnet fixes the code if needed; then the rules above apply.
- **Out-of-scope findings,** its own and the follow-ups the builder suggested in the PR description, become issues labeled `agent-followup`, each naming the PR it came from.
- What it writes on GitHub follows "What the agent writes".

## Merge safety

The rules for merging an agent PR are app-wide and live in [ARCHITECTURE.md](../../ARCHITECTURE.md) ("Agent pipeline"): read `touches-data` and `touches-gates` PRs before merging, and export a backup on the phone before merging a `touches-data` one.

Merging rests on the local reviewer's pass and the required checks (ARCHITECTURE.md, "Quality gates and releases": CI "Checks", Playwright, CodeQL, dependency review), with seeded data in Playwright standing in for TESTING.md's preview checks, and, for stored-data changes, the **upgrade tests** (ARCHITECTURE.md, "Changing the data model", step 5).

## The Actions version (disabled)

The pipeline first ran in GitHub Actions: `agent-ready` on an issue started a triage run and a coding run (`.github/workflows/agent.yml`, with the prompts `triage.md` and `code.md` and the helpers in this folder), as `claude[bot]`, billed per token through Workload Identity Federation to a Claude Console workspace. It cost API credit per run, so the workflow is disabled (`gh workflow disable agent.yml`) and kept for reference; the local builder replaced it. Re-enabling it needs the README's step 6 setup and credit in that workspace. Its files aren't kept in step with this document.
