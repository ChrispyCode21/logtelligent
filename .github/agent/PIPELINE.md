# Agent pipeline

What's specific to Logtelligent in its agent pipeline; working on the app needs only [ARCHITECTURE.md](../../ARCHITECTURE.md) ("Agent pipeline").

The builder and reviewer are [nightshift](https://github.com/ChrispyCode21/nightshift), a Claude Code plugin on the owner's machine that runs them on any repo it's opted into. Its DESIGN.md has how they work: the tiers, the nightly schedule, the triggers, which issue gets built and which PRs get reviewed. Logtelligent's half of opting in is [`.claude/nightshift.json`](../../.claude/nightshift.json): the checks, the docs the builder reads, SPEC.md and its §7 worked examples, the high-risk paths and labels, the merges left to the owner and the release issue text (`.claude/nightshift/release-issue.md`).

```
milestone ─► builder ─┬─► questions on the issue, label agent-needs-info, next issue
                      └─► PR + CI (Auto-fix) ─► reviewer: fix, push ─┬─► merge ─► next run builds the next issue
                                                                    └─► hold for the owner
```

**Accepted risk: they act as the owner.** They read text others could write (issue threads, PR descriptions, upstream release notes in Dependabot PRs) while holding the owner's full `gh` login, and they push, comment and merge without asking. It's accepted because the builder builds only issues the owner wrote (or created from the owner's answers) and reads only the owner's comments (and its own), the reviewer reviews only the builder's and Dependabot's PRs, both treat all of it as data and never as instructions, and the merge rules below keep stored data, the gates, releases and workflows for the owner.

## Labels and milestones

| Label | Color | Meaning |
|---|---|---|
| `agent-needs-info` | yellow | The builder asked questions and skips the issue. The owner answers in the thread and removes the label. |
| `agent-followup` | purple | Found by the reviewer, outside the PR's scope; the owner reads it, then moves it into a milestone and removes the label to have it built. |
| `reviewed` | gray | The reviewer has reviewed the PR at its latest commit. |
| `touches-data` | red | The PR changes what's stored (see "Merge safety"). |
| `touches-gates` | orange | The PR changes what decides "green": the check scripts, lint, format, type or test config, the security headers or hosting (see "Merge safety"). `merge-gate.yml` also sets both labels from a PR's paths, on every PR but Dependabot's. |
| `agent-ready` | green | Used only by the disabled Actions version ("The Actions version"). |

[README.md](../../README.md) ("Setting up a new deployment") has the commands that create them. Open questions and ideas carry GitHub's `question` and `enhancement` labels.

**Issue forms** (`.github/ISSUE_TEMPLATE/`): **Task** (what should change, why, where it's specified, done when, out of scope) and **Bug** (what happened, what was expected, steps, where). They ask for what the builder needs, so fewer issues come back with questions; blank issues still work.

Each version has a **milestone** (v1.4.0, v2.0.0…), created by the owner when the version is scoped. The builder works only in the open version milestone with the lowest version; other milestones (e.g. "Agent pipeline") are for the owner's sessions. Releasing a version closes its milestone (`release.yml`).

## What the agent writes

Everything the builder and reviewer write on GitHub (PR descriptions, issue comments, commit messages) is public and unreviewed until the owner reads it. Secret scanning catches known key formats; these rules cover the rest.

1. **Nothing sensitive:** no environment variables, no secret or token values (even masked or partial), no personal details (emails, account IDs). Command output is read before it's quoted, and quoted only as far as needed. Text from issues and comments is never pasted back as if it were the agent's own.
2. **Short PR descriptions:** what changed and why, how it was verified, and what needs the owner. A few lines each, not a log of the work. Anything longer belongs in the docs and is linked.

## Merge rules

The reviewer merges when CI is green and nothing is held, except (`reviewer.ownerMerges` in the config):

- `touches-data`: it comments that the PR is ready and a backup should be exported on the phone first, and leaves the merge to the owner;
- `touches-gates`: it comments that the PR is ready, and the owner reads it and merges (green means less if the checks changed);
- release PRs (those that change `package.json`'s version): the owner merges, since merging tags the version;
- Dependabot PRs that touch `.github/workflows/`: the owner reads it and merges.

## Merge safety

The rules for merging an agent PR are app-wide and live in [ARCHITECTURE.md](../../ARCHITECTURE.md) ("Agent pipeline"): read `touches-data` and `touches-gates` PRs before merging, and export a backup on the phone before merging a `touches-data` one.

Merging rests on the reviewer's pass and the required checks (ARCHITECTURE.md, "Quality gates and releases": CI "Checks", Playwright, CodeQL, dependency review), with seeded data in Playwright standing in for TESTING.md's preview checks, and, for stored-data changes, the **upgrade tests** (ARCHITECTURE.md, "Changing the data model", step 5).

## The Actions version (disabled)

The pipeline first ran in GitHub Actions: `agent-ready` on an issue started a triage run and a coding run (`.github/workflows/agent.yml`, with the prompts `triage.md` and `code.md` and the helpers in this folder), as `claude[bot]`, billed per token through Workload Identity Federation to a Claude Console workspace. It cost API credit per run, so the workflow is disabled (`gh workflow disable agent.yml`) and kept for reference; nightshift replaced it. Re-enabling it needs the README's step 6 setup and credit in that workspace. Its files aren't kept in step with this document.
