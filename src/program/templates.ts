// Ready-made programs (SPEC §5.1). A template produces a normal, fully editable program.
import { BANK, exerciseFromBank } from './bank'
import type { Program, ProgramDay, ProgramExercise } from './types'

/** What a template can set for one of its exercises; the rest is the bank's default (SPEC §5.1). */
export type TemplateSettings = Partial<
  Pick<ProgramExercise, 'sets' | 'repRange' | 'targetRpe' | 'tier' | 'progression'>
>

/** A template exercise: a bank id, with any settings of its own. */
export type TemplateExercise = string | ({ bank: string } & TemplateSettings)

export interface ProgramTemplate {
  id: string
  name: string
  description: string
  /** Each day's exercises, in session order. */
  days: { name: string; exercises: TemplateExercise[] }[]
}

/** A novice lift: a primary on Linear at 5–5 (SPEC §5.1, §6.10). */
const novice = (bank: string, sets: number, increment = 5): TemplateExercise => ({
  bank,
  tier: 'primary',
  sets,
  repRange: { min: 5, max: 5 },
  progression: { scheme: 'linear', increment },
})

/** A main lift: a primary on Waves (SPEC §5.1, §6.11); Waves ignores sets and range, kept valid at 5–5. */
const main = (bank: string, increment: number): TemplateExercise => ({
  bank,
  tier: 'primary',
  sets: 3,
  repRange: { min: 5, max: 5 },
  progression: { scheme: 'waves', increment },
})

/** The same lift's volume work: an Adaptive accessory at 5 × 10 (SPEC §5.1). */
const volume = (bank: string): TemplateExercise => ({
  bank,
  tier: 'accessory',
  sets: 5,
  repRange: { min: 10, max: 10 },
})

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
  {
    id: 'novice-ab-3',
    name: '3-day Novice A/B',
    description:
      'Two workouts, A and B, alternated three days a week: squat, a press and deadlift. Weight goes up every successful session; a lift missed three times in a row resets 10% lighter.',
    days: [
      {
        name: 'Workout A',
        exercises: [novice('back-squat', 3), novice('bench-press', 3), novice('deadlift', 1, 10)],
      },
      {
        name: 'Workout B',
        exercises: [novice('back-squat', 3), novice('overhead-press', 3), novice('deadlift', 1, 10)],
      },
    ],
  },
  {
    id: 'main-lift-volume-4',
    name: '4-day Main Lift + Volume (5/3/1-style)',
    description:
      'Four training days, one main lift each: press, deadlift, bench and squat. The main lift runs in four-week waves of a training max, its last set as many reps as you can; then 5 × 10 of the same lift, and one accessory.',
    days: [
      { name: 'Press', exercises: [main('overhead-press', 5), volume('overhead-press'), 'lat-pulldown'] },
      { name: 'Deadlift', exercises: [main('deadlift', 10), volume('deadlift'), 'hanging-leg-raise'] },
      { name: 'Bench', exercises: [main('bench-press', 5), volume('bench-press'), 'seated-cable-row'] },
      { name: 'Squat', exercises: [main('back-squat', 10), volume('back-squat'), 'lying-leg-curl'] },
    ],
  },
]

/** The template's days as new program days, with fresh ids, its settings and no starting numbers. */
export function templateDays(template: ProgramTemplate): ProgramDay[] {
  return template.days.map((day) => ({
    id: crypto.randomUUID(),
    name: day.name,
    exercises: day.exercises.map((entry) => {
      const { bank, ...settings } = typeof entry === 'string' ? { bank: entry } : entry
      const e = BANK.find((b) => b.id === bank)
      if (!e) throw new Error(`Template ${template.id} uses unknown bank exercise ${bank}`)
      // Copied, so editing the program never changes the template.
      return structuredClone({ ...exerciseFromBank(e), ...settings })
    }),
  }))
}

/**
 * Add a template's days to a program with no active days (SPEC §5.1; switching from another
 * program clears it first, §5.5). Archived days stay, and the effort scale is kept. Each
 * template exercise joins the lift of the same name (§6.9); `adapt` gives it your gym's setup.
 */
export function applyTemplate(
  program: Program,
  template: ProgramTemplate,
  adapt: (exercise: ProgramExercise) => ProgramExercise = (e) => e,
): Program {
  const days = templateDays(template).map((d) => ({ ...d, exercises: d.exercises.map(adapt) }))
  return { ...program, days: [...program.days, ...days] }
}
