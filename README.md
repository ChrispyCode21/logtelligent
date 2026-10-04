# Logtelligent

A lifting log PWA that suggests next session's weights and reps from your own history. See [SPEC.md](SPEC.md).

All data stays on the device (IndexedDB). Use **Program → Backup → Export data** now and then; **Restore from file…** brings a backup back.

## Develop

```bash
npm install
npm run dev           # dev server
npm test              # unit tests (Vitest)
npm run lint          # oxlint, including the engine-purity rule
npm run format        # Prettier (format:check to verify)
npm run check:spec    # every SPEC §7 example has a test named with its ID
npm run build         # type-check + production build
```

The progression engine is pure TypeScript in `src/engine/`. See [TESTING.md](TESTING.md) for preview-testing caveats and the on-device checklist.

## Quality gates

Every PR (and every push to `main`) runs:

- **CI / Checks** (`.github/workflows/ci.yml`): Prettier, oxlint (including "the engine imports nothing outside `src/engine`"), SPEC §7 test coverage, unit tests, type-check and production build.
- **Security** (`.github/workflows/security.yml`): CodeQL on the app code and on the workflows, plus dependency review that blocks PRs adding packages with known vulnerabilities.
- **Dependabot** opens weekly update PRs for npm packages and the SHA-pinned GitHub Actions.

The PR template carries the checklist for what can't be automated (building to Decided items, keeping SPEC.md current).

## Hosting (Cloudflare Pages)

The app gets its own origin on Cloudflare (Workers static assets, configured in `wrangler.jsonc`), so no other site can reach its stored data. Pushes to `main` deploy to production; other branches get preview URLs. `public/_headers` sets the security headers (a strict Content-Security-Policy, no framing, etc.); `vite preview` applies the same headers locally.

## One-time repository setup

Commands are PowerShell-safe (the single quotes stop PowerShell reading `{owner}` as a script block).

1. **Turn on 2FA** for both GitHub and Cloudflare.
2. **Cloudflare Pages:** dashboard → Workers & Pages → Create → Pages → Import an existing Git repository → `logtelligent`.
   - Build command `npm run build`, build output directory `dist`, environment variable `NODE_VERSION` = `22`.
   - Every push to `main` deploys to production; every PR gets its own preview URL.
3. **Move your data:** on the old site, Program → Backup → Export data; on the new `*.pages.dev` site, Restore from file…. Remove the old home-screen icon and add the new one.
4. **Turn off GitHub Pages** (the old copy):
   ```powershell
   gh api -X DELETE 'repos/{owner}/logtelligent/pages'
   ```
5. **Security features:** Dependabot alerts, secret scanning and push protection:
   ```powershell
   gh api -X PUT 'repos/{owner}/logtelligent/vulnerability-alerts'
   ```
   ```powershell
   gh api -X PATCH 'repos/{owner}/logtelligent' -f 'security_and_analysis[secret_scanning][status]=enabled' -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'
   ```
6. **Protect `main`** (after the first CI and Security runs, so the checks exist): changes go through PRs, and all checks must pass.
   ```powershell
   gh api -X POST 'repos/{owner}/logtelligent/rulesets' --input .github/rulesets/main.json
   ```
   Approvals are set to 0 because GitHub won't let you approve your own PR; raise `required_approving_review_count` when collaborators join.

## Install on iPhone

Open the site in **Safari → Share → Add to Home Screen**. It then opens full screen and works offline. Updates download in the background and apply the next time the app is opened.

## Icons

Generated from `public/logo.svg` by `npx pwa-assets-generator` (settings in `pwa-assets.config.ts`).
