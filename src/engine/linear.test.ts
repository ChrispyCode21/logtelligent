import { describe, expect, it } from 'vitest'
import { linear, schemeFor } from '.'
import type { ExerciseConfig, ExerciseSession, LinearReason, LoggedSet } from '.'

const squat: ExerciseConfig = {
  id: 'squat',
  name: 'Squat',
  tier: 'primary',
  repRange: { min: 5, max: 5 },
  targetRpe: 8,
  sets: 3,
  equipment: 'barbell',
  maxRelativeJump: 0.1,
  unilateral: false,
  seed: { weight: 135, reps: 5 },
  progression: { scheme: 'linear', increment: 5 },
}

const DAY_MS = 24 * 60 * 60 * 1000
const start = Date.parse('2026-09-01T12:00:00Z')
const at = (day: number) => new Date(start + day * DAY_MS).toISOString()

/** A session on the given day: `reps` at `weight`, one entry per logged set. */
const on = (day: number, weight: number, reps: number[], extra: LoggedSet[] = []): ExerciseSession => ({
  date: at(day),
  sets: [...reps.map((r) => ({ weight, reps: r })), ...extra],
})
const ok = (day: number, weight: number) => on(day, weight, [5, 5, 5])
const miss = (day: number, weight: number) => on(day, weight, [5, 5, 4])

/** The suggestion the day after the last session, unless `asOf` is a day number. */
function next(history: ExerciseSession[], config = squat, asOf?: number) {
  const last = Math.max(0, ...history.map((s) => Math.round((Date.parse(s.date) - start) / DAY_MS)))
  return linear.suggest(config, history, new Date(start + (asOf ?? last + 1) * DAY_MS), [])
}

function expectNext(s: ReturnType<typeof next>, weight: number, reason: LinearReason, reps = 5, sets = 3) {
  expect(s).toEqual({ kind: 'suggestion', scheme: 'linear', weight, reps, sets, reason })
}

