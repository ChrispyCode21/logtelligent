import { describe, expect, it } from 'vitest'
import type { Suggestion } from '../engine'
import {
  addExtra,
  addSet,
  allSetsLogged,
  canFinish,
  hasAnySets,
  hasRequiredEffort,
  loggedSetCount,
  loggedSets,
  removalNeedsEffort,
  removeFirstSet,
  removeSet,
  setTally,
  shownTarget,
  showsOutcome,
  substituteStep,
  targetSets,
  updateSet,
} from './sets'
import type { ExerciseLog } from './types'

const suggestion = (sets: number, plan: 'normal' | 'deload' = 'normal'): Suggestion => ({
  kind: 'suggestion',
  plan,
  weight: 225,
  reps: 5,
  sets,
  stacks: 0,
})
const bench = (sets: ExerciseLog['sets'] = []): ExerciseLog => ({ exerciseId: 'bench', sets })
const set = { weight: 225, reps: 5 }

describe('how many sets an exercise wants today', () => {
  it('is the suggestion count, which a deload halves (SPEC §6.2, §6.7)', () => {
    expect(targetSets(bench(), 3, suggestion(3))).toBe(3)
    expect(targetSets(bench(), 4, suggestion(2, 'deload'))).toBe(2)
  })

  it('is the configured count for a substitute, deload or not (SPEC §5.2)', () => {
    const replaced = { ...bench(), substitute: { name: 'Machine press', sets: [] } }
    expect(targetSets(replaced, 4, suggestion(2, 'deload'))).toBe(4)
  })

  it('is the configured count without a suggestion', () => {
    expect(targetSets(bench(), 3, { kind: 'needsSeed' })).toBe(3)
  })

  it('is all logged once the count is reached (SPEC §5.2, §6.6)', () => {
    expect(allSetsLogged([set, set], 3)).toBe(false)
    expect(allSetsLogged([set, set, set], 3)).toBe(true)
  })
})

describe('the session tally, "Only X of Y sets logged" (SPEC §5.2)', () => {
  it('adds logged and wanted sets across exercises', () => {
    expect(
      setTally([
        { log: bench([set, set]), target: 3 },
        { log: { exerciseId: 'curl', sets: [set] }, target: 2 },
      ]),
    ).toEqual({ logged: 3, target: 5 })
  })

  it('leaves skipped exercises out of both, and counts a substitute by its own sets', () => {
    expect(
      setTally([
        { log: { ...bench([set]), skipped: true }, target: 3 },
        { log: { ...bench([set, set]), substitute: { name: 'Machine press', sets: [set] } }, target: 3 },
      ]),
    ).toEqual({ logged: 1, target: 3 })
  })
})

describe("a primary's first-set effort (SPEC §6.3)", () => {
  it('is needed on a primary, not on an accessory', () => {
    expect(hasRequiredEffort('primary', [set])).toBe(false)
    expect(hasRequiredEffort('primary', [{ ...set, rpe: 8 }, set])).toBe(true)
    expect(hasRequiredEffort('accessory', [set])).toBe(true)
  })

  it('goes missing when set 1 is deleted and set 2 has none', () => {
    expect(hasRequiredEffort('primary', removeSet([{ ...set, rpe: 8 }, set], 0))).toBe(false)
  })

  it('is not needed with no sets', () => {
    expect(hasRequiredEffort('primary', [])).toBe(true)
  })
})

describe('editing a finished session (SPEC §5.4)', () => {
  it('knows when no set is left in a session, counting substitutes', () => {
    expect(hasAnySets([bench(), { ...bench(), exerciseId: 'curl' }])).toBe(false)
    expect(hasAnySets([bench(), { ...bench(), substitute: { name: 'Machine press', sets: [set] } }])).toBe(
      true,
    )
    expect(hasAnySets([bench([set])])).toBe(true)
  })

  it('shows a finished exercise its outcome whenever it has sets; a live one once all are in', () => {
    expect(showsOutcome(true, [set], 3)).toBe(true)
    expect(showsOutcome(true, [], 3)).toBe(false)
    expect(showsOutcome(false, [set], 3)).toBe(false)
    expect(showsOutcome(false, [set, set, set], 3)).toBe(true)
  })
})

