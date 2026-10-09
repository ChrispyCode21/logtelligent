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

function suggestion(config: ExerciseConfig, history: ExerciseSession[], lift: ExerciseSession[] = []) {
  const result = suggestNext(config, history, asOf, lift)
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
    expect(suggestion(lateralRaise, history.slice(0, 1))).toMatchObject({
      weight: 15,
      reps: 22,
      effectiveTop: 22,
    })
    expect(suggestion(lateralRaise, history.slice(0, 2))).toMatchObject({
      weight: 15,
      reps: 24,
      effectiveTop: 24,
    })
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

describe('7.H Stored prescriptions (SPEC §9.4 slice 1)', () => {
  /** Sessions saved with a rep range on Finish. */
  const stored = (repRange: { min: number; max: number }, sessions: ExerciseSession[]) =>
    sessions.map((s) => ({ ...s, repRange }))
  const bench8to12 = { ...bench, repRange: { min: 8, max: 12 } }
  const raise10to12 = { ...lateralRaise, repRange: { min: 10, max: 12 } }

  it('H1: a session stored at 3-5 is still a success after the range becomes 8-12; next from the e1RM rule', () => {
    const history = stored({ min: 3, max: 5 }, weekly(sets(225, [4, 4, 3])))
    const { state } = deriveState(bench8to12, history)
    expect(state).toEqual({ stacks: 0, next: { kind: 'normal' } })
    expect(suggestion(bench8to12, history)).toMatchObject({ plan: 'normal', stacks: 0 })
  })

  it('H2: the same session with no stored range is judged by today’s 8-12: a fail, stacks 1', () => {
    const history = weekly(sets(225, [4, 4, 3]))
    expect(deriveState(bench8to12, history).state.stacks).toBe(1)
    expect(suggestion(bench8to12, history).plan).toBe('revert')
  })

  it('H3: lateral raise at 15 x top 22 under 15-20, now 10-12: a fresh start at 15 x 10, top 12', () => {
    const history = stored({ min: 15, max: 20 }, weekly(sets(15, [20, 20, 18])))
    expect(suggestion(lateralRaise, history)).toMatchObject({ weight: 15, reps: 22, effectiveTop: 22 })
    expect(suggestion(raise10to12, history)).toMatchObject({
      plan: 'normal',
      weight: 15,
      reps: 10,
      effectiveTop: 12,
      stacks: 0,
    })
  })

  it('H4: bench with stacks 1 (revert to 225) under 3-5, now 5-7: stacks 0, no revert, the e1RM rule', () => {
    const history = stored({ min: 3, max: 5 }, weekly(sets(225, [5, 5, 4]), sets(235, [4, 3, 2])))
    expect(suggestion(bench, history)).toMatchObject({ plan: 'revert', weight: 225, stacks: 1 })
    const bench5to7 = { ...bench, repRange: { min: 5, max: 7 } }
    expect(deriveState(bench5to7, history).state).toEqual({ stacks: 0, next: { kind: 'normal' } })
    expect(suggestion(bench5to7, history)).toMatchObject({ plan: 'normal', stacks: 0 })
  })

  it('H5: after H3, a fail stored at 10-12 (15x9, 15x8, 15x8) reverts one step below: 12.5 x 10', () => {
    const [first, second] = weekly(sets(15, [20, 20, 18]), sets(15, [9, 8, 8]))
    const history = [
      { ...first, repRange: { min: 15, max: 20 } },
      { ...second, repRange: { min: 10, max: 12 } },
    ]
    expect(suggestion(raise10to12, history)).toMatchObject({
      plan: 'revert',
      weight: 12.5,
      reps: 10,
      effectiveTop: 12,
      stacks: 1,
    })
  })

  it('a fresh start between two stored sessions clears a pending deload', () => {
    // Two fails at 3-5 make the next session a deload; the range then changes before it.
    const fails = stored(
      { min: 3, max: 5 },
      weekly(sets(225, [5, 5, 4]), sets(235, [4, 3, 2]), sets(225, [4, 3, 2])),
    )
    expect(suggestion(bench, fails).plan).toBe('deload')
    const next = {
      ...weekly(sets(205, [7, 6, 6]))[0],
      date: asOf.toISOString(),
      repRange: { min: 5, max: 7 },
    }
    const { sessions } = deriveState({ ...bench, repRange: { min: 5, max: 7 } }, [...fails, next])
    expect(sessions.at(-1)!.isDeload).toBe(false)
  })

  it('sessions stored at the current range replay exactly as unstored ones', () => {
    const history = weekly(sets(225, [5, 4, 3]), sets(235, [4, 3, 2]), sets(225, [5, 4, 3]))
    expect(deriveState(bench, stored(bench.repRange, history))).toEqual({
      ...deriveState(bench, history),
      sessions: deriveState(bench, history).sessions.map((s) => ({ ...s, repRange: bench.repRange })),
    })
  })

  it('starts from the first judged session’s range, so seed numbers are in its terms', () => {
    // At 15-20, 100 x 15, 15, 15 doesn't fill the range: stay at 100. Judged from a seed at today's
    // 8-12 instead, it would fill 12 and step up to 105 before the fresh start.
    const cable = accessory({
      equipment: 'cable',
      loads: [95, 100, 105, 110],
      seed: { weight: 100, reps: 8 },
    })
    const history = stored({ min: 15, max: 20 }, weekly(reps(100, 15, 15, 15)))
    expect(suggestion(cable, history)).toMatchObject({ weight: 100, reps: 8, effectiveTop: 12 })
  })

  it('a fresh start clears a pending retry', () => {
    const history = stored(
      { min: 3, max: 5 },
      weekly(sets(225, [5, 4, 3]), sets(235, [4, 3, 2]), sets(225, [5, 4, 3])),
    )
    expect(suggestion(bench, history)).toMatchObject({ plan: 'retry', weight: 235, stacks: 1 })
    const state = deriveState({ ...bench, repRange: { min: 5, max: 7 } }, history).state
    expect(state).toEqual({ stacks: 0, next: { kind: 'normal' } })
  })

  it('an accessory’s fresh start from a pending revert uses the reverted weight', () => {
    // 70 x 8, 8, 8 fills 6-8: 75 x 6. Then 75 x 5, 5, 5 fails: revert to 70. The range becomes 8-10.
    const press = { ...inclinePress, seed: { weight: 70, reps: 6 } }
    const history = stored({ min: 6, max: 8 }, weekly(reps(70, 8, 8, 8), reps(75, 5, 5, 5)))
    expect(suggestion(press, history)).toMatchObject({ plan: 'revert', weight: 70 })
    expect(suggestion({ ...press, repRange: { min: 8, max: 10 } }, history)).toMatchObject({
      plan: 'normal',
      weight: 70,
      reps: 8,
      effectiveTop: 10,
      stacks: 0,
    })
  })

  it('older unstored sessions followed by stored ones at the same range replay as if none were stored', () => {
    const history = weekly(
      sets(225, [5, 4, 3]),
      sets(235, [4, 3, 2]),
      sets(225, [5, 4, 3]),
      sets(235, [4, 4, 3]),
    )
    const mixed = [...history.slice(0, 2), ...stored(bench.repRange, history.slice(2))]
    expect(deriveState(bench, mixed).state).toEqual(deriveState(bench, history).state)
    expect(suggestion(bench, mixed)).toEqual(suggestion(bench, history))
  })

  it('a live session is judged by the current range after a fresh start', () => {
    const history = stored({ min: 15, max: 20 }, weekly(sets(15, [20, 20, 18])))
    // 15 x 10, 10, 10 clears the floor of 10: a success under 10-12 (it would fail at 15-20).
    expect(evaluateSession(raise10to12, history, reps(15, 10, 10, 10)).result).toBe('success')
  })
})

describe('7.I Lifts (SPEC §9.4 slice 2)', () => {
  const upperA = bench // 3-5 @ RPE 8
  const upperB: ExerciseConfig = { ...bench, id: 'bench-b', repRange: { min: 10, max: 12 }, seed: undefined }
  const heavy = weekly(sets(225, [5, 5, 5]))
  const light = weekly(sets(185, [12, 12, 12]))

  it('I1: the 14-rep session is skipped while a lower one exists: e1RM 273.6, 230 x 4 and 190 x 11', () => {
    const a = suggestion(upperA, heavy, deriveState(upperB, light).sessions)
    expect(a.e1rm!.value).toBeCloseTo(273.6, 1)
    expect(a).toMatchObject({ weight: 230, reps: 4 })
    expect(a.predictedReps).toBeCloseTo(4.1, 1)
    const b = suggestion(upperB, light, deriveState(upperA, heavy).sessions)
    expect(b.e1rm!.value).toBeCloseTo(273.6, 1)
    expect(b).toMatchObject({ weight: 190, reps: 11 })
    expect(b.predictedReps).toBeCloseTo(11.9, 1)
  })

  it('I2: with only the 14-rep session in the window it counts: 267.3, Upper A suggests 225 x 4', () => {
    const a = suggestion({ ...upperA, seed: undefined }, [], deriveState(upperB, light).sessions)
    expect(a.e1rm!.value).toBeCloseTo(267.3, 1)
    expect(a).toMatchObject({ weight: 225, reps: 4 })
    expect(a.predictedReps).toBeCloseTo(4.1, 1)
  })

  it('I3: a fail on Upper A stacks there only; Upper B stays normal', () => {
    const aHistory = weekly(sets(225, [5, 4, 3]), sets(235, [4, 3, 2]))
    const a = suggestion(upperA, aHistory, deriveState(upperB, light).sessions)
    expect(a).toMatchObject({ plan: 'revert', weight: 225, stacks: 1 })
    const b = suggestion(upperB, light, deriveState(upperA, aHistory).sessions)
    expect(b).toMatchObject({ plan: 'normal', stacks: 0 })
  })

  it('I5: once the lift has a real session the seed is dropped: 266.8', () => {
    const other = deriveState(upperB, weekly(sets(225, [4, 4, 4])))
    expect(suggestion(upperA, [], other.sessions).e1rm).toMatchObject({ basis: 'history' })
    expect(suggestion(upperA, [], other.sessions).e1rm!.value).toBeCloseTo(266.8, 1)
  })

  it("I6: another exercise's deload week is left out of the lift's e1RM", () => {
    const deloaded = weekly(sets(205, [5, 5], 6)).map((s) => ({ ...s, isDeload: true }))
    const withDeload = suggestion(upperA, heavy, deloaded)
    expect(withDeload.e1rm!.value).toBeCloseTo(suggestion(upperA, heavy).e1rm!.value, 6)
  })

  it('I8: returning from a break uses the most recent lower-rep session: 246.2, 205 x 4', () => {
    const daysAgo = (n: number) => new Date(asOf.getTime() - n * DAY_MS).toISOString()
    const own = [{ date: daysAgo(42), sets: sets(225, [5, 5, 5]) }]
    const other = deriveState(upperB, [{ date: daysAgo(35), sets: sets(185, [12, 12, 12]) }]).sessions
    const a = suggestion(upperA, own, other)
    expect(a.e1rm).toMatchObject({ basis: 'returningFromBreak' })
    expect(a.e1rm!.value).toBeCloseTo(246.2, 1)
    expect(a).toMatchObject({ weight: 205, reps: 4 })
    expect(a.predictedReps).toBeCloseTo(4.5, 1)
  })
})
