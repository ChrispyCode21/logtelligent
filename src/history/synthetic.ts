import { availableLoads, epley, type LoggedSet } from '../engine'
import { liftKey } from '../program/lifts'
import { activeDays } from '../program/program'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { suggestFor } from './lifts'

// Synthetic training history for tests and benchmarks (the replay benchmark, #113); the app never
// imports it. Each session follows its exercises' own suggestions through `suggestFor`, so any
// scheme, built now or later, gets a history its replay actually walks. A simulated lifter, whose
// strength grows ever more slowly, logs what that strength allows at the suggested weight, so the
// history has increases, stalls and misses, and the stacks, deloads and resets they lead to.

export interface SyntheticOptions {
  /** Weeks of training. */
  weeks: number
  /** Sessions a week, rotating through the program's active days. */
  perWeek: number
  /** The first session's start time. */
  start?: Date
  /** One week off at the end of each this many weeks, for the returning-from-a-break rules. */
  breakEvery?: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** A small seeded PRNG (mulberry32), so a history is the same on every run. */
function random(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A cable or machine stack, which has no default loads: 10 to 300 in 10s. */
const STACK = Array.from({ length: 30 }, (_, i) => (i + 1) * 10)

/** Starting numbers by equipment: a light working weight with loads to grow into. */
const START: Record<ProgramExercise['equipment'], number> = {
  barbell: 95,
  dumbbell: 20,
  cable: 50,
  machine: 90,
  bodyweight: 0,
}

/** The lifter's body weight, which a bodyweight exercise's added weight goes on top of. */
const BODY = 180

/**
 * The program made ready to log: every exercise given starting numbers and, where its equipment
 * has no default loads, a stack.
 */
export function syntheticProgram(program: Program): Program {
  const ready = (e: ProgramExercise): ProgramExercise => {
    const withLoads = availableLoads(e).length ? e : { ...e, loads: STACK }
    return { ...withLoads, seed: { weight: START[e.equipment], reps: e.repRange.min } }
  }
  return { ...program, days: program.days.map((d) => ({ ...d, exercises: d.exercises.map(ready) })) }
}

/**
 * Finished sessions for `program` (prepared with `syntheticProgram`), oldest first. Each set is
 * logged at the suggested weight for its aim, or as many reps as the lifter has left, with the
 * effort it took on an Adaptive primary's first set.
 */
export function syntheticHistory(program: Program, options: SyntheticOptions): Session[] {
  const { weeks, perWeek, breakEvery } = options
  const start = (options.start ?? new Date('2023-01-02T17:00:00Z')).getTime()
  const days = activeDays(program)
  const next = random(113)
  // Each lift's true one-rep max, and its sessions so far.
  const lifts = new Map<string, { max: number; sessions: number }>()
  const sessions: Session[] = []

  const log = (e: ProgramExercise, startedAt: Date) => {
    const s = suggestFor(program, sessions, e, startedAt)
    if (s.kind !== 'suggestion') throw new Error(`${e.name} has no starting numbers`)
    const body = e.equipment === 'bodyweight' ? BODY : 0
    const key = liftKey(e.name)
    // At first, the starting weight leaves 2 reps in reserve at the top of the range.
    const lift = lifts.get(key) ?? { max: epley(START[e.equipment] + body, e.repRange.max + 2), sessions: 0 }
    // Reps to failure at this weight, one fewer each set, give or take one on the day.
    const noise = Math.floor(next() * 3) - 1
    const toFailure = Math.max(0, Math.floor(30 * (lift.max / (s.weight + body) - 1)) + noise)
    // An Adaptive primary is taken to its target effort, so a good day lands above the rep target
    // (SPEC §6.4); everything else stops at the rep target.
    const effort = !s.scheme ? s.targetRpe : undefined
    const aim = effort === undefined ? s.reps : toFailure - (10 - effort)
    const sets: LoggedSet[] = Array.from({ length: s.sets }, (_, i) => ({
      weight: s.weight,
      reps: Math.max(0, Math.min(aim, toFailure - i)),
    }))
    if (effort !== undefined)
      sets[0] = { ...sets[0], rpe: Math.max(6, Math.min(10, 10 - (toFailure - sets[0].reps))) }
    lifts.set(key, { max: lift.max * (1 + 0.01 / (1 + lift.sessions / 20)), sessions: lift.sessions + 1 })
    return { exerciseId: e.id, sets, prescription: { repRange: { ...e.repRange }, sets: e.sets } }
  }

  for (let week = 0; week < weeks; week++) {
    if (breakEvery && week % breakEvery === breakEvery - 1) {
      for (const lift of lifts.values()) lift.max *= 0.99
      continue
    }
    for (let i = 0; i < perWeek; i++) {
      const day = days[sessions.length % days.length]
      const startedAt = new Date(start + (week * 7 + Math.floor((i * 7) / perWeek)) * DAY_MS)
      sessions.push({
        id: sessions.length + 1,
        dayId: day.id,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date(startedAt.getTime() + 60 * 60 * 1000).toISOString(),
        exercises: day.exercises.filter((e) => !e.archived).map((e) => log(e, startedAt)),
      })
    }
  }
  return sessions
}
