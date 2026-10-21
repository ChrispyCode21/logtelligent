import { describe, expect, it } from 'vitest'
import { estimate1rm, runningE1rm, schemeFor, sessionE1rm, waves } from '.'
import type { ExerciseConfig, ExerciseSession, LoggedSet, WavesSet, WavesSuggestion } from '.'

const squat: ExerciseConfig = {
  id: 'squat',
  name: 'Squat',
  tier: 'primary',
  repRange: { min: 5, max: 5 },
  targetRpe: 8,
  sets: 3,
  equipment: 'barbell',
  maxRelativeJump: 0.1,
  unilateral: false,
  progression: { scheme: 'waves', increment: 10 },
}

const DAY_MS = 24 * 60 * 60 * 1000
const start = Date.parse('2026-09-01T12:00:00Z')
const at = (day: number) => new Date(start + day * DAY_MS).toISOString()
const dayDate = (day: number) => new Date(at(day))

/** A session on a day, from [weight, reps] pairs; `extra` sets are logged beyond the prescribed ones. */
const on = (day: number, sets: [number, number][], extra: [number, number][] = []): ExerciseSession => ({
  date: at(day),
  sets: [
    ...sets.map(([weight, reps]) => ({ weight, reps })),
    ...extra.map(([weight, reps]) => ({ weight, reps, extra: true })),
  ],
})

/** Weeks 1-4 at TM 245 as prescribed (SPEC §7.W), with the AMRAP set's reps for weeks 1-3. */
const WEEK_SETS: [number, number][][] = [
  [
    [160, 5],
    [185, 5],
    [210, 5],
  ],
  [
    [170, 3],
    [195, 3],
    [220, 3],
  ],
  [
    [185, 5],
    [210, 3],
    [235, 1],
  ],
  [
    [100, 5],
    [125, 5],
    [145, 5],
  ],
]
const MINIMUMS = [5, 3, 1]

/** Week `week` (1-4) logged on `day` as prescribed, its AMRAP set at `amrap` reps (weeks 1-3). */
function week(w: number, day: number, amrap = MINIMUMS[w - 1]): ExerciseSession {
  const sets = WEEK_SETS[w - 1].map((s) => [...s] as [number, number])
  if (w < 4) sets[2][1] = amrap
  return on(day, sets)
}

/** Weeks 1-4 a week apart from `day`, the AMRAP reps of weeks 1-3 given (the minimums by default). */
const cycle = (amraps = MINIMUMS, day = 0): ExerciseSession[] =>
  [1, 2, 3, 4].map((w) => week(w, day + (w - 1) * 7, amraps[w - 1]))

const lastDay = (history: ExerciseSession[]) =>
  Math.max(0, ...history.map((s) => Math.round((Date.parse(s.date) - start) / DAY_MS)))

/** A lift session whose e1RM, and so (at 90%) the TM, is `tm` exactly: one rep at RPE 10, 3 days before the first. */
const liftTm = (tm: number): ExerciseSession[] => [
  { date: at(-3), sets: [{ weight: tm / 0.9 / estimate1rm(1, 1), reps: 1, rpe: 10 }] },
]
/** The lift's 225 x 5 @8 (e1RM 273.6, TM 245). */
const lift245: ExerciseSession[] = [{ date: at(-3), sets: [{ weight: 225, reps: 5, rpe: 8 }] }]

/** The suggestion two days after the last session, unless `asOf` is a day number. */
function next(
  history: ExerciseSession[],
  {
    config = squat,
    asOf,
    lift = lift245,
  }: { config?: ExerciseConfig; asOf?: number; lift?: ExerciseSession[] } = {},
): WavesSuggestion {
  const s = waves.suggest(config, history, dayDate(asOf ?? lastDay(history) + 2), lift)
  if (s.kind !== 'suggestion' || s.scheme !== 'waves')
    throw new Error(`Not a Waves suggestion: ${JSON.stringify(s)}`)
  return s
}

const plan = (...sets: [number, number][]): WavesSet[] =>
  sets.map(([weight, reps], i) => ({ weight, reps, ...(i === 2 ? { amrap: true } : {}) }))
const noAmrap = (...sets: [number, number][]): WavesSet[] => sets.map(([weight, reps]) => ({ weight, reps }))

