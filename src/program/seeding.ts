// The guided seed walkthrough's pure parts (SPEC §9.1, slice 3).
import { snapDown } from '../engine'
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

/** A typed list of loads ("99, 110, 121"), or undefined when empty. Entries may not be valid numbers. */
export function parseLoads(text: string): number[] | undefined {
  const parts = text.split(/[\s,]+/).filter(Boolean)
  if (parts.length === 0) return undefined
  return parts.map(Number)
}

/** Cable and machine stacks are the gym's, so an exercise without one must be given one (SPEC §6.2). */
export const needsStack = (e: ProgramExercise) =>
  (e.equipment === 'cable' || e.equipment === 'machine') && !e.loads?.length

/**
 * Starting numbers to pre-fill: a bank exercise's placeholder weight (snapped down onto the
 * stack, if one is given) and, for primaries, the top of the rep range. Others start blank.
 */
export function seedPrefill(e: ProgramExercise, stack?: readonly number[]): { weight: string; reps: string } {
  const bank = findBankExercise(e.name)
  if (!bank) return { weight: '', reps: '' }
  const weight = stack?.length ? snapDown(bank.seedPlaceholder, [...stack]) : bank.seedPlaceholder
  return { weight: String(weight), reps: e.tier === 'primary' ? String(e.repRange.max) : '' }
}
