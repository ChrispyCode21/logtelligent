import { describe, expect, it } from 'vitest'
import { exerciseFromBank, findBankExercise } from './bank'
import {
  equipmentOptions,
  fromForm,
  schemesFor,
  toForm,
  validateExerciseForm,
  withEquipment,
  withScheme,
  withTier,
} from './exerciseForm'
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

describe('the progression scheme in the form (SPEC §6.1)', () => {
  const adaptive = toForm(bench)

  it('starts Adaptive, and Linear at a 5 lb increase with Reps at the top of the range', () => {
    expect(adaptive.scheme).toBe('adaptive')
    const linear = withScheme(adaptive, 'linear')
    expect(linear).toMatchObject({ scheme: 'linear', increment: '5', reps: '5', min: '3', max: '5' })
  })

  it('finds the range as it was when switched back in the same form', () => {
    const linear = { ...withScheme(adaptive, 'linear'), reps: '8' }
    expect(withScheme(linear, 'adaptive')).toMatchObject({ scheme: 'adaptive', min: '3', max: '5' })
    expect(fromForm(withScheme(linear, 'adaptive'), bench).repRange).toEqual({ min: 3, max: 5 })
  })

  it('saves Linear as a range with equal ends and its increment, keeping the target RPE', () => {
    const saved = fromForm({ ...withScheme(adaptive, 'linear'), increment: '2.5' }, bench)
    expect(saved).toMatchObject({ repRange: { min: 5, max: 5 }, targetRpe: 8.5 })
    expect(saved.progression).toEqual({ scheme: 'linear', increment: 2.5 })
    expect(toForm(saved)).toMatchObject({ scheme: 'linear', increment: '2.5', reps: '5' })
  })

  it('stores no scheme for Adaptive, even switching back from a saved Linear exercise', () => {
    const squat = fromForm(withScheme(adaptive, 'linear'), bench)
    expect(fromForm(withScheme(toForm(squat), 'adaptive'), squat)).not.toHaveProperty('progression')
  })

  it('checks the Reps number and the increase', () => {
    const linear = withScheme(adaptive, 'linear')
    expect(validateExerciseForm({ ...linear, min: '9', max: '1' })).toEqual([])
    expect(validateExerciseForm({ ...linear, reps: '0' })).toEqual([
      'Reps must be a whole number, at least 1.',
    ])
    for (const increment of ['', '0', '0.25', '101', 'lots']) {
      expect(validateExerciseForm({ ...linear, increment })).toEqual([
        'The increase must be from 0.5 to 100 lb.',
      ])
    }
  })

  it("takes a Linear primary's starting numbers as a weight only, at its rep target (SPEC §5.1)", () => {
    const linear = { ...withScheme(adaptive, 'linear'), seedWeight: '135', seedReps: '' }
    expect(validateExerciseForm(linear)).toEqual([])
    expect(fromForm(linear, bench).seed).toEqual({ weight: 135, reps: 5 })
  })
})

describe('Waves in the form (SPEC §6.1, §6.11)', () => {
  const waves = withScheme(toForm(bench), 'waves')

  it('starts at a 5 lb increase', () => {
    expect(waves).toMatchObject({ scheme: 'waves', increment: '5' })
  })

  it('is valid without a usable rep range or set count', () => {
    expect(validateExerciseForm({ ...waves, min: '', max: 'x', sets: '0' })).toEqual([])
  })

  it('checks the increment, within the same bounds as Linear', () => {
    for (const increment of ['', '0', '0.25', '101', 'lots']) {
      expect(validateExerciseForm({ ...waves, increment })).toEqual([
        'The increase must be from 0.5 to 100 lb.',
      ])
    }
    for (const increment of ['0.5', '10', '100']) {
      expect(validateExerciseForm({ ...waves, increment })).toEqual([])
    }
  })

  it('stores the scheme and increment, keeping the rep range, sets and target RPE', () => {
    const saved = fromForm({ ...waves, increment: '10' }, bench)
    expect(saved.progression).toEqual({ scheme: 'waves', increment: 10 })
    expect(saved).toMatchObject({ repRange: { min: 3, max: 5 }, sets: 3, targetRpe: 8.5 })
    expect(toForm(saved)).toMatchObject({ scheme: 'waves', increment: '10' })
  })

  it('stores a valid range and set count for a new Waves exercise whose were never typed', () => {
    const saved = fromForm({ ...waves, min: '', max: '', sets: '' })
    expect(saved).toMatchObject({ repRange: { min: 5, max: 5 }, sets: 3 })
  })

  it('takes starting numbers as a weight and reps, for either tier (SPEC §5.1)', () => {
    for (const tier of ['primary', 'accessory'] as const) {
      const form = { ...waves, tier, seedWeight: '135', seedReps: '' }
      expect(validateExerciseForm(form)).toEqual(['Starting reps must be at least 1.'])
      expect(fromForm({ ...form, seedReps: '5' }, bench).seed).toEqual({ weight: 135, reps: 5 })
    }
  })

  it('keeps the typed values switching Linear to Waves and back to Adaptive in one form', () => {
    const linear = { ...withScheme(toForm(bench), 'linear'), reps: '8' }
    const back = withScheme(withScheme(linear, 'waves'), 'adaptive')
    expect(back).toMatchObject({ scheme: 'adaptive', min: '3', max: '5', sets: '3' })
    expect(fromForm(back, bench)).not.toHaveProperty('progression')
  })
})

describe('Waves and bodyweight equipment (SPEC §6.1, §6.11)', () => {
  const waves = { ...withScheme(toForm(bench), 'waves'), tier: 'accessory' as const }
  const all = ['barbell', 'dumbbell', 'bodyweight'] as const

  it('offers Adaptive and Linear for bodyweight, and all three for other equipment', () => {
    expect(schemesFor('bodyweight')).toEqual(['adaptive', 'linear'])
    expect(schemesFor('dumbbell')).toEqual(['adaptive', 'linear', 'waves'])
  })

  it('moves a Waves exercise to Adaptive when it becomes bodyweight, restoring its range and sets', () => {
    const form = withEquipment(waves, 'bodyweight')
    expect(form).toMatchObject({ equipment: 'bodyweight', scheme: 'adaptive', min: '3', max: '5', sets: '3' })
    expect(fromForm(form, bench)).not.toHaveProperty('progression')
  })

  it('leaves the scheme alone for other changes', () => {
    expect(withEquipment(waves, 'dumbbell').scheme).toBe('waves')
    const linear = withScheme(toForm(bench), 'linear')
    expect(withEquipment(linear, 'bodyweight').scheme).toBe('linear')
    expect(withEquipment({ ...toForm(bench), equipment: 'bodyweight' }, 'barbell').scheme).toBe('adaptive')
  })

  it('leaves bodyweight out for a primary and for a Waves exercise whose scheme is fixed', () => {
    expect(equipmentOptions(all, 'primary', 'adaptive', false)).toEqual(['barbell', 'dumbbell'])
    expect(equipmentOptions(all, 'accessory', 'waves', true)).toEqual(['barbell', 'dumbbell'])
    expect(equipmentOptions(all, 'accessory', 'waves', false)).toEqual([...all])
    expect(equipmentOptions(all, 'accessory', 'adaptive', true)).toEqual([...all])
  })
})
