import { activeDays } from '../program/program'
import { applyTemplate, TEMPLATES } from '../program/templates'
import type { Program } from '../program/types'
import type { Session } from '../session/types'
import { dayHasHistory } from '../storage/history'
import { updateProgram } from '../storage/program'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

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
    const ok =
      empty ||
      confirm(
        `Replace your program with ${template.name}? Days with logged sessions are archived ` +
          '(their history is kept); the rest are deleted.',
      )
    if (!ok) return
    await updateProgram((p) => applyTemplate(p, template, (dayId) => dayHasHistory(sessions, dayId)))
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
