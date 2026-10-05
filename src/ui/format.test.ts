import { describe, expect, it } from 'vitest'
import { formatE1rm, formatSet, formatSets, formatWeight } from './format'

describe('formatSet', () => {
  it('shows the RPE when logged', () => {
    expect(formatSet({ weight: 225, reps: 4, rpe: 8 })).toBe('225 × 4 @ 8')
    expect(formatSet({ weight: 225, reps: 4, rpe: 8.5 })).toBe('225 × 4 @ 8.5')
  })

  it('leaves the RPE out when not logged', () => {
    expect(formatSet({ weight: 15, reps: 20 })).toBe('15 × 20')
  })
})

describe('formatSets', () => {
  it('joins sets with a middle dot', () => {
    expect(
      formatSets([
        { weight: 225, reps: 4, rpe: 8 },
        { weight: 225, reps: 3 },
      ]),
    ).toBe('225 × 4 @ 8 · 225 × 3')
  })

  it('is empty for no sets', () => {
    expect(formatSets([])).toBe('')
  })
})

describe('formatWeight', () => {
  it('shows pounds', () => {
    expect(formatWeight(225, 'barbell')).toBe('225 lb')
    expect(formatWeight(22.5)).toBe('22.5 lb')
  })

  it('shows bodyweight loads as added weight', () => {
    expect(formatWeight(0, 'bodyweight')).toBe('Bodyweight')
    expect(formatWeight(10, 'bodyweight')).toBe('BW + 10 lb')
  })
})

describe('formatE1rm', () => {
  it('rounds to one decimal', () => {
    expect(formatE1rm(271.0844)).toBe('271.1 lb')
    expect(formatE1rm(250)).toBe('250.0 lb')
  })
})
