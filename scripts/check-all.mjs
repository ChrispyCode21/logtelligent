// Runs every check CI runs, in CI's order (.github/workflows/ci.yml; keep the two in step).
// Prints one line per passing check and the full output of each failing one, so reading the
// result costs little when everything passes (CLAUDE.md, "How to work"). Runs them all even after
// a failure, so every failure shows at once. Exits 1 if any failed.
import { spawnSync } from 'node:child_process'

const checks = [
  'format:check',
  'lint',
  'check:conventions',
  'check:spec',
  'check:changelog',
  'test',
  'build',
  'test:e2e',
]

const failed = []
for (const name of checks) {
  // One shell string, so 2>&1 keeps stdout and stderr in order (in sh and cmd alike).
  const run = spawnSync(`npm run --silent ${name} 2>&1`, {
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (run.status === 0) {
    console.log(`ok   ${name}`)
  } else {
    failed.push(name)
    console.log(`FAIL ${name}\n${run.stdout.trimEnd()}\n`)
  }
}

if (failed.length) {
  console.log(`\n${failed.length} failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log('\nAll checks passed.')
