import { describe, expect, it } from 'vitest'
import { predictedReps, runningE1rm, sessionE1rm, suggestNext } from '.'
import type { ExerciseConfig, ExerciseSession, LoggedSet } from '.'

// SPEC §7: e1RM assertions allow +/- 0.1 lb.
function expectLb(actual: number | undefined, expected: number) {
  expect(actual).toBeDefined()
  expect(Math.abs(actual! - expected)).toBeLessThanOrEqual(0.1)
}

const asOf = new Date('2026-10-04T12:00:00Z')
const daysAgo = (n: number) => new Date(asOf.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

const set = (weight: number, reps: number, rpe?: number): LoggedSet => ({ weight, reps, rpe })
const session = (days: number, first: LoggedSet, extra: Partial<ExerciseSession> = {}) => ({
  date: daysAgo(days),
  sets: [first],
  ...extra,
})

const bench = (overrides: Partial<ExerciseConfig> = {}): ExerciseConfig => ({
  id: 'bench',
  name: 'Bench Press',
  tier: 'primary',
  repRange: { min: 3, max: 5 },
  targetRpe: 8,
  sets: 3,
  equipment: 'barbell',
  maxRelativeJump: 0.1,
  unilateral: false,
  ...overrides,
})

function suggestion(config: ExerciseConfig, history: ExerciseSession[]) {
  const result = suggestNext(config, history, asOf)
  if (result.kind !== 'suggestion') throw new Error(`expected a suggestion, got ${result.kind}`)
  return result
}

describe('7.A Estimated 1RM', () => {
  it('A1: 225x4 @ RPE 8 has an e1RM of 266.8', () => {
    expectLb(sessionE1rm(session(0, set(225, 4, 8))), 266.8)
  })

  it('A2: 225x4 @ RPE 10 has an e1RM of 253.0 (no reps in reserve)', () => {
    expectLb(sessionE1rm(session(0, set(225, 4, 10))), 253.0)
  })

  it('A3: last 3 sessions within 4 weeks average to a running e1RM of 271.1', () => {
    const history = [session(14, set(225, 4, 8)), session(7, set(225, 5, 8)), session(1, set(230, 4, 8))]
    const running = runningE1rm(history, undefined, asOf)
    expectLb(running?.value, 271.1)
    expect(running?.basis).toBe('history')
  })

  it('A4: most recent session 6 weeks ago gives 90% (240.1), a break note, and 200 x 4', () => {
    const history = [session(42, set(225, 4, 8))]
    const running = runningE1rm(history, undefined, asOf)
    expectLb(running?.value, 240.1)
    expect(running?.basis).toBe('returningFromBreak')

    const next = suggestion(bench(), history)
    expect(next.weight).toBe(200)
    expect(next.reps).toBe(4)
    expect(next.e1rm?.basis).toBe('returningFromBreak')
  })

  it('A5: a deload session is ignored; the 3 most recent non-deload sessions are averaged', () => {
    const history = [
      session(20, set(225, 4, 8)),
      session(13, set(225, 5, 8)),
      session(6, set(200, 3, 6), { isDeload: true }),
      session(1, set(230, 4, 8)),
    ]
    expectLb(runningE1rm(history, undefined, asOf)?.value, 271.1)
  })

  it('A6: a replaced session (substitute sets) is ignored for the original exercise', () => {
    const history = [
      session(20, set(225, 4, 8)),
      session(13, set(225, 5, 8)),
      session(6, set(80, 12, 8), { replaced: true }),
      session(1, set(230, 4, 8)),
    ]
    expectLb(runningE1rm(history, undefined, asOf)?.value, 271.1)
  })

  it('A7: only 2 sessions are averaged over 2 (270.2), not padded to 3', () => {
    const history = [session(7, set(225, 4, 8)), session(1, set(225, 5, 8))]
    expectLb(runningE1rm(history, undefined, asOf)?.value, 270.2)
  })

  it('A8: only 1 session gives its own e1RM (266.8) with no break penalty', () => {
    const running = runningE1rm([session(3, set(225, 4, 8))], undefined, asOf)
    expectLb(running?.value, 266.8)
    expect(running?.basis).toBe('history')
  })

  it('A9: seed 225x5 (RPE 7) gives e1RM 280.4 and suggests 235 x 4 on a 3-5 @ RPE 8 range', () => {
    const next = suggestion(bench({ seed: { weight: 225, reps: 5 } }), [])
    expectLb(next.e1rm?.value, 280.4)
    expect(next.e1rm?.basis).toBe('seed')
    expect(next.weight).toBe(235)
    expect(next.reps).toBe(4)
    expectLb(next.predictedReps, 4.2)
  })

  it('A10: after one real session the seed is dropped, not averaged (266.8)', () => {
    const next = suggestion(bench({ seed: { weight: 225, reps: 5 } }), [session(1, set(225, 4, 8))])
    expectLb(next.e1rm?.value, 266.8)
    expect(next.e1rm?.basis).toBe('history')
  })

  it('A12: an exercise with no seed and no history needs a seed before a session', () => {
    expect(suggestNext(bench(), [], asOf)).toEqual({ kind: 'needsSeed' })
  })
})

describe('7.B Primary-lift suggestions', () => {
  it('B1: running e1RM 271.1 on 3-5 @ RPE 8 suggests 225 x 4 (230 predicts too few reps)', () => {
    expectLb(predictedReps(271.1, 225, 8), 4.6)
    expectLb(predictedReps(271.1, 230, 8), 3.8)

    // Same running e1RM as A3, through the full engine.
    const history = [session(14, set(225, 4, 8)), session(7, set(225, 5, 8)), session(1, set(230, 4, 8))]
    const next = suggestion(bench(), history)
    expect(next.weight).toBe(225)
    expect(next.reps).toBe(4)
  })

  it('B2: 225x12 @ RPE 8 on a 3-5 range gives e1RM 325.0 and suggests 270 x 4', () => {
    const next = suggestion(bench(), [session(1, set(225, 12, 8))])
    expectLb(next.e1rm?.value, 325.0)
    expect(next.weight).toBe(270)
    expect(next.reps).toBe(4)
    expectLb(next.predictedReps, 4.6)
  })

  it('B3: 225x7 @ RPE 7 on a 5-7 range suggests 235 x 6', () => {
    const next = suggestion(bench({ repRange: { min: 5, max: 7 } }), [session(1, set(225, 7, 7))])
    expectLb(next.e1rm?.value, 294.4)
    expect(next.weight).toBe(235)
    expect(next.reps).toBe(6)
    expectLb(next.predictedReps, 6.2)
  })
})
