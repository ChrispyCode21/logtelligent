import { describe, expect, it } from 'vitest'
import type { Session } from './db'
import { exerciseHistory, lastLoggedDayId } from './history'

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
