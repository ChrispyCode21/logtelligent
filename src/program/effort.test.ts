import { describe, expect, it } from 'vitest'
import { EFFORT_SCALES, effortSuffix, effortTarget, nearestOption } from './effort'

describe('effort scales (SPEC §9.1, slice 1)', () => {
  it('maps every option onto the 6–10 RPE scale', () => {
    expect(EFFORT_SCALES.repsLeft.options.map((o) => [o.label, o.rpe])).toEqual([
      ['4+', 6],
      ['3', 7],
      ['2', 8],
      ['1', 9],
      ['0', 10],
    ])
    expect(EFFORT_SCALES.perceived.options.map((o) => [o.label, o.rpe])).toEqual([
      ['Easy', 6],
      ['Moderate', 7],
      ['Challenging', 8],
      ['Very hard', 9],
      ['Failed on the last rep', 10],
    ])
    expect(EFFORT_SCALES.rpe.options.map((o) => o.rpe)).toEqual([6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10])
  })

  it('finds the exact option for a stored value', () => {
    expect(nearestOption('repsLeft', 8).label).toBe('2')
    expect(nearestOption('perceived', 10).label).toBe('Failed on the last rep')
    expect(nearestOption('rpe', 8.5).label).toBe('8.5')
  })

  it('rounds a half step toward harder', () => {
    expect(nearestOption('repsLeft', 8.5).label).toBe('1')
    expect(nearestOption('perceived', 8.5).label).toBe('Very hard')
    expect(nearestOption('repsLeft', 6.5).label).toBe('3')
  })

  it('clamps values outside 6–10 to the nearest end', () => {
    expect(nearestOption('repsLeft', 5).label).toBe('4+')
    expect(nearestOption('perceived', 1).label).toBe('Easy')
  })
})

describe('showing effort', () => {
  it('shows a set’s effort in the program’s scale', () => {
    expect(effortSuffix('rpe', 8)).toBe('@ 8')
    expect(effortSuffix('repsLeft', 8)).toBe('· 2 left')
    expect(effortSuffix('repsLeft', 6)).toBe('· 4+ left')
    expect(effortSuffix('perceived', 8)).toBe('· Challenging')
  })

  it('shows a first-set target in the program’s scale', () => {
    expect(`first set${effortTarget('rpe', 8)}`).toBe('first set @ RPE 8')
    expect(`first set${effortTarget('repsLeft', 8)}`).toBe('first set with 2 reps left')
    expect(`first set${effortTarget('repsLeft', 9)}`).toBe('first set with 1 rep left')
    expect(`first set${effortTarget('perceived', 8)}`).toBe('first set: Challenging')
  })
})
