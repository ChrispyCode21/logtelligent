// Prints the CHANGELOG.md section for a version (release notes), or fails if there isn't one.
//   node scripts/changelog-section.mjs 1.0.0   -> prints the "## [1.0.0]" section's body
//   node scripts/changelog-section.mjs --check -> fails unless package.json's version has a section
import { readFileSync } from 'node:fs'

const arg = process.argv[2]
const check = arg === '--check'
const version = check || !arg ? JSON.parse(readFileSync('package.json', 'utf8')).version : arg

// Semantic version only (e.g. 1.2.3 or 1.2.3-beta.1). Input is matched as plain text, never as a regex.
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`"${version}" is not a semantic version like 1.2.3.`)
  process.exit(1)
}

const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n')
const heading = `## [${version}]`
const start = lines.findIndex((line) => line.startsWith(heading))
const end = lines.findIndex((line, i) => i > start && line.startsWith('## ['))
const notes =
  start < 0
    ? ''
    : lines
        .slice(start + 1, end < 0 ? undefined : end)
        .join('\n')
        .trim()

if (!notes) {
  console.error(`CHANGELOG.md has no notes under "${heading}". Add them before releasing.`)
  process.exit(1)
}
if (check) console.log(`CHANGELOG.md has notes for ${version}.`)
else process.stdout.write(notes + '\n')
