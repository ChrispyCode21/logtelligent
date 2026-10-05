// Ready-made programs (SPEC §9.1, slice 3). A template produces a normal, fully editable program.
import { BANK, exerciseFromBank } from './bank'
import { removeDay } from './program'
import type { Program, ProgramDay } from './types'

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
 * Replace the program's days with a template's (SPEC §9.1, slice 3). Days with history are
 * archived and the rest deleted, as with any delete (§6.1); the effort scale is kept.
 */
export function applyTemplate(
  program: Program,
  template: ProgramTemplate,
  dayHasHistory: (dayId: string) => boolean,
): Program {
  const cleared = program.days
    .filter((d) => !d.archived)
    .reduce((p, d) => removeDay(p, d.id, dayHasHistory(d.id)), program)
  return { ...cleared, days: [...cleared.days, ...templateDays(template)] }
}
