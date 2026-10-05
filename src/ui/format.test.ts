import { describe, expect, it } from 'vitest'
import { formatE1rm, formatPrescription, formatSet, formatSets, formatWeight } from './format'

describe('formatSet', () => {
  it('shows the RPE when logged', () => {
    expect(formatSet({ weight: 225, reps: 4, rpe: 8 })).toBe('225 × 4 @ 8')
    expect(formatSet({ weight: 225, reps: 4, rpe: 8.5 })).toBe('225 × 4 @ 8.5')
  })

  it('shows effort in the program’s scale (SPEC §9.1, slice 1)', () => {
    expect(formatSet({ weight: 225, reps: 4, rpe: 8 }, 'repsLeft')).toBe('225 × 4 · 2 left')
    expect(formatSet({ weight: 225, reps: 4, rpe: 8 }, 'perceived')).toBe('225 × 4 · Challenging')
    expect(formatSet({ weight: 225, reps: 4, rpe: 8.5 }, 'repsLeft')).toBe('225 × 4 · 1 left')
    expect(formatSet({ weight: 225, reps: 4 }, 'repsLeft')).toBe('225 × 4')
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

  it('uses the program’s scale for every set', () => {
    expect(
      formatSets(
        [
          { weight: 225, reps: 4, rpe: 8 },
          { weight: 225, reps: 3 },
        ],
        'repsLeft',
      ),
    ).toBe('225 × 4 · 2 left · 225 × 3')
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

describe('formatPrescription (SPEC §9.2, slice 0)', () => {
  const bench = {
    tier: 'primary' as const,
    sets: 3,
    repRange: { min: 5, max: 7 },
    unilateral: false,
    equipment: 'barbell' as const,
    targetRpe: 8,
  }

  it('shows tier, sets × reps and the equipment label', () => {
    expect(formatPrescription(bench)).toBe('Primary · 3 × 5–7 · Barbell')
  })

  it('adds a primary’s effort target in the scale given', () => {
    expect(formatPrescription(bench, 'rpe')).toBe('Primary · 3 × 5–7 @ RPE 8 · Barbell')
    expect(formatPrescription(bench, 'repsLeft')).toBe('Primary · 3 × 5–7 with 2 reps left · Barbell')
  })

  it('says per side for one side at a time, and gives accessories no target', () => {
    const lunge = { ...bench, tier: 'accessory' as const, repRange: { min: 10, max: 12 }, unilateral: true }
    expect(formatPrescription({ ...lunge, equipment: 'dumbbell' }, 'rpe')).toBe(
      'Accessory · 3 × 10–12 per side · Dumbbell',
    )
  })
})
