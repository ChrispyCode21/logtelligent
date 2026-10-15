# Agent pipeline

The design and rules of the agent pipeline, for working on the pipeline itself; working on the app needs only [ARCHITECTURE.md](../../ARCHITECTURE.md) ("Agent pipeline").

An issue labeled `agent-ready` triggers Claude in GitHub Actions, which asks questions if the issue is underspecified, or builds it on a branch following CLAUDE.md's "Building a slice" and opens a PR. The PR passes the same gates as any other, then a local reviewer on the owner's machine reviews it, fixes it and merges it, or holds it for the owner. Everything below is built except the local reviewer and the Sonnet-only coding run (#75) and lifting it into a shared repo (#76).

```
issue + agent-ready ─► triage ─┬─► questions on the issue, label agent-needs-info, stop
                               ├─► split proposal, stop (on approval: sub-issues)
                               └─► coding run ─► PR + CI ─► local reviewer: fix, push ─┬─► merge ─► production
                                                                                       └─► hold for the owner
```

## Where it lives

- **In this repo,** for now (#76). Nothing in the workflows or prompts is specific to Logtelligent: the rules come from the repo's own CLAUDE.md, SPEC.md, ARCHITECTURE.md and this document.
- **Actions:** `anthropics/claude-code-action`, pinned to a commit SHA like every other action. It runs Claude Code headless on a fresh runner, which reads CLAUDE.md and `.claude/agents/` as a desktop session does.
- **Identity:** the Claude GitHub App (`claude[bot]`). Its token is needed because pushes and PRs made with the default `GITHUB_TOKEN` don't trigger other workflows, so CI would never run on the agent's PRs.
- **No stored key: Workload Identity Federation.** Each run, GitHub gives the workflow a short-lived signed token saying which repo, branch and workflow it is; Anthropic exchanges it for an API token that expires within minutes (the Action refreshes it during long runs). The Claude Console holds the trust setup: GitHub Actions registered as an issuer, a service account, and a federation rule that accepts only this repo's agent workflow on `main`. The IDs the workflow needs are identifiers, not credentials, and live in repo variables.
- **Accepted risk: federation in the Code job** (rather than a stored API key for that job). Federation needs a job that may request GitHub identity tokens, and with that permission code running in the job could also get a Claude App write token and act outside the Publish checks (push to other branches, open unchecked PRs). The Code job runs Claude with a shell, so this would take an issue that tricks Claude (prompt injection). It's accepted because only the owner labels issues, and only issues the owner wrote or has read get labeled; Claude's shell commands also run sandboxed. The agent labels too, but only issues it created itself, from text the owner approved (sub-issues) or fixed text (release issues). That widens the risk a little: a hijacked run could also create and label an issue, starting more runs, though each still needs its own successful trick. Issues whose text the owner didn't write (the local reviewer's follow-ups) are labeled `agent-followup`, never `agent-ready`, so they wait for the owner's look.
- **Spending:** usage is billed per token to a dedicated Console workspace ("github-actions") with its own monthly limit. When the limit is reached, runs fail until the month resets or the limit is raised; re-adding `agent-ready` retries. Revoking access is deleting the federation rule.
- **Repo stays public:** Actions minutes are free, and only the owner (and the agent, through the workflow) can add labels.

## Triggers and who can start a run

- A run starts when `agent-ready` is added to an issue. The workflow checks who added it: the owner, or `claude[bot]` on an issue `claude[bot]` created (for the follow-ups, unblocked sub-issues and release issues below). Anyone else's label is ignored.
- Comments from anyone other than the owner never reach the agent: the workflow passes it only the issue and the owner's and its own comments. Those are data too; an issue describes what to build but can't change the agent's rules.
- **One triage and one coding run at a time** across the repo, each in its own concurrency group, so a waiting coding run can't be replaced by another issue's triage.
- **Waiting runs queue:** each group holds up to 100 waiting runs and starts them in order (GitHub's `queue: max`), so the sub-issues of one split all get built. Only past 100 is a waiting run dropped; re-adding `agent-ready` retries.

## Labels and milestones

| Label | Color | Meaning |
|---|---|---|
| `agent-ready` | green | Build this. Added by the owner, or by the agent where this document allows it. |
| `agent-needs-info` | yellow | The agent asked questions and stopped. The owner answers in a comment and re-adds `agent-ready`. |
| `agent-followup` | purple | Found by the local reviewer, outside the PR's scope; the owner reads it before it's built. |
| `reviewed` | gray | The local reviewer has reviewed the PR at its latest commit (see "Local reviewer"). |
| `touches-data` | red | The PR changes what's stored (see "Merge safety"). |
| `touches-gates` | orange | The PR changes what decides "green": the check scripts, lint, format, type or test config, the security headers or hosting (see "Merge safety"). |

[README.md](../../README.md) ("Setting up a new deployment") has the commands that create them. Open questions and ideas carry GitHub's `question` and `enhancement` labels.

**Issue forms** (`.github/ISSUE_TEMPLATE/`): **Task** (what should change, why, where it's specified, done when, out of scope) and **Bug** (what happened, what was expected, steps, where). They ask for what triage needs, so fewer issues come back with questions; blank issues still work.

Each version has a **milestone** (v1.4.0, v2.0.0…), created by the owner when the version is scoped. Triage never asks which milestone an issue belongs to; one without a milestone ships in the next release. The agent puts every issue it creates in the right milestone: sub-issues in their parent's, release issues in their version's. Releasing a version closes its milestone (`release.yml`).

## Triage (Claude Sonnet 5.5, 10 minutes)

Triage reads the issue, SPEC.md, ARCHITECTURE.md, this document and CLAUDE.md, then does one of three things:

1. **Questions.** If the issue leaves behavior open, touches behavior SPEC.md doesn't cover or that's open as an issue, or is a new feature whose scope is open, it comments numbered questions, each with a recommended default (CLAUDE.md, "Building a slice" step 1), swaps `agent-ready` for `agent-needs-info`, and stops. The owner answers with numbered replies and re-adds the label; the next run reads the whole thread.
2. **Split.** If the issue has natural seams (e.g. several new components and the work that wires them in), it comments a proposed split and stops. On the owner's approval it creates the sub-issues, linked with GitHub's "blocked by" where one depends on another, in the issue's milestone. Sub-issues with no blockers get `agent-ready` straight away; a blocked one gets it when its last blocker closes. Independent ones can be open as PRs at the same time.
   - **Sub-issues are the text the owner approved.** The proposal lists each sub-issue's title, text and blockers, and the sub-issues are created from that posted proposal word for word, not rewritten on approval. So every `agent-ready` issue is text the owner has read (see the accepted risk above). A reply asking for changes gets a revised proposal, approved the same way.
   - **The parent is context.** Triage and coding runs for a sub-issue also read its parent issue and the parent's thread, where the decisions are. The parent closes itself when its last sub-issue closes.
   - **Unblocking needs completed blockers.** A blocked sub-issue gets `agent-ready` only when every blocker is closed as completed. A blocker closed as not planned leaves it for the owner to decide. Only sub-issues the agent created this way are labeled automatically.
3. **Ready.** Otherwise it comments a short plan and the coding run starts.

**How it runs** (`.github/workflows/agent.yml`): the **Triage** job checks out `main`, writes the issue (as it was when labeled, from the event) and its filtered thread to `.agent-input/` (with `.github/agent/collect.sh`, which for a sub-issue also writes its parent and the parent's thread; a parent someone else wrote and edited after the split is left out), and runs Claude with the prompt in `.github/agent/triage.md`. The job holds only read permissions, and the Action is given that job's token rather than a Claude App token. Claude has read-only tools (Read, Grep, Glob; no shell, no web, no edits) and returns its answer as structured output, `{ decision, comment, subissues }`, checked against a schema (`subissues` only for a split: 2–8, each blocked only by earlier ones). The **Respond** job, which holds triage's only write permission (`issues: write`), posts the comment with a footer (the run and its cost) and sets the labels: `agent-ready` always comes off, so re-adding it starts the next run, and `agent-needs-info` goes on for questions and splits. For a split, Respond shows the sub-issues under Claude's comment and keeps them in it as data (a hidden, compressed block after Claude's text). If triage fails or returns nothing usable, Respond says so on the issue instead. A ready issue goes on to the coding run.

When triage judges that the owner approved the latest proposal (`approved_split`), the **Split** job creates the sub-issues from that posted proposal, never from new output. It checks that an owner comment starting "approved" follows the proposal, that the proposal's data passes the same checks as triage's result (`.github/agent/split-valid.jq`, which also refuses HTML comments, since they wouldn't show), and that the issue has no sub-issues yet, then, with a Claude App token limited to issues and reading contents, which the exchange requires (issues and labels it adds start runs; ones added with the job's own token wouldn't), creates each one in the parent's milestone with "Part of #n", links it as a sub-issue and its blockers as "blocked by", and labels the unblocked ones `agent-ready` last. If it stops part way it says what exists, for the owner to finish by hand.

**After an issue closes** (the **After an issue closes** job, one at a time so two closes can't both open a release issue), with fixed text only:

1. If it closed as completed, each open sub-issue of the agent's that it was blocking gets `agent-ready` once all its blockers are closed as completed (and it has no `agent-` label already).
2. If it was one of the agent's sub-issues and its parent's sub-issues are now all closed, the parent closes.
3. If its milestone is a version (`vX.Y.Z`) with nothing left open, no "Release vX.Y.Z" issue yet and no release, it opens one ("Releases" below).

Any `agent-ready` issue is in scope, new features included. A new feature's behavior is recorded in SPEC.md from the owner's answers, as a desktop session would.

## Coding run (Claude Sonnet 5.5, 45 minutes)

On branch `agent/issue-<n>-<slug>`, the agent follows CLAUDE.md's "Building a slice", with three differences: step 1 happened in triage (the answers are on the issue, and step 2 records them in SPEC.md first), step 5's preview check is replaced by the Playwright check in CI plus a line in the PR saying the preview wasn't used, and step 7's review is left to the local reviewer. It runs every CI check (`npm run check:all`) before opening the PR, which links the issue (`Closes #n`): a failure is cheapest to fix in the run that already has the code and spec loaded. The PR's footer carries the run and its cost; a run that ends without a PR says why on the issue, with the same footer.

- **Sonnet builds every PR, and Opus-level review happens locally.** Cloud runs are billed per token; the local reviewer runs on the owner's Claude plan. So the cloud run uses the cheaper model, and the local reviewer picks Opus where a mistake could pass quietly ("Local reviewer").
- **Claude can't push; a fixed step publishes.** Claude works with the job's read-only token: it edits, commits, and runs the checks and the reviewer, then returns the PR's title and description as structured output. The publish step copies its commits into a fresh clone, refuses if they touch a guardrail path (below) or there are none, then gets a Claude App token limited to contents and pull requests (from the same Anthropic endpoint the Action uses; it's undocumented, so a change there makes publishing fail visibly) and pushes the branch and opens the PR. A PR opened with that token runs CI, which one opened with the default token wouldn't. If Claude finds a question the thread doesn't answer, it returns the questions instead and nothing is published.
- **No new dependencies or scripts.** The coding run can't `npm install`, and Publish refuses any change to `package.json` or `package-lock.json` beyond the version (so releases still work) and any `.npmrc`. An issue that needs a new package comes back with a question.
- **Changes to the gates are labeled, not refused.** A PR that touches `scripts/`, the lint, format, type or Playwright config, `public/_headers` or `wrangler.jsonc` gets `touches-gates`, so the owner looks before merging.
- **One branch per issue.** If `agent/issue-<n>-…` already exists, the run stops and says so; close the PR or delete the branch to build it again. Changes to an open agent PR come from the local reviewer.

**How it runs** (`.github/workflows/agent.yml`): a `ready` triage starts three more jobs.

- **Code** checks out `main` on a new branch, installs dependencies and the Playwright browsers, and runs Claude with the prompt in `.github/agent/code.md`, the issue, the thread (and a sub-issue's parent) and triage's plan. Claude can edit, commit and run the repo's npm scripts, tests and read-only git commands; push, `npm install`, `curl`, `wget` and the web tools are denied. Its shell commands run sandboxed, which reduces the accepted risk above. It returns `{ status, pr_title, pr_body, touches_data, comment }`, and its commits leave the job as a git bundle.
- **Publish**, on a fresh machine, reads the bundle into a clean clone and refuses commits that touch a guardrail path or change `package.json` or `package-lock.json` beyond the version. It then pushes the branch and opens the PR (`Closes #n`, a footer with the run and cost) with the limited Claude App token, and labels it `touches-data` (when `src/storage/` changed or Claude said so) or `touches-gates`.
- **Report** comments on the issue only when there's no PR: Claude's questions (with `agent-needs-info`), an existing branch, a refusal, or a run that didn't finish. When there's a PR, the PR is the report.

The cloud agent never merges, and never edits its own guardrails: `.github/workflows/`, `.github/rulesets/`, `.github/agent/` (its prompts) and `.claude/` (its reviewer subagent and any Claude settings). Everything else, release PRs included, it may do.

## What the agent writes

Everything the agent writes on GitHub (PR descriptions, issue comments, commit messages) is public and unreviewed until the owner reads it. Secret scanning catches known key formats; these rules cover the rest.

1. **Nothing sensitive:** no environment variables, no secret or token values (even masked or partial), no personal details (emails, account IDs). Command output is read before it's quoted, and quoted only as far as needed. Text from issues and comments is never pasted back as if it were the agent's own.
2. **Short PR descriptions:** what changed and why, how it was verified, and what needs the owner. A few lines each, not a log of the work. Anything longer belongs in the docs and is linked.

## Local reviewer

Not built yet (#75); until then, the owner reviews and merges.

A Claude Code skill on the owner's machine (`/review-agent-prs`), billed to the owner's Claude plan rather than the Console workspace and acting with the owner's `gh` login. It runs as a desktop scheduled task every 3 hours (only while the Claude app is open and the PC awake), on demand, or on a loop in a session, so PRs don't sit for days unreviewed.

- **Which PRs:** open PRs by `claude[bot]` or `dependabot[bot]` that are due: no `reviewed` label, or commits by someone else since it was added. The owner's own PRs are left alone. The label also keeps two runs off the same PR.
- **Which model reviews:** Opus 5.5 whenever the PR touches `src/engine/` or `src/storage/`, or has `touches-data` or `touches-gates`. Otherwise a quick Sonnet 5.5 pass rates the diff by how quietly a mistake could pass, not by size: Opus for anything where a plausible-looking change can be quietly wrong (the engine and its math, state replayed from history, rounding and dates, stored data and upgrades, the gates, design choices, an issue open to interpretation, edges no test covers); Sonnet for mechanical work or work that repeats an existing pattern, where a test or check would fail on a slip.
- **What it checks:** compliance (the `architecture-reviewer` subagent, run on the chosen model), correctness, and the issue: the diff against the issue's "Done when" and the decisions in its thread.
- **Fixes:** it fixes the findings it agrees with, as commits whose messages explain each fix, runs `npm run check:all`, and pushes to the PR's branch.
- **Holds:** a valid finding it can't fix safely (e.g. the spec looks wrong) holds the PR: one short comment lists what it held and why, and the PR stays unmerged. That comment is the only thing it writes on the PR. Findings it disagrees with are dropped and don't hold it.
- **Keeping PRs green:** it brings a branch that's behind `main` up to date (the ruleset requires it) and resolves conflicts. A failed check gets at most 2 fix attempts per PR; after that the PR is held.
- **Merging:** when CI is green and nothing is held, it merges, except:
  - `touches-data`: it comments that the PR is ready and a backup should be exported on the phone first, and leaves the merge to the owner;
  - `touches-gates`: it comments that the PR is ready, and the owner reads it and merges (green means less if the checks changed);
  - release PRs: merging tags the version, so the owner merges.
- **Dependabot:** patch and minor bumps get a Sonnet review and merge when green. A major bump gets Opus, which reads the release notes and fixes the code if needed; then the rules above apply.
- **Out-of-scope findings** become issues labeled `agent-followup` (never `agent-ready`, see "Where it lives"), each naming the PR it came from.
- What it writes on GitHub follows "What the agent writes".

## Releases

When the last open issue in a version's milestone closes, the agent creates a "Release vX.Y.Z" issue in it, labeled `agent-ready`. Issues in other milestones don't hold it back. It isn't created twice, or for a version already released, and its text is fixed in the workflow, not written by Claude. Its PR bumps `package.json` and moves CHANGELOG.md's "Unreleased" notes under the version, and tightens SPEC.md and ARCHITECTURE.md (CLAUDE.md, "How to work"); merging it tags the release.

## Merge safety

The rules for merging an agent PR are app-wide and live in [ARCHITECTURE.md](../../ARCHITECTURE.md) ("Agent pipeline"): read `touches-data` and `touches-gates` PRs before merging, and export a backup on the phone before merging a `touches-data` one.

Merging once green rests on the required checks (ARCHITECTURE.md, "Quality gates and releases": CI "Checks", Playwright, CodeQL, dependency review), with seeded data in Playwright standing in for TESTING.md's preview checks, and, for stored-data changes, the **upgrade tests** (ARCHITECTURE.md, "Changing the data model", step 5). Publish sets the labels (see "Coding run"). Code review stays optional.
