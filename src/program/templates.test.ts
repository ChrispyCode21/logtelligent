import { describe, expect, it } from 'vitest'
import { BANK, exerciseFromBank } from './bank'
import { activeDays, clearProgram, EMPTY_PROGRAM, missingSeeds } from './program'
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
    const program = applyTemplate(EMPTY_PROGRAM, upperLower)
    expect(activeDays(program).map((d) => d.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(program.effortScale).toBe(EMPTY_PROGRAM.effortScale)
    expect(missingSeeds(program)).toHaveLength(22)
  })

  it('changing programs clears the active days: with history archived, others deleted (SPEC §9.4 slice 3)', () => {
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
    const cleared = clearProgram(existing, (id) => id === 'logged')
    expect(cleared.days.map((d) => [d.name, !!d.archived])).toEqual([
      ['Push', true],
      ['Old', true],
    ])
    expect(cleared.effortScale).toBe('rpe')
    const program = applyTemplate(cleared, upperLower)
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

  it("passes each template exercise through adapt, e.g. to take your gym's setup (SPEC §9.4 slice 2)", () => {
    const program = applyTemplate(EMPTY_PROGRAM, upperLower, (e) => ({ ...e, unilateral: true }))
    expect(
      activeDays(program)
        .flatMap((d) => d.exercises)
        .every((e) => e.unilateral),
    ).toBe(true)
  })
})
