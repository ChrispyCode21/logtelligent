import { describe, expect, it } from 'vitest'
import type { ExerciseConfig, LoggedSet } from '../engine'
import { exerciseTimeline } from './timeline'

const bench: ExerciseConfig = {
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
}

const sets = (weight: number, reps: number[], rpe = 8): LoggedSet[] =>
  reps.map((r, i) => (i === 0 ? { weight, reps: r, rpe } : { weight, reps: r }))

const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}T10:00:00Z`

/** A finished session on day n of the month; its id is n. */
const on = (n: number, logged: LoggedSet[]) => ({ sessionId: n, date: day(n), sets: logged })

describe('exerciseTimeline (SPEC §5.3)', () => {
  it('lists sessions newest first with each session e1RM; deloads are tagged with no e1RM', () => {
    const history = [
      on(1, sets(225, [5, 4, 3])),
      on(8, sets(235, [4, 3, 2])),
      on(15, sets(225, [4, 3, 2])),
      on(22, sets(200, [4, 4], 6)),
    ]
    const timeline = exerciseTimeline(bench, history)
    expect(timeline.map((t) => [t.sessionId, t.date, t.isDeload])).toEqual([
      [22, day(22), true],
      [15, day(15), false],
      [8, day(8), false],
      [1, day(1), false],
    ])
    expect(timeline[0].e1rm).toBeUndefined()
    expect(timeline[3].e1rm).toBeCloseTo(273.6, 1)
  })

  it('gives accessories no e1RM', () => {
    const curl = { ...bench, tier: 'accessory' as const, repRange: { min: 8, max: 12 } }
    expect(exerciseTimeline(curl, [on(1, sets(30, [12, 10]))])[0].e1rm).toBeUndefined()
  })
})

describe('exerciseTimeline with a replaced session (SPEC §5.2)', () => {
  it('shows the substitute with no e1RM, and the replaced session does not count for progression', () => {
    const substitute = { name: 'Machine press', sets: [{ weight: 150, reps: 10 }] }
    const timeline = exerciseTimeline(bench, [
      on(1, sets(225, [5, 4, 3])),
      { ...on(8, sets(235, [4])), replaced: true, substitute },
    ])
    expect(timeline[0]).toMatchObject({ sessionId: 8, date: day(8), substitute, e1rm: undefined })
    expect(timeline[1].e1rm).toBeCloseTo(273.6, 1)
  })
})