describe('7.L Linear (SPEC §6.10)', () => {
  it('L1: no history, seed 135 suggests 135 x 5, 3 sets, with no reason', () => {
    expectNext(next([]), 135, { kind: 'start' })
  })

  it('L2: 135 3x5 suggests 140 x 5, +5 lb', () => {
    expectNext(next([ok(0, 135)]), 140, { kind: 'increase', increment: 5 })
  })

  it('L3: a deadlift with a 10 lb increment, 225 x 5 suggests 235 x 5, +10 lb', () => {
    const deadlift = { ...squat, sets: 1, progression: { scheme: 'linear', increment: 10 } } as const
    const s = next([on(0, 225, [5])], deadlift)
    expectNext(s, 235, { kind: 'increase', increment: 10 }, 5, 1)
  })

  it('L4: one miss repeats the weight', () => {
    expectNext(next([ok(0, 135), on(2, 140, [5, 5, 4])]), 140, { kind: 'repeat' })
  })

  it('L5: two misses repeat the weight again', () => {
    expectNext(next([ok(0, 135), miss(2, 140), miss(4, 140)]), 140, { kind: 'repeat' })
  })

  it('L6: three misses reset 10% lighter, snapped down: 125 x 5', () => {
    expectNext(next([ok(0, 135), miss(2, 140), miss(4, 140), miss(6, 140)]), 125, { kind: 'reset' })
  })

  it('L7: after a reset, success at 125 suggests 130 x 5, and that session is marked as a deload', () => {
    const history = [ok(0, 135), miss(2, 140), miss(4, 140), miss(6, 140), ok(8, 125)]
    expectNext(next(history), 130, { kind: 'increase', increment: 5 })
    expect(linear.replay(squat, history).map((s) => !!s.isDeload)).toEqual([false, false, false, false, true])
  })

  it('L8: a success clears the count, so 145 missed twice repeats', () => {
    const history = [ok(0, 135), miss(2, 140), miss(4, 140), ok(6, 140), miss(8, 145), miss(10, 145)]
    expectNext(next(history), 145, { kind: 'repeat' })
  })

  it('L9: a miss at a lighter weight restarts the count at 1', () => {
    expectNext(next([ok(0, 135), miss(2, 140), miss(4, 140), miss(6, 135)]), 135, { kind: 'repeat' })
  })

  it('L10: a break after 200 3x5 restarts 10% lighter: 180 x 5', () => {
    expectNext(next([ok(0, 200)], squat, 42), 180, { kind: 'break' })
  })

  it('L11: after a break, the last success counts, not the miss: 180 x 5', () => {
    expectNext(next([ok(0, 200), miss(2, 205)], squat, 44), 180, { kind: 'break' })
  })

  it('L12: after a break with no success, the last weight attempted: 120 x 5', () => {
    expectNext(next([miss(0, 135)], squat, 42), 120, { kind: 'break' })
  })

  it('L13: an increment between loads takes the next load up: 2.5 lb from 135 gives 140', () => {
    const fine = { ...squat, progression: { scheme: 'linear', increment: 2.5 } } as const
    expectNext(next([ok(0, 135)], fine), 140, { kind: 'increase', increment: 5 })
  })

  it('L14: a dumbbell lunge at 22.5 with +5 lb suggests 30 x 8, +7.5 lb', () => {
    const lunge: ExerciseConfig = {
      ...squat,
      id: 'lunge',
      name: 'Lunge',
      tier: 'accessory',
      repRange: { min: 8, max: 8 },
      equipment: 'dumbbell',
    }
    const history = [{ date: at(0), sets: [22.5, 22.5, 22.5].map((weight) => ({ weight, reps: 8 })) }]
    expectNext(next(history, lunge), 30, { kind: 'increase', increment: 7.5 }, 8)
  })

  it('L15: a cable stack of 100, 110, 120 with +5 lb: 100 3x5 suggests 110 x 5, +10 lb', () => {
    const cable: ExerciseConfig = { ...squat, equipment: 'cable', loads: [100, 110, 120] }
    expectNext(next([ok(0, 100)], cable), 110, { kind: 'increase', increment: 10 })
  })

  it('L16: an extra set does not count', () => {
    const extra = on(0, 135, [5, 5, 5], [{ weight: 135, reps: 3, extra: true }])
    expectNext(next([extra]), 140, { kind: 'increase', increment: 5 })
    // Nor does it rescue a miss.
    const rescued = on(0, 135, [5, 5, 4], [{ weight: 135, reps: 5, extra: true }])
    expectNext(next([rescued]), 135, { kind: 'repeat' })
  })

  it('L17: a prescribed set not logged is a miss', () => {
    expectNext(next([ok(0, 135), on(2, 140, [5, 5])]), 140, { kind: 'repeat' })
  })

  it("L18: a substituted session isn't a third miss", () => {
    // A replaced session keeps its sets (here, a miss at 140); they still mustn't count.
    const replaced: ExerciseSession = { ...miss(6, 140), replaced: true }
    expectNext(next([ok(0, 135), miss(2, 140), miss(4, 140), replaced]), 140, { kind: 'repeat' })
  })

  it('L19: a reset never goes below the lightest load, and the count restarts', () => {
    const light: ExerciseConfig = {
      ...squat,
      equipment: 'cable',
      loads: [100, 110],
      seed: { weight: 100, reps: 5 },
    }
    const history = [miss(0, 100), miss(2, 100), miss(4, 100)]
    expectNext(next(history, light), 100, { kind: 'reset' })
    expectNext(next([...history, miss(6, 100)], light), 100, { kind: 'repeat' })
  })

  // L22-L23: a rep-range change keeps the weight and the miss count (no fresh start).
  const at55 = (s: ExerciseSession): ExerciseSession => ({ ...s, repRange: { min: 5, max: 5 } })
  const at33 = (s: ExerciseSession): ExerciseSession => ({ ...s, repRange: { min: 3, max: 3 } })
  const threes: ExerciseConfig = { ...squat, repRange: { min: 3, max: 3 } }
  const beforeChange = [at55(ok(0, 135)), at55(miss(2, 140)), at55(miss(4, 140))]

  it('L22: after a range change to 3-3, two misses at 140 repeat 140 x 3, with no fresh start', () => {
    expectNext(next(beforeChange, threes), 140, { kind: 'repeat' }, 3)
  })

  it('L23: L22, then a miss at 3-3 is the third in a row: reset to 125 x 3', () => {
    const history = [...beforeChange, at33(on(6, 140, [3, 3, 2]))]
    expectNext(next(history, threes), 125, { kind: 'reset' }, 3)
  })

  // L24-L30: the top of the loads.
  const stack: ExerciseConfig = { ...squat, equipment: 'cable', loads: [100, 110, 120] }
  const atTop = [ok(0, 120)]

  it('L24: 120 3x5 at the heaviest load suggests 120 x 6, top of the loads', () => {
    expectNext(next(atTop, stack), 120, { kind: 'topOfLoads' }, 6)
  })

  it('L25: L24, then 120 3x6 suggests 120 x 7', () => {
    expectNext(next([...atTop, on(2, 120, [6, 6, 6])], stack), 120, { kind: 'topOfLoads' }, 7)
  })

  it('L26: L24, then a miss at 120 x 6 repeats the raised target', () => {
    expectNext(next([...atTop, on(2, 120, [6, 6, 5])], stack), 120, { kind: 'repeat' }, 6)
  })

  it("L27: L24, then three misses reset to 100 x 5, back to the range's top", () => {
    const missed = [2, 4, 6].map((day) => on(day, 120, [6, 6, 5]))
    expectNext(next([...atTop, ...missed], stack), 100, { kind: 'reset' }, 5)
  })

  it("L28: L24 six weeks ago restarts at 100 x 5, back to the range's top", () => {
    expectNext(next(atTop, stack, 42), 100, { kind: 'break' }, 5)
  })

  it('L29: an increment past the heaviest load takes the heaviest: 110 +15 lb gives 120, +10 lb', () => {
    const big = { ...stack, progression: { scheme: 'linear', increment: 15 } } as const
    expectNext(next([ok(0, 110)], big), 120, { kind: 'increase', increment: 10 })
  })

  it('L30: L24, then a range change to 3-3 keeps the added rep: 120 x 4', () => {
    expectNext(next(atTop, { ...stack, repRange: { min: 3, max: 3 } }), 120, { kind: 'topOfLoads' }, 4)
  })

  // L31-L32: bodyweight, on added weight from 0.
  const pullUp: ExerciseConfig = {
    ...squat,
    id: 'pull-up',
    name: 'Pull-Up',
    tier: 'accessory',
    equipment: 'bodyweight',
    repRange: { min: 8, max: 8 },
    seed: { weight: 0, reps: 8 },
  }

  it('L31: a pull-up at 0 added, 3x8, suggests 5 x 8, +5 lb', () => {
    expectNext(next([on(0, 0, [8, 8, 8])], pullUp), 5, { kind: 'increase', increment: 5 }, 8)
  })

  it('L32: a pull-up missed three times at 0 resets to 0 x 8', () => {
    const missed = [0, 2, 4].map((day) => on(day, 0, [8, 8, 7]))
    expectNext(next(missed, pullUp), 0, { kind: 'reset' }, 8)
  })
})

