import type { LoggedSet } from '../engine'

// All sets of a primary lift use one working weight (SPEC §6.3), so changing
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

/** RPE is required on the first set only (SPEC §6.3). */
export function rpeRequired(index: number): boolean {
  return index === 0
}

export function canFinish(sets: LoggedSet[]): boolean {
  return sets.length > 0 && sets[0].rpe !== undefined
}
