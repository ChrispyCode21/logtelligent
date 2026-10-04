import { repsToFailure, runningE1rm } from './e1rm'
import { availableLoads } from './loads'
import type { ExerciseConfig, ExerciseSession, RepRange, Suggestion } from './types'

/** Midpoint of the rep range, rounded up (SPEC §6.4). */
export function targetReps(range: RepRange): number {
  return Math.ceil((range.min + range.max) / 2)
}

export function predictedReps(e1rm: number, weight: number, targetRpe: number): number {
  return repsToFailure(e1rm, weight) - (10 - targetRpe)
}

/**
 * Heaviest available load whose predicted reps reach the target (SPEC §6.4).
 * Falls back to the lightest load if none do (SPEC §10 #6).
 */
export function pickWeight(e1rm: number, target: number, targetRpe: number, loads: number[]) {
  let weight = loads[0]
  for (const load of loads) {
    if (predictedReps(e1rm, load, targetRpe) >= target) weight = load
  }
  return { weight, predictedReps: predictedReps(e1rm, weight, targetRpe) }
}

/** Next session's suggestion for a primary lift. */
export function suggestNext(
  config: ExerciseConfig,
  history: ExerciseSession[],
  asOf: Date,
): Suggestion {
  if (config.tier !== 'primary') {
    throw new Error('Accessory progression is not implemented yet (SPEC §9, slice 2)')
  }

  const e1rm = runningE1rm(history, config.seed, asOf)
  if (!e1rm) return { kind: 'needsSeed' }

  const reps = targetReps(config.repRange)
  const pick = pickWeight(e1rm.value, reps, config.targetRpe, availableLoads(config))
  return {
    kind: 'suggestion',
    weight: pick.weight,
    reps,
    sets: config.sets,
    targetRpe: config.targetRpe,
    predictedReps: pick.predictedReps,
    e1rm,
  }
}
