// Fails on code that skips the shared UI building blocks (ARCHITECTURE.md, "UI"): raw elements
// where a primitive exists, raw CSS values that equal a design token, and display formatting done
// outside src/ui/format.ts. Mechanical rules only; judgment calls are for the architecture-reviewer
// agent (.claude/agents/architecture-reviewer.md).
//
// A line can opt out with a comment containing `conventions-ignore` and a reason, e.g.
//   <button ...> {/* conventions-ignore: native file picker needs a raw button */}
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

function files(dir, pattern) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return files(path, pattern)
    return pattern.test(e.name) ? [path] : []
  })
}

const problems = []
function check(file, rules) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes('conventions-ignore')) return
    for (const { test, message } of rules) {
      if (test(line))
        problems.push(`${relative('.', file).replaceAll('\\', '/')}:${i + 1}  ${message}\n    ${line.trim()}`)
    }
  })
}

// Components compose the primitives in src/ui/ instead of raw elements with shared class names.
const componentRules = [
  { test: (l) => /<button[\s>]/.test(l), message: 'Use <Button> from src/ui/Button, not a raw <button>.' },
  {
    test: (l) => /<(label|fieldset)[^>]*className=["'{`][^>]*\bfield\b/.test(l),
    message: 'Use <Field> from src/ui/Field, not a raw label/fieldset with the "field" class.',
  },
  {
    test: (l) => /<(section|div|li|form)[^>]*className=["'{`][^>]*\bcard\b/.test(l),
    message: 'Use <Card> from src/ui/Card, not a raw element with the "card" class.',
  },
]

// Display formatting lives in src/ui/format.ts.
const formatRules = [
  {
    test: (l) => /\.toLocaleDateString\(/.test(l),
    message: 'Format dates with formatDate() from src/ui/format.ts.',
  },
  {
    test: (l) => /\b(function|const)\s+format(Set|Sets|Date|Weight|E1rm)\b/.test(l),
    message: 'This formatter already exists in src/ui/format.ts; import it instead of redefining it.',
  },
]

// A raw CSS value that equals a token must use the token (src/styles/tokens.css). Values with no
// token (1px hairlines, 2px offsets, icon sizes) are fine.
const SPACE = new Set(['4px', '6px', '8px', '12px', '16px', '24px'])
const RADIUS = new Set(['8px', '10px', '12px', '999px'])
const TAP = new Set(['44px', '52px'])
const cssRules = [
  {
    test: (l) =>
      /^\s*(gap|margin|margin-\w+|padding|padding-\w+)\s*:/.test(l) &&
      [...l.matchAll(/\b\d+px\b/g)].some(([v]) => SPACE.has(v)),
    message: 'Use a --space-* token for this spacing value.',
  },
  {
    test: (l) =>
      /^\s*border-radius\s*:/.test(l) && [...l.matchAll(/\b\d+px\b/g)].some(([v]) => RADIUS.has(v)),
    message: 'Use a --radius-* token for this radius.',
  },
  {
    test: (l) => /^\s*font-size\s*:[^;]*\d(\.\d+)?rem\b/.test(l),
    message: 'Use a --text-* token for this font size.',
  },
  {
    test: (l) =>
      /^\s*(min-height|min-width|grid-template-columns)\s*:/.test(l) &&
      [...l.matchAll(/\b\d+px\b/g)].some(([v]) => TAP.has(v)),
    message: 'Use --tap-target / --tap-target-lg for this size.',
  },
]

for (const f of files('src/components', /\.tsx$/)) check(f, [...componentRules, ...formatRules])
for (const f of [...files('src', /\.tsx?$/)].filter(
  (f) => !/[\\/]ui[\\/]format\.ts$/.test(f) && !f.startsWith(join('src', 'components')),
)) {
  check(f, formatRules)
}
for (const f of files('src', /\.css$/).filter((f) => !/tokens\.css$/.test(f))) check(f, cssRules)

if (problems.length > 0) {
  console.error(`Convention problems (ARCHITECTURE.md, "UI"):\n\n${problems.join('\n\n')}`)
  process.exit(1)
}
console.log('Components, formatting and CSS follow the conventions.')