describe('7.W Waves (SPEC §6.11): starting TM', () => {
  it('W1: the first session starts at 90% of the lift e1RM 273.6, snapped down: TM 245', () => {
    const s = next([], { lift: lift245 })
    expect(s.tm).toBe(245)
    expect(s.week).toBe(1)
    expect(s.reason).toEqual({ kind: 'start' })
  })

  it('W2: with no real session, the seed 225 x 5 (e1RM 280.4) starts at TM 250', () => {
    const s = next([], { config: { ...squat, seed: { weight: 225, reps: 5 } }, lift: [] })
    expect(s.tm).toBe(250)
  })

  it('W3: no seed and no e1RM needs starting numbers', () => {
    expect(waves.suggest(squat, [], dayDate(0), [])).toEqual({ kind: 'needsSeed' })
  })

  it('W4: later e1RM changes in the lift never move the TM', () => {
    const risen = [...lift245, { date: at(3), sets: [{ weight: 270, reps: 4, rpe: 8 }] }]
    expect(sessionE1rm(risen[1])).toBeGreaterThan(290)
    const s = next([week(1, 0)], { lift: risen, asOf: 7 })
    expect(s.tm).toBe(245)
    expect(s.setPlan).toEqual(plan([170, 3], [195, 3], [220, 3]))
    expect(next(cycle(), { lift: risen }).tm).toBe(255)
  })
})

describe('7.W Waves (SPEC §6.11): weights per week', () => {
  it('W5: week 1 at TM 245 is 160 x 5, 185 x 5, 210 x 5+', () => {
    const s = next([])
    expect(s.setPlan).toEqual(plan([160, 5], [185, 5], [210, 5]))
    expect(s).toMatchObject({ weight: 160, reps: 5, sets: 3 })
  })

  it('W6: week 2 is 170 x 3, 195 x 3, 220 x 3+', () => {
    expect(next([week(1, 0)]).setPlan).toEqual(plan([170, 3], [195, 3], [220, 3]))
  })

  it('W7: week 3 is 185 x 5, 210 x 3, 235 x 1+', () => {
    expect(next(cycle().slice(0, 2)).setPlan).toEqual(plan([185, 5], [210, 3], [235, 1]))
  })

  it('W8: week 4 is the deload, 100 x 5, 125 x 5 (a tie rounds up), 145 x 5, with no AMRAP', () => {
    const s = next(cycle().slice(0, 3))
    expect(s.week).toBe(4)
    expect(s.setPlan).toEqual(noAmrap([100, 5], [125, 5], [145, 5]))
  })
})

describe('7.W Waves (SPEC §6.11): a cycle and the TM', () => {
  it('W9: a met cycle raises the TM to 255; week 1 is 165 x 5, 190 x 5, 215 x 5+', () => {
    const s = next(cycle([7, 5, 3]))
    expect(s.tm).toBe(255)
    expect(s.week).toBe(1)
    expect(s.setPlan).toEqual(plan([165, 5], [190, 5], [215, 5]))
    expect(s.reason).toEqual({ kind: 'increase', increment: 10 })
  })

  it('W10: AMRAPs at exactly the minimums are met: TM 255', () => {
    expect(next(cycle([5, 3, 1])).tm).toBe(255)
  })

  it('W11: an increment of 2.5 takes the next load up: TM 250', () => {
    const config = { ...squat, progression: { scheme: 'waves', increment: 2.5 } } as const
    const s = next(cycle([7, 5, 3]), { config })
    expect(s.tm).toBe(250)
    expect(s.reason).toEqual({ kind: 'increase', increment: 5 })
  })

  it('W12: only AMRAP sets are judged: short sets 1 and 2 still give TM 255', () => {
    const history = cycle([7, 5, 3])
    history[0] = on(0, [
      [160, 4],
      [185, 4],
      [210, 5],
    ])
    expect(next(history).tm).toBe(255)
  })

  it('W13: an AMRAP set not logged is a miss, but the session advances the wave: TM 220', () => {
    const history = cycle([5, 3, 1])
    history[0] = on(0, [
      [160, 5],
      [185, 5],
    ])
    expect(next(history.slice(0, 1)).week).toBe(2)
    const s = next(history)
    expect(s.tm).toBe(220)
    expect(s.reason).toEqual({ kind: 'drop' })
  })

  it('W14: an extra set does not count: the third prescribed set is the AMRAP, met, TM 255', () => {
    const history = cycle([5, 3, 1])
    history[0] = on(
      0,
      [
        [160, 5],
        [185, 5],
        [210, 5],
      ],
      [[210, 9]],
    )
    expect(next(history).tm).toBe(255)
    // Without the third prescribed set, the extra one is no AMRAP.
    const short = on(
      0,
      [
        [160, 5],
        [185, 5],
      ],
      [[210, 9]],
    )
    expect(next([short, ...history.slice(1)]).tm).toBe(220)
  })
})

