import type { EquipmentType, ExerciseConfig } from './types'

const range = (start: number, step: number, max: number) =>
  Array.from({ length: Math.floor((max - start) / step) + 1 }, (_, i) => start + i * step)

// Barbell: 45 lb empty bar, 5 lb total jumps (SPEC §6.2).
const BARBELL = range(45, 5, 1000)

// Standard dumbbell rack, per hand (SPEC §6.1–6.2): 2.5 lb steps to 25, then 5 lb steps to 150.
const DUMBBELL_RACK = [10, 12.5, 15, 17.5, 20, 22.5, ...range(25, 5, 150)]

// Bodyweight: added weight, starting at none (SPEC §6.1).
const BODYWEIGHT_ADDED = range(0, 5, 200)

/** Default loads for an equipment type. Cable/machine stacks are user-entered, so none. */
export function defaultLoads(equipment: EquipmentType): number[] {
  switch (equipment) {
    case 'barbell':
      return BARBELL
    case 'dumbbell':
      return DUMBBELL_RACK
    case 'bodyweight':
      return BODYWEIGHT_ADDED
    default:
      return []
  }
}

/** Available loads for an exercise, ascending (SPEC §6.2 layers 1-2). */
export function availableLoads(config: ExerciseConfig): number[] {
  if (config.loads) return [...config.loads].sort((a, b) => a - b)
  return defaultLoads(config.equipment)
}

/** Heaviest available load at or below `weight`, or the lightest load if none is. */
export function snapDown(weight: number, loads: number[]): number {
  return loads.findLast((l) => l <= weight) ?? loads[0]
}

/** The next available load below `weight`, or the lightest load if there is none. */
export function stepDown(weight: number, loads: number[]): number {
  return loads.findLast((l) => l < weight) ?? loads[0]
}

/** The next available load above `weight`, if any. */
export function stepUp(weight: number, loads: number[]): number | undefined {
  return loads.find((l) => l > weight)
}
