#!/usr/bin/env bash
# Writes what Claude sees to .agent-input/ (ARCHITECTURE.md, "Agent pipeline"): the issue as it was
# when it was labeled (from the event, so a later edit doesn't count), and only the owner's and the
# agent's own comments. For a sub-issue, also its parent and the parent's thread, where the decisions
# are. Needs GH_TOKEN, ISSUE, ISSUE_JSON and OWNER.
set -euo pipefail

mkdir -p .agent-input
issue_fields='{number, title, author: .user.login, owner: $owner, labels: [.labels[].name], milestone: .milestone.title, body}'
# A split proposal's data block is for the workflow, not for reading.
thread() {
  gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$1/comments" \
    --jq ".[] | select(.user.login == \"$OWNER\" or .user.login == \"github-actions[bot]\") | {author: .user.login, created_at, body}" \
    | jq -s 'map(.body |= gsub("<!-- agent-split:[A-Za-z0-9+/=]+ -->"; ""))'
}

jq --arg owner "$OWNER" "$issue_fields" <<<"$ISSUE_JSON" > .agent-input/issue.json
thread "$ISSUE" > .agent-input/comments.json

if parent=$(gh api "repos/$GITHUB_REPOSITORY/issues/$ISSUE/parent" 2>/dev/null); then
  number=$(jq -r .number <<<"$parent")
  # The parent is read as it is now, not as the owner approved its split. If someone else wrote it
  # and edited it after this sub-issue was created, its text is left out (the thread still counts).
  if [ "$(jq -r .user.login <<<"$parent")" != "$OWNER" ]; then
    edited=$(gh api graphql -F number="$number" -f owner="${GITHUB_REPOSITORY%/*}" -f name="${GITHUB_REPOSITORY#*/}" \
      -f query='query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { issue(number: $number) { lastEditedAt } } }' \
      --jq '.data.repository.issue.lastEditedAt // empty')
    if [ -n "$edited" ] && [[ "$edited" > "$(jq -r .created_at <<<"$ISSUE_JSON")" ]]; then
      parent=$(jq '.body = "(Left out: edited by its author after this sub-issue was created.)"' <<<"$parent")
    fi
  fi
  jq --arg owner "$OWNER" "$issue_fields" <<<"$parent" > .agent-input/parent.json
  thread "$number" > .agent-input/parent-comments.json
elif [ "$(jq -r '.status // empty' <<<"$parent" 2>/dev/null)" != 404 ]; then
  echo "::error::Couldn't read the issue's parent."
  exit 1
fi
