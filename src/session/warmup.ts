import { snapDown, type LoggedSet } from '../engine'

const RAMP = [
  { fraction: 0.5, reps: 5 },
  { fraction: 0.7, reps: 3 },
  { fraction: 0.85, reps: 1 },
]
const OPENING_REPS = 10

/**
 * Warm-up ramp to a working weight (SPEC §5.2): the lightest load x 10, then
 * ~50%, ~70% and ~85% snapped down to available loads. Steps that don't climb
 * (or reach the working weight) are dropped.
 */
export function warmupRamp(workingWeight: number, loads: number[]): Omit<LoggedSet, 'rpe'>[] {
  if (loads.length === 0 || workingWeight <= loads[0]) return []
  const steps = [
    { weight: loads[0], reps: OPENING_REPS },
    ...RAMP.map((r) => ({ weight: snapDown(workingWeight * r.fraction, loads), reps: r.reps })),
  ]
  return steps.filter((s, i) => s.weight < workingWeight && (i === 0 || s.weight > steps[i - 1].weight))
}

export function warmupText(name: string, workingWeight: number, loads: number[]): string {
  const ramp = warmupRamp(workingWeight, loads)
  if (ramp.length === 0) return `Warm up for ${name}: 5–10 min easy cardio and a few easy reps.`
  const steps = ramp.map((s) => `${s.weight} × ${s.reps}`).join(', ')
  return `Warm up for ${name} (${workingWeight}): 5–10 min easy cardio, then ramp: ${steps}.`
}
