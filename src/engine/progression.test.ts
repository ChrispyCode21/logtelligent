import { describe, expect, it } from 'vitest'
import {
  deloadMessage,
  deriveState,
  evaluateSession,
  FAIL_MESSAGE,
  pickWeight,
  progressAccessory,
  repCeiling,
  repExtensionStep,
  runningE1rm,
  suggestNext,
} from '.'
import type { ExerciseConfig, ExerciseSession, LoggedSet } from '.'

const asOf = new Date('2026-10-04T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

/** Sessions one week apart, the last one a day before `asOf`. */
function weekly(...weeks: LoggedSet[][]): ExerciseSession[] {
  return weeks.map((sets, i) => ({
    date: new Date(asOf.getTime() - DAY_MS - (weeks.length - 1 - i) * 7 * DAY_MS).toISOString(),
    sets,
  }))
}

/** One working weight; RPE on the first set only. */
const sets = (weight: number, reps: number[], rpe = 8): LoggedSet[] =>
  reps.map((r, i) => (i === 0 ? { weight, reps: r, rpe } : { weight, reps: r }))

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

const accessory = (overrides: Partial<ExerciseConfig>): ExerciseConfig => ({
  id: 'accessory',
  name: 'Accessory',
  tier: 'accessory',
  repRange: { min: 8, max: 12 },
  targetRpe: 8,
  sets: 3,
  equipment: 'dumbbell',
  maxRelativeJump: 0.1,
  unilateral: false,
  ...overrides,
})

const lateralRaise = accessory({
  id: 'lateral-raise',
  name: 'Lateral Raise',
  repRange: { min: 15, max: 20 },
  unilateral: true,
  seed: { weight: 15, reps: 15 },
})
const inclinePress = accessory({ id: 'incline', name: 'Incline DB Press', repRange: { min: 6, max: 8 } })
const latPulldown = accessory({
  id: 'pulldown',
  name: 'Lat Pulldown',
  equipment: 'cable',
  loads: [88, 99, 110, 121, 132, 143],
})

function suggestion(config: ExerciseConfig, history: ExerciseSession[]) {
  const result = suggestNext(config, history, asOf)
  if (result.kind !== 'suggestion') throw new Error('expected a suggestion, got ' + result.kind)
  return result
}

// Bench sessions for 7.D: weight A = 225, weight B = 235.
const A_SUCCESS = sets(225, [5, 4, 3])
const B_FAIL = sets(235, [4, 3, 2])
const A_FAIL = sets(225, [4, 3, 2])
const B_SUCCESS = sets(235, [4, 3, 3])

describe('7.A Accessory seed', () => {
  it('A11: accessory with no sessions and seed 15 x 15 on a 15-20 range suggests 15 x 15', () => {
    const next = suggestion(lateralRaise, [])
    expect(next.weight).toBe(15)
    expect(next.reps).toBe(15)
    expect(next.e1rm).toBeUndefined()
  })
})

describe('7.B Primary-lift suggestions', () => {
  it('B4: with stacks > 0 the suggestion comes from stack state, not the e1RM rule', () => {
    const history = weekly(A_SUCCESS, B_FAIL, A_SUCCESS)
    const next = suggestion(bench, history)
    expect(next.stacks).toBe(1)
    expect(next.plan).toBe('retry')
    expect(next.weight).toBe(235)

    const e1rm = runningE1rm(deriveState(bench, history).sessions, bench.seed, asOf)!
    expect(pickWeight(e1rm.value, 4, 8, [225, 230, 235]).weight).not.toBe(235)
  })
})

const DB = [10, 12.5, 15, 17.5, 20, 65, 70, 75, 80]
const reps = (weight: number, ...r: number[]): LoggedSet[] => r.map((n) => ({ weight, reps: n }))

describe('7.C Accessory double progression', () => {
  it('C1: incline 6-8, 70x8, 70x8, 70x7 is filled; 70 -> 75 is 7.1%, so suggest 75 x 6', () => {
    const next = progressAccessory(inclinePress, DB, { weight: 70, reps: 6, top: 8 }, reps(70, 8, 8, 7))
    expect(next).toEqual({ weight: 75, reps: 6, top: 8 })
  })

  it('C2: 70x8, 70x7, 70x6 is not filled; suggest 70, target 8', () => {
    const next = progressAccessory(inclinePress, DB, { weight: 70, reps: 6, top: 8 }, reps(70, 8, 7, 6))
    expect(next).toEqual({ weight: 70, reps: 8, top: 8 })
  })

  it('C3: 2 sets, 70x8 and 70x7, is not filled (more than 50% of 2 means both)', () => {
    const next = progressAccessory(inclinePress, DB, { weight: 70, reps: 6, top: 8 }, reps(70, 8, 7))
    expect(next).toEqual({ weight: 70, reps: 8, top: 8 })
  })

  it('C4: lateral raise 15x20, 15x20, 15x18 is filled; 15 -> 17.5 is 16.7%, so effective top 22', () => {
    const next = progressAccessory(lateralRaise, DB, { weight: 15, reps: 20, top: 20 }, reps(15, 20, 20, 18))
    expect(next).toEqual({ weight: 15, reps: 22, top: 22 })
  })

  it('C5: effective top 22 filled (15x22, 15x22, 15x19) rises to 24, the ceiling', () => {
    const next = progressAccessory(lateralRaise, DB, { weight: 15, reps: 22, top: 22 }, reps(15, 22, 22, 19))
    expect(next).toEqual({ weight: 15, reps: 24, top: 24 })
  })

  it('C6: ceiling 24 filled (15x24, 15x24, 15x22) takes the jump anyway: 17.5 x 15', () => {
    const next = progressAccessory(lateralRaise, DB, { weight: 15, reps: 24, top: 24 }, reps(15, 24, 24, 22))
    expect(next).toEqual({ weight: 17.5, reps: 15, top: 20 })
  })

  it('C7: lat pulldown 8-12, 121x12, 121x12, 121x10 is filled; 121 -> 132 is 9.1%, so 132 x 8', () => {
    const next = progressAccessory(
      latPulldown,
      latPulldown.loads!,
      { weight: 121, reps: 12, top: 12 },
      reps(121, 12, 12, 10),
    )
    expect(next).toEqual({ weight: 132, reps: 8, top: 12 })
  })

  it('C8: rep ceilings are 3-5 -> 6, 5-7 -> 9, 8-12 -> 15, 15-20 -> 24', () => {
    expect(repCeiling({ min: 3, max: 5 })).toBe(6)
    expect(repCeiling({ min: 5, max: 7 })).toBe(9)
    expect(repCeiling({ min: 8, max: 12 })).toBe(15)
    expect(repCeiling({ min: 15, max: 20 })).toBe(24)
  })

  it('C9: rep extension steps are top 5 -> 1, 7 -> 1, 12 -> 2, 20 -> 2', () => {
    expect(repExtensionStep({ min: 3, max: 5 })).toBe(1)
    expect(repExtensionStep({ min: 5, max: 7 })).toBe(1)
    expect(repExtensionStep({ min: 8, max: 12 })).toBe(2)
    expect(repExtensionStep({ min: 15, max: 20 })).toBe(2)
  })

  it('C4-C6 through history: lateral raise extends 20 -> 22 -> 24, then steps to 17.5 x 15', () => {
    const history = weekly(sets(15, [20, 20, 18]), sets(15, [22, 22, 19]), sets(15, [24, 24, 22]))
    expect(suggestion(lateralRaise, history.slice(0, 1))).toMatchObject({ weight: 15, reps: 22, effectiveTop: 22 })
    expect(suggestion(lateralRaise, history.slice(0, 2))).toMatchObject({ weight: 15, reps: 24, effectiveTop: 24 })
    expect(suggestion(lateralRaise, history)).toMatchObject({ weight: 17.5, reps: 15, effectiveTop: 20 })
  })
})

describe('7.D Floor rule and fatigue stacks', () => {
  it('D1: 225x5, 225x4, 225x3 all reach the floor of 3: success, stacks 0, next from the e1RM rule', () => {
    const outcome = evaluateSession(bench, [], A_SUCCESS)
    expect(outcome.result).toBe('success')
    expect(outcome.state.stacks).toBe(0)
    expect(outcome.message).toBeUndefined()
    expect(suggestion(bench, weekly(A_SUCCESS)).plan).toBe('normal')
  })

  it('D2: after a 225 success, 235x4, 235x3, 235x2 fails: stacks 1, revert to 225, with the message', () => {
    const outcome = evaluateSession(bench, weekly(A_SUCCESS), B_FAIL)
    expect(outcome.result).toBe('fail')
    expect(outcome.message).toBe(FAIL_MESSAGE)
    expect(outcome.state.stacks).toBe(1)
    expect(suggestion(bench, weekly(A_SUCCESS, B_FAIL))).toMatchObject({
      plan: 'revert',
      weight: 225,
      reps: 4,
      stacks: 1,
    })
  })

  it('D3: success at the reverted 225 keeps stacks at 1 and retries 235', () => {
    expect(suggestion(bench, weekly(A_SUCCESS, B_FAIL, A_SUCCESS))).toMatchObject({
      plan: 'retry',
      weight: 235,
      stacks: 1,
    })
  })

  it('D4: success at the retried 235 clears stacks to 0; next from the e1RM rule', () => {
    const outcome = evaluateSession(bench, weekly(A_SUCCESS, B_FAIL, A_SUCCESS), B_SUCCESS)
    expect(outcome.result).toBe('success')
    expect(outcome.state.stacks).toBe(0)
    expect(suggestion(bench, weekly(A_SUCCESS, B_FAIL, A_SUCCESS, B_SUCCESS)).plan).toBe('normal')
  })

  it('D5: failing again at the reverted 225 makes stacks 2 and a deload next week', () => {
    const outcome = evaluateSession(bench, weekly(A_SUCCESS, B_FAIL), A_FAIL)
    expect(outcome.state.stacks).toBe(2)
    expect(outcome.message).toBe(deloadMessage('Bench Press'))
    expect(suggestion(bench, weekly(A_SUCCESS, B_FAIL, A_FAIL)).plan).toBe('deload')
  })

  it('D6: one stack on bench and one on lateral raise is no deload for either', () => {
    const benchNext = suggestion(bench, weekly(A_SUCCESS, B_FAIL))
    const raiseNext = suggestion(lateralRaise, weekly(sets(15, [15, 15, 15]), sets(15, [20, 16, 14])))
    expect(benchNext).toMatchObject({ stacks: 1, plan: 'revert' })
    expect(raiseNext).toMatchObject({ stacks: 1, plan: 'revert' })
  })

  it('D7: 235 fail, 225 success, 235 fail reaches 2 stacks and a deload (no endless loop)', () => {
    const history = weekly(A_SUCCESS, B_FAIL, A_SUCCESS, B_FAIL)
    expect(deriveState(bench, history).state.stacks).toBe(2)
    expect(suggestion(bench, history).plan).toBe('deload')
  })

  it('D8: lateral raise 15x20, 15x16, 15x14 fails (14 < 15): the floor rule applies to accessories', () => {
    const outcome = evaluateSession(lateralRaise, weekly(sets(15, [15, 15, 15])), sets(15, [20, 16, 14]))
    expect(outcome.result).toBe('fail')
    expect(outcome.state.stacks).toBe(1)
  })
})

describe('7.E Deload', () => {
  it('E1: bench 3 sets, last success 225 x 4, stacks 2: deload 2 sets at 200 lb, RPE 6', () => {
    expect(suggestion(bench, weekly(A_SUCCESS, B_FAIL, A_FAIL))).toMatchObject({
      plan: 'deload',
      sets: 2,
      weight: 200,
      reps: 4,
      targetRpe: 6,
    })
  })

  function raiseDeload(setCount: number) {
    const config = { ...lateralRaise, sets: setCount }
    const success = sets(15, Array(setCount).fill(15))
    const fail = sets(15, [14, ...Array(setCount - 1).fill(15)])
    return suggestion(config, weekly(success, fail, fail))
  }

  it('E2: lateral raise 3 sets, last success 15, stacks 2: deload 2 sets at the same 15 lb', () => {
    expect(raiseDeload(3)).toMatchObject({ plan: 'deload', sets: 2, weight: 15, reps: 15 })
  })

  it('E2b: an accessory with 4 sets deloads to 2 sets at the same load', () => {
    expect(raiseDeload(4)).toMatchObject({ plan: 'deload', sets: 2, weight: 15 })
  })

  it('E2c: an accessory with 1 set stays at 1 set in a deload', () => {
    expect(raiseDeload(1)).toMatchObject({ plan: 'deload', sets: 1, weight: 15 })
  })

  it('E3: a deload session with a set below the floor is not a fail and adds no stack', () => {
    const outcome = evaluateSession(bench, weekly(A_SUCCESS, B_FAIL, A_FAIL), sets(200, [4, 2], 6))
    expect(outcome.result).toBe('deload')
    expect(outcome.state.stacks).toBe(0)
    expect(outcome.message).toBeUndefined()
  })

  it('E4: the week after a deload resumes at the last successful numbers (225 x 4), stacks 0', () => {
    const history = weekly(A_SUCCESS, B_FAIL, A_FAIL, sets(200, [4, 4], 6))
    expect(suggestion(bench, history)).toMatchObject({ plan: 'resume', weight: 225, reps: 4, stacks: 0 })
    expect(deriveState(bench, history).sessions.map((s) => s.isDeload)).toEqual([false, false, false, true])
  })
})

describe('Slice 2 decisions (SPEC §5.2, §6.6)', () => {
  it('a short session (2 of 3 sets) is validated on the logged sets only', () => {
    expect(evaluateSession(bench, [], sets(225, [4, 3])).result).toBe('success')
  })

  it('a fail with no prior success reverts one load step below the failed weight', () => {
    expect(suggestion(bench, weekly(B_FAIL))).toMatchObject({ plan: 'revert', weight: 230, reps: 4 })
    expect(suggestion(lateralRaise, weekly(sets(17.5, [15, 14, 12])))).toMatchObject({
      plan: 'revert',
      weight: 15,
      reps: 15,
    })
  })

  it('off-plan weights are classified against the weight that failed', () => {
    // Revert suggested 225; 230 is still below the failed 235, so the stack stays.
    expect(suggestion(bench, weekly(A_SUCCESS, B_FAIL, sets(230, [4, 4, 3])))).toMatchObject({
      plan: 'retry',
      stacks: 1,
    })
    // 240 is at or above the failed weight, so success clears the stack.
    expect(suggestion(bench, weekly(A_SUCCESS, B_FAIL, sets(240, [4, 4, 3]))).stacks).toBe(0)
  })
})

describe('Bodyweight accessories (SPEC §6.1)', () => {
  const pullUp = accessory({
    id: 'pull-up',
    name: 'Pull-up',
    equipment: 'bodyweight',
    repRange: { min: 8, max: 12 },
    seed: { weight: 0, reps: 8 },
  })

  it('progress by reps up to the ceiling (12 -> 14 -> 15), then add 5 lb at the bottom of the range', () => {
    const history = weekly(sets(0, [12, 12, 12]), sets(0, [14, 14, 14]), sets(0, [15, 15, 15]))
    expect(suggestion(pullUp, [])).toMatchObject({ weight: 0, reps: 8 })
    expect(suggestion(pullUp, history.slice(0, 1))).toMatchObject({ weight: 0, reps: 14 })
    expect(suggestion(pullUp, history.slice(0, 2))).toMatchObject({ weight: 0, reps: 15 })
    expect(suggestion(pullUp, history)).toMatchObject({ weight: 5, reps: 8, effectiveTop: 12 })
  })
})
