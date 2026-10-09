#!/usr/bin/env bash
# Writes what Claude sees to .agent-input/ (ARCHITECTURE.md, "Agent pipeline"): the issue as it was
# when it was labeled (from the event, so a later edit doesn't count), and only the owner's and the
# agent's own comments. For a sub-issue, also its parent and the parent's thread, where the decisions
# are. Needs GH_TOKEN, ISSUE, ISSUE_JSON and OWNER.
set -euo pipefail

mkdir -p .agent-input
issue_fields='{number, title, author: .user.login, owner: $owner, labels: [.labels[].name], milestone: .milestone.title, body}'
thread() {
  gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$1/comments" \
    --jq ".[] | select(.user.login == \"$OWNER\" or .user.login == \"github-actions[bot]\") | {author: .user.login, created_at, body}" \
    | jq -s .
}

jq --arg owner "$OWNER" "$issue_fields" <<<"$ISSUE_JSON" > .agent-input/issue.json
thread "$ISSUE" > .agent-input/comments.json

if parent=$(gh api "repos/$GITHUB_REPOSITORY/issues/$ISSUE/parent" 2>/dev/null); then
  jq --arg owner "$OWNER" "$issue_fields" <<<"$parent" > .agent-input/parent.json
  thread "$(jq -r .number <<<"$parent")" > .agent-input/parent-comments.json
elif ! grep -q 'No parent issue found' <<<"$parent"; then
  echo "::error::Couldn't read the issue's parent."
  exit 1
fi
