# Logtelligent

A lifting log PWA that suggests next session's weights and reps from your own history. See [SPEC.md](SPEC.md).

All data stays on the device (IndexedDB). Use **Program → Backup → Export data** now and then; **Restore from file…** brings a backup back.

## Develop

```bash
npm install
npm run dev     # dev server
npm test        # unit tests (Vitest)
npm run lint    # oxlint
npm run build   # type-check + production build
```

The progression engine is pure TypeScript in `src/engine/`. Every worked example in SPEC §7 is a unit test named by its ID. See [TESTING.md](TESTING.md) for preview-testing caveats.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` tests, builds and publishes on every push to `main`. One-time setup:

1. Create a **public** GitHub repo named `logtelligent` and push `main` to it.
2. In the repo, **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The next push (or **Actions → Deploy to GitHub Pages → Run workflow**) publishes to `https://<your-user>.github.io/logtelligent/`.

If the repo has a different name, nothing changes: the workflow sets the base path from the repo name.

## Install on iPhone

Open the site in **Safari → Share → Add to Home Screen**. It then opens full screen and works offline. Updates download in the background and apply the next time the app is opened.

## Icons

Generated from `public/logo.svg` by `npx pwa-assets-generator` (settings in `pwa-assets.config.ts`).
