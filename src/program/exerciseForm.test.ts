import { describe, expect, it } from 'vitest'
import { exerciseFromBank, findBankExercise } from './bank'
import { fromForm, toForm, validateExerciseForm, withTier } from './exerciseForm'
import type { ProgramExercise } from './types'

const bench: ProgramExercise = {
  id: 'bench',
  name: 'Bench Press',
  tier: 'primary',
  repRange: { min: 3, max: 5 },
  targetRpe: 8.5,
  sets: 3,
  equipment: 'barbell',
  loads: [45, 95, 135],
  maxRelativeJump: 0.1,
  unilateral: false,
  seed: { weight: 225, reps: 5 },
  archived: true,
}

describe('the exercise form (SPEC §6.1)', () => {
  it('round-trips an existing exercise, keeping its id and other stored fields', () => {
    expect(fromForm(toForm(bench), bench)).toEqual(bench)
  })

  it("starts a bank exercise from the bank's defaults, with no starting numbers (SPEC §5.1)", () => {
    const form = toForm(exerciseFromBank(findBankExercise('Lateral Raise')!))
    expect(form).toMatchObject({ name: 'Lateral Raise', tier: 'accessory', targetRpe: 8, loads: '' })
    expect([form.seedWeight, form.seedReps]).toEqual(['', ''])
  })

  it('starts a custom exercise blank, as a 3-set barbell primary', () => {
    expect(toForm()).toMatchObject({ name: '', tier: 'primary', sets: '3', equipment: 'barbell', min: '' })
  })

  it('gives a new exercise a new id', () => {
    expect(fromForm(toForm(bench), undefined, () => 'new-id').id).toBe('new-id')
  })

  it('moves a bodyweight exercise to barbell when it becomes a primary (bodyweight is accessory-only)', () => {
    const pullUp = { ...toForm(bench), tier: 'accessory' as const, equipment: 'bodyweight' as const }
    expect(withTier(pullUp, 'primary').equipment).toBe('barbell')
    expect(withTier({ ...pullUp, equipment: 'dumbbell' }, 'primary').equipment).toBe('dumbbell')
  })
})

describe('validating the exercise form', () => {
  const valid = toForm(bench)

  it('accepts a complete form', () => {
    expect(validateExerciseForm(valid)).toEqual([])
  })

  it('needs a name, a whole-number rep range in order, and at least one set', () => {
    expect(validateExerciseForm({ ...valid, name: '  ' })).toEqual(['Name is required.'])
    expect(validateExerciseForm({ ...valid, min: '6', max: '5' })).toEqual([
      'Rep range needs whole numbers, with the top at least the bottom.',
    ])
    expect(validateExerciseForm({ ...valid, sets: '0' })).toEqual(['Sets must be at least 1.'])
  })

  it('needs loads that are numbers, and loads at all for cable and machine (SPEC §6.2)', () => {
    expect(validateExerciseForm({ ...valid, loads: '45, plates' })).toEqual([
      'Loads must be numbers, e.g. 99, 110, 121.',
    ])
    expect(validateExerciseForm({ ...valid, equipment: 'cable', loads: '' })).toEqual([
      'Enter the stack weights for cable and machine exercises.',
    ])
  })

  it('leaves starting numbers optional, but checks them once any are typed (SPEC §5.1)', () => {
    expect(validateExerciseForm({ ...valid, seedWeight: '', seedReps: '' })).toEqual([])
    expect(validateExerciseForm({ ...valid, seedWeight: '', seedReps: '5' })).toEqual([
      'Starting weight must be a number.',
    ])
    expect(validateExerciseForm({ ...valid, seedWeight: '225', seedReps: '' })).toEqual([
      'Starting reps must be at least 1.',
    ])
  })

  it("records an accessory's starting weight at the bottom of its range", () => {
    const curl = {
      ...valid,
      tier: 'accessory' as const,
      min: '10',
      max: '12',
      seedWeight: '30',
      seedReps: '',
    }
    expect(validateExerciseForm(curl)).toEqual([])
    expect(fromForm(curl, bench).seed).toEqual({ weight: 30, reps: 10 })
  })

  it('saves no starting numbers when none are typed', () => {
    expect(fromForm({ ...valid, seedWeight: '', seedReps: '' }, bench).seed).toBeUndefined()
  })
})
