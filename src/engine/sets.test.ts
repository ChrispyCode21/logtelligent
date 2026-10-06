import { describe, expect, it } from 'vitest'
import { countedSets, deriveState, evaluateSession, sessionE1rm, suggestNext } from '.'
import type { ExerciseConfig, ExerciseSession, LoggedSet } from '.'

// Extra sets are recorded, not counted (SPEC §9.2, slice 2).

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

const curl: ExerciseConfig = {
  ...bench,
  id: 'curl',
  name: 'Dumbbell Curl',
  tier: 'accessory',
  repRange: { min: 8, max: 12 },
  equipment: 'dumbbell',
  seed: { weight: 30, reps: 8 },
}

const counted = (weight: number, reps: number[], rpe?: number): LoggedSet[] =>
  reps.map((r, i) => (i === 0 && rpe !== undefined ? { weight, reps: r, rpe } : { weight, reps: r }))
const extra = (weight: number, reps: number): LoggedSet => ({ weight, reps, extra: true })
const on = (day: number, sets: LoggedSet[]): ExerciseSession => ({
  date: `2026-09-${String(day).padStart(2, '0')}T10:00:00Z`,
  sets,
})
const asOf = new Date('2026-09-30T10:00:00Z')

describe('extra sets (SPEC §9.2, slice 2)', () => {
  it('are left out of the counted sets', () => {
    expect(countedSets([...counted(225, [5, 4]), extra(185, 8)])).toEqual(counted(225, [5, 4]))
  })

  it('cannot fail the floor rule', () => {
    const sets = [...counted(225, [5, 4, 4], 8), extra(185, 1)]
    expect(evaluateSession(bench, [], sets).result).toBe('success')
  })

  it('do not fill the rep range for an accessory', () => {
    // 1 of 3 counted sets at the top: not filled, so the weight stays. Two extras at the top must not change that.
    const sets = [...counted(30, [12, 10, 9]), extra(30, 12), extra(30, 12)]
    const without = suggestNext(curl, [on(20, counted(30, [12, 10, 9]))], asOf)
    expect(suggestNext(curl, [on(20, sets)], asOf)).toEqual(without)
  })

  it('never give the session e1RM, even if logged first', () => {
    expect(sessionE1rm(on(20, [extra(300, 5), ...counted(225, [5, 4, 4], 8)]))).toBe(
      sessionE1rm(on(20, counted(225, [5, 4, 4], 8))),
    )
  })

  it('leave a session with only extras "not done", like a skip', () => {
    const history = [on(10, counted(225, [5, 5, 5], 8)), on(20, [extra(135, 10)])]
    const { state, sessions } = deriveState(bench, history)
    expect(state).toEqual(deriveState(bench, [history[0]]).state)
    expect(sessions[1].isDeload).toBeUndefined()
  })

  it('change no suggestion', () => {
    const plain = [on(10, counted(225, [5, 5, 4], 8)), on(17, counted(230, [5, 4, 4], 8))]
    const withExtras = plain.map((s) => ({ ...s, sets: [...s.sets, extra(185, 8), extra(185, 6)] }))
    expect(suggestNext(bench, withExtras, asOf)).toEqual(suggestNext(bench, plain, asOf))
  })
})
