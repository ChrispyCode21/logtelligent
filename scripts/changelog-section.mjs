// Prints the CHANGELOG.md section for a version (release notes), or fails if there isn't one.
//   node scripts/changelog-section.mjs 1.0.0   -> prints the "## [1.0.0]" section's body
//   node scripts/changelog-section.mjs --check -> fails unless package.json's version has a section
import { readFileSync } from 'node:fs'

const arg = process.argv[2]
const check = arg === '--check'
const version = check || !arg ? JSON.parse(readFileSync('package.json', 'utf8')).version : arg

const changelog = readFileSync('CHANGELOG.md', 'utf8')
const escaped = version.replace(/\./g, '\\.')
const section = changelog.match(
  new RegExp(`^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|(?![\\s\\S]))`, 'm'),
)

if (!section || !section[1].trim()) {
  console.error(`CHANGELOG.md has no notes under "## [${version}]". Add them before releasing.`)
  process.exit(1)
}
if (check) console.log(`CHANGELOG.md has notes for ${version}.`)
else process.stdout.write(section[1].trim() + '\n')
