import type { LoggedSet, Tier } from '../engine'
import type { ExerciseLog } from '../storage/db'

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

/**
 * A session can finish once something is logged and every primary lift that was
 * logged has an RPE on its first set. Unlogged exercises are simply not logged.
 */
export function canFinish(logs: ExerciseLog[], tierOf: (exerciseId: string) => Tier | undefined): boolean {
  const logged = logs.filter((l) => l.sets.length > 0)
  return (
    logged.length > 0 &&
    logged.every((l) => !rpeRequired(tierOf(l.exerciseId) ?? 'accessory', 0) || l.sets[0].rpe !== undefined)
  )
}
