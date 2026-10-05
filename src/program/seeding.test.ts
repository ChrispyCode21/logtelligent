import { describe, expect, it } from 'vitest'
import type { EquipmentType } from '../engine'
import { exerciseFromBank, findBankExercise } from './bank'
import {
  formSeedPlaceholder,
  hasInvalidLoads,
  needsStack,
  parseLoads,
  seedPrefill,
  stackLoads,
  STACK_PRESETS,
  toSeed,
  usesStack,
  validateSeed,
  validateSeedStep,
} from './seeding'

const fromBank = (name: string) => exerciseFromBank(findBankExercise(name)!)

describe('guided seeding (SPEC §9.1, slice 3)', () => {
  it('pre-fills a primary with the bank weight and the top of its range', () => {
    expect(seedPrefill(fromBank('Bench Press'))).toEqual({ weight: '95', reps: '7' })
  })

  it('pre-fills an accessory with the bank weight only', () => {
    expect(seedPrefill(fromBank('Lateral Raise'))).toEqual({ weight: '10', reps: '' })
  })

  it('snaps the pre-filled weight onto the chosen stack', () => {
    const tenLb = STACK_PRESETS.find((p) => p.id === '10')!.loads
    expect(seedPrefill(fromBank('Face Pull'), tenLb).weight).toBe('20')
  })

  it('snaps onto a custom stack typed in any order, and ignores one that has a non-weight in it', () => {
    expect(seedPrefill(fromBank('Face Pull'), [20, 10, 40]).weight).toBe('20')
    expect(seedPrefill(fromBank('Face Pull'), [Number.NaN, 50]).weight).toBe('25')
  })

  it("checks a step's stack before its starting numbers", () => {
    const blank = { weight: '', reps: '' }
    expect(validateSeedStep(blank, 'accessory', true, undefined)).toEqual([
      'Enter the stack weights, e.g. 10, 20, 30.',
      'Starting weight must be a number.',
    ])
    expect(validateSeedStep({ weight: '20', reps: '' }, 'accessory', true, [10, Number.NaN])).toEqual([
      'Enter the stack weights, e.g. 10, 20, 30.',
    ])
    expect(validateSeedStep({ weight: '20', reps: '' }, 'accessory', false, undefined)).toEqual([])
  })

  it('leaves exercises that are not in the bank blank', () => {
    expect(seedPrefill({ ...fromBank('Bench Press'), name: 'Spoto Press' })).toEqual({ weight: '', reps: '' })
  })

  it('asks for a stack only for cable and machine exercises without one', () => {
    expect(needsStack(fromBank('Lat Pulldown'))).toBe(true)
    expect(needsStack({ ...fromBank('Lat Pulldown'), loads: [10, 20] })).toBe(false)
    expect(needsStack(fromBank('Bench Press'))).toBe(false)
    const equipment: EquipmentType[] = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight']
    expect(equipment.filter(usesStack)).toEqual(['cable', 'machine'])
  })

  it('turns a stack pick into its loads', () => {
    expect(stackLoads({ choice: '5', custom: '' })?.slice(0, 3)).toEqual([5, 10, 15])
    expect(stackLoads({ choice: '10', custom: '' })?.at(-1)).toBe(300)
    expect(stackLoads({ choice: 'custom', custom: '12.5, 25' })).toEqual([12.5, 25])
    expect(stackLoads({ choice: 'custom', custom: ' ' })).toBeUndefined()
  })
})

describe('typed loads', () => {
  it('splits on commas and spaces, and is undefined when empty', () => {
    expect(parseLoads('99, 110,121  132')).toEqual([99, 110, 121, 132])
    expect(parseLoads('  ')).toBeUndefined()
  })

  it('keeps entries that are not numbers, for validation to catch', () => {
    const loads = parseLoads('10, ten')
    expect(loads?.[1]).toBeNaN()
    expect(hasInvalidLoads(loads)).toBe(true)
    expect(hasInvalidLoads([-5])).toBe(true)
    expect(hasInvalidLoads([0, 10])).toBe(false)
    expect(hasInvalidLoads(undefined)).toBe(false)
  })
})

describe('starting numbers (SPEC §5.1)', () => {
  it('needs a weight of 0 or more', () => {
    expect(validateSeed({ weight: '', reps: '' }, 'accessory')).toEqual(['Starting weight must be a number.'])
    expect(validateSeed({ weight: 'heavy', reps: '' }, 'accessory')).toEqual([
      'Starting weight must be a number.',
    ])
    expect(validateSeed({ weight: '-5', reps: '' }, 'accessory')).toEqual([
      'Starting weight must be a number.',
    ])
    expect(validateSeed({ weight: '0', reps: '' }, 'accessory')).toEqual([])
  })

  it('needs whole reps of at least 1 on a primary, and none on an accessory', () => {
    const reps = ['Starting reps must be at least 1.']
    expect(validateSeed({ weight: '225', reps: '' }, 'primary')).toEqual(reps)
    expect(validateSeed({ weight: '225', reps: '0' }, 'primary')).toEqual(reps)
    expect(validateSeed({ weight: '225', reps: '4.5' }, 'primary')).toEqual(reps)
    expect(validateSeed({ weight: '225', reps: '5' }, 'primary')).toEqual([])
  })

  it("records a primary's reps, and an accessory's weight at the bottom of its range", () => {
    const repRange = { min: 12, max: 15 }
    expect(toSeed({ weight: '225', reps: '5' }, 'primary', repRange)).toEqual({ weight: 225, reps: 5 })
    expect(toSeed({ weight: '20', reps: '' }, 'accessory', repRange)).toEqual({ weight: 20, reps: 12 })
  })
})

describe("the exercise form's starting-weight placeholder", () => {
  it("is the bank's weight, snapped down onto typed loads (SPEC §9.2, slice 0)", () => {
    expect(formSeedPlaceholder('primary', 'barbell', undefined, 95)).toBe('95')
    expect(formSeedPlaceholder('accessory', 'cable', [10, 40, 20, 30], 25)).toBe('20')
    expect(formSeedPlaceholder('accessory', 'cable', [30, 40], 25)).toBe('30')
  })

  it("ignores typed loads that aren't all numbers", () => {
    expect(formSeedPlaceholder('accessory', 'cable', [10, Number.NaN], 25)).toBe('25')
  })

  it('without a bank weight: none for a primary; a general suggestion or the first load for an accessory', () => {
    expect(formSeedPlaceholder('primary', 'barbell', undefined)).toBeUndefined()
    expect(formSeedPlaceholder('accessory', 'dumbbell', undefined)).toBe('15')
    expect(formSeedPlaceholder('accessory', 'machine', [60, 50])).toBe('50')
    expect(formSeedPlaceholder('accessory', 'machine', [Number.NaN, 50])).toBe('')
    expect(formSeedPlaceholder('accessory', 'machine', undefined)).toBe('')
  })
})
