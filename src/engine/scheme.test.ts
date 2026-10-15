import { describe, expect, it } from 'vitest'
import { adaptive, evaluateSession, schemeFor, suggestNext } from '.'
import type { ExerciseConfig, ExerciseSession, LoggedSet } from '.'

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
const sets: LoggedSet[] = [
  { weight: 225, reps: 4, rpe: 8 },
  { weight: 225, reps: 4 },
  { weight: 225, reps: 4 },
]
const history: ExerciseSession[] = [{ date: '2026-10-01T12:00:00Z', sets }]
const asOf = new Date('2026-10-04T12:00:00Z')

describe('progression schemes', () => {
  it('every program exercise uses Adaptive', () => {
    expect(schemeFor(bench)).toBe(adaptive)
    expect(schemeFor({ ...bench, tier: 'accessory' })).toBe(adaptive)
  })

  it('suggest and evaluate give the same results as the engine functions', () => {
    const scheme = schemeFor(bench)
    expect(scheme.suggest(bench, history, asOf, [])).toEqual(suggestNext(bench, history, asOf, []))
    expect(scheme.evaluate(bench, history, sets)).toEqual(evaluateSession(bench, history, sets))
  })
})
