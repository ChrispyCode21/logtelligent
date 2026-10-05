import { describe, expect, it } from 'vitest'
import { defaultLoads } from '../engine'
import { BANK, BODY_AREAS, findBankExercise, searchBank } from './bank'

describe('exercise bank (SPEC §9.1, slice 2)', () => {
  it('has about 50 exercises in every body area', () => {
    expect(BANK.length).toBeGreaterThanOrEqual(45)
    for (const { id } of BODY_AREAS) expect(BANK.some((e) => e.area === id)).toBe(true)
  })

  it('has unique ids and names', () => {
    expect(new Set(BANK.map((e) => e.id)).size).toBe(BANK.length)
    expect(new Set(BANK.map((e) => e.name.toLowerCase())).size).toBe(BANK.length)
  })

  it.each(BANK.map((e) => [e.name, e] as const))('%s follows the program rules', (_, e) => {
    // Bodyweight exercises are accessories only (SPEC §6.1).
    if (e.equipment === 'bodyweight') expect(e.tier).toBe('accessory')
    expect(Number.isInteger(e.repRange.min) && e.repRange.min >= 1).toBe(true)
    expect(e.repRange.max).toBeGreaterThanOrEqual(e.repRange.min)
    expect(e.sets).toBeGreaterThanOrEqual(1)
    expect(e.description.length).toBeGreaterThan(10)
    // The seed placeholder must be a load the equipment offers (cable/machine stacks are the gym's).
    const loads = defaultLoads(e.equipment)
    if (loads.length > 0) expect(loads).toContain(e.seedPlaceholder)
    else expect(e.seedPlaceholder).toBeGreaterThan(0)
  })
})

describe('searchBank', () => {
  const names = (q: string) => searchBank(q).map((e) => e.name)

  it('returns everything for an empty query', () => {
    expect(searchBank('  ')).toHaveLength(BANK.length)
  })

  it('matches names, ignoring case and punctuation', () => {
    expect(names('PULL-UP')).toEqual(['Pull-Up'])
    expect(names('pull up')).toEqual(['Pull-Up'])
    expect(names('bench')).toEqual(
      expect.arrayContaining(['Bench Press', 'Incline Bench Press', 'Close-Grip Bench Press']),
    )
  })

  it('matches nicknames', () => {
    expect(names('rdl')).toEqual(['Romanian Deadlift'])
    expect(names('OHP')).toEqual(['Overhead Press'])
    expect(names('db row')).toEqual(['One-Arm Dumbbell Row'])
  })

  it('needs every word typed, in any order', () => {
    expect(names('incline press')).toEqual(['Incline Bench Press', 'Incline Dumbbell Press'])
    expect(names('press incline')).toEqual(['Incline Bench Press', 'Incline Dumbbell Press'])
  })

  it('returns nothing when nothing matches', () => {
    expect(searchBank('zercher')).toEqual([])
  })
})

describe('findBankExercise', () => {
  it('finds a bank exercise by name, ignoring case and punctuation', () => {
    expect(findBankExercise('bench press')?.id).toBe('bench-press')
    expect(findBankExercise('Pull Up')?.id).toBe('pull-up')
    expect(findBankExercise('Zercher Squat')).toBeUndefined()
  })
})
