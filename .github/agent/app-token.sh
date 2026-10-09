# Sourced by agent.yml's jobs that need a Claude App token (ARCHITECTURE.md, "Agent pipeline").
# get_app_token '<permissions JSON>' sets $token to one, got the way claude-code-action gets one and
# retried as the Action does. Call it directly, not inside $( ), so $token is kept for the caller to
# use and revoke. On failure it logs the exchange's status and error message (never a token) and
# returns 1. Needs the job's id-token: write.
get_app_token() {
  local perms=$1 oidc resp code body attempt
  oidc=$(curl -sSf -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
    "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=claude-code-github-action" | jq -r '.value // empty') || true
  [ -n "$oidc" ] || { echo "::warning::Couldn't get a GitHub identity token."; return 1; }
  echo "::add-mask::$oidc"
  for attempt in 1 2 3; do
    resp=$(curl -sS -w '\n%{http_code}' -X POST https://api.anthropic.com/api/github/github-app-token-exchange \
      -H "Authorization: Bearer $oidc" -H 'Content-Type: application/json' \
      -d "{\"permissions\":$perms}") || resp=$'\n000'
    code=${resp##*$'\n'}
    body=${resp%$'\n'*}
    token=$(jq -r '.token // .app_token // empty' <<<"$body" 2>/dev/null || true)
    if [ -n "$token" ]; then
      echo "::add-mask::$token"
      return 0
    fi
    # Only the fields that explain the failure; never the raw body.
    echo "::warning::Claude App token exchange failed (attempt $attempt of 3): HTTP $code, $(jq -r '
      [(.error | objects | .message, .details.error_code), (.error | strings), .message]
      | map(select(. != null)) | join(" / ") | if . == "" then "no message" else . end' <<<"$body" 2>/dev/null \
      | head -c 300 || echo 'the response was not JSON')"
    [ "$attempt" = 3 ] || sleep $((attempt * 5))
  done
  return 1
}