describe('7.W Waves (SPEC §6.11): a missed AMRAP and the TM drop', () => {
  it('W15: a missed week 1 AMRAP drops the TM to 220; week 1 is 145 x 5, 165 x 5, 185 x 5+', () => {
    const s = next(cycle([4, 3, 1]))
    expect(s.tm).toBe(220)
    expect(s.setPlan).toEqual(plan([145, 5], [165, 5], [185, 5]))
  })

  it('W16: a miss in week 2 drops the TM at the cycle end: 220', () => {
    expect(next(cycle([5, 2, 1])).tm).toBe(220)
    // Mid-cycle the TM is unchanged.
    expect(next(cycle([5, 2, 1]).slice(0, 3)).tm).toBe(245)
  })

  it('W17: two misses are one drop: TM 220, not 198', () => {
    expect(next(cycle([4, 2, 1])).tm).toBe(220)
  })

  it('W18: the drop still applies when the lift e1RM rises before the cycle ends', () => {
    const risen = [...lift245, { date: at(10), sets: [{ weight: 300, reps: 3, rpe: 8 }] }]
    expect(next(cycle([4, 3, 1]), { lift: risen }).tm).toBe(220)
  })
})

describe('7.W Waves (SPEC §6.11): what advances the wave', () => {
  it('W19: no sessions suggests week 1', () => {
    expect(next([]).week).toBe(1)
  })

  it('W20: week 1 logged suggests week 2: 170 x 3, 195 x 3, 220 x 3+', () => {
    const s = next([week(1, 0)])
    expect(s.week).toBe(2)
    expect(s.setPlan).toEqual(plan([170, 3], [195, 3], [220, 3]))
    expect(s.reason).toEqual({ kind: 'continue' })
  })

  it('W21: a substituted session does not advance the wave', () => {
    const replaced = { ...week(2, 7), replaced: true }
    expect(next([week(1, 0), replaced]).week).toBe(2)
  })

  it('W22: a session with no prescribed sets logged does not advance the wave', () => {
    const empty: ExerciseSession = { date: at(21), sets: [{ weight: 100, reps: 5, extra: true }] }
    expect(next([...cycle().slice(0, 3), empty]).week).toBe(4)
    expect(next([...cycle().slice(0, 3), { date: at(21), sets: [] }]).week).toBe(4)
  })

  it('W23: weeks 1-4 logged suggests week 1 of the next cycle', () => {
    const s = next(cycle())
    expect(s.week).toBe(1)
    expect(s.tm).toBe(255)
  })

  it('W24: History marks sessions 4 and 8 as deloads, and a replaced session is passed through', () => {
    const history = [...cycle(), ...cycle(MINIMUMS, 28)]
    const replaced = { ...week(1, 10), replaced: true }
    const marked = waves.replay(squat, [...history.slice(0, 2), replaced, ...history.slice(2)])
    expect(marked.map((s) => s.isDeload)).toEqual([
      false,
      false,
      undefined,
      false,
      true,
      false,
      false,
      false,
      true,
    ])
    expect(marked.every((s) => !s.highReps)).toBe(true)
  })
})

