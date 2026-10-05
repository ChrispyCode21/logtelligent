import { activeDays } from '../program/program'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { exerciseHasHistory } from './sessions'

export interface PickerGroup {
  label: string
  exercises: ProgramExercise[]
}

/**
 * The History tab's exercise picker (SPEC §5.3): active exercises grouped by day, then an
 * "Archived" group of archived exercises (or exercises on archived days) that have history.
 * Groups with no exercises are left out.
 */
export function historyGroups(program: Program, sessions: Session[]): PickerGroup[] {
  const groups = activeDays(program).map((d) => ({ label: d.name, exercises: d.exercises }))
  const archived = program.days
    .flatMap((d) => d.exercises.filter((e) => d.archived || e.archived))
    .filter((e) => exerciseHasHistory(sessions, e.id))
  return [...groups, { label: 'Archived', exercises: archived }].filter((g) => g.exercises.length > 0)
}
