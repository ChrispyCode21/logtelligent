// Entering starting numbers (SPEC §5.1): the exercise form and the guided walkthrough (SPEC §9.1, slice 3).
import { snapDown, type EquipmentType, type RepRange, type Seed, type Tier } from '../engine'
import { findBankExercise } from './bank'
import type { ProgramExercise } from './types'

const steps = (start: number, step: number, max: number) =>
  Array.from({ length: Math.floor((max - start) / step) + 1 }, (_, i) => start + i * step)

/** Quick picks for a cable or machine weight stack. */
export const STACK_PRESETS = [
  { id: '5', label: '5 lb steps', loads: steps(5, 5, 300) },
  { id: '10', label: '10 lb steps', loads: steps(10, 10, 300) },
] as const

export type StackPresetId = (typeof STACK_PRESETS)[number]['id']

/** A stack pick: a preset, or 'custom' with the list typed for it. */
export interface StackPick {
  choice: StackPresetId | 'custom'
  custom: string
}

/** The loads a stack pick gives; undefined for an empty custom list. */
export function stackLoads(pick: StackPick): number[] | undefined {
  if (pick.choice === 'custom') return parseLoads(pick.custom)
  return [...STACK_PRESETS.find((p) => p.id === pick.choice)!.loads]
}

/** A typed list of loads ("99, 110, 121"), or undefined when empty. Entries may not be valid numbers. */
export function parseLoads(text: string): number[] | undefined {
  const parts = text.split(/[\s,]+/).filter(Boolean)
  if (parts.length === 0) return undefined
  return parts.map(Number)
}

/** Some typed load isn't a weight. */
export const hasInvalidLoads = (loads: number[] | undefined) =>
  !!loads?.some((l) => !Number.isFinite(l) || l < 0)

/** Cable and machine stacks are the gym's, so these exercises must be given theirs (SPEC §6.2). */
export const usesStack = (equipment: EquipmentType) => equipment === 'cable' || equipment === 'machine'

/** An exercise that uses a stack but hasn't been given one. */
export const needsStack = (e: ProgramExercise) => usesStack(e.equipment) && !e.loads?.length

/** Starting numbers as typed. */
export interface SeedInput {
  weight: string
  reps: string
}

/** What's wrong with typed starting numbers. Accessories enter a weight only (SPEC §5.1). */
export function validateSeed(input: SeedInput, tier: Tier): string[] {
  const errors: string[] = []
  const weight = Number(input.weight)
  if (input.weight === '' || !Number.isFinite(weight) || weight < 0)
    errors.push('Starting weight must be a number.')
  const reps = Number(input.reps)
  if (tier === 'primary' && !(input.reps !== '' && Number.isInteger(reps) && reps >= 1)) {
    errors.push('Starting reps must be at least 1.')
  }
  return errors
}

/** Valid typed starting numbers as a seed. */
export function toSeed(input: SeedInput, tier: Tier, repRange: RepRange): Seed {
  // Accessory seeds are a weight at the bottom of the range (SPEC §5.1).
  return { weight: Number(input.weight), reps: tier === 'primary' ? Number(input.reps) : repRange.min }
}

// The exercise form's placeholder for an accessory's starting weight when there's no bank weight.
const ACCESSORY_PLACEHOLDER: Record<EquipmentType, string> = {
  barbell: '65',
  dumbbell: '15',
  cable: '',
  machine: '',
  bodyweight: '0',
}

/** Typed loads, lightest first, if there are any and they're all weights. */
const usableLoads = (loads: readonly number[] | undefined) =>
  loads?.length && !hasInvalidLoads([...loads]) ? loads.toSorted((a, b) => a - b) : undefined

/** A bank weight snapped down onto the loads, however they were typed; unchanged without usable loads. */
function snapBankWeight(weight: number, loads: readonly number[] | undefined): number {
  const usable = usableLoads(loads)
  return usable ? snapDown(weight, usable) : weight
}

/**
 * The exercise form's placeholder starting weight (SPEC §9.1, slice 2): the bank's weight, snapped
 * down onto the exercise's typed loads (SPEC §9.2, slice 0). Without one, accessories get a general
 * suggestion, or the lightest typed load.
 */
export function formSeedPlaceholder(
  tier: Tier,
  equipment: EquipmentType,
  loads: number[] | undefined,
  bankWeight?: number,
): string | undefined {
  if (bankWeight !== undefined) return String(snapBankWeight(bankWeight, loads))
  if (tier === 'primary') return undefined
  return ACCESSORY_PLACEHOLDER[equipment] || usableLoads(loads)?.[0]?.toString() || ''
}

/**
 * Starting numbers to pre-fill: the lift's latest weight when it has history (SPEC §9.4 slice 2),
 * else a bank exercise's placeholder weight, snapped down onto the stack if one is given; and, for
 * primaries, the top of the rep range. Others start blank.
 */
export function seedPrefill(
  e: ProgramExercise,
  stack?: readonly number[],
  liftWeight?: number,
): { weight: string; reps: string } {
  const weight = liftWeight ?? findBankExercise(e.name)?.seedPlaceholder
  if (weight === undefined) return { weight: '', reps: '' }
  return {
    weight: String(snapBankWeight(weight, stack)),
    reps: e.tier === 'primary' ? String(e.repRange.max) : '',
  }
}

/**
 * What's wrong with a walkthrough step: the stack, when it asks for one (SPEC §9.1, slice 3),
 * then the starting numbers.
 */
export function validateSeedStep(
  input: SeedInput,
  tier: Tier,
  askStack: boolean,
  loads: number[] | undefined,
): string[] {
  const stackError =
    askStack && (!loads || hasInvalidLoads(loads)) ? ['Enter the stack weights, e.g. 10, 20, 30.'] : []
  return [...stackError, ...validateSeed(input, tier)]
}
