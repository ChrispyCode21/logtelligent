import { repsToFailure, runningE1rm } from './e1rm'
import { availableLoads, snapDown } from './loads'
import { deriveState, targetReps } from './progression'
import type {
  ExerciseConfig,
  ExerciseSession,
  ProgressionState,
  RunningE1rm,
  Suggestion,
} from './types'

const DELOAD_LOAD_FACTOR = 0.9
const DELOAD_RPE = 6

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

/** Numbers set by the stack logic, a deload, or accessory progression (SPEC §6.5–6.7). */
function fromPlan(
  config: ExerciseConfig,
  loads: number[],
  state: ProgressionState,
  e1rm: RunningE1rm | undefined,
): Suggestion {
  const plan = state.next
  if (!plan.numbers) return { kind: 'needsSeed' }

  const primary = config.tier === 'primary'
  const deload = plan.kind === 'deload'
  const { weight, reps, top } = plan.numbers
  return {
    kind: 'suggestion',
    plan: plan.kind,
    weight: deload && primary ? snapDown(weight * DELOAD_LOAD_FACTOR, loads) : weight,
    reps,
    effectiveTop: primary ? undefined : top,
    sets: deload ? Math.ceil(config.sets / 2) : config.sets,
    targetRpe: primary ? (deload ? DELOAD_RPE : config.targetRpe) : undefined,
    e1rm,
    stacks: state.stacks,
  }
}

/** Next session's suggestion for an exercise, from its finished history. */
export function suggestNext(
  config: ExerciseConfig,
  history: ExerciseSession[],
  asOf: Date,
): Suggestion {
  const loads = availableLoads(config)
  const { state, sessions } = deriveState(config, history)

  if (config.tier === 'accessory') return fromPlan(config, loads, state, undefined)

  const e1rm = runningE1rm(sessions, config.seed, asOf)
  // While stacks > 0 (or around a deload) the stack logic decides, not the e1RM rule.
  if (state.next.kind !== 'normal') return fromPlan(config, loads, state, e1rm)
  if (!e1rm) return { kind: 'needsSeed' }

  const reps = targetReps(config.repRange)
  const pick = pickWeight(e1rm.value, reps, config.targetRpe, loads)
  return {
    kind: 'suggestion',
    plan: 'normal',
    weight: pick.weight,
    reps,
    sets: config.sets,
    targetRpe: config.targetRpe,
    predictedReps: pick.predictedReps,
    e1rm,
    stacks: state.stacks,
  }
}
