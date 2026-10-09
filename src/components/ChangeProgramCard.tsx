import { liftsWithHistory } from '../history/lifts'
import { dayHasHistory } from '../history/sessions'
import { activeExercises, clearProgram } from '../program/program'
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

/** Anything logged in a session: its exercises' sets and any substitute's. */
function loggedSetCount(session: Session): number {
  return session.exercises.reduce((n, e) => n + e.sets.length + (e.substitute?.sets.length ?? 0), 0)
}

/** The confirm: the days, the lifts that keep their history (§9.4 slice 2), and the open session. */
function confirmMessage(kept: string[], open: Session | undefined): string {
  const lifts =
    kept.length === 0
      ? ''
      : ` ${formatNameList(kept)} ${kept.length === 1 ? 'keeps its' : 'keep their'} history for your next program.`
  const sets = open && loggedSetCount(open)
  const session =
    open === undefined
      ? ''
      : sets === 0
        ? ' Your open session has nothing logged yet, so it will be discarded.'
        : ` Today's session (${sets} ${sets === 1 ? 'set' : 'sets'} logged) will be discarded.`
  return `Change your program? Days with logged sessions are archived and their history kept; the rest are deleted.${lifts}${session}`
}

/**
 * Abandon the program for another (SPEC §9.4 slice 3). Days with history are archived; the Program
 * tab then shows the empty-program screen, to pick a template or build your own. An open session is
 * discarded, so its sets aren't history here.
 */
export function ChangeProgramCard({ program, sessions }: Props) {
  async function change() {
    const open = sessions.filter((s) => !s.finishedAt)
    const finished = sessions.filter((s) => s.finishedAt)
    const kept = liftsWithHistory(
      program,
      finished,
      activeExercises(program).map((e) => e.name),
    )
    if (!confirm(confirmMessage(kept, open[0]))) return
    await updateProgram(
      (p) => clearProgram(p, (dayId) => dayHasHistory(finished, dayId)),
      open.map((s) => s.id),
    )
  }

  return (
    <Card>
      <h2>Change your program</h2>
      <p className="muted">Consistency beats novelty: most programs work if you stick with them.</p>
      <Button onClick={() => void change()}>Change your program…</Button>
    </Card>
  )
}
