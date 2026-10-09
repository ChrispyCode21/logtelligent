import { describe, expect, it } from 'vitest'
import type { ProgramExercise, Program } from './types'
import {
  activeDays,
  addDay,
  addExercise,
  clearProgram,
  EMPTY_PROGRAM,
  missingSeeds,
  moveDay,
  moveExercise,
  removeDay,
  removeExercise,
} from './program'

const exercise = (id: string, seeded = true): ProgramExercise => ({
  id,
  name: id,
  tier: 'accessory',
  repRange: { min: 8, max: 12 },
  targetRpe: 8,
  sets: 3,
  equipment: 'dumbbell',
  maxRelativeJump: 0.1,
  unilateral: false,
  seed: seeded ? { weight: 20, reps: 8 } : undefined,
})

function program(): Program {
  let p = EMPTY_PROGRAM
  for (const id of ['a', 'b', 'c']) p = addDay(p, { id, name: id.toUpperCase(), exercises: [] })
  p = addExercise(p, 'a', exercise('curl'))
  p = addExercise(p, 'a', exercise('raise'))
  return p
}

const dayNames = (p: Program) => activeDays(p).map((d) => d.name)

describe('program editing', () => {
  it('starts a new program on the Reps left effort scale (SPEC §5.6)', () => {
    expect(EMPTY_PROGRAM.effortScale).toBe('repsLeft')
  })

  it('moves days up and down, ignoring moves past either end', () => {
    expect(dayNames(moveDay(program(), 'c', -1))).toEqual(['A', 'C', 'B'])
    expect(dayNames(moveDay(program(), 'a', -1))).toEqual(['A', 'B', 'C'])
  })

  it('moving past an archived day swaps with the next visible one', () => {
    const p = removeDay(program(), 'b', true)
    expect(dayNames(moveDay(p, 'c', -1))).toEqual(['C', 'A'])
  })

  it('removing a day with history archives it; without history deletes it (SPEC §6.1)', () => {
    expect(removeDay(program(), 'b', true).days.find((d) => d.id === 'b')?.archived).toBe(true)
    expect(removeDay(program(), 'b', false).days.map((d) => d.id)).toEqual(['a', 'c'])
  })

  it('removing an exercise with history archives it; without history deletes it', () => {
    const archived = removeExercise(program(), 'curl', true)
    expect(archived.days[0].exercises.map((e) => [e.id, !!e.archived])).toEqual([
      ['curl', true],
      ['raise', false],
    ])
    expect(activeDays(archived)[0].exercises.map((e) => e.id)).toEqual(['raise'])
    expect(removeExercise(program(), 'curl', false).days[0].exercises.map((e) => e.id)).toEqual(['raise'])
  })

  it('reorders exercises within a day', () => {
    const p = moveExercise(program(), 'a', 'raise', -1)
    expect(p.days[0].exercises.map((e) => e.id)).toEqual(['raise', 'curl'])
  })
})

describe('7.A Seed gate', () => {
  it('A12: any active exercise without a seed blocks starting a session', () => {
    const p = addExercise(program(), 'b', exercise('row', false))
    expect(missingSeeds(p).map((e) => e.id)).toEqual(['row'])
    expect(missingSeeds(removeExercise(p, 'row', false))).toEqual([])
  })
})

describe('changing programs (SPEC §5.5)', () => {
  it('clears the active days: with history archived, others deleted; archived days and the scale stay', () => {
    const program: Program = {
      id: 'main',
      effortScale: 'perceived',
      days: [
        { id: 'logged', name: 'Push', exercises: [exercise('bench')] },
        { id: 'never', name: 'Pull', exercises: [] },
        { id: 'old', name: 'Old', archived: true, exercises: [] },
      ],
    }
    const cleared = clearProgram(program, (id) => id === 'logged')
    expect(cleared.days.map((d) => [d.id, !!d.archived])).toEqual([
      ['logged', true],
      ['old', true],
    ])
    expect(activeDays(cleared)).toEqual([])
    expect(cleared.effortScale).toBe('perceived')
  })
})
