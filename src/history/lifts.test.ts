import { describe, expect, it } from 'vitest'
import { linear, runningE1rm, suggestNext, type LoggedSet } from '../engine'
import { liftKey } from '../program/lifts'
import { sessionExercises } from '../session/context'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import {
  latestInLift,
  liftsWithHistory,
  needsStartingNumbers,
  otherLiftSessions,
  programChange,
  startingNumbersStep,
  suggestFor,
  withLiftGym,
} from './lifts'
import { historyGroups } from './picker'
import { exerciseHistory } from './sessions'
import { liftTimeline } from './timeline'

const exercise = (id: string, name: string, over: Partial<ProgramExercise> = {}): ProgramExercise => ({
  id,
  name,
  tier: 'primary',
  repRange: { min: 3, max: 5 },
  targetRpe: 8,
  sets: 3,
  equipment: 'barbell',
  maxRelativeJump: 0.1,
  unilateral: false,
  ...over,
})

const benchA = exercise('bench-a', 'Bench Press', { seed: { weight: 225, reps: 5 } })
const benchB = exercise('bench-b', 'bench-press', {
  repRange: { min: 10, max: 12 },
  seed: { weight: 185, reps: 12 },
})
const raise = exercise('raise', 'Lateral Raise', {
  tier: 'accessory',
  equipment: 'cable',
  loads: [10, 15, 20],
  unilateral: true,
  repRange: { min: 15, max: 20 },
  seed: { weight: 15, reps: 15 },
})

const program = (...extra: ProgramExercise[]): Program => ({
  id: 'main',
  effortScale: 'rpe',
  days: [
    { id: 'upper-a', name: 'Upper A', exercises: [benchA, raise, ...extra] },
    { id: 'upper-b', name: 'Upper B', exercises: [benchB] },
  ],
})

const firstRpe = (weight: number, reps: number[]): LoggedSet[] =>
  reps.map((r, i) => (i === 0 ? { weight, reps: r, rpe: 8 } : { weight, reps: r }))

const asOf = new Date('2026-10-08T12:00:00Z')
let nextId = 1
const finished = (dayId: string, day: number, exerciseId: string, sets: LoggedSet[]): Session => {
  const startedAt = `2026-10-0${day}T10:00:00.000Z`
  return { id: nextId++, dayId, startedAt, finishedAt: startedAt, exercises: [{ exerciseId, sets }] }
}

const heavy = finished('upper-a', 1, 'bench-a', firstRpe(225, [5, 5, 5]))
const light = finished('upper-b', 3, 'bench-b', firstRpe(185, [12, 12, 12]))

describe('7.I Lifts (SPEC §6.9)', () => {
  it('I4: a new primary with no starting numbers joining a lift with history is not blocked, and suggests 230 x 4', () => {
    const newBench = exercise('bench-c', 'Bench Press')
    const p = program(newBench)
    expect(needsStartingNumbers(p, [heavy, light]).map((e) => e.id)).toEqual([])
    const s = suggestNext(newBench, [], asOf, otherLiftSessions(p, [heavy, light], newBench))
    expect(s).toMatchObject({ kind: 'suggestion', weight: 230, reps: 4 })
  })

  it('I4: without history in the lift the seed gate still asks (A12)', () => {
    expect(needsStartingNumbers(program(exercise('bench-c', 'Bench Press')), []).map((e) => e.id)).toEqual([
      'bench-c',
    ])
  })

  it('I7: case, punctuation and spacing are ignored; a different name is a different lift', () => {
    expect(liftKey('Bench Press')).toBe(liftKey('bench-press'))
    expect(liftKey('BENCH  PRESS')).toBe(liftKey('Bench Press'))
    expect(liftKey('Paused Bench')).not.toBe(liftKey('Bench Press'))
  })
})

