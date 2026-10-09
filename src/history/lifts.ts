import { countedSets, deriveState, sessionE1rm, type ExerciseSession } from '../engine'
import { liftExercises, liftKey } from '../program/lifts'
import { missingSeeds } from '../program/program'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { exerciseHistory, type LoggedExerciseSession } from './sessions'

// A lift's sessions across the program (SPEC §9.4 slice 2): they share the e1RM and History, while
// each exercise keeps its own progression.

/** One exercise's finished sessions, marked by its own replay (deloads, SPEC §6.7). */
function replayed(sessions: Session[], exercise: ProgramExercise, before?: Session): LoggedExerciseSession[] {
  return deriveState(exercise, exerciseHistory(sessions, exercise.id, before)).sessions
}

/**
 * The finished sessions of the other exercises in this one's lift, each marked by its own replay:
 * what `suggestNext` takes as `lift`. With `before`, only sessions before it (editing, §9.2 slice 1).
 */
export function otherLiftSessions(
  program: Program,
  sessions: Session[],
  exercise: ProgramExercise,
  before?: Session,
): LoggedExerciseSession[] {
  return liftExercises(program, exercise.name)
    .filter((e) => e.id !== exercise.id)
    .flatMap((e) => replayed(sessions, e, before))
}

const countsForE1rm = (s: ExerciseSession) => !s.isDeload && !s.replaced && sessionE1rm(s) !== undefined

/**
 * Exercises still missing starting numbers, which the seed gate asks for before a session (SPEC
 * §5.1). A primary whose lift already has an e1RM from a real session needs none (§9.4 slice 2).
 */
export function needsStartingNumbers(program: Program, sessions: Session[]): ProgramExercise[] {
  return missingSeeds(program).filter((e) => e.tier !== 'primary' || !liftHasE1rm(program, sessions, e.name))
}

/**
 * The lift's most recently logged exercise, where a new exercise in the lift copies its equipment
 * and loads from, and the starting weight an accessory is pre-filled with: the first counted set of
 * the latest session that wasn't a deload week (SPEC §9.4 slice 2). Replaced sessions don't count.
 */
export function latestInLift(
  program: Program,
  sessions: Session[],
  name: string,
): { exercise: ProgramExercise; weight?: number } | undefined {
  type Found = { exercise: ProgramExercise; weight: number; time: number; id: number }
  const later = (a: Found | undefined, b: Found) =>
    !a || b.time > a.time || (b.time === a.time && b.id > a.id)
  let latest: Found | undefined
  let latestWeight: Found | undefined
  for (const exercise of liftExercises(program, name)) {
    for (const s of replayed(sessions, exercise)) {
      const first = countedSets(s.sets)[0]
      if (s.replaced || !first) continue
      const found = { exercise, weight: first.weight, time: Date.parse(s.date), id: s.sessionId }
      if (later(latest, found)) latest = found
      if (!s.isDeload && later(latestWeight, found)) latestWeight = found
    }
  }
  return latest && { exercise: latest.exercise, weight: latestWeight?.weight }
}

/** Whether the lift has an e1RM from a real session: a primary joining it needs no starting numbers. */
export function liftHasE1rm(program: Program, sessions: Session[], name: string): boolean {
  return liftExercises(program, name).some((x) => replayed(sessions, x).some(countsForE1rm))
}

/**
 * A new exercise joining a lift takes your gym's setup from the lift's most recently logged
 * exercise (`latestInLift`): equipment, loads, one-sided (SPEC §9.4 slice 2).
 */
export function withLiftGym(exercise: ProgramExercise, from: ProgramExercise | undefined): ProgramExercise {
  // Bodyweight is accessory-only (SPEC §6.1), so a primary keeps its own equipment then.
  if (!from || (exercise.tier === 'primary' && from.equipment === 'bodyweight')) return exercise
  return { ...exercise, equipment: from.equipment, loads: from.loads, unilateral: from.unilateral }
}

/** Of these names, the ones whose lift has finished history, each once, in the order given. */
export function liftsWithHistory(program: Program, sessions: Session[], names: string[]): string[] {
  const seen = new Set<string>()
  return names.filter((name) => {
    const key = liftKey(name)
    if (seen.has(key)) return false
    seen.add(key)
    return liftExercises(program, name).some((e) => exerciseHistory(sessions, e.id).length > 0)
  })
}
