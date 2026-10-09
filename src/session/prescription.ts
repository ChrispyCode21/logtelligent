import type { ExerciseConfig } from '../engine'
import type { ExerciseLog } from './types'

// A finished session's prescription (SPEC §9.4 slice 1): each exercise's rep range and set count,
// saved on Finish so later changes to the program don't change how the session is judged.

/** The session's logs with each exercise's prescription saved from its current settings. */
export function withPrescriptions(
  logs: ExerciseLog[],
  configOf: (exerciseId: string) => ExerciseConfig | undefined,
): ExerciseLog[] {
  return logs.map((log) => {
    const config = configOf(log.exerciseId)
    if (!config) return log
    return { ...log, prescription: { repRange: { ...config.repRange }, sets: config.sets } }
  })
}

/**
 * The settings a finished session is judged and shown by: its saved rep range and set count, or the
 * exercise's current ones for a session finished before v1.3.0.
 */
export function prescribedConfig<C extends ExerciseConfig>(config: C, log: ExerciseLog): C {
  const p = log.prescription
  return p ? { ...config, repRange: p.repRange, sets: p.sets } : config
}
