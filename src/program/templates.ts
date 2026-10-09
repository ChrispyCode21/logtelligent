// Ready-made programs (SPEC §9.1, slice 3). A template produces a normal, fully editable program.
import { BANK, exerciseFromBank } from './bank'
import type { Program, ProgramDay, ProgramExercise } from './types'

export interface ProgramTemplate {
  id: string
  name: string
  description: string
  /** Each day's exercises are bank ids, in session order. */
  days: { name: string; exercises: string[] }[]
}

export const TEMPLATES: ProgramTemplate[] = [
  {
    id: 'upper-lower-4',
    name: '4-day Upper/Lower',
    description:
      'Four training days: upper body and lower body, twice each, with different exercises on each pass. 5–6 exercises a day.',
    days: [
      {
        name: 'Upper A',
        exercises: [
          'bench-press',
          'barbell-row',
          'dumbbell-shoulder-press',
          'lat-pulldown',
          'lateral-raise',
          'triceps-pushdown',
        ],
      },
      {
        name: 'Lower A',
        exercises: ['back-squat', 'romanian-deadlift', 'leg-press', 'lying-leg-curl', 'standing-calf-raise'],
      },
      {
        name: 'Upper B',
        exercises: [
          'overhead-press',
          'pull-up',
          'incline-dumbbell-press',
          'seated-cable-row',
          'dumbbell-curl',
          'face-pull',
        ],
      },
      {
        name: 'Lower B',
        exercises: [
          'deadlift',
          'bulgarian-split-squat',
          'leg-extension',
          'seated-leg-curl',
          'hanging-leg-raise',
        ],
      },
    ],
  },
]

/** The template's days as new program days, with fresh ids and no starting numbers. */
export function templateDays(template: ProgramTemplate): ProgramDay[] {
  return template.days.map((day) => ({
    id: crypto.randomUUID(),
    name: day.name,
    exercises: day.exercises.map((bankId) => {
      const e = BANK.find((b) => b.id === bankId)
      if (!e) throw new Error(`Template ${template.id} uses unknown bank exercise ${bankId}`)
      return exerciseFromBank(e)
    }),
  }))
}

/**
 * Add a template's days to a program with no active days (SPEC §9.1 slice 3; switching from another
 * program clears it first, §9.4 slice 3). Archived days stay, and the effort scale is kept. Each
 * template exercise joins the lift of the same name (§9.4 slice 2); `adapt` gives it your gym's setup.
 */
export function applyTemplate(
  program: Program,
  template: ProgramTemplate,
  adapt: (exercise: ProgramExercise) => ProgramExercise = (e) => e,
): Program {
  const days = templateDays(template).map((d) => ({ ...d, exercises: d.exercises.map(adapt) }))
  return { ...program, days: [...program.days, ...days] }
}
