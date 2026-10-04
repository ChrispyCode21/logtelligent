import { describe, expect, it } from 'vitest'
import type { Session } from './db'
import { backupFilename, buildBackup, parseBackup } from './backup'

const sessions: Session[] = [
  {
    id: 1,
    dayId: 'upper-a',
    startedAt: '2026-10-01T10:00:00Z',
    finishedAt: '2026-10-01T11:00:00Z',
    exercises: [{ exerciseId: 'bench', sets: [{ weight: 225, reps: 4, rpe: 8 }] }],
  },
]
const program = { id: 'main' as const, days: [{ id: 'upper-a', name: 'Upper A', exercises: [] }] }

describe('JSON backup (SPEC §2)', () => {
  it('names the file by local date', () => {
    expect(backupFilename(new Date(2026, 9, 4, 23, 30))).toBe('logtelligent-2026-10-04.json')
  })

  it('round-trips through JSON', () => {
    const backup = buildBackup(program, sessions, new Date('2026-10-04T12:00:00Z'))
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup)
  })

  it('accepts a backup with no program yet', () => {
    expect(parseBackup(JSON.stringify(buildBackup(undefined, [], new Date()))).program).toBeNull()
  })

  it('rejects files that are not a usable backup, with a readable reason', () => {
    expect(() => parseBackup('not json')).toThrow('not valid JSON')
    expect(() => parseBackup('{"hello":1}')).toThrow('not a Logtelligent backup')
    const newer = { ...buildBackup(program, sessions, new Date()), format: 99 }
    expect(() => parseBackup(JSON.stringify(newer))).toThrow('newer version')
    const damaged = { ...buildBackup(program, sessions, new Date()), sessions: [{ id: 1 }] }
    expect(() => parseBackup(JSON.stringify(damaged))).toThrow('incomplete or damaged')
  })
})
