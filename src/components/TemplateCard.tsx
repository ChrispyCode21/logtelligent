import { latestInLift, withLiftGym } from '../history/lifts'
import { applyTemplate, TEMPLATES } from '../program/templates'
import type { Program } from '../program/types'
import type { Session } from '../session/types'
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
 * Ready-made programs (SPEC §9.1, slice 3), offered while the program has no active days: to start
 * with, or after changing programs (§9.4 slice 3). Each exercise joins the lift of the same name,
 * with your gym's setup (§9.4 slice 2).
 */
export function TemplateCard({ program, sessions, onApplied }: Props) {
  async function use(template: (typeof TEMPLATES)[number]) {
    await updateProgram((p) =>
      applyTemplate(p, template, (e) => withLiftGym(e, latestInLift(program, sessions, e.name)?.exercise)),
    )
    onApplied()
  }

  return (
    <Card className="templates">
      <h2>Start from a template</h2>
      {TEMPLATES.map((t) => (
        <div key={t.id} className="template">
          <strong>{t.name}</strong>
          <p className="muted">{t.description}</p>
          <Button variant="primary" onClick={() => void use(t)}>
            Use {t.name}
          </Button>
        </div>
      ))}
      <p className="muted">Or build your own: add a training day below.</p>
    </Card>
  )
}
