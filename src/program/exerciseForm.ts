// The exercise form's pure parts: fields as typed, validation, and the exercise they describe (SPEC §6.1).
import type { EquipmentType, SchemeId, Tier } from '../engine'
import { LINEAR_INCREMENT, MAX_RELATIVE_JUMP } from './program'
import { hasInvalidLoads, parseLoads, seedHasReps, toSeed, usesStack, validateSeed } from './seeding'
import type { ProgramExercise } from './types'

export interface ExerciseFormFields {
  name: string
  tier: Tier
  scheme: SchemeId
  /** Linear's increment (SPEC §6.10). */
  increment: string
  /** Linear's one Reps number; the range (`min`, `max`) is kept for switching back. */
  reps: string
  min: string
  max: string
  sets: string
  equipment: EquipmentType
  targetRpe: number
  unilateral: boolean
  loads: string
  seedWeight: string
  seedReps: string
}

/** The form for an exercise; blank for a custom one. A bank exercise comes in via `exerciseFromBank`. */
export function toForm(e?: ProgramExercise): ExerciseFormFields {
  return {
    name: e?.name ?? '',
    tier: e?.tier ?? 'primary',
    scheme: e?.progression?.scheme ?? 'adaptive',
    increment: String(e?.progression?.increment ?? LINEAR_INCREMENT.initial),
    reps: String(e?.repRange.max ?? ''),
    min: String(e?.repRange.min ?? ''),
    max: String(e?.repRange.max ?? ''),
    sets: String(e?.sets ?? 3),
    equipment: e?.equipment ?? 'barbell',
    targetRpe: e?.targetRpe ?? 8,
    unilateral: e?.unilateral ?? false,
    loads: e?.loads?.join(', ') ?? '',
    seedWeight: e?.seed ? String(e.seed.weight) : '',
    seedReps: e?.seed ? String(e.seed.reps) : '',
  }
}

/** Change the tier. Bodyweight is accessory-only, so a primary moves to barbell (SPEC §6.1). */
export function withTier(form: ExerciseFormFields, tier: Tier): ExerciseFormFields {
  const equipment = tier === 'primary' && form.equipment === 'bodyweight' ? 'barbell' : form.equipment
  return { ...form, tier, equipment }
}

/**
 * Change the scheme (SPEC §6.1). Linear's Reps starts at the top of the range; switching back in the
 * same open form finds the range as it was.
 */
export function withScheme(form: ExerciseFormFields, scheme: SchemeId): ExerciseFormFields {
  return { ...form, scheme, reps: scheme === 'linear' && form.scheme !== 'linear' ? form.max : form.reps }
}

const linear = (form: ExerciseFormFields) => form.scheme === 'linear'

/** Starting numbers have reps for an Adaptive primary only (SPEC §5.1). */
export const formSeedHasReps = (form: ExerciseFormFields) => seedHasReps(form.tier, form.scheme)

/** Starting numbers are optional here (the seed gate asks later, SPEC §5.1), but checked once any are typed. */
const hasSeed = (form: ExerciseFormFields) =>
  form.seedWeight !== '' || (formSeedHasReps(form) && form.seedReps !== '')

const isIncrement = (s: string) => {
  const n = Number(s)
  return s.trim() !== '' && Number.isFinite(n) && n >= LINEAR_INCREMENT.min && n <= LINEAR_INCREMENT.max
}

const isWholeNumber = (s: string, min: number) => s !== '' && Number.isInteger(Number(s)) && Number(s) >= min

/** What's wrong with the form; empty when it can be saved. */
export function validateExerciseForm(form: ExerciseFormFields): string[] {
  const errors: string[] = []
  const loads = parseLoads(form.loads)
  if (!form.name.trim()) errors.push('Name is required.')
  if (linear(form)) {
    if (!isWholeNumber(form.reps, 1)) errors.push('Reps must be a whole number, at least 1.')
    if (!isIncrement(form.increment))
      errors.push(`The increase must be from ${LINEAR_INCREMENT.min} to ${LINEAR_INCREMENT.max} lb.`)
  } else if (
    !isWholeNumber(form.min, 1) ||
    !isWholeNumber(form.max, 1) ||
    Number(form.max) < Number(form.min)
  ) {
    errors.push('Rep range needs whole numbers, with the top at least the bottom.')
  }
  if (!isWholeNumber(form.sets, 1)) errors.push('Sets must be at least 1.')
  if (hasInvalidLoads(loads)) errors.push('Loads must be numbers, e.g. 99, 110, 121.')
  if (usesStack(form.equipment) && !loads)
    errors.push('Enter the stack weights for cable and machine exercises.')
  if (hasSeed(form))
    errors.push(...validateSeed({ weight: form.seedWeight, reps: form.seedReps }, formSeedHasReps(form)))
  return errors
}

/**
 * The exercise a valid form describes. Editing keeps `initial`'s id and any other stored fields; a
 * Linear exercise keeps its target RPE for switching back (SPEC §6.1).
 */
export function fromForm(
  form: ExerciseFormFields,
  initial?: ProgramExercise,
  newId: () => string = () => crypto.randomUUID(),
): ProgramExercise {
  const repRange = linear(form)
    ? { min: Number(form.reps), max: Number(form.reps) }
    : { min: Number(form.min), max: Number(form.max) }
  const { progression: _, ...kept } = initial ?? {}
  return {
    ...kept,
    id: initial?.id ?? newId(),
    name: form.name.trim(),
    tier: form.tier,
    repRange,
    targetRpe: form.targetRpe,
    sets: Number(form.sets),
    equipment: form.equipment,
    loads: parseLoads(form.loads),
    maxRelativeJump: MAX_RELATIVE_JUMP,
    unilateral: form.unilateral,
    seed: hasSeed(form)
      ? toSeed({ weight: form.seedWeight, reps: form.seedReps }, formSeedHasReps(form), repRange)
      : undefined,
    ...(linear(form) && { progression: { scheme: 'linear', increment: Number(form.increment) } }),
  }
}
