import { countedSets, type LoggedSet, type Suggestion, type Tier } from '../engine'
import type { ExerciseLog } from './types'

// An exercise's prescribed sets use one working weight (SPEC §6.3, §6.5), so changing the weight on
// any of them changes it on all of them. Extra sets (SPEC §9.2, slice 2) come after the prescribed
// ones and keep their own weight, so one can be a lighter back-off set.

/** Log a prescribed set, before any extras. */
export function addSet(sets: LoggedSet[], set: LoggedSet): LoggedSet[] {
  const counted = countedSets(sets).map((s) => ({ ...s, weight: set.weight }))
  return [...counted, set, ...sets.filter((s) => s.extra)]
}

/** Log an extra set after the others. Effort isn't asked on extras. */
export function addExtra(sets: LoggedSet[], set: LoggedSet): LoggedSet[] {
  return [...sets, { weight: set.weight, reps: set.reps, extra: true }]
}

/** Change one set. A prescribed set's weight applies to every prescribed set; an extra changes alone. */
export function updateSet(sets: LoggedSet[], index: number, set: LoggedSet): LoggedSet[] {
  if (sets[index].extra) {
    return sets.map((s, i) => (i === index ? { weight: set.weight, reps: set.reps, extra: true } : s))
  }
  return sets.map((s, i) => (i === index ? set : s.extra ? s : { ...s, weight: set.weight }))
}

export function removeSet(sets: LoggedSet[], index: number): LoggedSet[] {
  return sets.filter((_, i) => i !== index)
}

/**
 * Removing set 1 would leave a first set without the effort it needs, so the delete must ask for one
 * (SPEC §9.2, slice 1). Removing a later set never asks, even if set 1 already lacks one (e.g. an
 * exercise that was an accessory when it was logged). Extras never become set 1.
 */
export function removalNeedsEffort(
  sets: LoggedSet[],
  index: number,
  rpeRequiredAt: (index: number) => boolean,
): boolean {
  const counted = countedSets(sets)
  return index === 0 && counted.length > 1 && rpeRequiredAt(0) && counted[1].rpe === undefined
}

/** Remove set 1, saving the effort (and any other change) given for the set that takes its place. */
export function removeFirstSet(sets: LoggedSet[], newFirst: LoggedSet): LoggedSet[] {
  return updateSet(removeSet(sets, 0), 0, newFirst)
}

/** Sets logged in a log: the original exercise's and any substitute's, extras included. */
export const loggedSetCount = (log: ExerciseLog) => log.sets.length + (log.substitute?.sets.length ?? 0)

/** Some set is logged in these logs, for the original exercise or a substitute. */
export const hasAnySets = (logs: ExerciseLog[]) => logs.some((l) => loggedSetCount(l) > 0)

/**
 * When an exercise's validation message shows. Live: once all of today's sets are in (SPEC §5.2,
 * §6.6). Finished: whenever it has prescribed sets, since the replay judged it however many there
 * were (SPEC §9.2, slice 1).
 */
export const showsOutcome = (finished: boolean, sets: LoggedSet[], target: number) =>
  finished ? countedSets(sets).length > 0 : allSetsLogged(sets, target)

/** RPE is required on a primary lift's first set only (SPEC §6.3, §6.5). */
export function rpeRequired(tier: Tier, index: number): boolean {
  return tier === 'primary' && index === 0
}

/**
 * Whether a primary lift's sets have the effort its first set needs (SPEC §6.3). An exercise with
 * no sets needs no effort. Checked at Finish, and when a finished session is edited (SPEC §9.2, slice 1).
 */
export function hasRequiredEffort(tier: Tier, sets: LoggedSet[]): boolean {
  const first = countedSets(sets)[0]
  return !first || !rpeRequired(tier, 0) || first.rpe !== undefined
}

/**
 * How many sets this exercise wants today: the configured count, halved in a deload
 * (SPEC §6.2, §6.7). A substitute wants the configured count; it isn't on the plan (SPEC §5.2).
 */
export function targetSets(log: ExerciseLog, configuredSets: number, suggestion: Suggestion): number {
  return suggestion.kind === 'suggestion' && !log.substitute ? suggestion.sets : configuredSets
}

/**
 * All of today's prescribed sets are in: validation runs (SPEC §5.2, §6.6), the form for a new set
 * closes, and "+ Add set" is offered (SPEC §9.2, slice 2).
 */
export function allSetsLogged(sets: LoggedSet[], target: number): boolean {
  return countedSets(sets).length >= target
}

/**
 * A substitute's weight step: 5 lb either way, never below 0. A substitute has no equipment or
 * loads to step through (SPEC §5.2), and a weight that isn't a number steps from 0.
 */
export function substituteStep(weight: number, direction: 1 | -1): number {
  return Math.max(0, (Number.isFinite(weight) ? weight : 0) + direction * 5)
}

/** Sets that count as done for this log: the substitute's if replaced, none if skipped. */
export function loggedSets(log: ExerciseLog): LoggedSet[] {
  if (log.skipped) return []
  return log.substitute ? log.substitute.sets : log.sets
}

/**
 * Prescribed sets logged against sets wanted across a session, for "Only X of Y sets logged"
 * (SPEC §5.2). Skipped exercises count for neither; substitutes count their own sets; extras
 * don't count (SPEC §9.2, slice 2).
 */
export function setTally(entries: { log: ExerciseLog; target: number }[]): {
  logged: number
  target: number
} {
  const counted = entries.filter((e) => !e.log.skipped)
  return {
    logged: counted.reduce((n, e) => n + countedSets(loggedSets(e.log)).length, 0),
    target: counted.reduce((n, e) => n + e.target, 0),
  }
}

/**
 * A session can finish once something is logged and every primary lift that was
 * logged (and not replaced) has an RPE on its first set. Unlogged exercises are
 * simply not logged.
 */
export function canFinish(logs: ExerciseLog[], tierOf: (exerciseId: string) => Tier | undefined): boolean {
  const progression = logs.filter((l) => !l.skipped && !l.substitute)
  return (
    logs.some((l) => loggedSets(l).length > 0) &&
    progression.every((l) => hasRequiredEffort(tierOf(l.exerciseId) ?? 'accessory', l.sets))
  )
}

/**
 * The set count a header shows against what's logged: today's target in a live session, and in a
 * finished one only if its prescription was saved (SPEC §9.4 slice 1). Before v1.3.0 it wasn't, so
 * those show what was logged alone.
 */
export function shownTarget(log: ExerciseLog, finished: boolean, target: number): number | undefined {
  return finished && !log.prescription ? undefined : target
}
