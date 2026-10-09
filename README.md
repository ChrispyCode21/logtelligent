# Logtelligent

A lifting log PWA that suggests next session's weights and reps from your own history.

**Docs:** [SPEC.md](SPEC.md) (what and why) · [ARCHITECTURE.md](ARCHITECTURE.md) (how) · [TESTING.md](TESTING.md) (verifying changes) · [CHANGELOG.md](CHANGELOG.md) (versions) · [CLAUDE.md](CLAUDE.md) (rules for AI sessions)

All data stays on the device (IndexedDB). Use **Program → Backup → Export data** now and then; **Restore from file…** brings a backup back.

## Develop

```bash
npm install
npm run dev           # dev server
npm test              # unit tests (Vitest)
npm run lint          # oxlint, including the engine-purity rule
npm run format        # Prettier (format:check to verify)
npm run check:spec    # every SPEC §7 example has a test named with its ID
npm run check:changelog  # CHANGELOG.md has notes for package.json's version
npm run build         # type-check + production build
```

The progression engine is pure TypeScript in `src/engine/`. See [TESTING.md](TESTING.md) for preview-testing caveats and the on-device checklist.

## Quality gates

Every PR (and every push to `main`) runs:

- **CI / Checks** (`.github/workflows/ci.yml`): Prettier, oxlint (including the purity rules: the engine imports nothing outside `src/engine`, and `program/`, `session/` and `history/` import no React, Dexie, storage or UI), UI conventions (`scripts/check-conventions.mjs`), SPEC §7 test coverage, CHANGELOG entry for the current version, unit tests, type-check and production build.
- **Security** (`.github/workflows/security.yml`): CodeQL on the app code and on the workflows, plus dependency review that blocks PRs adding packages with known vulnerabilities.
- **Dependabot** opens weekly update PRs for npm packages and the SHA-pinned GitHub Actions.

The PR template carries the checklist for what can't be automated (building to Decided items, keeping SPEC.md current).

## Releases

Semantic versioning. To release, open a PR that bumps `version` in `package.json` and moves CHANGELOG.md's "Unreleased" notes under that version. When it merges, `.github/workflows/release.yml` creates the `vX.Y.Z` tag and a GitHub Release with those notes.

## Hosting (Cloudflare Pages)

The app gets its own origin on Cloudflare (Workers static assets, configured in `wrangler.jsonc`), so no other site can reach its stored data. Pushes to `main` deploy to production; other branches get preview URLs. `public/_headers` sets the security headers (a strict Content-Security-Policy, no framing, etc.); `vite preview` applies the same headers locally.

## Setting up a new deployment

Commands are PowerShell-safe (single quotes stop PowerShell reading `{owner}` as a script block).

1. Turn on 2FA for the GitHub and Cloudflare accounts.
2. Cloudflare: Workers & Pages → Create → import the GitHub repo. `wrangler.jsonc` holds the build settings; set the environment variable `NODE_VERSION` = `22`. Turn on the production (and, optionally, preview) URL.
3. GitHub security features (Dependabot alerts, secret scanning, push protection):
   ```powershell
   gh api -X PUT 'repos/{owner}/logtelligent/vulnerability-alerts'
   ```
   ```powershell
   gh api -X PATCH 'repos/{owner}/logtelligent' -f 'security_and_analysis[secret_scanning][status]=enabled' -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
   ```
4. Protect `main` once CI and Security have run at least once:
   ```powershell
   gh api -X POST 'repos/{owner}/logtelligent/rulesets' --input .github/rulesets/main.json
   ```
   After changing `.github/rulesets/main.json`, update the live ruleset to match (find its id with `gh api 'repos/{owner}/logtelligent/rulesets'`):
   ```powershell
   gh api -X PUT 'repos/{owner}/logtelligent/rulesets/<id>' --input .github/rulesets/main.json
   ```
5. Labels for the agent pipeline (ARCHITECTURE.md, "Agent pipeline"). `--force` updates a label that already exists, so these are safe to re-run:
   ```powershell
   gh label create agent-ready --color 0E8A16 --description 'Ready for Claude to build' --force
   ```
   ```powershell
   gh label create agent-needs-info --color FBCA04 --description 'Claude asked questions; answer, then re-add agent-ready' --force
   ```
   ```powershell
   gh label create agent-followup --color 5319E7 --description 'Found by Claude; needs a decision before it can be built' --force
   ```
   ```powershell
   gh label create touches-data --color B60205 --description 'Changes what is stored; export a backup on the phone before merging' --force
   ```
6. Claude for the agent pipeline, with no stored key (Workload Identity Federation; ARCHITECTURE.md, "Agent pipeline"):
   1. Install the [Claude GitHub App](https://github.com/apps/claude) on this repository only.
   2. In the [Claude Console](https://platform.claude.com) (the developer API, billed separately from a Claude plan): add credits under **Billing**, and create a workspace `github-actions` with a monthly spend limit.
   3. **Settings → Workload identity → Connect workload → GitHub Actions.** Issuer `https://token.actions.githubusercontent.com`. Match: subject `<prefix>:ref:refs/heads/main`, where `<prefix>` is the repo's GitHub OIDC subject prefix from `gh api 'repos/{owner}/logtelligent/actions/oidc/customization/sub' --jq .sub_claim_prefix` (with GitHub's immutable subjects it includes numeric IDs, e.g. `repo:owner@123/logtelligent@456`, not the `repo:owner/logtelligent` the Console's template suggests), and the claims `repository_owner`, `repository`, `ref` (`refs/heads/main`), `repository_owner_id`, `event_name` (`issues`) and `workflow_ref` (`{owner}/logtelligent/.github/workflows/agent.yml@refs/heads/main`). Enable it in the `github-actions` workspace only; scope `workspace:developer`; token lifetime 600 seconds. Don't create API keys for the service account.
   4. Store the IDs it shows as repo variables (identifiers, not secrets):
      ```powershell
      gh variable set ANTHROPIC_ORGANIZATION_ID --body '<org id>'
      ```
      ```powershell
      gh variable set ANTHROPIC_WORKSPACE_ID --body '<wrkspc_…>'
      ```
      ```powershell
      gh variable set ANTHROPIC_SERVICE_ACCOUNT_ID --body '<svac_…>'
      ```
      ```powershell
      gh variable set ANTHROPIC_FEDERATION_RULE_ID --body '<fdrl_…>'
      ```

## Install on iPhone

Open the site in **Safari → Share → Add to Home Screen**. It then opens full screen and works offline. Updates download in the background and apply the next time the app is opened.

## Icons

Generated from `public/logo.svg` by `npx pwa-assets-generator` (settings in `pwa-assets.config.ts`).