describe('deleting set 1 (SPEC §5.4)', () => {
  const primary = (i: number) => i === 0
  const accessory = () => false

  it('asks for an effort when set 2 would become set 1 without one', () => {
    expect(removalNeedsEffort([{ ...set, rpe: 8 }, set], 0, primary)).toBe(true)
  })

  it('does not ask when set 2 has an effort, when it is the only set, for accessories, or for later sets', () => {
    expect(
      removalNeedsEffort(
        [
          { ...set, rpe: 8 },
          { ...set, rpe: 9 },
        ],
        0,
        primary,
      ),
    ).toBe(false)
    expect(removalNeedsEffort([{ ...set, rpe: 8 }], 0, primary)).toBe(false)
    expect(removalNeedsEffort([set, set], 0, accessory)).toBe(false)
    expect(removalNeedsEffort([{ ...set, rpe: 8 }, set, set], 1, primary)).toBe(false)
  })

  it('never asks when deleting a later set, even if set 1 has no effort (an exercise that was an accessory)', () => {
    expect(removalNeedsEffort([set, set, set], 1, primary)).toBe(false)
    expect(removalNeedsEffort([set, set, set], 2, primary)).toBe(false)
  })

  it('saves the delete and the new set 1 together, at one working weight', () => {
    expect(
      removeFirstSet(
        [
          { weight: 225, reps: 5, rpe: 8 },
          { weight: 225, reps: 4 },
          { weight: 225, reps: 3 },
        ],
        { weight: 220, reps: 4, rpe: 9 },
      ),
    ).toEqual([
      { weight: 220, reps: 4, rpe: 9 },
      { weight: 220, reps: 3 },
    ])
  })
})

describe('set editing (one working weight, SPEC §6.3)', () => {
  it('adding a set at a new weight moves every set to that weight', () => {
    const sets = addSet([{ weight: 225, reps: 4, rpe: 8 }], { weight: 230, reps: 4 })
    expect(sets.map((s) => s.weight)).toEqual([230, 230])
  })

  it('editing one set updates it and applies its weight to the others', () => {
    const sets = updateSet(
      [
        { weight: 255, reps: 4, rpe: 8 },
        { weight: 255, reps: 3 },
      ],
      0,
      { weight: 225, reps: 5, rpe: 8 },
    )
    expect(sets).toEqual([
      { weight: 225, reps: 5, rpe: 8 },
      { weight: 225, reps: 3 },
    ])
  })

  it('deleting a set removes only that set', () => {
    expect(
      removeSet(
        [
          { weight: 225, reps: 5 },
          { weight: 225, reps: 4 },
        ],
        0,
      ),
    ).toEqual([{ weight: 225, reps: 4 }])
  })

  describe('finishing a session', () => {
    const tierOf = (id: string) => (id === 'bench' ? 'primary' : 'accessory')

    it('needs at least one logged set', () => {
      expect(canFinish([{ exerciseId: 'bench', sets: [] }], tierOf)).toBe(false)
    })

    it('needs an RPE on the first set of each logged primary lift', () => {
      const bench = (rpe?: number) => ({ exerciseId: 'bench', sets: [{ weight: 225, reps: 4, rpe }] })
      expect(canFinish([bench()], tierOf)).toBe(false)
      expect(canFinish([bench(8)], tierOf)).toBe(true)
    })

    it('does not need RPE on accessories, and skipped exercises do not block it', () => {
      const logs = [
        { exerciseId: 'bench', sets: [] },
        { exerciseId: 'curl', sets: [{ weight: 30, reps: 12 }] },
      ]
      expect(canFinish(logs, tierOf)).toBe(true)
    })
  })
})

describe('finishing with the exercise menu (SPEC §5.2)', () => {
  const tierOf = (id: string) => (id === 'bench' ? 'primary' : 'accessory')

  it('a replaced primary counts its substitute sets and needs no RPE', () => {
    const logs = [
      {
        exerciseId: 'bench',
        sets: [],
        substitute: { name: 'Machine press', sets: [{ weight: 150, reps: 10 }] },
      },
    ]
    expect(canFinish(logs, tierOf)).toBe(true)
  })

  it('a skipped exercise counts for nothing', () => {
    expect(canFinish([{ exerciseId: 'curl', sets: [{ weight: 30, reps: 12 }], skipped: true }], tierOf)).toBe(
      false,
    )
    expect(loggedSets({ exerciseId: 'curl', sets: [{ weight: 30, reps: 12 }], skipped: true })).toEqual([])
  })
})

