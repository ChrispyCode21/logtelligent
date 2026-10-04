import { describe, expect, it } from 'vitest'
import { defaultLoads } from '../engine'
import { warmupRamp, warmupText } from './warmup'

describe('warm-up banner (SPEC §5.2)', () => {
  it('ramps to bench 225 on a barbell: 45 x 10, 110 x 5, 155 x 3, 190 x 1', () => {
    expect(warmupText('Bench Press', 225, defaultLoads('barbell'))).toBe(
      'Warm up for Bench Press (225): 5–10 min easy cardio, then ramp: 45 × 10, 110 × 5, 155 × 3, 190 × 1.',
    )
  })

  it('drops steps that do not climb on a light dumbbell', () => {
    // 50% of 15 = 7.5 snaps to the lightest 10 (no climb), 70% likewise; 85% = 12.75 -> 12.5.
    expect(warmupRamp(15, defaultLoads('dumbbell'))).toEqual([
      { weight: 10, reps: 10 },
      { weight: 12.5, reps: 1 },
    ])
  })

  it('shows only the cardio line with nothing to ramp to (unweighted bodyweight)', () => {
    expect(warmupText('Pull-up', 0, defaultLoads('bodyweight'))).toBe(
      'Warm up for Pull-up: 5–10 min easy cardio and a few easy reps.',
    )
  })
})
