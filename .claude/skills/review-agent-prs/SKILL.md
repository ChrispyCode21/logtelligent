---
name: review-agent-prs
description: Review, fix and merge the open PRs from claude[bot] and dependabot[bot] (the agent pipeline's local reviewer). Use when asked to review agent or Dependabot PRs, or from the scheduled task.
---

# Review agent PRs

You are the agent pipeline's local reviewer. The rules are in `.github/agent/PIPELINE.md`, "Local reviewer"; read that section first, and if this file and it disagree, it wins. This file is the procedure.

You act with the owner's `gh` login, so everything you push, comment or merge is the owner's. No one is watching a scheduled run: never ask a question mid-run. Anything you can't settle holds the PR (step 6) and the run moves on.

## 1. Find the PRs that are due

From the repo's main checkout (not a worktree), run `git fetch origin --prune` and list open PRs:

```
gh pr list --state open --json number,title,author,headRefName,headRefOid,labels,isDraft
```

Keep non-draft PRs whose author is `app/claude` or `app/dependabot`. Leave everything else alone, including the owner's own PRs.

A PR is **due** when it has no `reviewed` label, or when it has a commit by someone other than the owner (`gh api user --jq .login`) whose `committedDate` (`gh pr view <n> --json commits`) is later than the `created_at` of the last `labeled` event for `reviewed` (`gh api 'repos/{owner}/{repo}/issues/<n>/events'`). A Dependabot rebase gives its commits a new `committedDate`, so it counts.

If none are due, say so in one line and stop. Otherwise take them one at a time, oldest first, through steps 2–8.

## 2. Claim it and check it out

1. Re-check that it's still due (another run may have just claimed it), then add the `reviewed` label (`gh pr edit <n> --add-label reviewed`) before anything else, so a second run skips this PR.
2. `git worktree add -B <headRefName> .claude/worktrees/review-pr-<n> origin/<headRefName>`. Git refuses to read worktrees under `.claude/` on Windows ("dubious ownership"): pass `-c safe.directory=<worktree path>` to each git command there (TESTING.md). Run `npm ci` in the worktree.
3. Bring it up to date: `git fetch origin`, then `git merge origin/main`. Resolve any conflicts in favor of `main`'s intent plus the PR's change, run `npm run check:all`, and commit the merge.
4. Read the context: for an agent PR, the linked issue (`Closes #n` in the PR body) with its comments, and its parent issue if it has one. For Dependabot, the PR body's release notes.

## 3. Pick the review model

- **Opus** if the diff (`git diff origin/main...HEAD --stat`) touches `src/engine/` or `src/storage/`, the PR has `touches-data` or `touches-gates`, or it's a Dependabot **major** bump (the leading version number changes in any "from X to Y" in the title or body).
- **Sonnet** for any other Dependabot bump.
- **Otherwise,** start a `general-purpose` subagent with `model: "sonnet"` to rate the diff by PIPELINE.md's rule (how quietly a mistake could pass, not size). Give it the worktree path, the diff command, and that rule word for word, and have it answer `opus` or `sonnet` with one line of reason. When unsure, Opus.

Every subagent in steps 4–5 runs on the chosen model (pass `model` when you start it; it overrides `model: opus` in `architecture-reviewer`). Give each one the worktree path and say that all its git commands need `-c safe.directory=<worktree path>`.

## 4. Review

Start these two in the foreground, in parallel, and wait for both:

- **Compliance:** the `architecture-reviewer` subagent on `git diff origin/main...HEAD`.
- **Correctness and the issue:** a `general-purpose` subagent that reads the diff and the files it touches and reports bugs, plus every way the diff falls short of the issue's "Done when" and the decisions in its thread (for Dependabot: breaking changes in the release notes that the code doesn't handle). Read-only; findings ranked, each with file, line and why.

## 5. Fix

Start one `general-purpose` subagent with the findings, the issue and its thread. For each finding it decides one of:

- **Fix:** it agrees and can fix it safely. One commit per fix (or per closely related group), message `Review: <what was wrong>` with a body saying what changed and why, ending with a `Local-review: <model>` trailer.
- **Drop:** it disagrees. One line on why.
- **Hold:** it agrees but can't fix it safely: the fix needs a decision the issue, thread and SPEC.md don't make, the spec looks wrong, or the fix is out of proportion to the PR.
- **Out of scope:** a real problem the PR didn't cause and needn't fix.

Then it runs `npm run check:all`, fixes what fails (folding each fix into the commits above), and returns the lists: fixed, dropped (with reasons), held (with reasons) and out of scope (title and a short description each).

It follows CLAUDE.md like any change: the spec wins over a test, no new dependencies unless it's a Dependabot PR, and it never edits `.github/workflows/`, `.github/rulesets/`, `.github/agent/` or `.claude/` on an agent PR.

## 6. Push, then hold or merge

1. If there are new commits, `git push origin HEAD:<headRefName>`.
2. **Out of scope:** each becomes an issue: `gh issue create --label agent-followup`, body starting "Found reviewing #<n>." Never `agent-ready`, no milestone.
3. **Wait for CI:** `gh pr checks <n> --watch --required`. If a check fails, count earlier attempts with `git log origin/main..HEAD --grep='Local-review: ci-fix'`. Under 2: start the step 5 subagent on the failure alone; its commit carries a `Local-review: ci-fix` trailer (even an attempt that ends in no change is committed with `--allow-empty`, so it counts). Push and wait again. At 2: it's a hold ("CI still failing after 2 fix attempts: <check>").
4. **Hold** if anything is held: post one comment listing each held finding and why, then one line listing what was dropped and why. Don't merge.
5. **Owner merges** for `touches-data`, `touches-gates` and release PRs (any PR whose diff changes `"version"` in `package.json`): post one comment that it's reviewed and ready, listing what was dropped, and for `touches-data` add "Export a backup on the phone before merging." Don't merge.
6. **Merge** otherwise: `gh pr merge <n> --merge --body "<body>"`, where the body lists what was dropped and why (one line each), or "Nothing dropped." It must be green and up to date with `main`. If `main` moved while you worked, redo step 2.3 (fetch, merge, `check:all`), push, and return to step 6.3; review again (steps 4–5) only if the merge had conflicts.

Everything written on GitHub follows PIPELINE.md, "What the agent writes": public, nothing sensitive, short.

## 7. Clean up

`git worktree remove --force .claude/worktrees/review-pr-<n>` (everything is pushed by now; `--force` because of `node_modules`), then `git branch -D <headRefName>`. Leave the `reviewed` label on.

## 8. Report

At the end, one line per PR: merged, held (why), or ready for the owner (why), plus any issues created. If a run stops part way through a PR, say which: removing its `reviewed` label makes it due again.
