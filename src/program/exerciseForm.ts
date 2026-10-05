// The exercise form's pure parts: fields as typed, validation, and the exercise they describe (SPEC §6.1).
import type { EquipmentType, Tier } from '../engine'
import { MAX_RELATIVE_JUMP } from './program'
import { hasInvalidLoads, parseLoads, toSeed, usesStack, validateSeed } from './seeding'
import type { ProgramExercise } from './types'

export interface ExerciseFormFields {
  name: string
  tier: Tier
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

/** Starting numbers are optional here (the seed gate asks later, SPEC §5.1), but checked once any are typed. */
const hasSeed = (form: ExerciseFormFields) =>
  form.seedWeight !== '' || (form.tier === 'primary' && form.seedReps !== '')

const isWholeNumber = (s: string, min: number) => s !== '' && Number.isInteger(Number(s)) && Number(s) >= min

/** What's wrong with the form; empty when it can be saved. */
export function validateExerciseForm(form: ExerciseFormFields): string[] {
  const errors: string[] = []
  const loads = parseLoads(form.loads)
  if (!form.name.trim()) errors.push('Name is required.')
  if (!isWholeNumber(form.min, 1) || !isWholeNumber(form.max, 1) || Number(form.max) < Number(form.min)) {
    errors.push('Rep range needs whole numbers, with the top at least the bottom.')
  }
  if (!isWholeNumber(form.sets, 1)) errors.push('Sets must be at least 1.')
  if (hasInvalidLoads(loads)) errors.push('Loads must be numbers, e.g. 99, 110, 121.')
  if (usesStack(form.equipment) && !loads)
    errors.push('Enter the stack weights for cable and machine exercises.')
  if (hasSeed(form)) errors.push(...validateSeed({ weight: form.seedWeight, reps: form.seedReps }, form.tier))
  return errors
}

/** The exercise a valid form describes. Editing keeps `initial`'s id and any other stored fields. */
export function fromForm(
  form: ExerciseFormFields,
  initial?: ProgramExercise,
  newId: () => string = () => crypto.randomUUID(),
): ProgramExercise {
  const repRange = { min: Number(form.min), max: Number(form.max) }
  return {
    ...initial,
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
      ? toSeed({ weight: form.seedWeight, reps: form.seedReps }, form.tier, repRange)
      : undefined,
  }
}
