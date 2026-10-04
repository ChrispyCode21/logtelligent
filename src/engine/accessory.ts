import { stepUp } from './loads'
import type { ExerciseConfig, LoggedSet, Numbers, RepRange } from './types'

/** Rep ceiling: ceil(top x 1.2) (SPEC §6.2). */
export function repCeiling(range: RepRange): number {
  return Math.ceil(range.max * 1.2)
}

/** Rep extension step: max(ceil(top x 0.1), 1) (SPEC §6.2). */
export function repExtensionStep(range: RepRange): number {
  return Math.max(Math.ceil(range.max * 0.1), 1)
}

/** More than 50% of the logged working sets reached `top` (SPEC §6.5). */
export function rangeFilled(sets: LoggedSet[], top: number): boolean {
  return sets.filter((s) => s.reps >= top).length > sets.length / 2
}

/** A fresh start at `weight`: bottom of the configured range (SPEC §5.1, A11). */
export function startingNumbers(config: ExerciseConfig, weight: number): Numbers {
  return { weight, reps: config.repRange.min, top: config.repRange.max }
}

/**
 * Double progression after a successful session at `current` (SPEC §6.2, §6.5).
 * Not filled: same weight, aim for the effective top. Filled: take the next load
 * (back to the bottom of the range) unless that jump is too big, in which case
 * extend the effective top; at the rep ceiling, take the load step anyway.
 */
export function progressAccessory(
  config: ExerciseConfig,
  loads: number[],
  current: Numbers,
  sets: LoggedSet[],
): Numbers {
  if (!rangeFilled(sets, current.top)) {
    return { weight: current.weight, reps: current.top, top: current.top }
  }

  const ceiling = repCeiling(config.repRange)
  const next = stepUp(current.weight, loads)
  if (next !== undefined) {
    const jump = (next - current.weight) / current.weight
    if (jump <= config.maxRelativeJump || current.top >= ceiling) {
      return startingNumbers(config, next)
    }
  }

  const top = Math.min(current.top + repExtensionStep(config.repRange), ceiling)
  return { weight: current.weight, reps: top, top }
}
