import {
  countedSets,
  schemeFor,
  schemeId,
  sessionE1rm,
  type ExerciseSession,
  type Seed,
  type Suggestion,
} from '../engine'
import { liftExercises, liftKey } from '../program/lifts'
import { activeExercises, missingSeeds } from '../program/program'
import type { Program, ProgramExercise } from '../program/types'
import { loggedSetCount } from '../session/sets'
import type { Session } from '../session/types'
import { dayHasHistory, exerciseHistory, type LoggedExerciseSession } from './sessions'

// A lift's sessions across the program (SPEC §6.9): they share the e1RM and History, while
// each exercise keeps its own progression, except Linear exercises with the same prescription (§6.10).

const sameRange = (a: ProgramExercise, b: ProgramExercise) =>
  a.repRange.min === b.repRange.min && a.repRange.max === b.repRange.max

/**
 * The exercises whose sessions one progression is replayed from: for a Linear exercise, every
 * Linear exercise in its lift with the same rep range and set count, archived ones included, in
 * program order (SPEC §6.10); otherwise the exercise alone.
 */
function progressionGroup(program: Program, exercise: ProgramExercise): ProgramExercise[] {
  if (schemeId(exercise) !== 'linear') return [exercise]
  return liftExercises(program, exercise.name).filter(
    (e) => schemeId(e) === 'linear' && sameRange(e, exercise) && e.sets === exercise.sets,
  )
}

/**
 * The finished sessions an exercise's progression replays (SPEC §6.10): its own, plus its Linear
 * group's, oldest first, each tagged with the exercise that logged it. With `before`, only
 * sessions before it (editing, §5.4).
 */
export function progressionHistory(
  program: Program,
  sessions: Session[],
  exercise: ProgramExercise,
  before?: Session,
): LoggedExerciseSession[] {
  return progressionGroup(program, exercise)
    .flatMap((e) => exerciseHistory(sessions, e.id, before).map((s) => ({ ...s, exerciseId: e.id })))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.sessionId - b.sessionId)
}

/** The starting numbers a progression starts from: the exercise's own, else its group's (SPEC §6.10). */
export function groupSeed(program: Program, exercise: ProgramExercise): Seed | undefined {
  return exercise.seed ?? progressionGroup(program, exercise).find((e) => e.seed)?.seed
}

/**
 * An exercise's next suggestion as of `asOf`, from all finished history (SPEC §6): its progression
 * history, its group's starting numbers and its lift's other sessions for the e1RM.
 */
export function suggestFor(
  program: Program,
  sessions: Session[],
  exercise: ProgramExercise,
  asOf: Date,
): Suggestion {
  return schemeFor(exercise).suggest(
    { ...exercise, seed: groupSeed(program, exercise) },
    progressionHistory(program, sessions, exercise),
    asOf,
    otherLiftSessions(program, sessions, exercise),
  )
}

/** One exercise's finished sessions, marked by its progression's replay (deloads, SPEC §6.7, §6.10). */
function replayed(
  program: Program,
  sessions: Session[],
  exercise: ProgramExercise,
  before?: Session,
): LoggedExerciseSession[] {
  return schemeFor(exercise)
    .replay(exercise, progressionHistory(program, sessions, exercise, before))
    .filter((s) => s.exerciseId === exercise.id)
}

/**
 * The finished sessions of the other exercises in this one's lift, each marked by its own exercise's replay:
 * what a scheme's `suggest` takes as `lift`. With `before`, only sessions before it (editing, §5.4).
 */
export function otherLiftSessions(
  program: Program,
  sessions: Session[],
  exercise: ProgramExercise,
  before?: Session,
): LoggedExerciseSession[] {
  return liftExercises(program, exercise.name)
    .filter((e) => e.id !== exercise.id)
    .flatMap((e) => replayed(program, sessions, e, before))
}

const countsForE1rm = (s: ExerciseSession) => !s.isDeload && !s.replaced && sessionE1rm(s) !== undefined

/**
 * Exercises still missing starting numbers, which the seed gate asks for before a session (SPEC
 * §5.1). A primary whose lift already has an e1RM from a real session needs none (§6.9, §6.10),
 * nor does a Linear exercise whose group has them (§6.10).
 */
export function needsStartingNumbers(program: Program, sessions: Session[]): ProgramExercise[] {
  return missingSeeds(program).filter(
    (e) => !groupSeed(program, e) && (e.tier !== 'primary' || !liftHasE1rm(program, sessions, e.name)),
  )
}

/**
 * The walkthrough's place, "step of total" (SPEC §5.1), counting progressions rather than
 * exercises: a Linear group shares one set of starting numbers (§6.10), so it's one step.
 */
export function startingNumbersStep(program: Program, sessions: Session[]): { step: number; of: number } {
  const groups = (exercises: ProgramExercise[]) =>
    new Set(exercises.map((e) => progressionGroup(program, e)[0]?.id ?? e.id)).size
  const total = groups(activeExercises(program))
  return { step: total - groups(needsStartingNumbers(program, sessions)) + 1, of: total }
}

/**
 * The lift's most recently logged exercise, where a new exercise in the lift copies its equipment
 * and loads from, and the starting weight an accessory is pre-filled with: the first counted set of
 * the latest session that wasn't a deload week (SPEC §6.9). Replaced sessions don't count.
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
    for (const s of replayed(program, sessions, exercise)) {
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
  return liftExercises(program, name).some((x) => replayed(program, sessions, x).some(countsForE1rm))
}

/**
 * A new exercise joining a lift takes your gym's setup from the lift's most recently logged
 * exercise (`latestInLift`): equipment, loads, one-sided (SPEC §6.9).
 */
export function withLiftGym(exercise: ProgramExercise, from: ProgramExercise | undefined): ProgramExercise {
  // Bodyweight is accessory-only (SPEC §6.1), so a primary keeps its own equipment then.
  if (!from || (exercise.tier === 'primary' && from.equipment === 'bodyweight')) return exercise
  return { ...exercise, equipment: from.equipment, loads: from.loads, unilateral: from.unilateral }
}

/** What "Change your program" does (SPEC §5.5), for its confirm and the change itself. */
export interface ProgramChange {
  /** Lifts among the active exercises with finished history: they keep it for the next program. */
  keptLifts: string[]
  /** The open session, discarded with the change, and how many sets it has logged. */
  open?: { session: Session; sets: number }
  /** Every open session: all are discarded. */
  discardIds: number[]
  /** Whether a day is archived rather than deleted: finished sessions only, since open ones go. */
  dayHasHistory: (dayId: string) => boolean
}

export function programChange(program: Program, sessions: Session[]): ProgramChange {
  const open = sessions.filter((s) => !s.finishedAt)
  const finished = sessions.filter((s) => s.finishedAt)
  const first = open[0]
  return {
    keptLifts: liftsWithHistory(
      program,
      sessions,
      activeExercises(program).map((e) => e.name),
    ),
    open: first && { session: first, sets: first.exercises.reduce((n, l) => n + loggedSetCount(l), 0) },
    discardIds: open.map((s) => s.id),
    dayHasHistory: (dayId) => dayHasHistory(finished, dayId),
  }
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