describe('I6 and editing, through the replay (SPEC §6.9)', () => {
  it("I6: the other exercise's deload week comes back marked by its own replay, and stays out of the e1RM", () => {
    // Upper B: a success, two fails (deload due), then the deload week at RPE 6.
    const b = [
      finished('upper-b', 1, 'bench-b', firstRpe(185, [12, 12, 12])),
      finished('upper-b', 2, 'bench-b', firstRpe(195, [9, 9, 8])),
      finished('upper-b', 3, 'bench-b', firstRpe(185, [9, 9, 9])),
      finished('upper-b', 4, 'bench-b', [
        { weight: 165, reps: 12, rpe: 6 },
        { weight: 165, reps: 12 },
      ]),
    ]
    const benchA0 = { ...benchA, seed: undefined }
    const other = otherLiftSessions(program(), b, benchA0)
    expect(other.map((s) => !!s.isDeload)).toEqual([false, false, false, true])
    const withFlags = suggestNext(benchA0, [], asOf, other)
    const withoutDeload = suggestNext(benchA0, [], asOf, other.slice(0, 3))
    expect(withFlags).toEqual(withoutDeload)
    // A new exercise in the lift copies the latest exercise's setup, but not the deload week's weight.
    expect(latestInLift(program(), b, 'Bench Press')).toEqual({ exercise: benchB, weight: 185 })
  })

  it("editing a finished session ignores the other exercise's later sessions", () => {
    // Upper A on the 1st, Upper B on the 3rd: as of the 1st, the lift had only the seed.
    const [bench] = sessionExercises(heavy, program(), [heavy, light], asOf)
    expect(bench.suggestion).toMatchObject({ kind: 'suggestion', e1rm: { basis: 'seed' } })
  })
})

describe('lift helpers (SPEC §6.9)', () => {
  it("passes the other exercises' sessions, not this one's", () => {
    const other = otherLiftSessions(program(), [heavy, light], benchA)
    expect(other.map((s) => s.sessionId)).toEqual([light.id])
  })

  it('an accessory still needs starting numbers, whatever its lift has', () => {
    const newRaise = exercise('raise-2', 'Lateral Raise', { tier: 'accessory' })
    const logged = finished('upper-a', 2, 'raise', [{ weight: 15, reps: 18 }])
    expect(needsStartingNumbers(program(newRaise), [logged]).map((e) => e.id)).toEqual(['raise-2'])
  })

  it("finds the lift's latest weight and exercise, and copies its gym setup", () => {
    const later = finished('upper-a', 5, 'raise', [{ weight: 20, reps: 15 }])
    const p = program()
    expect(
      latestInLift(p, [finished('upper-a', 2, 'raise', [{ weight: 15, reps: 18 }]), later], 'lateral raise'),
    ).toEqual({
      exercise: raise,
      weight: 20,
    })
    const fromBank = exercise('new', 'Lateral Raise', {
      tier: 'accessory',
      equipment: 'dumbbell',
      unilateral: false,
    })
    expect(withLiftGym(fromBank, raise)).toMatchObject({
      equipment: 'cable',
      loads: [10, 15, 20],
      unilateral: true,
    })
    expect(withLiftGym(fromBank, undefined)).toBe(fromBank)
  })

  it('a primary never copies bodyweight equipment', () => {
    const dips = exercise('dips', 'Dip', { tier: 'accessory', equipment: 'bodyweight' })
    const primaryDip = exercise('dip-2', 'Dip')
    expect(withLiftGym(primaryDip, dips)).toBe(primaryDip)
  })

  it('names the lifts with history once each, in order', () => {
    expect(liftsWithHistory(program(), [heavy], ['Back Squat', 'Bench Press', 'BENCH PRESS'])).toEqual([
      'Bench Press',
    ])
  })
})

describe('History by lift (SPEC §5.3, §6.9)', () => {
  it('lists a lift once, under the first day it is on', () => {
    const groups = historyGroups(program(), [heavy, light])
    expect(groups.map((g) => [g.label, g.exercises.map((e) => e.id)])).toEqual([
      ['Upper A', ['bench-a', 'raise']],
    ])
  })

  it("shows every day's sessions of the lift, newest first, tagged with the day", () => {
    const entries = liftTimeline(program(), [heavy, light], 'Bench Press')
    expect(entries.map((e) => [e.sessionId, e.dayName, e.highReps])).toEqual([
      [light.id, 'Upper B', true],
      [heavy.id, 'Upper A', false],
    ])
  })

  it('an archived exercise in a lift with an active one stays under the active one', () => {
    const p = program()
    const archivedB: Program = {
      ...p,
      days: [p.days[0], { ...p.days[1], archived: true }],
    }
    expect(historyGroups(archivedB, [heavy, light]).map((g) => g.label)).toEqual(['Upper A'])
    expect(liftTimeline(archivedB, [heavy, light], 'Bench Press')).toHaveLength(2)
    expect(exerciseHistory([heavy, light], 'bench-b')).toHaveLength(1)
  })
})

