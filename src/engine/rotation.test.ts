import { describe, expect, it } from 'vitest'
import { nextDay } from '.'

const days = [
  { id: 'upper-a', name: 'Upper A' },
  { id: 'lower-a', name: 'Lower A' },
  { id: 'upper-b', name: 'Upper B' },
  { id: 'lower-b', name: 'Lower B' },
]

describe('7.F Rotation', () => {
  it('F1: no sessions logged yet starts at Upper A', () => {
    expect(nextDay(days)?.name).toBe('Upper A')
  })

  it('F2: last logged Upper B gives Lower B', () => {
    expect(nextDay(days, 'upper-b')?.name).toBe('Lower B')
  })

  it('F3: last logged Lower B wraps to Upper A, the start of a new week', () => {
    expect(nextDay(days, 'lower-b')?.name).toBe('Upper A')
  })

  it('F4: overriding Upper A -> Upper B and logging it continues the rotation from Upper B', () => {
    // Last logged was Upper A, so Lower A was next; Upper B was logged instead.
    expect(nextDay(days, 'upper-a')?.name).toBe('Lower A')
    expect(nextDay(days, 'upper-b')?.name).toBe('Lower B')
  })

  it('a last day that is no longer in the rotation starts again at the first day', () => {
    expect(nextDay(days, 'archived-day')?.name).toBe('Upper A')
  })

  it('an empty rotation has no next day', () => {
    expect(nextDay([], 'upper-a')).toBeUndefined()
  })
})
