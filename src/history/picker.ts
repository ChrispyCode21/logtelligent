import { liftKey } from '../program/lifts'
import { activeDays } from '../program/program'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { exerciseHistory } from './sessions'

export interface PickerGroup {
  label: string
  /** One exercise per lift, standing for it: picking it shows the whole lift (SPEC §6.9). */
  exercises: ProgramExercise[]
}

/**
 * The History tab's picker (SPEC §5.3): each lift once, under the first day it's active on, then an
 * "Archived" group of lifts with no active exercise but finished history (an open session doesn't
 * count, SPEC §5.3). Groups with no exercises are left out.
 */
export function historyGroups(program: Program, sessions: Session[]): PickerGroup[] {
  const seen = new Set<string>()
  const firstOfLift = (e: ProgramExercise) => {
    const key = liftKey(e.name)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }
  const groups = activeDays(program).map((d) => ({
    label: d.name,
    exercises: d.exercises.filter(firstOfLift),
  }))
  const archived = program.days
    .flatMap((d) => d.exercises.filter((e) => d.archived || e.archived))
    .filter((e) => exerciseHistory(sessions, e.id).length > 0)
    .filter(firstOfLift)
  return [...groups, { label: 'Archived', exercises: archived }].filter((g) => g.exercises.length > 0)
}
