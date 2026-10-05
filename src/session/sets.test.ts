import { describe, expect, it } from 'vitest'
import type { Suggestion } from '../engine'
import {
  addSet,
  allSetsLogged,
  canFinish,
  hasRequiredEffort,
  loggedSets,
  removalNeedsEffort,
  removeFirstSet,
  removeSet,
  setTally,
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

describe('deleting set 1 (SPEC §9.2, slice 1)', () => {
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
