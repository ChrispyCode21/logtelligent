import { describe, expect, it } from 'vitest'
import { suggestNext, type LoggedSet } from '../engine'
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

describe('7.I Lifts (SPEC §9.4 slice 2)', () => {
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

describe('I6 and editing, through the replay (SPEC §9.4 slice 2)', () => {
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

describe('lift helpers (SPEC §9.4 slice 2)', () => {
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

describe('History by lift (SPEC §5.3, §9.4 slice 2)', () => {
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

describe('changing programs (SPEC §9.4 slice 3)', () => {
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