describe('changing programs (SPEC §5.5)', () => {
  it('keeps lifts with finished history, discards every open session, and counts its sets', () => {
    const open: Session = {
      id: 900,
      dayId: 'upper-b',
      startedAt: '2026-10-08T10:00:00.000Z',
      exercises: [
        { exerciseId: 'bench-b', sets: firstRpe(185, [12, 12]) },
        {
          exerciseId: 'raise',
          sets: [],
          substitute: { name: 'Cable raise', sets: [{ weight: 10, reps: 15 }] },
        },
      ],
    }
    const change = programChange(program(), [heavy, open])
    expect(change.keptLifts).toEqual(['Bench Press'])
    expect(change.open).toEqual({ session: open, sets: 3 })
    expect(change.discardIds).toEqual([900])
  })

  it('a day whose only sets are in the open session is deleted, not archived', () => {
    const open: Session = {
      id: 901,
      dayId: 'upper-b',
      startedAt: '2026-10-08T10:00:00.000Z',
      exercises: [{ exerciseId: 'bench-b', sets: firstRpe(185, [12]) }],
    }
    const change = programChange(program(), [heavy, open])
    expect(change.dayHasHistory('upper-a')).toBe(true)
    expect(change.dayHasHistory('upper-b')).toBe(false)
  })

  it('with no open session, nothing is discarded', () => {
    const change = programChange(program(), [heavy, light])
    expect(change.open).toBeUndefined()
    expect(change.discardIds).toEqual([])
  })
})

describe('7.L Linear, through History (SPEC §6.10)', () => {
  const squat = {
    ...exercise('squat', 'Squat', { repRange: { min: 5, max: 5 } }),
    progression: { scheme: 'linear', increment: 5 },
  } as ProgramExercise
  const threeSets = (weight: number, reps: number) => [0, 1, 2].map(() => ({ weight, reps }))

  it('L20: a Linear primary on a lift with an e1RM of 273.6 needs no starting numbers and starts at 215 x 5', () => {
    const oldSquat = exercise('squat-old', 'Squat', { seed: { weight: 225, reps: 5 } })
    const p = program(squat, oldSquat)
    const logged = finished('upper-a', 1, 'squat-old', firstRpe(225, [5, 5, 5]))
    expect(needsStartingNumbers(p, [logged])).toEqual([])
    const lift = otherLiftSessions(p, [logged], squat)
    expect(runningE1rm(lift, undefined, asOf)?.value).toBeCloseTo(273.6, 1)
    const start = {
      kind: 'suggestion',
      scheme: 'linear',
      weight: 215,
      reps: 5,
      sets: 3,
      reason: { kind: 'start' },
    }
    expect(linear.suggest(squat, [], asOf, lift)).toEqual(start)
    // A seed is left unused.
    expect(linear.suggest({ ...squat, seed: { weight: 135, reps: 5 } }, [], asOf, lift)).toEqual(start)
  })

  it('a Linear accessory on a lift with an e1RM still needs a starting weight', () => {
    const curl = { ...squat, tier: 'accessory' } as ProgramExercise
    const oldSquat = exercise('squat-old', 'Squat', { seed: { weight: 225, reps: 5 } })
    const logged = finished('upper-a', 1, 'squat-old', firstRpe(225, [5, 5, 5]))
    expect(needsStartingNumbers(program(curl, oldSquat), [logged]).map((e) => e.id)).toEqual(['squat'])
  })

  it("L21: each exercise's deloads are marked by its own scheme, and Adaptive's are as before", () => {
    const p = program(squat)
    const sessions = [
      finished('upper-a', 1, 'squat', threeSets(140, 4)),
      finished('upper-a', 2, 'squat', threeSets(140, 4)),
      finished('upper-a', 3, 'squat', threeSets(140, 4)),
      finished('upper-a', 4, 'squat', threeSets(125, 5)),
      // Adaptive: a success, two fails, then the deload week (as in I6).
      finished('upper-b', 1, 'bench-b', firstRpe(185, [12, 12, 12])),
      finished('upper-b', 2, 'bench-b', firstRpe(195, [9, 9, 8])),
      finished('upper-b', 3, 'bench-b', firstRpe(185, [9, 9, 9])),
      finished('upper-b', 4, 'bench-b', [
        { weight: 165, reps: 12, rpe: 6 },
        { weight: 165, reps: 12 },
      ]),
    ]
    const squats = liftTimeline(p, sessions, 'Squat')
    expect(squats.map((t) => t.isDeload)).toEqual([true, false, false, false])
    expect(squats.every((t) => t.e1rm === undefined)).toBe(true)
    const benches = liftTimeline(p, sessions, 'Bench Press')
    expect(benches.map((t) => t.isDeload)).toEqual([true, false, false, false])
  })

  it("feeds the lift's e1RM from a Linear session with effort logged, though History shows none", () => {
    const adaptiveSquat = exercise('squat-b', 'Squat', { seed: { weight: 135, reps: 5 } })
    const p = program(squat, adaptiveSquat)
    const logged = finished('upper-a', 1, 'squat', firstRpe(225, [4, 4, 4]))
    // 225 x 4 @8 is A1's 266.8.
    const lift = otherLiftSessions(p, [logged], adaptiveSquat)
    expect(runningE1rm(lift, undefined, asOf)?.value).toBeCloseTo(266.8, 1)
    expect(liftTimeline(p, [logged], 'Squat')[0].e1rm).toBeUndefined()
  })

  it("feeds the lift's e1RM from neither a Linear deload session nor one with no effort logged", () => {
    const adaptiveSquat = exercise('squat-b', 'Squat', { seed: { weight: 135, reps: 5 } })
    const p = program(squat, adaptiveSquat)
    // Three misses with no effort logged reset to 125; the 125 session, with effort, is a deload.
    const sessions = [
      finished('upper-a', 1, 'squat', threeSets(140, 4)),
      finished('upper-a', 2, 'squat', threeSets(140, 4)),
      finished('upper-a', 3, 'squat', threeSets(140, 4)),
      finished('upper-a', 4, 'squat', firstRpe(125, [5, 5, 5])),
    ]
    const lift = otherLiftSessions(p, sessions, adaptiveSquat)
    expect(lift.map((s) => !!s.isDeload)).toEqual([false, false, false, true])
    expect(runningE1rm(lift, undefined, asOf)).toBeUndefined()
  })

  it('L34: a Linear 12-12 session is high-rep, so a lower-rep one in the window is used instead', () => {
    const highSquat = {
      ...exercise('squat-high', 'Squat', { repRange: { min: 12, max: 12 } }),
      progression: { scheme: 'linear', increment: 5 },
    } as ProgramExercise
    const adaptiveSquat = exercise('squat-b', 'Squat', { seed: { weight: 135, reps: 5 } })
    const p = program(squat, highSquat, adaptiveSquat)
    const sessions = [
      finished('upper-a', 1, 'squat', firstRpe(225, [5, 5, 5])),
      finished('upper-a', 2, 'squat-high', firstRpe(185, [12, 12, 12])),
    ]
    // 225 x 5 @8 is 273.6; 185 x 12 @8 (267.3) is skipped, as in I1.
    const lift = otherLiftSessions(p, sessions, adaptiveSquat)
    expect(runningE1rm(lift, undefined, asOf)?.value).toBeCloseTo(273.6, 1)
  })
})

