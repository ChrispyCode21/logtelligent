import { describe, expect, it } from 'vitest'
import type { Session } from './db'
import { exerciseHistory } from './history'

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
