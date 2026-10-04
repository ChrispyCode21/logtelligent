// Fails if any worked example in SPEC.md §7 has no unit test named with its ID (CLAUDE.md, "Tests").
// A test counts when its name starts with the ID and a colon, e.g. it('B3: 225x7 @ RPE 7 ...').
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const spec = readFileSync('SPEC.md', 'utf8')
const section = spec.match(/^## 7\..*?(?=^## 8\.)/ms)?.[0]
if (!section) {
  console.error('Could not find SPEC.md §7 (between "## 7." and "## 8.").')
  process.exit(1)
}

// Table rows look like "| B3 | ... |".
const ids = [...section.matchAll(/^\| ([A-Z]\d+[a-z]?) \|/gm)].map((m) => m[1])

function testFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return testFiles(path)
    return /\.test\.tsx?$/.test(e.name) ? [path] : []
  })
}
const tests = testFiles('src')
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

const missing = ids.filter((id) => !new RegExp(`\\bit\\(\\s*['"\`]${id}:`).test(tests))

if (missing.length > 0) {
  console.error(`SPEC §7 examples with no test named after them: ${missing.join(', ')}`)
  process.exit(1)
}
console.log(`All ${ids.length} SPEC §7 examples have tests.`)
