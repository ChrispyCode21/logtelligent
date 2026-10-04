import { describe, expect, it } from 'vitest'
import { addSet, canFinish, loggedSets, removeSet, updateSet } from './sets'

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
