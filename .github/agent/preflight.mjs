// Tier 0 of the agent pipeline (PIPELINE.md, "Tiers"): decides with no model whether the local
// builder or reviewer has anything to do, so a run with nothing to do costs no tokens.
//
//   node .github/agent/preflight.mjs build  [--claim | --ignore-lock]    the builder's gate
//   node .github/agent/preflight.mjs review [--claim | --ignore-lock]    the reviewer's gate
//   node .github/agent/preflight.mjs release <build|review>    drop that agent's run lock
//
// Run it from the checkout the agent works in. Prints one JSON object. Exit 0: there's work
// (`status: "work"`); 10: nothing to do (`status: "idle"`, with `reason`); 1: it failed.
// --claim takes a machine-wide lock for that agent when there's work, so a scheduled run and a
// triggered one never overlap; a lock older than LOCK_HOURS was left by a run that crashed.
// --ignore-lock is for the run holding the lock, to check again part way through.
import { execFileSync } from 'node:child_process'
import { closeSync, fstatSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const LOCK_HOURS = 4
// Git reports "dubious ownership" for these checkouts on Windows (TESTING.md).
const env = {
  ...process.env,
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'safe.directory',
  GIT_CONFIG_VALUE_0: '*',
}

const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const ghJson = (args) => JSON.parse(run('gh', args) || 'null')
const api = (path) => ghJson(['api', path])
// The owner's own folder, not the shared temp dir; trigger.ps1 checks the same path. Not AppData:
// the Claude desktop app's processes see a private copy of it, so its scheduled runs and the
// triggers' runs wouldn't see each other's lock.
const LOCK_DIR = join(homedir(), '.logtelligent-agent')
const lockPath = (agent) => join(LOCK_DIR, `${agent}.lock`)
const idle = (reason, extra = {}) => ({ status: 'idle', reason, ...extra })

// Who holds the lock, or null. One file handle for the age and the text, so they agree.
function lockHolder(agent) {
  let fd
  try {
    fd = openSync(lockPath(agent), 'r')
  } catch {
    return null
  }
  try {
    const ageHours = (Date.now() - fstatSync(fd).mtimeMs) / 3_600_000
    return ageHours < LOCK_HOURS ? readFileSync(fd, 'utf8').trim() : null
  } finally {
    closeSync(fd)
  }
}

function claim(agent) {
  mkdirSync(LOCK_DIR, { recursive: true })
  rmSync(lockPath(agent), { force: true }) // stale, or this run's own (--ignore-lock)
  // 'wx' fails if another run created it in the meantime.
  writeFileSync(lockPath(agent), `pid ${process.pid}, since ${new Date().toISOString()}`, { flag: 'wx' })
}

function semver(title) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(title)
  return m && m.slice(1).map(Number)
}
const bySemver = (a, b) => a.v[0] - b.v[0] || a.v[1] - b.v[1] || a.v[2] - b.v[2]

function succeeds(cmd, args) {
  try {
    run(cmd, args)
    return true
  } catch {
    return false
  }
}

function build() {
  const prs = ghJson([
    'pr',
    'list',
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    'number,headRefName,closingIssuesReferences',
  ])
  const openBuild = prs.find((p) => p.headRefName.startsWith('agent/issue-'))
  if (openBuild) return idle(`Build PR #${openBuild.number} still open.`)

  const milestone = api('repos/{owner}/{repo}/milestones?state=open&per_page=100')
    .map((m) => ({ ...m, v: semver(m.title) }))
    .filter((m) => m.v)
    .sort(bySemver)[0]
  if (!milestone) return idle('No version milestone open.')

  const me = run('gh', ['api', 'user', '--jq', '.login'])
  const issues = api(`repos/{owner}/{repo}/issues?milestone=${milestone.number}&state=open&per_page=100`)
    .filter((i) => !i.pull_request)
    .sort((a, b) => a.number - b.number)

  if (issues.length === 0) {
    const title = `Release ${milestone.title}`
    const releaseIssue = api(
      `repos/{owner}/{repo}/issues?milestone=${milestone.number}&state=all&per_page=100`,
    ).some((i) => i.title === title)
    if (releaseIssue || succeeds('gh', ['release', 'view', milestone.title]))
      return idle(`Milestone ${milestone.title} has nothing open and its release is under way.`)
    return { status: 'work', milestone: milestone.title, release: true, candidates: [], waiting: [] }
  }

  const closing = new Set(prs.flatMap((p) => p.closingIssuesReferences.map((r) => r.number)))
  const branches = run('git', ['ls-remote', '--heads', 'origin', 'agent/issue-*'])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('refs/heads/')[1])
  const skipLabels = new Set(['agent-needs-info', 'agent-followup', 'question'])
  const waiting = []
  const candidates = []

  for (const issue of issues) {
    if (issue.user.login !== me) continue
    const skip = issue.labels.map((l) => l.name).find((l) => skipLabels.has(l))
    const left = branches.find((b) => b.startsWith(`agent/issue-${issue.number}-`))
    if (skip) waiting.push(`#${issue.number} ${skip}`)
    else if (closing.has(issue.number)) waiting.push(`#${issue.number} has an open PR`)
    else if (left) waiting.push(`#${issue.number} left-over branch ${left}`)
    else {
      // A parent is context for its sub-issues, not built itself.
      const subs = api(`repos/{owner}/{repo}/issues/${issue.number}/sub_issues?per_page=100`)
      if (subs.some((s) => s.state === 'open')) continue
      const blockers = api(`repos/{owner}/{repo}/issues/${issue.number}/dependencies/blocked_by?per_page=100`)
      const open = blockers.filter((b) => !(b.state === 'closed' && b.state_reason === 'completed'))
      if (open.length)
        waiting.push(`#${issue.number} blocked by ${open.map((b) => `#${b.number}`).join(', ')}`)
      else candidates.push({ number: issue.number, title: issue.title })
    }
  }

  if (candidates.length === 0) return idle(`Nothing to build in ${milestone.title}.`, { waiting })
  return { status: 'work', milestone: milestone.title, release: false, candidates, waiting }
}

