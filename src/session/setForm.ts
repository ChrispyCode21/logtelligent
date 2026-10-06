import { countedSets, type LoggedSet } from '../engine'

/** The set form's fields, as typed. */
export interface SetForm {
  weight: string
  reps: string
  rpe?: number
}

/** The form showing a logged set, to edit it. */
export function formFromSet(set: LoggedSet): SetForm {
  return { weight: String(set.weight), reps: String(set.reps), rpe: set.rpe }
}

/**
 * The next prescribed set pre-fills its weight and reps from the previous one (SPEC §5.2), not from
 * an extra; set 1 from `first`, usually the suggestion. Effort isn't carried over: only a primary's
 * first set asks for it (SPEC §6.3, §9.3).
 */
export function prefill(sets: LoggedSet[], first?: { weight: number; reps: number }): SetForm {
  const last = countedSets(sets).at(-1)
  if (last) return { weight: String(last.weight), reps: String(last.reps) }
  if (first) return { weight: String(first.weight), reps: String(first.reps) }
  return { weight: '', reps: '' }
}

/** An extra set pre-fills from the set before it, without effort (SPEC §9.2, slice 2). */
export function prefillExtra(sets: LoggedSet[]): SetForm {
  const last = sets.at(-1)
  return last ? { weight: String(last.weight), reps: String(last.reps) } : { weight: '', reps: '' }
}

export interface SetRules {
  /** 0 lb is a valid set: bodyweight exercises, where the weight is added weight (SPEC §6.1), and substitutes. */
  allowZeroWeight: boolean
  /** Effort is required on this set (SPEC §6.3). */
  rpeRequired: boolean
}

/** The set the form describes, or undefined if it isn't a valid set yet. */
export function parseSetForm(form: SetForm, rules: SetRules): LoggedSet | undefined {
  const weight = Number(form.weight)
  const reps = Number(form.reps)
  const weightValid = form.weight !== '' && (weight > 0 || (rules.allowZeroWeight && weight === 0))
  const repsValid = form.reps !== '' && Number.isInteger(reps) && reps >= 0
  if (!weightValid || !repsValid || (rules.rpeRequired && form.rpe === undefined)) return undefined
  return { weight, reps, rpe: form.rpe }
}
