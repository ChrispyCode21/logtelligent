import { describe, expect, it } from 'vitest'
import { addSet, canFinish, removeSet, updateSet } from './sets'

describe('set editing (one working weight, SPEC §6.3)', () => {
  it('adding a set at a new weight moves every set to that weight', () => {
    const sets = addSet([{ weight: 225, reps: 4, rpe: 8 }], { weight: 230, reps: 4 })
    expect(sets.map((s) => s.weight)).toEqual([230, 230])
  })

  it('editing one set updates it and applies its weight to the others', () => {
    const sets = updateSet(
      [{ weight: 255, reps: 4, rpe: 8 }, { weight: 255, reps: 3 }],
      0,
      { weight: 225, reps: 5, rpe: 8 },
    )
    expect(sets).toEqual([{ weight: 225, reps: 5, rpe: 8 }, { weight: 225, reps: 3 }])
  })

  it('deleting a set removes only that set', () => {
    expect(removeSet([{ weight: 225, reps: 5 }, { weight: 225, reps: 4 }], 0)).toEqual([
      { weight: 225, reps: 4 },
    ])
  })

  it('a session can finish only once set 1 has an RPE', () => {
    expect(canFinish([])).toBe(false)
    expect(canFinish([{ weight: 225, reps: 4 }])).toBe(false)
    expect(canFinish([{ weight: 225, reps: 4, rpe: 8 }, { weight: 225, reps: 3 }])).toBe(true)
  })
})
