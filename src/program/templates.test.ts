import { describe, expect, it } from 'vitest'
import { BANK, exerciseFromBank } from './bank'
import { activeDays, clearProgram, EMPTY_PROGRAM, missingSeeds } from './program'
import { LINEAR_INCREMENT } from './program'
import { applyTemplate, TEMPLATES, templateDays, type ProgramTemplate } from './templates'
import type { Program } from './types'

const upperLower = TEMPLATES[0]
const novice = TEMPLATES[1]

describe('program templates (SPEC §5.1)', () => {
  it('uses only bank exercises, with settings the exercise form would accept (SPEC §6.1, §6.10)', () => {
    for (const t of TEMPLATES) {
      // templateDays throws on an unknown bank id.
      for (const e of templateDays(t).flatMap((d) => d.exercises)) {
        expect(e.repRange.min).toBeLessThanOrEqual(e.repRange.max)
        expect(e.tier === 'primary' && e.equipment === 'bodyweight').toBe(false)
        if (e.progression) {
          expect(e.repRange.min).toBe(e.repRange.max)
          expect(e.progression.increment).toBeGreaterThanOrEqual(LINEAR_INCREMENT.min)
          expect(e.progression.increment).toBeLessThanOrEqual(LINEAR_INCREMENT.max)
        }
      }
    }
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
    const program = applyTemplate(EMPTY_PROGRAM, upperLower)
    expect(activeDays(program).map((d) => d.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(program.effortScale).toBe(EMPTY_PROGRAM.effortScale)
    expect(missingSeeds(program)).toHaveLength(22)
  })

  it('adds its days after any archived ones, e.g. after changing programs (SPEC §5.5)', () => {
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
    const program = applyTemplate(
      clearProgram(existing, (id) => id === 'logged'),
      upperLower,
    )
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

  it("passes each template exercise through adapt, e.g. to take your gym's setup (SPEC §6.9)", () => {
    const program = applyTemplate(EMPTY_PROGRAM, upperLower, (e) => ({ ...e, unilateral: true }))
    expect(
      activeDays(program)
        .flatMap((d) => d.exercises)
        .every((e) => e.unilateral),
    ).toBe(true)
  })
})

describe('the 3-day Novice A/B template (SPEC §5.1)', () => {
  const days = templateDays(novice)
  const summary = (d: (typeof days)[number]) =>
    d.exercises.map((e) => [e.name, e.tier, e.sets, e.repRange, e.progression])
  const linear = (increment: number) => ({ scheme: 'linear', increment })
  const five = { min: 5, max: 5 }

  it('alternates Workout A and B, every exercise a primary on Linear at 5–5, +5 lb, the deadlift +10 lb', () => {
    expect(days.map((d) => d.name)).toEqual(['Workout A', 'Workout B'])
    expect(summary(days[0])).toEqual([
      ['Back Squat', 'primary', 3, five, linear(5)],
      ['Bench Press', 'primary', 3, five, linear(5)],
      ['Deadlift', 'primary', 1, five, linear(10)],
    ])
    expect(summary(days[1])).toEqual([
      ['Back Squat', 'primary', 3, five, linear(5)],
      ['Overhead Press', 'primary', 3, five, linear(5)],
      ['Deadlift', 'primary', 1, five, linear(10)],
    ])
  })

  it('says how it progresses and resets', () => {
    expect(novice.description).toMatch(/every successful session/)
    expect(novice.description).toMatch(/three times in a row resets 10% lighter/)
  })
})

describe('template settings (SPEC §5.1)', () => {
  const tiered: ProgramTemplate = {
    id: 'test',
    name: 'Test',
    description: '',
    days: [
      {
        name: 'Day 1',
        exercises: [
          { bank: 'back-squat', sets: 5, repRange: { min: 3, max: 3 }, targetRpe: 8.5 },
          {
            bank: 'deadlift',
            sets: 1,
            repRange: { min: 5, max: 5 },
            progression: { scheme: 'linear', increment: 10 },
          },
          'bench-press',
        ],
      },
      {
        name: 'Day 2',
        exercises: [{ bank: 'back-squat', tier: 'accessory', sets: 3, repRange: { min: 10, max: 10 } }],
      },
    ],
  }
  const bank = (id: string) =>
    exerciseFromBank(
      BANK.find((b) => b.id === id)!,
      'id',
    )
  const [day1, day2] = templateDays(tiered)
  const withoutId = <T extends { id: string }>(e: T) => {
    const { id: _, ...rest } = e
    return rest
  }

  it('gives an exercise the settings the template sets, and the bank defaults for the rest', () => {
    expect(withoutId(day1.exercises[0])).toEqual({
      ...withoutId(bank('back-squat')),
      sets: 5,
      repRange: { min: 3, max: 3 },
      targetRpe: 8.5,
    })
    expect(day1.exercises[1]).toMatchObject({
      name: 'Deadlift',
      sets: 1,
      progression: { scheme: 'linear', increment: 10 },
    })
  })

  it('gives an exercise with no settings the bank defaults, as before', () => {
    expect(withoutId(day1.exercises[2])).toEqual(withoutId(bank('bench-press')))
  })

  it('lets one bank exercise appear on several days with different settings, each joining its lift by name', () => {
    expect(day2.exercises[0]).toMatchObject({ name: 'Back Squat', tier: 'accessory', sets: 3 })
    expect(day1.exercises[0].name).toBe(day2.exercises[0].name)
    expect(day1.exercises[0].id).not.toBe(day2.exercises[0].id)
  })

  it('copies the settings, so editing the program leaves the template alone', () => {
    const [own] = templateDays(tiered)
    own.exercises[0].repRange.max = 99
    expect(templateDays(tiered)[0].exercises[0].repRange).toEqual({ min: 3, max: 3 })
  })
})