describe('7.W Waves (SPEC §6.11): returning from a break', () => {
  it('W25: six weeks after week 2 the TM drops to 220 and the wave restarts: 145 x 5, 165 x 5, 185 x 5+', () => {
    const s = next(cycle().slice(0, 2), { asOf: 7 + 42 })
    expect(s.tm).toBe(220)
    expect(s.week).toBe(1)
    expect(s.setPlan).toEqual(plan([145, 5], [165, 5], [185, 5]))
    expect(s.reason).toEqual({ kind: 'break' })
  })

  it('W26: after a met cycle (TM 255) a break drops it to 225: 145 x 5, 170 x 5, 190 x 5+', () => {
    const s = next(cycle(), { asOf: 21 + 42 })
    expect(s.tm).toBe(225)
    expect(s.setPlan).toEqual(plan([145, 5], [170, 5], [190, 5]))
  })

  it('W27: week 1 logged 27 days ago is no break: week 2, TM 245', () => {
    const s = next([week(1, 0)], { asOf: 27 })
    expect(s.week).toBe(2)
    expect(s.tm).toBe(245)
  })

  it('W28: a session after a break is week 1 of the restarted wave and advances to week 2', () => {
    const history = [week(1, 0), week(2, 7), week(1, 49)]
    const marked = waves.replay(squat, history)
    expect(marked.map((s) => s.isDeload)).toEqual([false, false, false])
    const s = next(history)
    expect(s.week).toBe(2)
    expect(s.tm).toBe(220)
    expect(s.setPlan).toEqual(plan([155, 3], [175, 3], [200, 3]))
  })

  it('W29: a break clears an earlier miss: the TM drops once, to 220', () => {
    const history = [week(1, 0, 4), week(2, 7)]
    const s = next(history, { asOf: 7 + 42 })
    expect(s.tm).toBe(220)
    // The restarted wave's cycle is judged afresh.
    const again = [...history, ...cycle([5, 3, 1], 49)]
    expect(next(again).tm).toBe(230)
  })
})

describe('7.W Waves (SPEC §6.11): weights between available loads', () => {
  it('W30: a dumbbell rack, TM 50, week 1 is 35 x 5, 40 x 5, 45 x 5+ (each a tie rounded up)', () => {
    const rack = { ...squat, equipment: 'dumbbell' } as const
    expect(next([], { config: rack, lift: liftTm(50) }).setPlan).toEqual(plan([35, 5], [40, 5], [45, 5]))
  })

  it('W31: a cable stack in 10s, TM 190, week 1 is 120 x 5, 140 x 5, 160 x 5+', () => {
    const loads = [90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200]
    const stack: ExerciseConfig = { ...squat, equipment: 'cable', loads }
    expect(next([], { config: stack, lift: liftTm(190) }).setPlan).toEqual(plan([120, 5], [140, 5], [160, 5]))
  })

  it('W32: a barbell, TM 100, week 4 is 45 x 5 (the lightest load), 50 x 5, 60 x 5', () => {
    const s = next(cycle().slice(0, 3), { lift: liftTm(100) })
    expect(s.week).toBe(4)
    expect(s.setPlan).toEqual(noAmrap([45, 5], [50, 5], [60, 5]))
  })

  it('W33: a cable machine with no stack entered is exact: 130 x 5, 150 x 5, 170 x 5+', () => {
    const none = { ...squat, equipment: 'cable' } as const
    const s = next([], { config: none, lift: liftTm(200) })
    expect(s.setPlan.map((p) => p.weight)).toEqual([
      expect.closeTo(130, 6),
      expect.closeTo(150, 6),
      expect.closeTo(170, 6),
    ])
    expect(s.setPlan.map((p) => p.reps)).toEqual([5, 5, 5])
    expect(s.setPlan[2].amrap).toBe(true)
  })

  it('W34: a TM drop snaps down: 250 x 0.9 is 225, 245 x 0.9 is 220, never up to 225', () => {
    expect(next(cycle([4, 3, 1]), { lift: liftTm(250) }).tm).toBe(225)
    expect(next(cycle([4, 3, 1]), { lift: liftTm(245) }).tm).toBe(220)
  })
})

