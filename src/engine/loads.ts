import type { ExerciseConfig } from './types'

// Barbell: 45 lb empty bar, 5 lb total jumps (SPEC §6.2, §10 #5).
const BARBELL_EMPTY = 45
const BARBELL_STEP = 5
const BARBELL_MAX = 1000

// Standard dumbbell rack (SPEC §6.2): 2.5 lb steps to 25, then 5 lb steps to 150.
const DUMBBELL_RACK = [
  10, 12.5, 15, 17.5, 20, 22.5,
  ...Array.from({ length: 26 }, (_, i) => 25 + i * 5),
]

function barbellLoads(): number[] {
  const loads: number[] = []
  for (let w = BARBELL_EMPTY; w <= BARBELL_MAX; w += BARBELL_STEP) loads.push(w)
  return loads
}

/** Available loads for an exercise, ascending (SPEC §6.2 layers 1-2). */
export function availableLoads(config: ExerciseConfig): number[] {
  if (config.loads) return [...config.loads].sort((a, b) => a - b)
  switch (config.equipment) {
    case 'barbell':
      return barbellLoads()
    case 'dumbbell':
      return DUMBBELL_RACK
    default:
      // Cable/machine stacks are user-entered; bodyweight has no load list.
      return []
  }
}
