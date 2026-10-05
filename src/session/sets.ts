import type { LoggedSet, Suggestion, Tier } from '../engine'
import type { ExerciseLog } from './types'

// All sets of an exercise use one working weight (SPEC §6.3, §6.5), so changing
// the weight on any set changes it on every set.

export function addSet(sets: LoggedSet[], set: LoggedSet): LoggedSet[] {
  return [...sets.map((s) => ({ ...s, weight: set.weight })), set]
}

export function updateSet(sets: LoggedSet[], index: number, set: LoggedSet): LoggedSet[] {
  return sets.map((s, i) => (i === index ? set : { ...s, weight: set.weight }))
}

export function removeSet(sets: LoggedSet[], index: number): LoggedSet[] {
  return sets.filter((_, i) => i !== index)
}

/**
 * Removing this set would leave a first set without the effort it needs, so the delete must ask for
 * one (SPEC §9.2, slice 1). Only removing set 1 can, when set 2 has none.
 */
export function removalNeedsEffort(
  sets: LoggedSet[],
  index: number,
  rpeRequiredAt: (index: number) => boolean,
): boolean {
  const rest = removeSet(sets, index)
  return rest.length > 0 && rpeRequiredAt(0) && rest[0].rpe === undefined
}

/** Remove set 1, saving the effort (and any other change) given for the set that takes its place. */
export function removeFirstSet(sets: LoggedSet[], newFirst: LoggedSet): LoggedSet[] {
  return updateSet(removeSet(sets, 0), 0, newFirst)
}

/** RPE is required on a primary lift's first set only (SPEC §6.3, §6.5). */
export function rpeRequired(tier: Tier, index: number): boolean {
  return tier === 'primary' && index === 0
}

/**
 * Whether a primary lift's sets have the effort its first set needs (SPEC §6.3). An exercise with
 * no sets needs no effort. Checked at Finish, and when a finished session is edited (SPEC §9.2, slice 1).
 */
export function hasRequiredEffort(tier: Tier, sets: LoggedSet[]): boolean {
  return sets.length === 0 || !rpeRequired(tier, 0) || sets[0].rpe !== undefined
}

/**
 * How many sets this exercise wants today: the configured count, halved in a deload
 * (SPEC §6.2, §6.7). A substitute wants the configured count; it isn't on the plan (SPEC §5.2).
 */
export function targetSets(log: ExerciseLog, configuredSets: number, suggestion: Suggestion): number {
  return suggestion.kind === 'suggestion' && !log.substitute ? suggestion.sets : configuredSets
}

/** All of today's sets are in: validation runs (SPEC §5.2, §6.6) and the form for a new set closes. */
export function allSetsLogged(sets: LoggedSet[], target: number): boolean {
  return sets.length >= target
}

/** Sets that count as done for this log: the substitute's if replaced, none if skipped. */
export function loggedSets(log: ExerciseLog): LoggedSet[] {
  if (log.skipped) return []
  return log.substitute ? log.substitute.sets : log.sets
}

/**
 * Sets logged against sets wanted across a session, for "Only X of Y sets logged" (SPEC §5.2).
 * Skipped exercises count for neither; substitutes count their own sets.
 */
export function setTally(entries: { log: ExerciseLog; target: number }[]): {
  logged: number
  target: number
} {
  const counted = entries.filter((e) => !e.log.skipped)
  return {
    logged: counted.reduce((n, e) => n + loggedSets(e.log).length, 0),
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
