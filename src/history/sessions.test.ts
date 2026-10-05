import { describe, expect, it } from 'vitest'
import type { Session } from '../session/types'
import { exerciseHistory, lastLoggedDayId } from './sessions'

describe('exerciseHistory', () => {
  it('includes finished sessions only, mapped to the engine shape', () => {
    const sessions: Session[] = [
      {
        id: 1,
        startedAt: '2026-10-01T10:00:00Z',
        finishedAt: '2026-10-01T11:00:00Z',
        exercises: [{ exerciseId: 'bench', sets: [{ weight: 225, reps: 4, rpe: 8 }] }],
      },
      {
        id: 2,
        startedAt: '2026-10-04T10:00:00Z',
        exercises: [{ exerciseId: 'bench', sets: [{ weight: 235, reps: 4, rpe: 8 }] }],
      },
    ]
    expect(exerciseHistory(sessions, 'bench')).toEqual([
      { date: '2026-10-01T10:00:00Z', sets: [{ weight: 225, reps: 4, rpe: 8 }] },
    ])
  })

  describe('before a session (SPEC §9.2, slice 1)', () => {
    const finished = (id: number, startedAt: string, weight: number): Session => ({
      id,
      startedAt,
      finishedAt: startedAt,
      exercises: [{ exerciseId: 'bench', sets: [{ weight, reps: 4, rpe: 8 }] }],
    })
    const first = finished(1, '2026-10-01T10:00:00Z', 225)
    const middle = finished(2, '2026-10-04T10:00:00Z', 230)
    const last = finished(3, '2026-10-08T10:00:00Z', 235)
    const weights = (before?: Session) =>
      exerciseHistory([last, first, middle], 'bench', before).map((h) => h.sets[0].weight)

    it('leaves out the session itself and every later one', () => {
      expect(weights(middle)).toEqual([225])
    })

    it('is empty before the first session', () => {
      expect(weights(first)).toEqual([])
    })

    it('leaves out another session that started at the same moment', () => {
      const twin = finished(4, middle.startedAt, 999)
      expect(exerciseHistory([first, middle, twin], 'bench', middle).map((h) => h.sets[0].weight)).toEqual([
        225,
      ])
    })

    it('is the full history without it', () => {
      expect(weights()).toEqual([235, 225, 230])
    })
  })
})

describe('lastLoggedDayId', () => {
  const session = (id: number, dayId: string | undefined, startedAt: string, finished = true): Session => ({
    id,
    dayId,
    startedAt,
    finishedAt: finished ? startedAt : undefined,
    exercises: [],
  })

  it('is the day of the most recent finished session', () => {
    expect(
      lastLoggedDayId([
        session(2, 'upper-b', '2026-10-03T10:00:00Z'),
        session(1, 'upper-a', '2026-10-01T10:00:00Z'),
        session(3, 'lower-b', '2026-10-04T10:00:00Z', false),
        session(4, undefined, '2026-10-04T11:00:00Z'),
      ]),
    ).toBe('upper-b')
  })

  it('is undefined with nothing logged', () => {
    expect(lastLoggedDayId([])).toBeUndefined()
  })
})

describe('exerciseHistory with the exercise menu (SPEC §5.2)', () => {
  const finished = (exercises: Session['exercises']): Session => ({
    id: 1,
    startedAt: '2026-10-01T10:00:00Z',
    finishedAt: '2026-10-01T11:00:00Z',
    exercises,
  })

  it('flags replaced sessions (so the engine skips them, A6) and keeps the substitute', () => {
    const substitute = { name: 'Machine press', sets: [{ weight: 150, reps: 10 }] }
    expect(exerciseHistory([finished([{ exerciseId: 'bench', sets: [], substitute }])], 'bench')).toEqual([
      { date: '2026-10-01T10:00:00Z', sets: [], replaced: true, substitute },
    ])
  })

  it('leaves skipped exercises out', () => {
    expect(exerciseHistory([finished([{ exerciseId: 'bench', sets: [], skipped: true }])], 'bench')).toEqual(
      [],
    )
  })
})