describe('7.W Waves (SPEC §6.11): effort and e1RM', () => {
  const rated = (amrapRpe?: number): ExerciseSession => ({
    date: at(0),
    sets: [
      { weight: 160, reps: 5, rpe: 8 },
      { weight: 185, reps: 5 },
      { weight: 210, reps: 8, ...(amrapRpe === undefined ? {} : { rpe: amrapRpe }) },
    ],
  })

  it('W35: the e1RM comes from the AMRAP set, not set 1: 210 x 8 @10 is 261.7', () => {
    const [session] = waves.replay(squat, [rated(10)])
    expect(sessionE1rm(session)).toBeCloseTo(261.7, 1)
  })

  it('W36: with no effort on the AMRAP set the session gives no e1RM', () => {
    const [session] = waves.replay(squat, [rated()])
    expect(sessionE1rm(session)).toBeUndefined()
  })

  it('W37: a deload week is not in the lift e1RM', () => {
    const weeks = cycle()
    const deload = { ...weeks[3], sets: weeks[3].sets.map((s) => ({ ...s, rpe: 8 })) }
    const replayed = waves.replay(squat, [...weeks.slice(0, 3), deload])
    expect(replayed[3].isDeload).toBe(true)
    expect(runningE1rm(replayed, undefined, dayDate(22))).toBeUndefined()
  })

  it('W38: a Waves session is not high-rep, so it counts before a 12-rep session', () => {
    const [session] = waves.replay(squat, [rated(10)])
    const twelve: ExerciseSession = {
      date: at(0),
      sets: [{ weight: 185, reps: 12, rpe: 8 }],
      highReps: true,
    }
    expect(session.highReps).toBe(false)
    const running = runningE1rm([session, twelve], undefined, dayDate(2))
    expect(running?.value).toBeCloseTo(sessionE1rm(session) ?? NaN, 5)
  })
})

describe('7.W Waves (SPEC §6.11): the outcome per session', () => {
  const amrap = (reps: number): LoggedSet[] => [
    { weight: 160, reps: 5 },
    { weight: 185, reps: 5 },
    { weight: 210, reps },
  ]

  it('W39: a met AMRAP is a success, with no state', () => {
    const outcome = waves.evaluate(squat, [], amrap(5), dayDate(0))
    expect(outcome.result).toBe('success')
    expect(outcome).not.toHaveProperty('state')
  })

  it('W40: a missed AMRAP is a fail, with no state', () => {
    const outcome = waves.evaluate(squat, [], amrap(4), dayDate(0))
    expect(outcome.result).toBe('fail')
    expect(outcome).not.toHaveProperty('state')
  })

  it('W41: week 4 is a deload, with no state', () => {
    const outcome = waves.evaluate(
      squat,
      cycle().slice(0, 3),
      WEEK_SETS[3].map(([weight, reps]) => ({ weight, reps })),
      dayDate(22),
    )
    expect(outcome.result).toBe('deload')
    expect(outcome).not.toHaveProperty('state')
  })

  it('judges an unlogged AMRAP, and a session with no prescribed sets, as fails', () => {
    expect(waves.evaluate(squat, [], amrap(5).slice(0, 2), dayDate(0)).result).toBe('fail')
    expect(waves.evaluate(squat, [], [], dayDate(0)).result).toBe('fail')
  })

  it('judges a session by the week the replay puts it in, after a break', () => {
    // Six weeks after week 2 the wave restarts, so this is week 1, not week 3.
    const outcome = waves.evaluate(squat, cycle().slice(0, 2), amrap(5), dayDate(7 + 42))
    expect(outcome.result).toBe('success')
  })
})

describe('Waves scheme', () => {
  it('is the scheme of an exercise set to Waves', () => {
    expect(schemeFor(squat)).toBe(waves)
  })

  it('throws for an exercise not set to Waves', () => {
    const adaptive = { ...squat, progression: undefined }
    expect(() => waves.suggest(adaptive, cycle(), dayDate(30), lift245)).toThrow()
  })

  it('passes extra fields on the sessions through the replay', () => {
    const history = [{ ...week(1, 0), sessionId: 7 }]
    expect(waves.replay(squat, history)[0]).toMatchObject({ sessionId: 7, e1rmSet: 2 })
  })

  it('prescribes three sets whatever the configured set count', () => {
    expect(next([], { config: { ...squat, sets: 5 } }).setPlan).toHaveLength(3)
  })

  it('needs starting numbers when the e1RM is gone at the first session', () => {
    expect(waves.suggest(squat, [week(1, 0)], dayDate(3), [])).toEqual({ kind: 'needsSeed' })
  })
})