describe('Linear details', () => {
  it('asks for starting numbers with no seed and no history', () => {
    expect(next([], { ...squat, seed: undefined })).toEqual({ kind: 'needsSeed' })
  })

  it('judges a session by its first set weight, and goes on from the weight lifted', () => {
    expectNext(next([ok(0, 135), ok(2, 145)]), 150, { kind: 'increase', increment: 5 })
  })

  it('judges a past session by its own saved rep range (SPEC §6.8)', () => {
    // Saved as 3 sets of 3 (range 3–3); the exercise is 5–5 now.
    const saved: ExerciseSession = { ...on(0, 135, [3, 3, 3]), repRange: { min: 3, max: 3 } }
    expectNext(next([saved]), 140, { kind: 'increase', increment: 5 })
  })

  it('clears the miss count after a break', () => {
    // Two misses at 125, then six weeks off: the next miss at 125 is the first, not a reset.
    const history = [ok(0, 140), miss(2, 125), miss(4, 125)]
    expectNext(next(history, squat, 46), 125, { kind: 'break' })
    expectNext(next([...history, miss(46, 125)]), 125, { kind: 'repeat' })
  })

  it('with no loads to snap to, adds the exact increment and never reaches a top of the loads', () => {
    const noStack: ExerciseConfig = { ...squat, equipment: 'cable' }
    expectNext(next([ok(0, 100)], noStack), 105, { kind: 'increase', increment: 5 })
  })

  it('at or above the heaviest load, stays at the weight lifted and adds a rep', () => {
    const stack: ExerciseConfig = { ...squat, equipment: 'cable', loads: [100, 110, 120] }
    expectNext(next([ok(0, 125)], stack), 125, { kind: 'topOfLoads' }, 6)
  })

  it('takes the added reps off when a heavier load is added', () => {
    // History replays under the current loads, so 120 is no longer the top: 130 at the range's top.
    const history = [ok(0, 120), on(2, 120, [6, 6, 6])]
    const more: ExerciseConfig = { ...squat, equipment: 'cable', loads: [100, 110, 120, 130] }
    expectNext(next(history, more), 130, { kind: 'increase', increment: 10 })
  })

  it('takes the added reps off after a break, even once sessions resume', () => {
    const stack: ExerciseConfig = { ...squat, equipment: 'cable', loads: [100, 110, 120] }
    // 120 x 6 is pending; six weeks off, then 100 3x5 succeeds at the range's top.
    expectNext(next([ok(0, 120), ok(42, 100)], stack), 110, { kind: 'increase', increment: 10 })
  })

  it('validates against the added rep target', () => {
    const stack: ExerciseConfig = { ...squat, equipment: 'cable', loads: [100, 110, 120] }
    const fives = [120, 120, 120].map((weight) => ({ weight, reps: 5 }))
    expect(linear.evaluate(stack, [ok(0, 120)], fives).result).toBe('fail')
    const sixes = fives.map((s) => ({ ...s, reps: 6 }))
    expect(linear.evaluate(stack, [ok(0, 120)], sixes).result).toBe('success')
  })

  it('gives no message and no stacks when validating', () => {
    expect(linear.evaluate(squat, [], [{ weight: 135, reps: 5 }])).toMatchObject({ result: 'fail' })
    const sets = [135, 135, 135].map((weight) => ({ weight, reps: 5 }))
    const outcome = linear.evaluate(squat, [], sets)
    expect(outcome).toMatchObject({ result: 'success', state: { stacks: 0 } })
    expect(outcome.message).toBeUndefined()
  })

  it('is the scheme of an exercise set to Linear, and has no e1RM', () => {
    expect(schemeFor(squat)).toBe(linear)
    expect(linear.usesLiftE1rm).toBe(false)
  })
})
