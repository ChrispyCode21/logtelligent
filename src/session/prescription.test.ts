import { describe, expect, it } from 'vitest'
import type { ExerciseConfig } from '../engine'
import { prescribedConfig, withPrescriptions } from './prescription'
import type { ExerciseLog } from './types'

const bench: ExerciseConfig = {
  id: 'bench',
  name: 'Bench Press',
  tier: 'primary',
  repRange: { min: 3, max: 5 },
  targetRpe: 8,
  sets: 3,
  equipment: 'barbell',
  maxRelativeJump: 0.1,
  unilateral: false,
}

describe('prescriptions (SPEC §6.8)', () => {
  it('saves each exercise’s rep range and set count, leaving exercises gone from the program as they are', () => {
    const logs: ExerciseLog[] = [
      { exerciseId: 'bench', sets: [{ weight: 225, reps: 5, rpe: 8 }] },
      { exerciseId: 'deleted', sets: [] },
    ]
    const saved = withPrescriptions(logs, (id) => (id === 'bench' ? bench : undefined))
    expect(saved).toEqual([{ ...logs[0], prescription: { repRange: { min: 3, max: 5 }, sets: 3 } }, logs[1]])
  })

  it('copies the range, so a later program edit can’t reach into a saved session', () => {
    const [log] = withPrescriptions([{ exerciseId: 'bench', sets: [] }], () => bench)
    expect(log.prescription!.repRange).not.toBe(bench.repRange)
  })

  it('judges by the saved range and set count, or the current ones without a saved prescription', () => {
    const log: ExerciseLog = {
      exerciseId: 'bench',
      sets: [],
      prescription: { repRange: { min: 5, max: 7 }, sets: 4 },
    }
    expect(prescribedConfig(bench, log)).toEqual({ ...bench, repRange: { min: 5, max: 7 }, sets: 4 })
    expect(prescribedConfig(bench, { exerciseId: 'bench', sets: [] })).toBe(bench)
  })
})
