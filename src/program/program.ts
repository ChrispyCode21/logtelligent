import type { Program, ProgramDay, ProgramExercise } from './types'

export const EMPTY_PROGRAM: Program = { id: 'main', days: [] }

/** Days in rotation, each with its active exercises. */
export function activeDays(program: Program): ProgramDay[] {
  return program.days
    .filter((d) => !d.archived)
    .map((d) => ({ ...d, exercises: d.exercises.filter((e) => !e.archived) }))
}

export function activeExercises(program: Program): ProgramExercise[] {
  return activeDays(program).flatMap((d) => d.exercises)
}

/** Any exercise, archived or not, so old sessions can still be shown. */
export function findExercise(program: Program, id: string): ProgramExercise | undefined {
  return program.days.flatMap((d) => d.exercises).find((e) => e.id === id)
}

/** Exercises that still need starting numbers. Sessions can't start until this is empty (SPEC §5.1). */
export function missingSeeds(program: Program): ProgramExercise[] {
  return activeExercises(program).filter((e) => !e.seed)
}

// Editing. Every function returns a new program.

function moveWithin<T extends { id: string; archived?: boolean }>(
  items: T[],
  id: string,
  direction: -1 | 1,
): T[] {
  const from = items.findIndex((i) => i.id === id)
  // Swap with the nearest visible neighbor, skipping archived items.
  let to = from + direction
  while (to >= 0 && to < items.length && items[to].archived) to += direction
  if (from < 0 || to < 0 || to >= items.length) return items
  const next = [...items]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

function updateDay(program: Program, dayId: string, fn: (day: ProgramDay) => ProgramDay): Program {
  return { ...program, days: program.days.map((d) => (d.id === dayId ? fn(d) : d)) }
}

export function addDay(program: Program, day: ProgramDay): Program {
  return { ...program, days: [...program.days, day] }
}

export function renameDay(program: Program, dayId: string, name: string): Program {
  return updateDay(program, dayId, (d) => ({ ...d, name }))
}

export function moveDay(program: Program, dayId: string, direction: -1 | 1): Program {
  return { ...program, days: moveWithin(program.days, dayId, direction) }
}

/** Archive a day that has logged sessions; delete one that has none (SPEC §6.1). */
export function removeDay(program: Program, dayId: string, hasHistory: boolean): Program {
  if (hasHistory) return updateDay(program, dayId, (d) => ({ ...d, archived: true }))
  return { ...program, days: program.days.filter((d) => d.id !== dayId) }
}

export function addExercise(program: Program, dayId: string, exercise: ProgramExercise): Program {
  return updateDay(program, dayId, (d) => ({ ...d, exercises: [...d.exercises, exercise] }))
}

export function updateExercise(program: Program, exercise: ProgramExercise): Program {
  return {
    ...program,
    days: program.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.id === exercise.id ? exercise : e)),
    })),
  }
}

export function moveExercise(
  program: Program,
  dayId: string,
  exerciseId: string,
  direction: -1 | 1,
): Program {
  return updateDay(program, dayId, (d) => ({
    ...d,
    exercises: moveWithin(d.exercises, exerciseId, direction),
  }))
}

/** Archive an exercise that has logged sets; delete one that has none (SPEC §6.1). */
export function removeExercise(program: Program, exerciseId: string, hasHistory: boolean): Program {
  return {
    ...program,
    days: program.days.map((d) => ({
      ...d,
      exercises: hasHistory
        ? d.exercises.map((e) => (e.id === exerciseId ? { ...e, archived: true } : e))
        : d.exercises.filter((e) => e.id !== exerciseId),
    })),
  }
}
