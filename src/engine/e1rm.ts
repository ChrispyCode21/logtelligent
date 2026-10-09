import { countedSets } from './sets'
import type { ExerciseSession, RunningE1rm, Seed } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 28
const MAX_SESSIONS = 3
const BREAK_FACTOR = 0.9
const SEED_RPE = 7
// Brzycki divides by (37 - r), so the averaged formula is only defined below 37 reps.
const MAX_REPS = 36

export const epley = (w: number, r: number) => w * (1 + r / 30)
export const brzycki = (w: number, r: number) => (w * 36) / (37 - r)
export const lombardi = (w: number, r: number) => w * r ** 0.1

/** Average of Epley, Brzycki and Lombardi (SPEC §6.4). */
export function estimate1rm(weight: number, reps: number): number {
  return (epley(weight, reps) + brzycki(weight, reps) + lombardi(weight, reps)) / 3
}

/** Reps performed plus reps in reserve: reps + (10 - RPE). */
export function effectiveReps(reps: number, rpe: number): number {
  return reps + (10 - rpe)
}

export function setE1rm(set: { weight: number; reps: number; rpe: number }): number {
  return estimate1rm(set.weight, effectiveReps(set.reps, set.rpe))
}

/**
 * Reps to failure at `weight` for a lifter with this e1RM: the averaged formula
 * inverted numerically. It increases with reps, so bisection works.
 */
export function repsToFailure(e1rm: number, weight: number): number {
  if (estimate1rm(weight, 0) >= e1rm) return 0
  if (estimate1rm(weight, MAX_REPS) <= e1rm) return MAX_REPS
  let lo = 0
  let hi = MAX_REPS
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (estimate1rm(weight, mid) < e1rm) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** A session's first (counted) set, when it carries an RPE: the e1RM comes from it alone (SPEC §6.3). */
function ratedFirstSet(session: ExerciseSession) {
  const first = countedSets(session.sets)[0]
  return first?.rpe === undefined ? undefined : { ...first, rpe: first.rpe }
}

export function sessionE1rm(session: ExerciseSession): number | undefined {
  const first = ratedFirstSet(session)
  return first && setE1rm(first)
}

/** A session's first set at or under this many effective reps counts before higher-rep ones (SPEC §6.4). */
const LOW_REP_MAX = 10

/** Over 10 effective reps on the first set: counted only when nothing lower is (SPEC §6.4). */
export function isHighRepSession(session: ExerciseSession): boolean {
  const first = ratedFirstSet(session)
  return first !== undefined && effectiveReps(first.reps, first.rpe) > LOW_REP_MAX
}

/** Sessions of 10 or fewer effective reps when there are any, else all of them (SPEC §6.4). */
function lowerRepsFirst<T extends { lowReps: boolean }>(sessions: T[]): T[] {
  const low = sessions.filter((s) => s.lowReps)
  return low.length > 0 ? low : sessions
}

/**
 * Running e1RM (SPEC §6.4): the average of up to the last 3 sessions within 4 weeks,
 * else 90% of the most recent session ("returning from a break"), else the seed.
 * Sessions of 10 or fewer effective reps are used before higher-rep ones, in both cases.
 * `history` is every session of the lift, on any day (SPEC §9.4 slice 2).
 * Deload and replaced sessions are ignored. Undefined when there is nothing to go on.
 */
export function runningE1rm(
  history: ExerciseSession[],
  seed: Seed | undefined,
  asOf: Date,
): RunningE1rm | undefined {
  const eligible = history
    .filter((s) => !s.isDeload && !s.replaced)
    .map((s) => ({
      time: Date.parse(s.date),
      e1rm: sessionE1rm(s),
      lowReps: !isHighRepSession(s),
    }))
    .filter((s): s is { time: number; e1rm: number; lowReps: boolean } => s.e1rm !== undefined)
    .sort((a, b) => b.time - a.time)

  if (eligible.length > 0) {
    const windowStart = asOf.getTime() - WINDOW_DAYS * DAY_MS
    const window = eligible.filter((s) => s.time >= windowStart)
    if (window.length > 0) {
      const recent = lowerRepsFirst(window).slice(0, MAX_SESSIONS)
      const value = recent.reduce((sum, s) => sum + s.e1rm, 0) / recent.length
      return { value, basis: 'history' }
    }
    return { value: lowerRepsFirst(eligible)[0].e1rm * BREAK_FACTOR, basis: 'returningFromBreak' }
  }

  if (seed) return { value: setE1rm({ ...seed, rpe: SEED_RPE }), basis: 'seed' }
  return undefined
}
