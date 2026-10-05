import { describe, expect, it } from 'vitest'
import { BANK, exerciseFromBank, findBankExercise } from './bank'
import { EMPTY_PROGRAM, activeDays, missingSeeds } from './program'
import { needsStack, seedPrefill, STACK_PRESETS } from './seeding'
import { applyTemplate, TEMPLATES, templateDays } from './templates'
import type { Program } from './types'

const upperLower = TEMPLATES[0]

describe('program templates (SPEC §9.1, slice 3)', () => {
  it('uses only bank exercises', () => {
    for (const t of TEMPLATES)
      for (const day of t.days) for (const id of day.exercises) expect(BANK.map((b) => b.id)).toContain(id)
  })

  it('ships the decided 4-day Upper/Lower', () => {
    const names = templateDays(upperLower).map((d) => [d.name, d.exercises.map((e) => e.name)])
    expect(names).toEqual([
      [
        'Upper A',
        [
          'Bench Press',
          'Barbell Row',
          'Dumbbell Shoulder Press',
          'Lat Pulldown',
          'Lateral Raise',
          'Triceps Pushdown',
        ],
      ],
      ['Lower A', ['Back Squat', 'Romanian Deadlift', 'Leg Press', 'Lying Leg Curl', 'Standing Calf Raise']],
      [
        'Upper B',
        [
          'Overhead Press',
          'Pull-Up',
          'Incline Dumbbell Press',
          'Seated Cable Row',
          'Dumbbell Curl',
          'Face Pull',
        ],
      ],
      [
        'Lower B',
        ['Deadlift', 'Bulgarian Split Squat', 'Leg Extension', 'Seated Leg Curl', 'Hanging Leg Raise'],
      ],
    ])
  })

  it('uses different exercises on each pass of a day type (SPEC §5.1)', () => {
    const [upperA, lowerA, upperB, lowerB] = upperLower.days.map((d) => d.exercises)
    expect(upperA.filter((e) => upperB.includes(e))).toEqual([])
    expect(lowerA.filter((e) => lowerB.includes(e))).toEqual([])
  })

  it('gives every day and exercise a fresh id, and no starting numbers', () => {
    const days = templateDays(upperLower)
    const ids = [...days.map((d) => d.id), ...days.flatMap((d) => d.exercises.map((e) => e.id))]
    expect(new Set(ids).size).toBe(ids.length)
    expect(days.flatMap((d) => d.exercises).every((e) => e.seed === undefined)).toBe(true)
  })

  it('fills an empty program, keeping its effort scale', () => {
    const program = applyTemplate(EMPTY_PROGRAM, upperLower, () => false)
    expect(activeDays(program).map((d) => d.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(program.effortScale).toBe(EMPTY_PROGRAM.effortScale)
    expect(missingSeeds(program)).toHaveLength(22)
  })

  it('replaces a program: days with history are archived, others deleted', () => {
    const bench = exerciseFromBank(BANK[0], 'bench')
    const existing: Program = {
      id: 'main',
      effortScale: 'rpe',
      days: [
        { id: 'logged', name: 'Push', exercises: [bench] },
        { id: 'never', name: 'Pull', exercises: [] },
        { id: 'old', name: 'Old', archived: true, exercises: [] },
      ],
    }
    const program = applyTemplate(existing, upperLower, (id) => id === 'logged')
    expect(program.days.map((d) => [d.name, !!d.archived])).toEqual([
      ['Push', true],
      ['Old', true],
      ['Upper A', false],
      ['Lower A', false],
      ['Upper B', false],
      ['Lower B', false],
    ])
    expect(program.effortScale).toBe('rpe')
  })
})

describe('guided seeding', () => {
  const fromBank = (name: string) => exerciseFromBank(findBankExercise(name)!)

  it('finds a bank exercise by name, ignoring case and punctuation', () => {
    expect(findBankExercise('bench press')?.id).toBe('bench-press')
    expect(findBankExercise('Pull Up')?.id).toBe('pull-up')
    expect(findBankExercise('Zercher Squat')).toBeUndefined()
  })

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

  it('leaves exercises that are not in the bank blank', () => {
    expect(seedPrefill({ ...fromBank('Bench Press'), name: 'Spoto Press' })).toEqual({ weight: '', reps: '' })
  })

  it('asks for a stack only for cable and machine exercises without one', () => {
    expect(needsStack(fromBank('Lat Pulldown'))).toBe(true)
    expect(needsStack({ ...fromBank('Lat Pulldown'), loads: [10, 20] })).toBe(false)
    expect(needsStack(fromBank('Bench Press'))).toBe(false)
  })
})