describe('extra sets (SPEC §5.2)', () => {
  const x = (weight: number, reps: number) => ({ weight, reps, extra: true })

  it('are added after the prescribed sets with their own weight and no effort', () => {
    expect(addExtra([{ weight: 225, reps: 5, rpe: 8 }], { weight: 185, reps: 8, rpe: 7 })).toEqual([
      { weight: 225, reps: 5, rpe: 8 },
      x(185, 8),
    ])
  })

  it('keep their weight when a prescribed set changes weight, and change alone', () => {
    const sets = [{ weight: 225, reps: 5, rpe: 8 }, { weight: 225, reps: 4 }, x(185, 8)]
    expect(updateSet(sets, 1, { weight: 230, reps: 4 }).map((s) => s.weight)).toEqual([230, 230, 185])
    expect(updateSet(sets, 2, { weight: 175, reps: 10, rpe: 9 })).toEqual([sets[0], sets[1], x(175, 10)])
  })

  it('stay after a prescribed set logged later, e.g. after deleting one', () => {
    expect(addSet([{ weight: 225, reps: 5, rpe: 8 }, x(185, 8)], { weight: 225, reps: 4 })).toEqual([
      { weight: 225, reps: 5, rpe: 8 },
      { weight: 225, reps: 4 },
      x(185, 8),
    ])
  })

  it('count toward neither "all sets logged" nor the session tally', () => {
    expect(allSetsLogged([set, set, x(185, 8)], 3)).toBe(false)
    expect(setTally([{ log: bench([set, set, x(185, 8)]), target: 3 }])).toEqual({ logged: 2, target: 3 })
  })

  it('never need or supply set 1’s effort, and never become set 1 on a delete', () => {
    const primary = (i: number) => i === 0
    expect(hasRequiredEffort('primary', [x(185, 8)])).toBe(true)
    expect(hasRequiredEffort('primary', [{ ...set, rpe: 8 }, x(185, 8)])).toBe(true)
    expect(removalNeedsEffort([{ ...set, rpe: 8 }, x(185, 8)], 0, primary)).toBe(false)
  })

  it('ask for set 2’s effort when set 1 is deleted with extras present, and keep the extras’ weight', () => {
    const sets = [{ weight: 225, reps: 5, rpe: 8 }, { weight: 225, reps: 4 }, x(185, 8)]
    expect(removalNeedsEffort(sets, 0, (i) => i === 0)).toBe(true)
    expect(removeFirstSet(sets, { weight: 220, reps: 4, rpe: 9 })).toEqual([
      { weight: 220, reps: 4, rpe: 9 },
      x(185, 8),
    ])
  })

  it('show a finished exercise’s outcome only when it has prescribed sets', () => {
    expect(showsOutcome(true, [x(185, 8)], 3)).toBe(false)
  })
})

describe('shownTarget (SPEC §6.8)', () => {
  it('shows the target live, and in a finished session only with a saved prescription', () => {
    const log = { exerciseId: 'bench', sets: [] }
    const prescribed = { ...log, prescription: { repRange: { min: 3, max: 5 }, sets: 3 } }
    expect(shownTarget(log, false, 3)).toBe(3)
    expect(shownTarget(prescribed, true, 3)).toBe(3)
    expect(shownTarget(log, true, 3)).toBeUndefined()
  })
})

describe('substituteStep', () => {
  it('steps 5 lb up or down', () => {
    expect(substituteStep(100, 1)).toBe(105)
    expect(substituteStep(100, -1)).toBe(95)
  })

  it('never goes below 0', () => {
    expect(substituteStep(2.5, -1)).toBe(0)
    expect(substituteStep(0, -1)).toBe(0)
  })

  it('steps a weight that isn’t a number from 0', () => {
    expect(substituteStep(NaN, 1)).toBe(5)
    expect(substituteStep(NaN, -1)).toBe(0)
  })
})

describe('loggedSetCount', () => {
  it('counts the original exercise’s sets, extras included, and a substitute’s', () => {
    expect(loggedSetCount({ exerciseId: 'b', sets: [] })).toBe(0)
    expect(
      loggedSetCount({
        exerciseId: 'b',
        sets: [
          { weight: 225, reps: 5 },
          { weight: 185, reps: 8, extra: true },
        ],
        substitute: { name: 'Machine press', sets: [{ weight: 150, reps: 10 }] },
      }),
    ).toBe(3)
  })
})
