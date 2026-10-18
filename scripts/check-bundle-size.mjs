// The bundle size budget (#113): fails when the built app's JavaScript or CSS, gzipped, grows past
// its limit. Runs at the end of `npm run build`, so CI's build step and `check:all` both enforce it.
// The limits are raised deliberately, in a PR, when a feature needs it (ARCHITECTURE.md, "Quality
// gates and releases"). Measures dist/assets, the app itself; the service worker and icons aren't
// counted.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

/** Gzipped KB. */
const BUDGET = { js: 150, css: 10 }

const dir = 'dist/assets'
const totals = { js: 0, css: 0 }
for (const name of readdirSync(dir)) {
  const ext = name.split('.').pop()
  if (ext in totals) totals[ext] += gzipSync(readFileSync(join(dir, name))).length / 1024
}

let failed = false
for (const [ext, limit] of Object.entries(BUDGET)) {
  const line = `${ext.toUpperCase()} ${totals[ext].toFixed(1)} KB gzipped, budget ${limit} KB`
  if (totals[ext] > limit) {
    failed = true
    console.log(`Over budget: ${line}. Shrink it, or raise the budget in scripts/check-bundle-size.mjs.`)
  } else {
    console.log(line)
  }
}
if (failed) process.exit(1)
