import { activeDays } from '../program/program'
import { applyTemplate, templateExerciseNames, TEMPLATES } from '../program/templates'
import type { Program } from '../program/types'
import type { Session } from '../session/types'
import { liftsWithHistory, withLiftGym } from '../history/lifts'
import { dayHasHistory, emptyOpenSessions } from '../history/sessions'
import { updateProgram } from '../storage/program'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { formatNameList } from '../ui/format'

interface Props {
  program: Program
  sessions: Session[]
  /** Called once a template is in place, to start entering starting numbers. */
  onApplied: () => void
}

/**
 * Ready-made programs (SPEC §9.1, slice 3): offered to start with when the program is empty, and
 * as a replacement (after a confirm) once it isn't.
 */
export function TemplateCard({ program, sessions, onApplied }: Props) {
  const empty = activeDays(program).length === 0

  async function use(template: (typeof TEMPLATES)[number]) {
    const discard = emptyOpenSessions(
      sessions,
      activeDays(program).map((d) => d.id),
    )
    // Template exercises join the lifts of the same name, history and all (SPEC §9.4 slice 2).
    const kept = liftsWithHistory(program, sessions, templateExerciseNames(template))
    const ok =
      empty ||
      confirm(
        `Replace your program with ${template.name}? Days with logged sessions are archived ` +
          '(their history is kept); the rest are deleted.' +
          (kept.length > 0
            ? ` ${formatNameList(kept)} ${kept.length === 1 ? 'keeps its' : 'keep their'} history.`
            : '') +
          (discard.length > 0 ? ' Your open session has nothing logged yet, so it will be discarded.' : ''),
      )
    if (!ok) return
    await updateProgram(
      (p) =>
        applyTemplate(
          p,
          template,
          (dayId) => dayHasHistory(sessions, dayId),
          (e) => withLiftGym(e, program, sessions),
        ),
      discard.map((s) => s.id),
    )
    onApplied()
  }

  return (
    <Card className="templates">
      <h2>{empty ? 'Start from a template' : 'Templates'}</h2>
      {TEMPLATES.map((t) => (
        <div key={t.id} className="template">
          <strong>{t.name}</strong>
          <p className="muted">{t.description}</p>
          <Button variant={empty ? 'primary' : 'secondary'} onClick={() => void use(t)}>
            {empty ? `Use ${t.name}` : `Replace with ${t.name}…`}
          </Button>
        </div>
      ))}
      {empty && <p className="muted">Or build your own: add a training day below.</p>}
    </Card>
  )
}
