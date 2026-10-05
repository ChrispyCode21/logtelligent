import type { LoggedSet, Tier } from '../engine'
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

/** RPE is required on a primary lift's first set only (SPEC §6.3, §6.5). */
export function rpeRequired(tier: Tier, index: number): boolean {
  return tier === 'primary' && index === 0
}

/** Sets that count as done for this log: the substitute's if replaced, none if skipped. */
export function loggedSets(log: ExerciseLog): LoggedSet[] {
  if (log.skipped) return []
  return log.substitute ? log.substitute.sets : log.sets
}

/**
 * A session can finish once something is logged and every primary lift that was
 * logged (and not replaced) has an RPE on its first set. Unlogged exercises are
 * simply not logged.
 */
export function canFinish(logs: ExerciseLog[], tierOf: (exerciseId: string) => Tier | undefined): boolean {
  const progression = logs.filter((l) => !l.skipped && !l.substitute && l.sets.length > 0)
  return (
    logs.some((l) => loggedSets(l).length > 0) &&
    progression.every(
      (l) => !rpeRequired(tierOf(l.exerciseId) ?? 'accessory', 0) || l.sets[0].rpe !== undefined,
    )
  )
}
