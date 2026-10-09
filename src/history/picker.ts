import { activeDays } from '../program/program'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { exerciseHistory } from './sessions'

export interface PickerGroup {
  label: string
  exercises: ProgramExercise[]
}

/**
 * The History tab's exercise picker (SPEC §5.3): active exercises grouped by day, then an
 * "Archived" group of archived exercises (or exercises on archived days) with finished history
 * (an open session doesn't count, SPEC §9.4 slice 0).
 * Groups with no exercises are left out.
 */
export function historyGroups(program: Program, sessions: Session[]): PickerGroup[] {
  const groups = activeDays(program).map((d) => ({ label: d.name, exercises: d.exercises }))
  const archived = program.days
    .flatMap((d) => d.exercises.filter((e) => d.archived || e.archived))
    .filter((e) => exerciseHistory(sessions, e.id).length > 0)
  return [...groups, { label: 'Archived', exercises: archived }].filter((g) => g.exercises.length > 0)
}
