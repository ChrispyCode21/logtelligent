import { describe, expect, it } from 'vitest'
import type { Program, ProgramExercise } from '../program/types'
import type { Session } from '../session/types'
import { historyGroups } from './picker'

const exercise = (id: string, archived?: boolean): ProgramExercise => ({
  id,
  name: id,
  tier: 'accessory',
  repRange: { min: 8, max: 12 },
  targetRpe: 8,
  sets: 3,
  equipment: 'dumbbell',
  maxRelativeJump: 0.1,
  unilateral: false,
  archived,
})

const program: Program = {
  id: 'main',
  effortScale: 'rpe',
  days: [
    {
      id: 'a',
      name: 'Upper A',
      exercises: [exercise('bench'), exercise('fly', true), exercise('dip', true)],
    },
    { id: 'b', name: 'Lower A', exercises: [] },
    {
      id: 'old',
      name: 'Old day',
      archived: true,
      exercises: [exercise('row'), exercise('shrug'), exercise('curl', true)],
    },
  ],
}

/** A finished session that logged one set of each exercise named. */
const logged = (...ids: string[]): Session => ({
  id: 1,
  startedAt: '2026-10-01T10:00:00Z',
  finishedAt: '2026-10-01T11:00:00Z',
  exercises: ids.map((exerciseId) => ({ exerciseId, sets: [{ weight: 20, reps: 10 }] })),
})

const labels = (groups: ReturnType<typeof historyGroups>) =>
  groups.map((g) => [g.label, g.exercises.map((e) => e.id)])

describe('the History picker (SPEC §5.3)', () => {
  it('groups active exercises by day, leaving out days with none', () => {
    expect(labels(historyGroups(program, []))).toEqual([['Upper A', ['bench']]])
  })

  it('adds archived exercises, and exercises on archived days, that have history', () => {
    expect(labels(historyGroups(program, [logged('fly', 'row')]))).toEqual([
      ['Upper A', ['bench']],
      ['Archived', ['fly', 'row']],
    ])
  })

  it('lists an archived exercise on an archived day once, and keeps only the archived day’s exercises with history', () => {
    expect(labels(historyGroups(program, [logged('curl', 'row')]))).toEqual([
      ['Upper A', ['bench']],
      ['Archived', ['row', 'curl']],
    ])
  })

  it('leaves out an archived exercise whose only sets are in the open session (SPEC §5.3)', () => {
    const open = { ...logged('fly'), finishedAt: undefined }
    expect(labels(historyGroups(program, [open]))).toEqual([['Upper A', ['bench']]])
  })
})