describe('7.L Linear, shared across days (SPEC §6.10)', () => {
  const linear = (increment = 5) => ({ scheme: 'linear', increment }) as const
  const squatA = exercise('squat-a', 'Back Squat', {
    repRange: { min: 5, max: 5 },
    seed: { weight: 95, reps: 5 },
    progression: linear(),
  })
  const squatB = exercise('squat-b', 'Back Squat', { repRange: { min: 5, max: 5 }, progression: linear() })
  const novice = (a: ProgramExercise = squatA, b: ProgramExercise = squatB): Program => ({
    id: 'main',
    effortScale: 'rpe',
    days: [
      { id: 'workout-a', name: 'Workout A', exercises: [a] },
      { id: 'workout-b', name: 'Workout B', exercises: [b] },
    ],
  })
  const sets = (weight: number, reps: number[]) => reps.map((r) => ({ weight, reps: r }))
  const dayOf = (id: string) => (id === 'squat-a' ? 'workout-a' : 'workout-b')
  const ok = (day: number, id: string, weight: number) =>
    finished(dayOf(id), day, id, sets(weight, [5, 5, 5]))
  const miss = (day: number, id: string, weight: number) =>
    finished(dayOf(id), day, id, sets(weight, [5, 5, 4]))
  const next = (p: Program, sessions: Session[], e: ProgramExercise) => suggestFor(p, sessions, e, asOf)
  const expectNext = (s: ReturnType<typeof next>, weight: number, reason: object) =>
    expect(s).toMatchObject({ kind: 'suggestion', scheme: 'linear', weight, reps: 5, reason })

  it('L36: with no history, B needs no starting numbers and both suggest 95 x 5', () => {
    const p = novice()
    expect(needsStartingNumbers(p, [])).toEqual([])
    expectNext(next(p, [], squatA), 95, { kind: 'start' })
    expectNext(next(p, [], squatB), 95, { kind: 'start' })
  })

  it("counts a group's shared starting numbers as one walkthrough step", () => {
    const unseeded = novice({ ...squatA, seed: undefined })
    expect(startingNumbersStep(unseeded, [])).toEqual({ step: 1, of: 1 })
    const withBench = { ...unseeded, days: [...unseeded.days, { id: 'c', name: 'C', exercises: [benchA] }] }
    // The bench already has its starting numbers, so the squat is step 2 of 2.
    expect(startingNumbersStep(withBench, [])).toEqual({ step: 2, of: 2 })
  })

  it('L37: A 95 3x5, then B suggests 100 x 5, +5 lb', () => {
    expectNext(next(novice(), [ok(1, 'squat-a', 95)], squatB), 100, { kind: 'increase', increment: 5 })
  })

  it('L38: A 95, B 100, A 105, all 3x5, then B and A both suggest 110 x 5', () => {
    const logged = [ok(1, 'squat-a', 95), ok(2, 'squat-b', 100), ok(3, 'squat-a', 105)]
    expectNext(next(novice(), logged, squatB), 110, { kind: 'increase', increment: 5 })
    expectNext(next(novice(), logged, squatA), 110, { kind: 'increase', increment: 5 })
  })

  it('L39: A, B, A each miss at 95, then B resets to 85 x 5: misses count across both', () => {
    const logged = [miss(1, 'squat-a', 95), miss(2, 'squat-b', 95), miss(3, 'squat-a', 95)]
    expectNext(next(novice(), logged, squatB), 85, { kind: 'reset' })
  })

  it('L40: L39, then B 85 3x5: A suggests 90 x 5, and History marks that B session as the deload, on B', () => {
    const reset = ok(4, 'squat-b', 85)
    const logged = [miss(1, 'squat-a', 95), miss(2, 'squat-b', 95), miss(3, 'squat-a', 95), reset]
    expectNext(next(novice(), logged, squatA), 90, { kind: 'increase', increment: 5 })
    const timeline = liftTimeline(novice(), logged, 'Back Squat')
    expect(timeline.map((e) => [e.sessionId, e.exerciseId, e.isDeload])).toEqual([
      [reset.id, 'squat-b', true],
      [logged[2].id, 'squat-a', false],
      [logged[1].id, 'squat-b', false],
      [logged[0].id, 'squat-a', false],
    ])
  })

  it('L41: B on 5 x 5 progresses apart: after A 95 3x5, B suggests its own 95 x 5 and A 100 x 5', () => {
    const fiveByFive = { ...squatB, sets: 5, seed: { weight: 95, reps: 5 } }
    const p = novice(squatA, fiveByFive)
    const logged = [ok(1, 'squat-a', 95)]
    expect(next(p, logged, fiveByFive)).toMatchObject({ weight: 95, sets: 5, reason: { kind: 'start' } })
    expectNext(next(p, logged, squatA), 100, { kind: 'increase', increment: 5 })
  })

  it("L42: B's increase is +10 lb: after A 95 3x5, B suggests 105 x 5 and A 100 x 5", () => {
    const plusTen = { ...squatB, progression: linear(10) }
    const p = novice(squatA, plusTen)
    const logged = [ok(1, 'squat-a', 95)]
    expectNext(next(p, logged, plusTen), 105, { kind: 'increase', increment: 10 })
    expectNext(next(p, logged, squatA), 100, { kind: 'increase', increment: 5 })
  })

  it('shares with an archived exercise of the same prescription, so a new program carries on', () => {
    const fresh = { ...squatB, id: 'squat-new' }
    const p: Program = {
      ...novice(),
      days: [
        { id: 'workout-a', name: 'Workout A', archived: true, exercises: [{ ...squatA, archived: true }] },
        { id: 'new', name: 'New', exercises: [fresh] },
      ],
    }
    expectNext(next(p, [ok(1, 'squat-a', 95)], fresh), 100, { kind: 'increase', increment: 5 })
  })

  it('leaves Adaptive exercises on their own', () => {
    const adaptiveB = exercise('squat-b', 'Back Squat', { repRange: { min: 5, max: 5 } })
    const p = novice(squatA, adaptiveB)
    expect(needsStartingNumbers(p, []).map((e) => e.id)).toEqual(['squat-b'])
    const seeded = { ...adaptiveB, seed: { weight: 95, reps: 5 } }
    expect(next(novice(squatA, seeded), [ok(1, 'squat-a', 95)], seeded)).not.toHaveProperty('scheme')
  })
})
