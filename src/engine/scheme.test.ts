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

  it('passes the lift sessions through to the suggestion', () => {
    const lift: ExerciseSession[] = [
      { date: '2026-09-28T12:00:00Z', sets: [{ weight: 245, reps: 5, rpe: 8 }] },
    ]
    const withLift = schemeFor(bench).suggest(bench, history, asOf, lift)
    expect(withLift).toEqual(suggestNext(bench, history, asOf, lift))
    expect(withLift).not.toEqual(schemeFor(bench).suggest(bench, history, asOf, []))
  })

  it('suggests and evaluates accessories the same way', () => {
    const curl: ExerciseConfig = {
      ...bench,
      id: 'curl',
      name: 'Curl',
      tier: 'accessory',
      repRange: { min: 8, max: 12 },
      equipment: 'dumbbell',
      seed: { weight: 25, reps: 10 },
    }
    const curlSets: LoggedSet[] = [
      { weight: 25, reps: 12 },
      { weight: 25, reps: 11 },
      { weight: 25, reps: 10 },
    ]
    const curlHistory: ExerciseSession[] = [{ date: '2026-10-01T12:00:00Z', sets: curlSets }]
    const scheme = schemeFor(curl)
    expect(scheme.suggest(curl, curlHistory, asOf, [])).toEqual(suggestNext(curl, curlHistory, asOf, []))
    expect(scheme.evaluate(curl, curlHistory, curlSets)).toEqual(evaluateSession(curl, curlHistory, curlSets))
  })
})
