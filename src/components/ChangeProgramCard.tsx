import { programChange, type ProgramChange } from '../history/lifts'
import { clearProgram } from '../program/program'
import type { Program } from '../program/types'
import type { Session } from '../session/types'
import { updateProgram } from '../storage/program'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { formatNameList } from '../ui/format'

interface Props {
  program: Program
  sessions: Session[]
}

/** The confirm: the days, the lifts that keep their history (§9.4 slice 2), and the open session. */
function confirmMessage({ keptLifts, open }: ProgramChange): string {
  const lifts =
    keptLifts.length === 0
      ? ''
      : ` ${formatNameList(keptLifts)} ${keptLifts.length === 1 ? 'keeps its' : 'keep their'} history for your next program.`
  const session =
    open === undefined
      ? ''
      : open.sets === 0
        ? ' Your open session has nothing logged yet, so it will be discarded.'
        : ` Your open session (${open.sets} ${open.sets === 1 ? 'set' : 'sets'} logged) will be discarded.`
  return `Change your program? Days with logged sessions are archived and their history kept; the rest are deleted.${lifts}${session}`
}

/**
 * Abandon the program for another (SPEC §9.4 slice 3). The Program tab then shows the
 * empty-program screen, to pick a template or build your own.
 */
export function ChangeProgramCard({ program, sessions }: Props) {
  async function change() {
    const plan = programChange(program, sessions)
    if (!confirm(confirmMessage(plan))) return
    await updateProgram((p) => clearProgram(p, plan.dayHasHistory), plan.discardIds)
  }

  return (
    <Card>
      <h2>Change your program</h2>
      <p className="muted">Consistency beats novelty: most programs work if you stick with them.</p>
      <Button onClick={() => void change()}>Change your program…</Button>
    </Card>
  )
}