function review() {
  const me = run('gh', ['api', 'user', '--jq', '.login'])
  const prs = ghJson([
    'pr',
    'list',
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    'number,title,body,author,headRefName,isDraft,isCrossRepository,labels',
  ])
    // Only PRs the owner or the agents opened, from this repo: a branch name alone can be copied
    // by anyone's fork.
    .filter((p) => !p.isDraft && !p.isCrossRepository)
    .filter(
      (p) =>
        (p.headRefName.startsWith('agent/issue-') && p.author.login === me) ||
        ['app/claude', 'app/dependabot'].includes(p.author.login),
    )
    .sort((a, b) => a.number - b.number)

  const due = []
  for (const pr of prs) {
    const labels = pr.labels.map((l) => l.name)
    if (labels.includes('reviewed')) {
      // Due again only for commits by someone else since the label went on.
      const events = api(`repos/{owner}/{repo}/issues/${pr.number}/events?per_page=100`)
      const labeledAt = events
        .filter((e) => e.event === 'labeled' && e.label?.name === 'reviewed')
        .at(-1)?.created_at
      const { commits } = ghJson(['pr', 'view', String(pr.number), '--json', 'commits'])
      const newer = commits.some(
        (c) => labeledAt && c.committedDate > labeledAt && !c.authors.some((a) => a.login === me),
      )
      if (!newer) continue
    }
    const { files } = ghJson(['pr', 'view', String(pr.number), '--json', 'files'])
    const paths = files.map((f) => f.path)
    const dependabot = pr.author.login === 'app/dependabot'
    // A major bump changes the leading number in any "from X to Y".
    const major =
      dependabot &&
      [...`${pr.title}\n${pr.body}`.matchAll(/from v?(\d+)\S* to v?(\d+)/g)].some((m) => m[1] !== m[2])
    const highRisk =
      major ||
      labels.includes('touches-data') ||
      labels.includes('touches-gates') ||
      paths.some((p) => p.startsWith('src/engine/') || p.startsWith('src/storage/'))
    due.push({
      number: pr.number,
      title: pr.title,
      branch: pr.headRefName,
      kind: dependabot ? (major ? 'dependabot-major' : 'dependabot') : 'agent',
      highRisk,
      touchesWorkflows: paths.some((p) => p.startsWith('.github/workflows/')),
    })
  }

  if (due.length === 0) return idle('No PRs due.')
  return { status: 'work', prs: due }
}

const [mode, arg] = process.argv.slice(2)
let result
try {
  if (mode === 'release') {
    rmSync(lockPath(arg), { force: true })
    process.exit(0)
  }
  if (mode !== 'build' && mode !== 'review')
    throw new Error('Usage: preflight.mjs <build|review> [--claim] | release <agent>')
  const holder = !process.argv.includes('--ignore-lock') && lockHolder(mode)
  if (holder) result = idle(`Another ${mode} run is in progress (${holder}).`)
  else result = mode === 'build' ? build() : review()
  if (result.status === 'work' && process.argv.includes('--claim')) claim(mode)
} catch (error) {
  result = { status: 'error', reason: String(error.stderr || error.message).trim() }
}
console.log(JSON.stringify(result, null, 2))
process.exit({ work: 0, idle: 10 }[result.status] ?? 1)
