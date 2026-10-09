import { describe, expect, it } from 'vitest'
import type { LoggedSet } from '../engine'
import type { Program } from '../program/types'
import { sessionExercises } from './context'
import { shownTarget, targetSets } from './sets'
import type { Session } from './types'

const program: Program = {
  id: 'main',
  effortScale: 'rpe',
  days: [
    {
      id: 'upper-a',
      name: 'Upper A',
      exercises: [
        {
          id: 'bench',
          name: 'Bench Press',
          tier: 'primary',
          repRange: { min: 3, max: 5 },
          targetRpe: 8,
          sets: 3,
          equipment: 'barbell',
          maxRelativeJump: 0.1,
          unilateral: false,
          seed: { weight: 225, reps: 5 },
        },
      ],
    },
  ],
}

const sets = (weight: number, reps: number[]): LoggedSet[] =>
  reps.map((r, i) => (i === 0 ? { weight, reps: r, rpe: 8 } : { weight, reps: r }))

const session = (id: number, day: number, logged: LoggedSet[], finished = true): Session => {
  const startedAt = `2026-09-${String(day).padStart(2, '0')}T10:00:00.000Z`
  return {
    id,
    dayId: 'upper-a',
    startedAt,
    finishedAt: finished ? startedAt : undefined,
    exercises: [{ exerciseId: 'bench', sets: logged }],
  }
}

const first = session(1, 1, sets(225, [5, 4, 4]))
const middle = session(2, 8, sets(230, [5, 4, 3]))
const last = session(3, 15, sets(235, [4, 4, 3]))
const now = new Date('2026-10-05T10:00:00.000Z')

describe('the exercises of a session and what they are judged against (SPEC §9.2, slice 1)', () => {
  it('judges a live session against every finished session', () => {
    const live = session(4, 22, [], false)
    const [bench] = sessionExercises(live, program, [first, middle, last, live], now)
    expect(bench.history.map((h) => h.sessionId)).toEqual([1, 2, 3])
  })

  it('judges a finished session only against the sessions before it, not itself or later ones', () => {
    const [bench] = sessionExercises(middle, program, [first, middle, last], now)
    expect(bench.history.map((h) => h.sessionId)).toEqual([1])
  })

  it("suggests what applied when a finished session started, not today's numbers", () => {
    const [then] = sessionExercises(middle, program, [first, middle, last], now)
    const [today] = sessionExercises(session(4, 22, [], false), program, [first, middle, last], now)
    expect(then.suggestion).not.toEqual(today.suggestion)
    expect(then.suggestion).toEqual(
      sessionExercises(session(5, 8, [], false), program, [first], new Date(middle.startedAt))[0].suggestion,
    )
  })

  it('judges a finished session by its saved prescription, not today’s settings (SPEC §9.4 slice 1)', () => {
    const changed: Program = {
      ...program,
      days: [
        {
          ...program.days[0],
          exercises: [{ ...program.days[0].exercises[0], repRange: { min: 8, max: 12 }, sets: 4 }],
        },
      ],
    }
    const prescribed: Session = {
      ...middle,
      exercises: [{ ...middle.exercises[0], prescription: { repRange: { min: 3, max: 5 }, sets: 3 } }],
    }
    const [bench] = sessionExercises(prescribed, changed, [first, prescribed, last], now)
    expect(bench.config.repRange).toEqual({ min: 3, max: 5 })
    expect(bench.config.sets).toBe(3)
    expect(bench.suggestion).toMatchObject({ sets: 3 })
    // Without one, today's settings, as before v1.3.0.
    expect(sessionExercises(middle, changed, [first, middle, last], now)[0].config.sets).toBe(4)
  })

  it('judges a live session by today’s settings, even if it carries a prescription', () => {
    const live: Session = {
      ...session(4, 22, [], false),
      exercises: [{ exerciseId: 'bench', sets: [], prescription: { repRange: { min: 5, max: 7 }, sets: 2 } }],
    }
    expect(sessionExercises(live, program, [first, live], now)[0].config.repRange).toEqual({ min: 3, max: 5 })
  })

  it('counts a finished deload week against its halved prescription: 2 of 2 from 3 prescribed', () => {
    const failed = (id: number, day: number) => ({
      ...session(id, day, sets(235, [4, 3, 2])),
      exercises: [
        {
          exerciseId: 'bench',
          sets: sets(235, [4, 3, 2]),
          prescription: { repRange: { min: 3, max: 5 }, sets: 3 },
        },
      ],
    })
    const deload: Session = {
      ...session(4, 22, sets(205, [4, 4])),
      exercises: [
        {
          exerciseId: 'bench',
          sets: sets(205, [4, 4]),
          prescription: { repRange: { min: 3, max: 5 }, sets: 3 },
        },
      ],
    }
    const all = [first, failed(2, 8), failed(3, 15), deload]
    const [bench] = sessionExercises(deload, program, all, now)
    expect(bench.suggestion).toMatchObject({ plan: 'deload', sets: 2 })
    expect(targetSets(bench.log, bench.config.sets, bench.suggestion)).toBe(2)
    expect(shownTarget(bench.log, true, 2)).toBe(2)
  })

  it('judges earlier unsaved sessions by today’s range, as History does, not the edited session’s', () => {
    const changed: Program = {
      ...program,
      days: [
        {
          ...program.days[0],
          exercises: [{ ...program.days[0].exercises[0], repRange: { min: 8, max: 12 } }],
        },
      ],
    }
    const prescribed: Session = {
      ...last,
      exercises: [{ ...last.exercises[0], prescription: { repRange: { min: 3, max: 5 }, sets: 3 } }],
    }
    const [bench] = sessionExercises(prescribed, changed, [first, middle, prescribed], now)
    expect(bench.history.map((h) => h.repRange)).toEqual([
      { min: 8, max: 12 },
      { min: 8, max: 12 },
    ])
  })

  it('leaves out exercises no longer in the program', () => {
    const gone = { ...middle, exercises: [...middle.exercises, { exerciseId: 'deleted', sets: [] }] }
    expect(sessionExercises(gone, program, [first, gone], now).map((e) => e.config.id)).toEqual(['bench'])
  })
})
